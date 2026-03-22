import * as vscode from 'vscode';
import { SynapseNotebookSerializer } from './notebookSerializer';

/**
 * Custom text editor provider for editing JSON files as Synapse notebooks
 */
export class SynapseNotebookCustomEditorProvider implements vscode.CustomTextEditorProvider {
    public static readonly viewType = 'synapse-notebook.jsonEditor';
    
    private readonly serializer: SynapseNotebookSerializer;
    private readonly documentMap = new Map<string, vscode.NotebookDocument>();

    constructor() {
        this.serializer = new SynapseNotebookSerializer();
    }

    /**
     * Resolve the custom text editor
     */
    async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        token: vscode.CancellationToken
    ): Promise<void> {
        try {
            // Parse the JSON to check if it's a valid notebook
            const content = new TextEncoder().encode(document.getText());
            
            if (!this.isSynapseNotebook(content)) {
                vscode.window.showErrorMessage('This JSON file is not a valid Synapse notebook format.');
                return;
            }

            // Deserialize to notebook data
            const notebookData = await this.serializer.deserializeNotebook(content, token);
            
            // Create a new notebook document
            const notebookDoc = await vscode.workspace.openNotebookDocument('synapse-notebook', notebookData);
            this.documentMap.set(document.uri.toString(), notebookDoc);
            
            // Show the notebook editor
            const notebookEditor = await vscode.window.showNotebookDocument(notebookDoc);
            
            // Set up listener to save changes back to the JSON file
            const changeDisposable = vscode.workspace.onDidChangeNotebookDocument(async (e) => {
                if (e.notebook === notebookDoc) {
                    // Serialize notebook back to JSON
                    const serializedContent = await this.serializer.serializeNotebook(
                        new vscode.NotebookData(
                            notebookDoc.getCells().map(cell => {
                                const cellData = new vscode.NotebookCellData(
                                    cell.kind,
                                    cell.document.getText(),
                                    cell.document.languageId
                                );
                                cellData.outputs = cell.outputs ? [...cell.outputs] : [];
                                cellData.metadata = cell.metadata;
                                cellData.executionSummary = cell.executionSummary;
                                return cellData;
                            })
                        ),
                        token
                    );
                    
                    const jsonText = new TextDecoder().decode(serializedContent);
                    
                    // Update the text document
                    const edit = new vscode.WorkspaceEdit();
                    edit.replace(
                        document.uri,
                        new vscode.Range(0, 0, document.lineCount, 0),
                        jsonText
                    );
                    await vscode.workspace.applyEdit(edit);
                }
            });

            // Clean up when the webview is disposed
            webviewPanel.onDidDispose(() => {
                changeDisposable.dispose();
                this.documentMap.delete(document.uri.toString());
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open as notebook: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Check if the JSON content is a Synapse/Jupyter notebook
     */
    private isSynapseNotebook(content: Uint8Array): boolean {
        try {
            const text = new TextDecoder().decode(content);
            const json = JSON.parse(text);
            
            // Check for required notebook properties
            return (
                typeof json === 'object' &&
                json !== null &&
                ('nbformat' in json || 'cells' in json) &&
                Array.isArray(json.cells)
            );
        } catch {
            return false;
        }
    }

    /**
     * Open a JSON file as a notebook using custom editor
     */
    public static async openAsNotebook(uri: vscode.Uri): Promise<void> {
        try {
            // Open with the custom editor
            await vscode.commands.executeCommand('vscode.openWith', uri, SynapseNotebookCustomEditorProvider.viewType);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open as notebook: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
