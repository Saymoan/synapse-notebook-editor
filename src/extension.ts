import * as vscode from 'vscode';
import { SynapseNotebookSerializer } from './notebookSerializer';
import { SynapseExecutionManager } from './executionManager';
import { ConfigurationManager } from './configurationManager';

/**
 * Activates the Synapse Notebook extension
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Azure Synapse Notebook Editor is now active');

    // Create output channel
    const outputChannel = vscode.window.createOutputChannel('Synapse Notebook');
    context.subscriptions.push(outputChannel);

    // Initialize execution manager
    const executionManager = new SynapseExecutionManager(context);
    context.subscriptions.push(executionManager);

    // Initialize configuration manager
    const configManager = new ConfigurationManager(context, outputChannel, executionManager);

    // Register the notebook serializer
    const notebookSerializer = new SynapseNotebookSerializer();
    context.subscriptions.push(
        vscode.workspace.registerNotebookSerializer(
            'synapse-notebook',
            notebookSerializer,
            {
                transientOutputs: false,
                transientCellMetadata: {
                    inputCollapsed: true,
                    outputCollapsed: true,
                }
            }
        )
    );

    // Register command to create a new Synapse notebook
    context.subscriptions.push(
        vscode.commands.registerCommand('synapse-notebook.createNew', async () => {
            const newNotebookData = notebookSerializer.createNewNotebook();
            const doc = await vscode.workspace.openNotebookDocument(
                'synapse-notebook',
                newNotebookData
            );
            await vscode.window.showNotebookDocument(doc);
        })
    );

    // Register command to add a code cell
    context.subscriptions.push(
        vscode.commands.registerCommand('synapse-notebook.addCodeCell', async () => {
            const editor = vscode.window.activeNotebookEditor;
            if (editor && editor.notebook.notebookType === 'synapse-notebook') {
                const edit = new vscode.WorkspaceEdit();
                const cellData = new vscode.NotebookCellData(
                    vscode.NotebookCellKind.Code,
                    '',
                    'python'
                );
                const nbEdit = vscode.NotebookEdit.insertCells(
                    editor.notebook.cellCount,
                    [cellData]
                );
                edit.set(editor.notebook.uri, [nbEdit]);
                await vscode.workspace.applyEdit(edit);
            }
        })
    );

    // Register command to add a markdown cell
    context.subscriptions.push(
        vscode.commands.registerCommand('synapse-notebook.addMarkdownCell', async () => {
            const editor = vscode.window.activeNotebookEditor;
            if (editor && editor.notebook.notebookType === 'synapse-notebook') {
                const edit = new vscode.WorkspaceEdit();
                const cellData = new vscode.NotebookCellData(
                    vscode.NotebookCellKind.Markup,
                    '',
                    'markdown'
                );
                const nbEdit = vscode.NotebookEdit.insertCells(
                    editor.notebook.cellCount,
                    [cellData]
                );
                edit.set(editor.notebook.uri, [nbEdit]);
                await vscode.workspace.applyEdit(edit);
            }
        })
    );

    // Register command to configure Synapse workspace
    context.subscriptions.push(
        vscode.commands.registerCommand('synapse-notebook.configureSynapse', async () => {
            await executionManager.configure();
        })
    );

    // Register command to open configuration manager
    context.subscriptions.push(
        vscode.commands.registerCommand('synapse-notebook.manageConfigurations', async () => {
            await configManager.show();
        })
    );

    // Register command to upload and execute notebook
    context.subscriptions.push(
        vscode.commands.registerCommand('synapse-notebook.uploadAndExecute', async () => {
            const editor = vscode.window.activeNotebookEditor;
            if (editor && editor.notebook.notebookType === 'synapse-notebook') {
                await executionManager.uploadAndExecute(editor.notebook);
            } else {
                vscode.window.showWarningMessage('Please open a Synapse notebook to execute');
            }
        })
    );

    vscode.window.showInformationMessage('Azure Synapse Notebook Editor loaded successfully!');
}

/**
 * Deactivates the extension
 */
export function deactivate() {
    console.log('Azure Synapse Notebook Editor is now deactivated');
}
