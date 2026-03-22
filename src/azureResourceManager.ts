import * as vscode from 'vscode';
import { DefaultAzureCredential } from '@azure/identity';
import axios from 'axios';

/**
 * Azure subscription information
 */
export interface AzureSubscription {
    subscriptionId: string;
    displayName: string;
    state: string;
}

/**
 * Synapse workspace information
 */
export interface SynapseWorkspace {
    name: string;
    id: string;
    location: string;
    resourceGroup: string;
}

/**
 * Spark pool information
 */
export interface SparkPool {
    name: string;
    id: string;
    nodeSize: string;
    nodeCount: number;
}

/**
 * Manager for Azure resource discovery and selection
 */
export class AzureResourceManager {
    private credential?: DefaultAzureCredential;
    private accessToken?: string;

    /**
     * Authenticate with Azure
     */
    async authenticate(): Promise<boolean> {
        try {
            this.credential = new DefaultAzureCredential();
            const token = await this.credential.getToken('https://management.azure.com/.default');
            
            if (token) {
                this.accessToken = token.token;
                return true;
            }
            return false;
        } catch (error) {
            console.error('Authentication failed:', error);
            throw new Error(`Azure authentication failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * List all available Azure subscriptions
     */
    async listSubscriptions(): Promise<AzureSubscription[]> {
        if (!this.accessToken) {
            await this.authenticate();
        }

        try {
            const response = await axios.get(
                'https://management.azure.com/subscriptions?api-version=2020-01-01',
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data.value.map((sub: any) => ({
                subscriptionId: sub.subscriptionId,
                displayName: sub.displayName,
                state: sub.state
            })).filter((sub: AzureSubscription) => sub.state === 'Enabled');
        } catch (error: any) {
            const message = error.response?.data?.error?.message || error.message;
            throw new Error(`Failed to list subscriptions: ${message}`);
        }
    }

    /**
     * List Synapse workspaces in a subscription
     */
    async listSynapseWorkspaces(subscriptionId: string): Promise<SynapseWorkspace[]> {
        if (!this.accessToken) {
            await this.authenticate();
        }

        try {
            const response = await axios.get(
                `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.Synapse/workspaces?api-version=2021-06-01`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data.value.map((workspace: any) => ({
                name: workspace.name,
                id: workspace.id,
                location: workspace.location,
                resourceGroup: workspace.id.split('/')[4] // Extract resource group from ID
            }));
        } catch (error: any) {
            const message = error.response?.data?.error?.message || error.message;
            throw new Error(`Failed to list Synapse workspaces: ${message}`);
        }
    }

    /**
     * List Spark pools in a workspace
     */
    async listSparkPools(subscriptionId: string, resourceGroup: string, workspaceName: string): Promise<SparkPool[]> {
        if (!this.accessToken) {
            await this.authenticate();
        }

        try {
            const response = await axios.get(
                `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Synapse/workspaces/${workspaceName}/bigDataPools?api-version=2021-06-01`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data.value.map((pool: any) => ({
                name: pool.name,
                id: pool.id,
                nodeSize: pool.properties?.nodeSize || 'Unknown',
                nodeCount: pool.properties?.nodeCount || 0
            }));
        } catch (error: any) {
            const message = error.response?.data?.error?.message || error.message;
            throw new Error(`Failed to list Spark pools: ${message}`);
        }
    }

    /**
     * Interactive workflow to select Azure resources
     */
    async selectAzureResources(): Promise<{
        subscriptionId: string;
        workspaceName: string;
        resourceGroup: string;
        sparkPoolName: string;
    } | undefined> {
        try {
            // Step 1: Authenticate
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Authenticating with Azure...',
                cancellable: false
            }, async () => {
                await this.authenticate();
            });

            // Step 2: List and select subscription
            const subscriptions = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Loading subscriptions...',
                cancellable: false
            }, async () => {
                return await this.listSubscriptions();
            });

            if (subscriptions.length === 0) {
                vscode.window.showErrorMessage('No Azure subscriptions found');
                return undefined;
            }

            const subscriptionItems = subscriptions.map(sub => ({
                label: sub.displayName,
                description: sub.subscriptionId,
                subscription: sub
            }));

            const selectedSubscription = await vscode.window.showQuickPick(subscriptionItems, {
                placeHolder: 'Select an Azure subscription',
                ignoreFocusOut: true
            });

            if (!selectedSubscription) {
                return undefined;
            }

            // Step 3: List and select workspace
            const workspaces = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Loading Synapse workspaces...',
                cancellable: false
            }, async () => {
                return await this.listSynapseWorkspaces(selectedSubscription.subscription.subscriptionId);
            });

            if (workspaces.length === 0) {
                vscode.window.showErrorMessage('No Synapse workspaces found in this subscription');
                return undefined;
            }

            const workspaceItems = workspaces.map(ws => ({
                label: ws.name,
                description: `${ws.location} (${ws.resourceGroup})`,
                workspace: ws
            }));

            const selectedWorkspace = await vscode.window.showQuickPick(workspaceItems, {
                placeHolder: 'Select a Synapse workspace',
                ignoreFocusOut: true
            });

            if (!selectedWorkspace) {
                return undefined;
            }

            // Step 4: List and select Spark pool
            const sparkPools = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Loading Spark pools...',
                cancellable: false
            }, async () => {
                return await this.listSparkPools(
                    selectedSubscription.subscription.subscriptionId,
                    selectedWorkspace.workspace.resourceGroup,
                    selectedWorkspace.workspace.name
                );
            });

            if (sparkPools.length === 0) {
                vscode.window.showErrorMessage('No Spark pools found in this workspace');
                return undefined;
            }

            const poolItems = sparkPools.map(pool => ({
                label: pool.name,
                description: `${pool.nodeSize} - ${pool.nodeCount} nodes`,
                pool: pool
            }));

            const selectedPool = await vscode.window.showQuickPick(poolItems, {
                placeHolder: 'Select a Spark pool',
                ignoreFocusOut: true
            });

            if (!selectedPool) {
                return undefined;
            }

            // Return selected configuration
            return {
                subscriptionId: selectedSubscription.subscription.subscriptionId,
                workspaceName: selectedWorkspace.workspace.name,
                resourceGroup: selectedWorkspace.workspace.resourceGroup,
                sparkPoolName: selectedPool.pool.name
            };

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to select Azure resources: ${message}`);
            return undefined;
        }
    }
}
