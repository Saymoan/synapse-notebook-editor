import * as vscode from 'vscode';
import { DefaultAzureCredential } from '@azure/identity';
import axios, { AxiosInstance } from 'axios';

export interface SynapseConfig {
    workspaceName: string;
    workspaceUrl?: string;
    subscriptionId?: string;
    resourceGroup?: string;
    sparkPoolName?: string;
}

type LivySessionState =
    | 'not_started' | 'starting' | 'idle' | 'busy'
    | 'shutting_down' | 'error' | 'dead' | 'killed' | 'success';

export type LivyStatementKind = 'pyspark' | 'sql' | 'spark' | 'sparkr';

export interface LivyStatementOutput {
    status: 'ok' | 'error';
    execution_count: number;
    data?: Record<string, string>;
    ename?: string;
    evalue?: string;
    traceback?: string[];
}

export class SynapseClient {
    private config: SynapseConfig;
    private httpClient: AxiosInstance;

    constructor(config: SynapseConfig) {
        this.config = config;
        const baseUrl = config.workspaceUrl || `https://${config.workspaceName}.dev.azuresynapse.net`;

        this.httpClient = axios.create({
            baseURL: baseUrl,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    async authenticate(): Promise<boolean> {
        try {
            const credential = new DefaultAzureCredential();
            const token = await credential.getToken('https://dev.azuresynapse.net/.default');

            if (token) {
                this.httpClient.defaults.headers.common['Authorization'] = `Bearer ${token.token}`;
                return true;
            }
            return false;
        } catch (error) {
            throw new Error(`Azure authentication failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private livyPath(poolName: string, suffix = ''): string {
        return `/livyApi/versions/2019-11-01-preview/sparkPools/${poolName}/sessions${suffix}`;
    }

    async createSession(poolName: string): Promise<number> {
        try {
            const response = await this.httpClient.post(this.livyPath(poolName), {
                kind: 'pyspark',
                idleTimeoutInMinutes: 10
            });
            return response.data.id as number;
        } catch (error: any) {
            const message = error.response?.data?.message || error.message;
            throw new Error(`Failed to create Livy session: ${message}`);
        }
    }

    async waitForSessionIdle(
        poolName: string,
        sessionId: number,
        token?: vscode.CancellationToken
    ): Promise<void> {
        const terminalStates: LivySessionState[] = ['error', 'dead', 'killed'];
        const maxPolls = 200; // 10 minutes at 3 s intervals

        for (let i = 0; i < maxPolls; i++) {
            if (token?.isCancellationRequested) {
                throw new Error('Session startup cancelled');
            }

            const response = await this.httpClient.get(this.livyPath(poolName, `/${sessionId}`));
            const state: LivySessionState = response.data.state;

            if (state === 'idle') {
                return;
            }
            if (terminalStates.includes(state)) {
                const msg = response.data.appInfo?.driverLogUrl
                    ? ` Check driver log: ${response.data.appInfo.driverLogUrl}`
                    : '';
                throw new Error(`Spark session failed to start (state: ${state}).${msg}`);
            }

            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        throw new Error('Timed out waiting for Spark session to become idle (10 min limit)');
    }

    async submitStatement(
        poolName: string,
        sessionId: number,
        code: string,
        kind: LivyStatementKind
    ): Promise<number> {
        try {
            const response = await this.httpClient.post(
                this.livyPath(poolName, `/${sessionId}/statements`),
                { code, kind }
            );
            return response.data.id as number;
        } catch (error: any) {
            const message = error.response?.data?.message || error.message;
            throw new Error(`Failed to submit statement: ${message}`);
        }
    }

    async waitForStatement(
        poolName: string,
        sessionId: number,
        statementId: number,
        token?: vscode.CancellationToken
    ): Promise<LivyStatementOutput> {
        const maxPolls = 900; // 30 minutes at 2 s intervals

        for (let i = 0; i < maxPolls; i++) {
            if (token?.isCancellationRequested) {
                throw new Error('Statement cancelled');
            }

            const response = await this.httpClient.get(
                this.livyPath(poolName, `/${sessionId}/statements/${statementId}`)
            );
            const stmt = response.data;

            if (stmt.state === 'available') {
                return stmt.output as LivyStatementOutput;
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        throw new Error('Timed out waiting for statement to complete (30 min limit)');
    }

    async closeSession(poolName: string, sessionId: number): Promise<void> {
        try {
            await this.httpClient.delete(this.livyPath(poolName, `/${sessionId}`));
        } catch {
            // best-effort; session will expire via idleTimeoutInMinutes regardless
        }
    }

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

    async listSparkPools(): Promise<string[]> {
        try {
            const response = await this.httpClient.get(`/bigDataPools?api-version=2020-12-01`);
            return response.data.value.map((pool: any) => pool.name);
        } catch {
            return [];
        }
    }
}
