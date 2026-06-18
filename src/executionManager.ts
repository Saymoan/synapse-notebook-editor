import * as vscode from 'vscode';
import { SynapseClient, SynapseConfig, LivyStatementKind, LivyStatementOutput } from './synapseClient';
import { AzureResourceManager } from './azureResourceManager';

export class SynapseExecutionManager {
    private client?: SynapseClient;
    private outputChannel: vscode.OutputChannel;
    private workspaceStatusBar: vscode.StatusBarItem;
    private executionStatusBar: vscode.StatusBarItem;
    private controller: vscode.NotebookController;

    constructor(private context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('Synapse Notebook');

        // Workspace/Pool info status bar (persistent, left side, higher priority)
        this.workspaceStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000);
        this.workspaceStatusBar.command = 'synapse-notebook.manageConfigurations';
        this.workspaceStatusBar.tooltip = 'Click to manage Synapse configurations';

        // Execution status bar (temporary, right side, for execution status)
        this.executionStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);

        this.controller = vscode.notebooks.createNotebookController(
            'synapse-livy',
            'synapse-notebook',
            'Synapse Spark (Livy)'
        );
        this.controller.supportsExecutionOrder = true;
        this.controller.executeHandler = (cells, notebook, controller) =>
            this.executeHandler(cells, notebook, controller);

        this.context.subscriptions.push(
            this.outputChannel,
            this.workspaceStatusBar,
            this.executionStatusBar,
            this.controller
        );

        this.updateWorkspaceStatusBar();

        this.context.subscriptions.push(
            vscode.window.onDidChangeActiveNotebookEditor(() => this.updateWorkspaceStatusBar())
        );
    }

    private updateWorkspaceStatusBar(): void {
        const editor = vscode.window.activeNotebookEditor;

        if (!editor || editor.notebook.notebookType !== 'synapse-notebook') {
            this.workspaceStatusBar.hide();
            return;
        }

        const config = this.context.globalState.get<SynapseConfig>('synapseConfig');

        if (config) {
            this.workspaceStatusBar.text = `$(database) ${config.workspaceName} | $(server-process) ${config.sparkPoolName}`;
            this.workspaceStatusBar.tooltip = `Synapse Workspace: ${config.workspaceName}\nSpark Pool: ${config.sparkPoolName}\n\nClick to manage configurations`;
        } else {
            this.workspaceStatusBar.text = `$(warning) No Synapse workspace configured`;
            this.workspaceStatusBar.tooltip = 'Click to configure Synapse workspace';
        }

        this.workspaceStatusBar.show();
    }

    refreshWorkspaceStatus(): void {
        this.updateWorkspaceStatusBar();
    }

    async configure(): Promise<void> {
        try {
            this.outputChannel.clear();
            this.outputChannel.show();
            this.outputChannel.appendLine('Starting Azure Synapse configuration...');
            this.outputChannel.appendLine('═'.repeat(60));

            const resourceManager = new AzureResourceManager();

            this.outputChannel.appendLine('\n🔐 Authenticating with Azure...');
            this.outputChannel.appendLine('Please sign in if prompted.');

            const selection = await resourceManager.selectAzureResources();

            if (!selection) {
                this.outputChannel.appendLine('\n✗ Configuration cancelled');
                return;
            }

            const config: SynapseConfig = {
                workspaceName: selection.workspaceName,
                sparkPoolName: selection.sparkPoolName,
                subscriptionId: selection.subscriptionId,
                resourceGroup: selection.resourceGroup
            };

            await this.context.globalState.update('synapseConfig', config);

            this.outputChannel.appendLine('\n✓ Configuration saved:');
            this.outputChannel.appendLine(`  Subscription: ${selection.subscriptionId}`);
            this.outputChannel.appendLine(`  Workspace: ${selection.workspaceName}`);
            this.outputChannel.appendLine(`  Resource Group: ${selection.resourceGroup}`);
            this.outputChannel.appendLine(`  Spark Pool: ${selection.sparkPoolName}`);

            this.client = new SynapseClient(config);

            this.outputChannel.appendLine('\n🔗 Connecting to Synapse workspace...');
            await this.client.authenticate();

            this.outputChannel.appendLine('✓ Successfully connected to Azure Synapse');
            this.updateWorkspaceStatusBar();

            vscode.window.showInformationMessage(
                `Connected to Synapse workspace: ${selection.workspaceName}`
            );

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`\n✗ Configuration failed: ${message}`);
            this.outputChannel.appendLine('\nTroubleshooting:');
            this.outputChannel.appendLine('  • Make sure you are logged into Azure (az login or VS Code Azure Account)');
            this.outputChannel.appendLine('  • Verify you have proper permissions (Contributor/Reader on subscription)');
            this.outputChannel.appendLine('  • Check that Synapse workspace and Spark pool exist');

            vscode.window.showErrorMessage(`Failed to configure Synapse: ${message}`);
            throw error;
        }
    }

    private async ensureClient(): Promise<boolean> {
        if (this.client) {
            return true;
        }

        const config = this.context.globalState.get<SynapseConfig>('synapseConfig');
        if (!config) {
            const result = await vscode.window.showWarningMessage(
                'No Synapse workspace configured. Would you like to configure one now?',
                'Configure', 'Cancel'
            );

            if (result === 'Configure') {
                await this.configure();
                return !!this.client;
            }
            return false;
        }

        try {
            this.client = new SynapseClient(config);
            await this.client.authenticate();
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Authentication failed: ${message}`);
            return false;
        }
    }

    // Called from the uploadAndExecute command (run-all path) and the controller's run button.
    async uploadAndExecute(notebookDocument: vscode.NotebookDocument): Promise<void> {
        await this.executeHandler(
            notebookDocument.getCells(),
            notebookDocument,
            this.controller
        );
    }

    private async executeHandler(
        cells: vscode.NotebookCell[],
        _notebook: vscode.NotebookDocument,
        controller: vscode.NotebookController
    ): Promise<void> {
        if (!await this.ensureClient()) {
            return;
        }

        const config = this.context.globalState.get<SynapseConfig>('synapseConfig');
        const poolName = config?.sparkPoolName;
        if (!poolName) {
            vscode.window.showErrorMessage('No Spark pool configured. Run "Configure Synapse Workspace" first.');
            return;
        }

        const codeCells = cells.filter(c => c.kind === vscode.NotebookCellKind.Code);
        if (codeCells.length === 0) {
            return;
        }

        this.outputChannel.clear();
        this.outputChannel.show();
        this.outputChannel.appendLine(`Executing ${codeCells.length} cell(s) via Livy on pool "${poolName}"`);
        this.outputChannel.appendLine('═'.repeat(60));

        this.updateStatusBar('$(sync~spin) Starting Spark session...', true);

        let sessionId: number | undefined;
        let executionOrder = 1;

        try {
            sessionId = await this.client!.createSession(poolName);
            this.outputChannel.appendLine(`Session ${sessionId} created — waiting for idle state...`);

            await this.client!.waitForSessionIdle(poolName, sessionId);
            this.outputChannel.appendLine(`Session ${sessionId} is idle.`);
            this.updateStatusBar('$(sync~spin) Running...', true);

            for (const cell of codeCells) {
                const execution = controller.createNotebookCellExecution(cell);
                execution.executionOrder = executionOrder++;
                execution.start(Date.now());

                if (execution.token.isCancellationRequested) {
                    execution.end(false, Date.now());
                    break;
                }

                let cellSuccess = false;
                try {
                    const source = cell.document.getText();
                    const kind = detectStatementKind(source);

                    const stmtId = await this.client!.submitStatement(poolName, sessionId, source, kind);
                    const output = await this.client!.waitForStatement(
                        poolName, sessionId, stmtId, execution.token
                    );

                    await execution.replaceOutput([buildCellOutput(output)]);
                    cellSuccess = output.status === 'ok';

                    if (!cellSuccess) {
                        this.outputChannel.appendLine(`Cell error: ${output.evalue}`);
                    }
                } catch (err) {
                    if (!execution.token.isCancellationRequested) {
                        const msg = err instanceof Error ? err.message : String(err);
                        await execution.replaceOutput([
                            new vscode.NotebookCellOutput([
                                vscode.NotebookCellOutputItem.error({ name: 'ExecutionError', message: msg })
                            ])
                        ]);
                        this.outputChannel.appendLine(`Error: ${msg}`);
                    }
                    execution.end(false, Date.now());
                    return; // fall through to finally; don't execute remaining cells
                }

                execution.end(cellSuccess, Date.now());

                if (!cellSuccess) {
                    break; // stop on cell-level error (bad output status)
                }
            }

            this.updateStatusBar('$(check) Done', false);

        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg !== 'Statement cancelled' && msg !== 'Session startup cancelled') {
                this.outputChannel.appendLine(`\n✗ ${msg}`);
                this.updateStatusBar('$(error) Execution failed', false);
                vscode.window.showErrorMessage(`Notebook execution failed: ${msg}`);
            } else {
                this.updateStatusBar('$(debug-stop) Cancelled', false);
            }
        } finally {
            if (sessionId !== undefined) {
                this.outputChannel.appendLine(`\nClosing session ${sessionId}...`);
                await this.client!.closeSession(poolName, sessionId);
                this.outputChannel.appendLine('Session closed.');
            }
        }
    }

    private updateStatusBar(text: string, spinning: boolean): void {
        this.executionStatusBar.text = text;
        this.executionStatusBar.show();

        if (!spinning) {
            setTimeout(() => this.executionStatusBar.hide(), 5000);
        }
    }

    dispose(): void {
        this.outputChannel.dispose();
        this.workspaceStatusBar.dispose();
        this.executionStatusBar.dispose();
        this.controller.dispose();
    }
}

function detectStatementKind(source: string): LivyStatementKind {
    const firstLine = source.trimStart().split('\n')[0];
    if (/^%%sql\b/.test(firstLine)) { return 'sql'; }
    if (/^%%scala\b/.test(firstLine)) { return 'spark'; }
    if (/^%%sparkr\b/.test(firstLine)) { return 'sparkr'; }
    return 'pyspark';
}

function buildCellOutput(output: LivyStatementOutput): vscode.NotebookCellOutput {
    if (output.status === 'error') {
        return new vscode.NotebookCellOutput([
            vscode.NotebookCellOutputItem.error({
                name: output.ename || 'Error',
                message: output.evalue || '',
                stack: output.traceback?.join('\n')
            })
        ]);
    }

    const items: vscode.NotebookCellOutputItem[] = [];
    const data = output.data || {};

    // Ordered richest-first so VS Code renders the best available MIME type
    if ('image/png' in data) {
        items.push(new vscode.NotebookCellOutputItem(
            Buffer.from(data['image/png'], 'base64'), 'image/png'
        ));
    }
    if ('text/html' in data) {
        items.push(new vscode.NotebookCellOutputItem(
            Buffer.from(data['text/html']), 'text/html'
        ));
    }
    if ('application/json' in data) {
        try {
            items.push(vscode.NotebookCellOutputItem.json(JSON.parse(data['application/json'])));
        } catch {
            items.push(vscode.NotebookCellOutputItem.text(data['application/json']));
        }
    }
    if ('text/plain' in data) {
        items.push(vscode.NotebookCellOutputItem.text(data['text/plain']));
    }

    if (items.length === 0) {
        items.push(vscode.NotebookCellOutputItem.text(''));
    }

    return new vscode.NotebookCellOutput(items);
}
