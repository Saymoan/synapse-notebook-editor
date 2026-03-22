import * as vscode from 'vscode';
import { ClientSecretCredential, DefaultAzureCredential } from '@azure/identity';
import axios, { AxiosInstance } from 'axios';

/**
 * Configuration for Synapse workspace connection
 */
export interface SynapseConfig {
    workspaceName: string;
    workspaceUrl?: string;
    subscriptionId?: string;
    resourceGroup?: string;
    sparkPoolName?: string;
}

/**
 * Notebook execution status
 */
export interface NotebookRunStatus {
    runId: string;
    status: 'Running' | 'Succeeded' | 'Failed' | 'Cancelled';
    startTime?: string;
    endTime?: string;
    error?: string;
}

/**
 * Client for interacting with Azure Synapse Analytics
 */
export class SynapseClient {
    private config: SynapseConfig;
    private httpClient: AxiosInstance;
    private accessToken?: string;

    constructor(config: SynapseConfig) {
        this.config = config;
        const baseUrl = config.workspaceUrl || `https://${config.workspaceName}.dev.azuresynapse.net`;
        
        this.httpClient = axios.create({
            baseURL: baseUrl,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Authenticate with Azure using default credentials
     */
    async authenticate(): Promise<boolean> {
        try {
            const credential = new DefaultAzureCredential();
            const token = await credential.getToken('https://dev.azuresynapse.net/.default');
            
            if (token) {
                this.accessToken = token.token;
                this.httpClient.defaults.headers.common['Authorization'] = `Bearer ${token.token}`;
                return true;
            }
            return false;
        } catch (error) {
            console.error('Authentication failed:', error);
            throw new Error(`Azure authentication failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Upload a notebook to Synapse workspace
     */
    async uploadNotebook(notebookName: string, notebookContent: any): Promise<void> {
        try {
            const notebookPayload = {
                name: notebookName,
                properties: {
                    nbformat: notebookContent.nbformat,
                    nbformat_minor: notebookContent.nbformat_minor,
                    metadata: {
                        ...notebookContent.metadata,
                        a365ComputeOptions: {
                            id: `/subscriptions/${this.config.subscriptionId}/resourceGroups/${this.config.resourceGroup}/providers/Microsoft.Synapse/workspaces/${this.config.workspaceName}/bigDataPools/${this.config.sparkPoolName}`,
                            name: this.config.sparkPoolName,
                            type: 'Spark',
                            endpoint: `https://${this.config.workspaceName}.dev.azuresynapse.net/livyApi/versions/2019-11-01-preview/sparkPools/${this.config.sparkPoolName}`,
                            auth: {
                                type: 'AAD',
                                authResource: 'https://dev.azuresynapse.net'
                            }
                        }
                    },
                    cells: notebookContent.cells,
                    bigDataPool: {
                        referenceName: this.config.sparkPoolName,
                        type: 'BigDataPoolReference'
                    }
                }
            };

            await this.httpClient.put(
                `/notebooks/${notebookName}?api-version=2020-12-01`,
                notebookPayload
            );
            
            vscode.window.showInformationMessage(`Notebook "${notebookName}" uploaded successfully`);
        } catch (error: any) {
            const statusCode = error.response?.status;
            const message = error.response?.data?.error?.message || error.message;
            const details = error.response?.data?.error?.details;
            
            let errorMsg = `Failed to upload notebook: ${message}`;
            if (statusCode) {
                errorMsg = `HTTP ${statusCode}: ${errorMsg}`;
            }
            if (details) {
                errorMsg += `\nDetails: ${JSON.stringify(details)}`;
            }
            
            throw new Error(errorMsg);
        }
    }

    /**
     * Execute a notebook in Synapse using Pipeline with Notebook Activity
     */
    async executeNotebook(notebookName: string, sparkPoolName?: string): Promise<string> {
        try {
            const poolName = sparkPoolName || this.config.sparkPoolName;
            if (!poolName) {
                throw new Error('Spark pool name is required for execution');
            }

            // Create a temporary pipeline with notebook activity
            const pipelineName = `TempPipeline_${notebookName}_${Date.now()}`;

            // First, create the pipeline
            const pipelinePayload = {
                name: pipelineName,
                properties: {
                    activities: [
                        {
                            name: 'RunNotebook',
                            type: 'SynapseNotebook',
                            typeProperties: {
                                notebook: {
                                    referenceName: notebookName,
                                    type: 'NotebookReference'
                                },
                                sparkPool: {
                                    referenceName: poolName,
                                    type: 'BigDataPoolReference'
                                },
                                parameters: {}
                            }
                        }
                    ]
                }
            };

            // Create pipeline
            try {
                await this.httpClient.put(
                    `/pipelines/${pipelineName}?api-version=2020-12-01`,
                    pipelinePayload
                );
            } catch (createError: any) {
                const msg = createError.response?.data?.error?.message || createError.message;
                throw new Error(`Failed to create pipeline: ${msg}`);
            }

            // Wait a moment for pipeline to be registered in Synapse
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Trigger pipeline run
            const runResponse = await this.httpClient.post(
                `/pipelines/${pipelineName}/createRun?api-version=2020-12-01`,
                {}
            );

            const actualRunId = runResponse.data.runId;
            
            // Store pipeline name for cleanup
            (this as any).lastPipelineName = pipelineName;

            return actualRunId;
        } catch (error: any) {
            const statusCode = error.response?.status;
            const message = error.response?.data?.error?.message || error.response?.data?.message || error.message;
            const details = error.response?.data?.error?.details;
            
            let errorMsg = `Failed to execute notebook: ${message}`;
            if (statusCode === 404) {
                errorMsg = `Failed to execute notebook: The notebook '${notebookName}' or Spark pool '${sparkPoolName || this.config.sparkPoolName}' was not found.\n\nMake sure:\n• The notebook was uploaded successfully\n• The notebook name matches exactly\n• The Spark pool exists and is spelled correctly`;
            } else if (statusCode === 400) {
                errorMsg = `Failed to execute notebook (Bad Request): ${message}`;
                if (details) {
                    errorMsg += `\n\nDetails: ${JSON.stringify(details, null, 2)}`;
                }
                errorMsg += '\n\nPossible causes:\n• Notebook may not be fully synchronized in Synapse (wait a few seconds and retry)\n• Spark pool may not be active or properly configured\n• Check if the notebook can be opened in Synapse Studio';
            } else if (statusCode) {
                errorMsg = `HTTP ${statusCode}: ${errorMsg}`;
            }
            
            throw new Error(errorMsg);
        }
    }

    /**
     * Get the status of a pipeline run
     */
    async getRunStatus(notebookName: string, runId: string): Promise<NotebookRunStatus> {
        try {
            const response = await this.httpClient.get(
                `/pipelineruns/${runId}?api-version=2020-12-01`
            );

            const data = response.data;
            const pipelineStatus = data.status; // Queued, InProgress, Succeeded, Failed, Canceling, Cancelled
            
            let status: NotebookRunStatus['status'];
            if (pipelineStatus === 'Succeeded') {
                status = 'Succeeded';
            } else if (pipelineStatus === 'Failed') {
                status = 'Failed';
            } else if (pipelineStatus === 'Cancelled' || pipelineStatus === 'Canceling') {
                status = 'Cancelled';
            } else {
                status = 'Running';
            }

            return {
                runId: runId,
                status: status,
                startTime: data.runStart,
                endTime: data.runEnd,
                error: data.message || (status === 'Failed' ? 'Pipeline execution failed' : undefined)
            };
        } catch (error: any) {
            const message = error.response?.data?.error?.message || error.message;
            throw new Error(`Failed to get run status: ${message}`);
        }
    }

    /**
     * Delete temporary pipeline after execution
     */
    async cleanupPipeline(pipelineName: string): Promise<void> {
        try {
            await this.httpClient.delete(
                `/pipelines/${pipelineName}?api-version=2020-12-01`
            );
        } catch (error) {
            // Ignore cleanup errors
            console.warn('Failed to cleanup temporary pipeline:', error);
        }
    }

    /**
     * Poll for notebook execution completion
     */
    async waitForCompletion(
        notebookName: string,
        runId: string,
        onProgress?: (status: NotebookRunStatus) => void
    ): Promise<NotebookRunStatus> {
        const maxAttempts = 60; // 5 minutes with 5 second intervals
        let attempts = 0;

        while (attempts < maxAttempts) {
            const status = await this.getRunStatus(notebookName, runId);
            
            if (onProgress) {
                onProgress(status);
            }

            if (status.status === 'Succeeded' || status.status === 'Failed' || status.status === 'Cancelled') {
                return status;
            }

            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
            attempts++;
        }

        throw new Error('Notebook execution timeout - exceeded maximum wait time');
    }

    /**
     * Get notebook content from Synapse
     */
    async getNotebook(notebookName: string): Promise<any> {
        try {
            const response = await this.httpClient.get(
                `/notebooks/${notebookName}?api-version=2020-12-01`
            );
            return response.data.properties;
        } catch (error: any) {
            const message = error.response?.data?.error?.message || error.message;
            throw new Error(`Failed to get notebook: ${message}`);
        }
    }

    /**
     * List all Spark pools in the workspace
     */
    async listSparkPools(): Promise<string[]> {
        try {
            const response = await this.httpClient.get(
                `/bigDataPools?api-version=2020-12-01`
            );
            return response.data.value.map((pool: any) => pool.name);
        } catch (error: any) {
            console.error('Failed to list Spark pools:', error);
            return [];
        }
    }
}
