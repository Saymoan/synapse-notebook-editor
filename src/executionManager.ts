import * as vscode from 'vscode';
import { SynapseClient, SynapseConfig, NotebookRunStatus } from './synapseClient';
import { AzureResourceManager } from './azureResourceManager';

/**
 * Manages Synapse notebook execution and status tracking
 */
export class SynapseExecutionManager {
    private client?: SynapseClient;
    private outputChannel: vscode.OutputChannel;
    private workspaceStatusBar: vscode.StatusBarItem;
    private executionStatusBar: vscode.StatusBarItem;
    private currentRun?: { notebookName: string; runId: string };

    constructor(private context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('Synapse Notebook');
        
        // Workspace/Pool info status bar (persistent, left side, higher priority)
        this.workspaceStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000);
        this.workspaceStatusBar.command = 'synapse-notebook.manageConfigurations';
        this.workspaceStatusBar.tooltip = 'Click to manage Synapse configurations';
        
        // Execution status bar (temporary, right side, for execution status)
        this.executionStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        
        this.context.subscriptions.push(this.outputChannel, this.workspaceStatusBar, this.executionStatusBar);
        
        // Initialize workspace status bar
        this.updateWorkspaceStatusBar();
        
        // Update status bar when active editor changes
        this.context.subscriptions.push(
            vscode.window.onDidChangeActiveNotebookEditor(() => this.updateWorkspaceStatusBar())
        );
    }

    /**
     * Update workspace status bar with current configuration
     */
    private updateWorkspaceStatusBar(): void {
        const editor = vscode.window.activeNotebookEditor;
        
        // Only show for Synapse notebooks
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

    /**
     * Refresh workspace status bar (public method for external calls)
     */
    refreshWorkspaceStatus(): void {
        this.updateWorkspaceStatusBar();
    }

    /**
     * Configure Synapse connection with interactive Azure resource selection
     */
    async configure(): Promise<void> {
        try {
            this.outputChannel.clear();
            this.outputChannel.show();
            this.outputChannel.appendLine('Starting Azure Synapse configuration...');
            this.outputChannel.appendLine('═'.repeat(60));

            // Create resource manager
            const resourceManager = new AzureResourceManager();

            // Interactive selection workflow
            this.outputChannel.appendLine('\n🔐 Authenticating with Azure...');
            this.outputChannel.appendLine('Please sign in if prompted.');
            
            const selection = await resourceManager.selectAzureResources();

            if (!selection) {
                this.outputChannel.appendLine('\n✗ Configuration cancelled');
                return;
            }

            // Create configuration
            const config: SynapseConfig = {
                workspaceName: selection.workspaceName,
                sparkPoolName: selection.sparkPoolName,
                subscriptionId: selection.subscriptionId,
                resourceGroup: selection.resourceGroup
            };

            // Save configuration
            await this.context.globalState.update('synapseConfig', config);

            this.outputChannel.appendLine('\n✓ Configuration saved:');
            this.outputChannel.appendLine(`  Subscription: ${selection.subscriptionId}`);
            this.outputChannel.appendLine(`  Workspace: ${selection.workspaceName}`);
            this.outputChannel.appendLine(`  Resource Group: ${selection.resourceGroup}`);
            this.outputChannel.appendLine(`  Spark Pool: ${selection.sparkPoolName}`);

            // Initialize client
            this.client = new SynapseClient(config);
            
            // Authenticate
            this.outputChannel.appendLine('\n🔗 Connecting to Synapse workspace...');
            await this.client.authenticate();
            
            this.outputChannel.appendLine('✓ Successfully connected to Azure Synapse');
            
            // Update workspace status bar
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

    /**
     * Initialize client from saved configuration
     */
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

    /**
     * Upload and execute the current notebook
     */
    async uploadAndExecute(notebookDocument: vscode.NotebookDocument): Promise<void> {
        try {
            if (!await this.ensureClient()) {
                return;
            }

            // Get notebook name from file
            const uri = notebookDocument.uri;
            const fileName = uri.path.split('/').pop()!;
            const notebookName = fileName.replace(/\.(synapse|ipynb|json)$/, '');

            this.outputChannel.clear();
            this.outputChannel.show();
            this.outputChannel.appendLine(`Starting notebook execution: ${notebookName}`);
            this.outputChannel.appendLine('═'.repeat(60));

            // Serialize notebook content
            const cells = notebookDocument.getCells().map(cell => ({
                cell_type: cell.kind === vscode.NotebookCellKind.Markup ? 'markdown' : 'code',
                metadata: {},
                source: cell.document.getText().split('\n'),
                execution_count: cell.executionSummary?.executionOrder || null,
                outputs: cell.outputs ? this.serializeOutputs(cell.outputs) : []
            }));

            const notebookContent = {
                nbformat: 4,
                nbformat_minor: 2,
                metadata: {
                    language_info: { name: 'python' },
                    kernelspec: {
                        name: 'synapse_pyspark',
                        display_name: 'Synapse PySpark'
                    }
                },
                cells: cells
            };

            // Upload notebook
            this.outputChannel.appendLine(`📤 Uploading notebook to Synapse...`);
            this.updateStatusBar('$(sync~spin) Uploading notebook...', true);
            
            await this.client!.uploadNotebook(notebookName, notebookContent);
            this.outputChannel.appendLine(`✓ Upload complete`);

            // Execute notebook
            this.outputChannel.appendLine(`\n▶️  Starting execution via Pipeline...`);
            this.outputChannel.appendLine(`   (Creating temporary pipeline - this may take a few seconds)`);
            this.updateStatusBar('$(sync~spin) Creating pipeline...', true);
            
            const runId = await this.client!.executeNotebook(notebookName);
            this.currentRun = { notebookName, runId };
            
            this.outputChannel.appendLine(`✓ Pipeline execution started (Run ID: ${runId})`);
            this.outputChannel.appendLine(`\n⏳ Waiting for completion...`);

            // Poll for completion
            const finalStatus = await this.client!.waitForCompletion(
                notebookName,
                runId,
                (status) => this.onStatusUpdate(status)
            );

            // Cleanup temporary pipeline
            if ((this.client as any).lastPipelineName) {
                this.outputChannel.appendLine(`\n🧹 Cleaning up temporary pipeline...`);
                await this.client!.cleanupPipeline((this.client as any).lastPipelineName);
            }

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`\n✗ Error: ${message}`);
            this.updateStatusBar('$(error) Execution failed', false);
            vscode.window.showErrorMessage(`Notebook execution failed: ${message}`);
        }
    }

    /**
     * Handle status updates during execution
     */
    private onStatusUpdate(status: NotebookRunStatus): void {
        const timestamp = new Date().toLocaleTimeString();
        
        switch (status.status) {
            case 'Running':
                this.updateStatusBar(`$(sync~spin) Running...`, true);
                this.outputChannel.appendLine(`[${timestamp}] Status: Running`);
                break;
            
            case 'Succeeded':
                this.updateStatusBar(`$(check) Execution succeeded`, false);
                this.outputChannel.appendLine(`\n[${timestamp}] ✓ Pipeline execution completed successfully`);
                if (status.endTime) {
                    this.outputChannel.appendLine(`End time: ${status.endTime}`);
                }
                vscode.window.showInformationMessage('Notebook execution completed successfully!');
                break;
            
            case 'Failed':
                this.updateStatusBar(`$(error) Execution failed`, false);
                this.outputChannel.appendLine(`\n[${timestamp}] ✗ Pipeline execution failed`);
                if (status.error) {
                    this.outputChannel.appendLine(`Error: ${status.error}`);
                }
                this.outputChannel.appendLine(`\nTip: Check the Synapse Studio Monitor tab for detailed logs`);
                vscode.window.showErrorMessage(`Notebook execution failed: ${status.error || 'Unknown error'}`);
                break;
            
            case 'Cancelled':
                this.updateStatusBar(`$(debug-stop) Execution cancelled`, false);
                this.outputChannel.appendLine(`\n[${timestamp}] Execution was cancelled`);
                break;
        }
    }

    /**
     * Update execution status bar (used during notebook execution)
     */
    private updateStatusBar(text: string, spinning: boolean): void {
        this.executionStatusBar.text = text;
        this.executionStatusBar.show();
        
        if (!spinning) {
            setTimeout(() => this.executionStatusBar.hide(), 5000);
        }
    }

    /**
     * Serialize cell outputs for upload
     */
    private serializeOutputs(outputs: readonly vscode.NotebookCellOutput[]): any[] {
        return outputs.map(output => ({
            output_type: 'display_data',
            data: {
                'text/plain': output.items.map(item => 
                    new TextDecoder().decode(item.data)
                ).join('')
            },
            metadata: output.metadata
        }));
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.outputChannel.dispose();
        this.workspaceStatusBar.dispose();
        this.executionStatusBar.dispose();
    }
}
