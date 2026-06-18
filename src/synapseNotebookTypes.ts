/**
 * Azure Synapse Notebook format interfaces
 */

export interface SynapseNotebook {
    nbformat: number;
    nbformat_minor: number;
    metadata: SynapseNotebookMetadata;
    cells: SynapseCell[];
    bigDataPool?: {
        referenceName: string;
        type: string;
    };
    sessionProperties?: {
        driverMemory: string;
        driverCores: number;
        executorMemory: string;
        executorCores: number;
        numExecutors: number;
    };
}

export interface SynapseNotebookMetadata {
    language_info?: {
        name: string;
        version?: string;
    };
    kernelspec?: {
        name: string;
        display_name: string;
        language?: string;
    };
    save_output?: boolean;
    synapse_widget?: {
        version: string;
        state: any;
    };
    a365ComputeOptions?: {
        id: string;
        name: string;
        type: string;
        endpoint: string;
        auth: {
            type: string;
            authResource: string;
        };
        sparkVersion: string;
        nodeCount: number;
        cores: number;
        memory: number;
    };
    [key: string]: any;
}

export interface SynapseCell {
    cell_type: 'code' | 'markdown' | 'raw';
    metadata: SynapseCellMetadata;
    source: string | string[];
    outputs?: SynapseCellOutput[];
    execution_count?: number | null;
}

export interface SynapseCellMetadata {
    collapsed?: boolean;
    jupyter?: {
        source_hidden?: boolean;
        outputs_hidden?: boolean;
    };
    nteract?: {
        transient?: {
            deleting?: boolean;
        };
    };
    microsoft?: {
        language?: string;
    };
    [key: string]: any;
}

export interface SynapseNotebookResource {
    name: string;
    properties: SynapseNotebook & {
        targetSparkConfiguration?: { referenceName: string; type: string } | null;
        description?: string;
        folder?: { name: string };
    };
    id?: string;
    type?: string;
    etag?: string;
}

export interface SynapseCellOutput {
    output_type: 'stream' | 'display_data' | 'execute_result' | 'error';
    name?: string;
    text?: string | string[];
    data?: {
        [mimeType: string]: any;
    };
    metadata?: any;
    execution_count?: number | null;
    ename?: string;
    evalue?: string;
    traceback?: string[];
}
