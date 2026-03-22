import * as vscode from 'vscode';
import { SynapseNotebook, SynapseCell, SynapseCellOutput } from './synapseNotebookTypes';

/**
 * Serializer for Azure Synapse notebooks
 * Handles conversion between Synapse notebook format and VS Code's NotebookData
 */
export class SynapseNotebookSerializer implements vscode.NotebookSerializer {
    
    /**
     * Deserialize notebook from disk format to VS Code format
     */
    async deserializeNotebook(
        content: Uint8Array,
        _token: vscode.CancellationToken
    ): Promise<vscode.NotebookData> {
        const contents = new TextDecoder().decode(content);
        
        let raw: SynapseNotebook;
        try {
            raw = JSON.parse(contents);
            
            // Validate that this is actually a notebook
            if (!raw.cells || !Array.isArray(raw.cells)) {
                throw new Error('Invalid notebook format: missing cells array');
            }
        } catch (error) {
            // Return empty notebook if parsing fails
            raw = {
                nbformat: 4,
                nbformat_minor: 2,
                metadata: {},
                cells: []
            };
        }

        // Convert Synapse cells to VS Code cells
        const cells = raw.cells.map(cell => this.convertToNotebookCell(cell));

        // Store Synapse-specific metadata
        const notebookMetadata = {
            custom: {
                metadata: raw.metadata,
                nbformat: raw.nbformat,
                nbformat_minor: raw.nbformat_minor,
                bigDataPool: raw.bigDataPool,
                sessionProperties: raw.sessionProperties
            }
        };

        return new vscode.NotebookData(cells);
    }

    /**
     * Serialize notebook from VS Code format to disk format
     */
    async serializeNotebook(
        data: vscode.NotebookData,
        _token: vscode.CancellationToken
    ): Promise<Uint8Array> {
        // Convert VS Code cells to Synapse cells
        const cells: SynapseCell[] = [];
        
        for (const cell of data.cells) {
            cells.push(this.convertFromNotebookCell(cell));
        }

        // Extract Synapse-specific metadata
        const metadata = (data.metadata as any)?.custom?.metadata || {
            language_info: {
                name: 'python'
            },
            kernelspec: {
                name: 'synapse_pyspark',
                display_name: 'Synapse PySpark'
            }
        };

        const synapseNotebook: SynapseNotebook = {
            nbformat: (data.metadata as any)?.custom?.nbformat || 4,
            nbformat_minor: (data.metadata as any)?.custom?.nbformat_minor || 2,
            metadata: metadata,
            cells: cells
        };

        // Add optional Synapse-specific properties if they exist
        if ((data.metadata as any)?.custom?.bigDataPool) {
            synapseNotebook.bigDataPool = (data.metadata as any).custom.bigDataPool;
        }

        if ((data.metadata as any)?.custom?.sessionProperties) {
            synapseNotebook.sessionProperties = (data.metadata as any).custom.sessionProperties;
        }

        const contents = JSON.stringify(synapseNotebook, null, 2);
        return new TextEncoder().encode(contents);
    }

    /**
     * Convert a Synapse cell to VS Code NotebookCellData
     */
    private convertToNotebookCell(cell: SynapseCell): vscode.NotebookCellData {
        const kind = cell.cell_type === 'markdown' 
            ? vscode.NotebookCellKind.Markup 
            : vscode.NotebookCellKind.Code;
        
        const source = Array.isArray(cell.source) 
            ? cell.source.join('') 
            : cell.source;

        const language = cell.cell_type === 'markdown' 
            ? 'markdown' 
            : this.detectLanguage(source, cell.metadata);

        const cellData = new vscode.NotebookCellData(kind, source, language);
        
        // Convert outputs
        if (cell.outputs && cell.outputs.length > 0) {
            cellData.outputs = cell.outputs.map(output => this.convertOutput(output));
        }

        // Set execution count
        if (cell.execution_count) {
            cellData.executionSummary = {
                executionOrder: cell.execution_count
            };
        }

        // Preserve cell metadata
        cellData.metadata = {
            custom: cell.metadata
        };

        return cellData;
    }

    /**
     * Convert VS Code NotebookCellData to Synapse cell
     */
    private convertFromNotebookCell(cell: vscode.NotebookCellData): SynapseCell {
        const cellType = cell.kind === vscode.NotebookCellKind.Markup ? 'markdown' : 'code';
        
        const synapseCell: SynapseCell = {
            cell_type: cellType,
            metadata: (cell.metadata as any)?.custom || {},
            source: cell.value.split('\n').map((line: string, i: number, arr: string[]) => 
                i < arr.length - 1 ? line + '\n' : line
            )
        };

        // Add outputs for code cells
        if (cellType === 'code' && cell.outputs && cell.outputs.length > 0) {
            synapseCell.outputs = cell.outputs.map((output: vscode.NotebookCellOutput) => this.convertFromOutput(output));
        }

        // Add execution count
        if (cell.executionSummary?.executionOrder) {
            synapseCell.execution_count = cell.executionSummary.executionOrder;
        } else if (cellType === 'code') {
            synapseCell.execution_count = null;
        }

        return synapseCell;
    }

    /**
     * Convert Synapse output to VS Code output
     */
    private convertOutput(output: SynapseCellOutput): vscode.NotebookCellOutput {
        const items: vscode.NotebookCellOutputItem[] = [];

        switch (output.output_type) {
            case 'stream':
                const text = Array.isArray(output.text) ? output.text.join('') : output.text || '';
                items.push(vscode.NotebookCellOutputItem.text(text, 'text/plain'));
                break;

            case 'display_data':
            case 'execute_result':
                if (output.data) {
                    for (const [mimeType, value] of Object.entries(output.data)) {
                        if (typeof value === 'string') {
                            items.push(vscode.NotebookCellOutputItem.text(value, mimeType));
                        } else if (Array.isArray(value)) {
                            items.push(vscode.NotebookCellOutputItem.text(value.join(''), mimeType));
                        } else {
                            items.push(vscode.NotebookCellOutputItem.json(value, mimeType));
                        }
                    }
                }
                break;

            case 'error':
                const errorText = output.traceback 
                    ? output.traceback.join('\n') 
                    : `${output.ename}: ${output.evalue}`;
                items.push(vscode.NotebookCellOutputItem.error({
                    name: output.ename || 'Error',
                    message: output.evalue || ''
                }));
                break;
        }

        return new vscode.NotebookCellOutput(items, {
            custom: { originalOutput: output }
        });
    }

    /**
     * Convert VS Code output to Synapse output
     */
    private convertFromOutput(output: vscode.NotebookCellOutput): SynapseCellOutput {
        // Try to use original output if available
        if ((output.metadata as any)?.custom?.originalOutput) {
            return (output.metadata as any).custom.originalOutput;
        }

        // Otherwise, convert from VS Code output
        const item = output.items[0];
        if (item) {
            const text = new TextDecoder().decode(item.data);
            return {
                output_type: 'stream',
                name: 'stdout',
                text: text.split('\n')
            };
        }

        return {
            output_type: 'stream',
            name: 'stdout',
            text: []
        };
    }

    /**
     * Detect language from cell content or metadata
     */
    private detectLanguage(source: string, metadata: any): string {
        // Check for magic commands
        if (source.trim().startsWith('%%')) {
            const firstLine = source.trim().split('\n')[0];
            if (firstLine.includes('%%pyspark')) {
                return 'python';
            }
            if (firstLine.includes('%%sql')) {
                return 'sql';
            }
            if (firstLine.includes('%%spark')) {
                return 'scala';
            }
            if (firstLine.includes('%%csharp')) {
                return 'csharp';
            }
        }

        // Default to Python for Synapse
        return metadata?.language || 'python';
    }

    /**
     * Create a new empty Synapse notebook
     */
    public createNewNotebook(): vscode.NotebookData {
        const cell = new vscode.NotebookCellData(
            vscode.NotebookCellKind.Code,
            '# Welcome to Azure Synapse Notebook\n',
            'python'
        );

        const notebook = new vscode.NotebookData([cell]);
        notebook.metadata = {
            custom: {
                metadata: {
                    language_info: {
                        name: 'python'
                    },
                    kernelspec: {
                        name: 'synapse_pyspark',
                        display_name: 'Synapse PySpark'
                    }
                },
                nbformat: 4,
                nbformat_minor: 2
            }
        };

        return notebook;
    }
}
