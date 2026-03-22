import * as vscode from 'vscode';
import { AzureResourceManager, AzureSubscription, SynapseWorkspace, SparkPool } from './azureResourceManager';
import { SynapseConfig } from './synapseClient';
import { SynapseExecutionManager } from './executionManager';

interface SavedConfiguration {
    id: string;
    name: string;
    subscriptionId: string;
    subscriptionName: string;
    workspaceName: string;
    resourceGroup: string;
    sparkPoolName: string;
    accountId: string;
    createdAt: string;
}

/**
 * Manages Azure Synapse workspace configurations with a rich UI
 */
export class ConfigurationManager {
    private panel?: vscode.WebviewPanel;
    private resourceManager: AzureResourceManager;
    private currentConfigurations: SavedConfiguration[] = [];

    constructor(
        private context: vscode.ExtensionContext, 
        private outputChannel: vscode.OutputChannel,
        private executionManager: SynapseExecutionManager
    ) {
        this.resourceManager = new AzureResourceManager();
        this.loadConfigurations();
    }

    /**
     * Show the configuration manager UI
     */
    async show(): Promise<void> {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'synapseConfigManager',
            'Synapse Configuration Manager',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.getWebviewContent();
        this.setupMessageHandlers();

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });

        // Load initial data
        await this.refreshData();
    }

    /**
     * Setup message handlers for webview communication
     */
    private setupMessageHandlers(): void {
        this.panel!.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'loadAccounts':
                    await this.handleLoadAccounts();
                    break;
                case 'switchAccount':
                    await this.handleSwitchAccount(message.accountId);
                    break;
                case 'loadSubscriptions':
                    await this.handleLoadSubscriptions();
                    break;
                case 'loadWorkspaces':
                    await this.handleLoadWorkspaces(message.subscriptionId);
                    break;
                case 'loadSparkPools':
                    await this.handleLoadSparkPools(message.subscriptionId, message.resourceGroup, message.workspaceName);
                    break;
                case 'createWorkspace':
                    await this.handleCreateWorkspace(message.data);
                    break;
                case 'saveConfiguration':
                    await this.handleSaveConfiguration(message.config);
                    break;
                case 'deleteConfiguration':
                    await this.handleDeleteConfiguration(message.id);
                    break;
                case 'activateConfiguration':
                    await this.handleActivateConfiguration(message.id);
                    break;
                case 'refresh':
                    await this.refreshData();
                    break;
            }
        });
    }

    /**
     * Handle loading Azure accounts
     */
    private async handleLoadAccounts(): Promise<void> {
        try {
            // For now, we use DefaultAzureCredential which handles the current logged-in account
            // To support multiple accounts, users would need to use Azure CLI or VS Code Azure Account extension
            const accounts = [
                {
                    id: 'default',
                    displayName: 'Current Azure Account',
                    type: 'Azure AD'
                }
            ];

            this.sendMessage({
                command: 'accountsLoaded',
                accounts: accounts
            });
        } catch (error) {
            this.sendMessage({
                command: 'error',
                message: `Failed to load accounts: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }

    /**
     * Handle account switching
     */
    private async handleSwitchAccount(accountId: string): Promise<void> {
        // In a real implementation, this would switch Azure credentials
        // For now, we'll just authenticate
        try {
            await this.resourceManager.authenticate();
            this.sendMessage({
                command: 'accountSwitched',
                accountId: accountId
            });
        } catch (error) {
            this.sendMessage({
                command: 'error',
                message: `Failed to switch account: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }

    /**
     * Handle loading subscriptions
     */
    private async handleLoadSubscriptions(): Promise<void> {
        try {
            const subscriptions = await this.resourceManager.listSubscriptions();
            this.sendMessage({
                command: 'subscriptionsLoaded',
                subscriptions: subscriptions
            });
        } catch (error) {
            this.sendMessage({
                command: 'error',
                message: `Failed to load subscriptions: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }

    /**
     * Handle loading workspaces
     */
    private async handleLoadWorkspaces(subscriptionId: string): Promise<void> {
        try {
            const workspaces = await this.resourceManager.listSynapseWorkspaces(subscriptionId);
            this.sendMessage({
                command: 'workspacesLoaded',
                workspaces: workspaces
            });
        } catch (error) {
            this.sendMessage({
                command: 'error',
                message: `Failed to load workspaces: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }

    /**
     * Handle loading Spark pools
     */
    private async handleLoadSparkPools(subscriptionId: string, resourceGroup: string, workspaceName: string): Promise<void> {
        try {
            const pools = await this.resourceManager.listSparkPools(subscriptionId, resourceGroup, workspaceName);
            this.sendMessage({
                command: 'sparkPoolsLoaded',
                pools: pools
            });
        } catch (error) {
            this.sendMessage({
                command: 'error',
                message: `Failed to load Spark pools: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }

    /**
     * Handle workspace creation
     */
    private async handleCreateWorkspace(data: any): Promise<void> {
        try {
            // Show a message that workspace creation would require Azure Portal or CLI
            const result = await vscode.window.showInformationMessage(
                'Workspace creation requires Azure Portal or Azure CLI. Would you like to:',
                'Open Azure Portal',
                'Show CLI Command',
                'Cancel'
            );

            if (result === 'Open Azure Portal') {
                const portalUrl = `https://portal.azure.com/#create/Microsoft.Synapse`;
                vscode.env.openExternal(vscode.Uri.parse(portalUrl));
            } else if (result === 'Show CLI Command') {
                const cliCommand = `az synapse workspace create \\
  --name ${data.workspaceName} \\
  --resource-group ${data.resourceGroup} \\
  --location ${data.location} \\
  --storage-account ${data.storageAccount} \\
  --sql-admin-login-user ${data.adminUser} \\
  --sql-admin-login-password <password>`;

                this.outputChannel.clear();
                this.outputChannel.appendLine('Azure CLI Command to Create Synapse Workspace:');
                this.outputChannel.appendLine('═'.repeat(60));
                this.outputChannel.appendLine(cliCommand);
                this.outputChannel.appendLine('\n' + '═'.repeat(60));
                this.outputChannel.appendLine('After creating the workspace, refresh this configuration manager.');
                this.outputChannel.show();
            }

        } catch (error) {
            this.sendMessage({
                command: 'error',
                message: `Workspace creation failed: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }

    /**
     * Handle saving a configuration
     */
    private async handleSaveConfiguration(config: any): Promise<void> {
        try {
            const savedConfig: SavedConfiguration = {
                id: config.id || Date.now().toString(),
                name: config.name || `${config.workspaceName} - ${config.sparkPoolName}`,
                subscriptionId: config.subscriptionId,
                subscriptionName: config.subscriptionName || config.subscriptionId,
                workspaceName: config.workspaceName,
                resourceGroup: config.resourceGroup,
                sparkPoolName: config.sparkPoolName,
                accountId: config.accountId || 'default',
                createdAt: new Date().toISOString()
            };

            // Add or update configuration
            const existingIndex = this.currentConfigurations.findIndex(c => c.id === savedConfig.id);
            if (existingIndex >= 0) {
                this.currentConfigurations[existingIndex] = savedConfig;
            } else {
                this.currentConfigurations.push(savedConfig);
            }

            await this.saveConfigurations();

            this.sendMessage({
                command: 'configurationSaved',
                configuration: savedConfig
            });

            vscode.window.showInformationMessage(`Configuration "${savedConfig.name}" saved successfully`);
        } catch (error) {
            this.sendMessage({
                command: 'error',
                message: `Failed to save configuration: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }

    /**
     * Handle deleting a configuration
     */
    private async handleDeleteConfiguration(id: string): Promise<void> {
        this.currentConfigurations = this.currentConfigurations.filter(c => c.id !== id);
        await this.saveConfigurations();

        this.sendMessage({
            command: 'configurationDeleted',
            id: id
        });
    }

    /**
     * Handle activating a configuration
     */
    private async handleActivateConfiguration(id: string): Promise<void> {
        const config = this.currentConfigurations.find(c => c.id === id);
        if (!config) {
            return;
        }

        const synapseConfig: SynapseConfig = {
            workspaceName: config.workspaceName,
            sparkPoolName: config.sparkPoolName,
            subscriptionId: config.subscriptionId,
            resourceGroup: config.resourceGroup
        };

        await this.context.globalState.update('synapseConfig', synapseConfig);
        await this.context.globalState.update('activeConfigurationId', id);

        // Refresh workspace status bar
        this.executionManager.refreshWorkspaceStatus();

        this.sendMessage({
            command: 'configurationActivated',
            id: id
        });

        vscode.window.showInformationMessage(`Activated configuration: ${config.name}`);
    }

    /**
     * Refresh all data
     */
    private async refreshData(): Promise<void> {
        await this.loadConfigurations();
        this.sendMessage({
            command: 'configurationsLoaded',
            configurations: this.currentConfigurations,
            activeId: this.context.globalState.get<string>('activeConfigurationId')
        });
    }

    /**
     * Load configurations from storage
     */
    private async loadConfigurations(): Promise<void> {
        this.currentConfigurations = this.context.globalState.get<SavedConfiguration[]>('synapseConfigurations', []);
    }

    /**
     * Save configurations to storage
     */
    private async saveConfigurations(): Promise<void> {
        await this.context.globalState.update('synapseConfigurations', this.currentConfigurations);
    }

    /**
     * Send message to webview
     */
    private sendMessage(message: any): void {
        if (this.panel) {
            this.panel.webview.postMessage(message);
        }
    }

    /**
     * Get webview HTML content
     */
    private getWebviewContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Synapse Configuration Manager</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        .header {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        h1 {
            margin: 0 0 10px 0;
            font-size: 24px;
        }
        .subtitle {
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
        }
        .section {
            margin-bottom: 30px;
            padding: 15px;
            background-color: var(--vscode-sideBar-background);
            border-radius: 4px;
        }
        .section-title {
            font-weight: bold;
            margin-bottom: 15px;
            color: var(--vscode-textLink-foreground);
        }
        .button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 2px;
            margin-right: 8px;
        }
        .button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .button-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .button-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        select, input {
            width: 100%;
            padding: 6px;
            margin: 8px 0;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
        }
        label {
            display: block;
            margin-top: 12px;
            font-weight: 500;
        }
        .config-list {
            list-style: none;
            padding: 0;
        }
        .config-item {
            padding: 12px;
            margin: 8px 0;
            background-color: var(--vscode-list-inactiveSelectionBackground);
            border-radius: 4px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .config-item.active {
            background-color: var(--vscode-list-activeSelectionBackground);
            border-left: 3px solid var(--vscode-textLink-activeForeground);
        }
        .config-info {
            flex-grow: 1;
        }
        .config-name {
            font-weight: bold;
            margin-bottom: 4px;
        }
        .config-details {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .config-actions {
            display: flex;
            gap: 8px;
        }
        .error {
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            color: var(--vscode-inputValidation-errorForeground);
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
        }
        .success {
            background-color: var(--vscode-terminal-ansiGreen);
            color: var(--vscode-editor-background);
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
        }
        .loading {
            text-align: center;
            padding: 20px;
            color: var(--vscode-descriptionForeground);
        }
        .tabs {
            display: flex;
            border-bottom: 1px solid var(--vscode-panel-border);
            margin-bottom: 20px;
        }
        .tab {
            padding: 10px 20px;
            cursor: pointer;
            border-bottom: 2px solid transparent;
        }
        .tab.active {
            border-bottom-color: var(--vscode-textLink-activeForeground);
        }
        .tab-content {
            display: none;
        }
        .tab-content.active {
            display: block;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔧 Synapse Configuration Manager</h1>
        <p class="subtitle">Manage multiple Azure Synapse workspace configurations</p>
    </div>

    <div class="tabs">
        <div class="tab active" onclick="switchTab('saved')">Saved Configurations</div>
        <div class="tab" onclick="switchTab('new')">New Configuration</div>
        <div class="tab" onclick="switchTab('accounts')">Azure Accounts</div>
    </div>

    <div id="error-container"></div>

    <!-- Saved Configurations Tab -->
    <div id="saved-tab" class="tab-content active">
        <div class="section">
            <div class="section-title">Saved Configurations</div>
            <ul id="config-list" class="config-list">
                <li class="loading">Loading configurations...</li>
            </ul>
        </div>
    </div>

    <!-- New Configuration Tab -->
    <div id="new-tab" class="tab-content">
        <div class="section">
            <div class="section-title">Create New Configuration</div>
            
            <label>Configuration Name (optional)</label>
            <input type="text" id="configName" placeholder="My Synapse Config" />

            <label>Azure Subscription</label>
            <select id="subscriptionSelect" onchange="loadWorkspaces()">
                <option value="">Select a subscription...</option>
            </select>
            <button class="button button-secondary" onclick="loadSubscriptions()">Refresh Subscriptions</button>

            <label>Synapse Workspace</label>
            <select id="workspaceSelect" onchange="loadSparkPools()">
                <option value="">Select a workspace...</option>
            </select>
            <button class="button button-secondary" onclick="showCreateWorkspace()">Create New Workspace</button>

            <label>Spark Pool</label>
            <select id="sparkPoolSelect">
                <option value="">Select a Spark pool...</option>
            </select>

            <br><br>
            <button class="button" onclick="saveConfiguration()">Save Configuration</button>
            <button class="button button-secondary" onclick="resetForm()">Reset</button>
        </div>
    </div>

    <!-- Azure Accounts Tab -->
    <div id="accounts-tab" class="tab-content">
        <div class="section">
            <div class="section-title">Azure Account Management</div>
            <p class="subtitle">Switch between Azure accounts or manage authentication</p>
            <div id="accounts-list">
                <p class="loading">Loading accounts...</p>
            </div>
            <br>
            <button class="button" onclick="authenticateAzure()">Re-authenticate</button>
            <button class="button button-secondary" onclick="openAzureCLI()">Open Azure CLI Guide</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let subscriptions = [];
        let workspaces = [];
        let sparkPools = [];

        // Tab switching
        function switchTab(tabName) {
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            document.querySelector(\`[onclick="switchTab('\${tabName}')"]\`).classList.add('active');
            document.getElementById(\`\${tabName}-tab\`).classList.add('active');

            if (tabName === 'accounts') {
                loadAccounts();
            } else if (tabName === 'new') {
                loadSubscriptions();
            }
        }

        // Message handler
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'configurationsLoaded':
                    renderConfigurations(message.configurations, message.activeId);
                    break;
                case 'subscriptionsLoaded':
                    renderSubscriptions(message.subscriptions);
                    break;
                case 'workspacesLoaded':
                    renderWorkspaces(message.workspaces);
                    break;
                case 'sparkPoolsLoaded':
                    renderSparkPools(message.pools);
                    break;
                case 'accountsLoaded':
                    renderAccounts(message.accounts);
                    break;
                case 'configurationSaved':
                    showSuccess('Configuration saved successfully!');
                    vscode.postMessage({ command: 'refresh' });
                    switchTab('saved');
                    break;
                case 'error':
                    showError(message.message);
                    break;
            }
        });

        function renderConfigurations(configs, activeId) {
            const list = document.getElementById('config-list');
            if (configs.length === 0) {
                list.innerHTML = '<li class="loading">No configurations saved yet. Create one in the "New Configuration" tab!</li>';
                return;
            }

            list.innerHTML = configs.map(config => \`
                <li class="config-item \${config.id === activeId ? 'active' : ''}">
                    <div class="config-info">
                        <div class="config-name">\${config.name}</div>
                        <div class="config-details">
                            Workspace: \${config.workspaceName} | 
                            Pool: \${config.sparkPoolName} | 
                            RG: \${config.resourceGroup}
                        </div>
                    </div>
                    <div class="config-actions">
                        \${config.id !== activeId ? 
                            '<button class="button" onclick="activateConfig(\\'' + config.id + '\\')">Activate</button>' : 
                            '<span style="color: var(--vscode-textLink-activeForeground);">✓ Active</span>'
                        }
                        <button class="button button-secondary" onclick="deleteConfig('\\'' + config.id + '\\')">Delete</button>
                    </div>
                </li>
            \`).join('');
        }

        function renderSubscriptions(subs) {
            subscriptions = subs;
            const select = document.getElementById('subscriptionSelect');
            select.innerHTML = '<option value="">Select a subscription...</option>' +
                subs.map(sub => \`<option value="\${sub.subscriptionId}">\${sub.displayName}</option>\`).join('');
        }

        function renderWorkspaces(ws) {
            workspaces = ws;
            const select = document.getElementById('workspaceSelect');
            if (ws.length === 0) {
                select.innerHTML = '<option value="">No workspaces found - Create one!</option>';
            } else {
                select.innerHTML = '<option value="">Select a workspace...</option>' +
                    ws.map(w => \`<option value="\${w.name}" data-rg="\${w.resourceGroup}">\${w.name} (\${w.location})</option>\`).join('');
            }
        }

        function renderSparkPools(pools) {
            sparkPools = pools;
            const select = document.getElementById('sparkPoolSelect');
            if (pools.length === 0) {
                select.innerHTML = '<option value="">No Spark pools found</option>';
            } else {
                select.innerHTML = '<option value="">Select a Spark pool...</option>' +
                    pools.map(p => \`<option value="\${p.name}">\${p.name} (\${p.nodeSize}, \${p.nodeCount} nodes)</option>\`).join('');
            }
        }

        function renderAccounts(accounts) {
            const list = document.getElementById('accounts-list');
            list.innerHTML = accounts.map(acc => \`
                <div class="config-item">
                    <div class="config-info">
                        <div class="config-name">\${acc.displayName}</div>
                        <div class="config-details">Type: \${acc.type}</div>
                    </div>
                    <button class="button" onclick="switchAccount('\\'' + acc.id + '\\')">Switch</button>
                </div>
            \`).join('');
        }

        // Actions
        function loadSubscriptions() {
            vscode.postMessage({ command: 'loadSubscriptions' });
        }

        function loadWorkspaces() {
            const subId = document.getElementById('subscriptionSelect').value;
            if (subId) {
                vscode.postMessage({ command: 'loadWorkspaces', subscriptionId: subId });
            }
        }

        function loadSparkPools() {
            const subId = document.getElementById('subscriptionSelect').value;
            const wsSelect = document.getElementById('workspaceSelect');
            const wsName = wsSelect.value;
            const wsOption = wsSelect.selectedOptions[0];
            const rg = wsOption?.getAttribute('data-rg');
            
            if (subId && wsName && rg) {
                vscode.postMessage({ 
                    command: 'loadSparkPools', 
                    subscriptionId: subId,
                    resourceGroup: rg,
                    workspaceName: wsName
                });
            }
        }

        function saveConfiguration() {
            const subSelect = document.getElementById('subscriptionSelect');
            const wsSelect = document.getElementById('workspaceSelect');
            const poolSelect = document.getElementById('sparkPoolSelect');
            const nameInput = document.getElementById('configName');

            const subId = subSelect.value;
            const wsName = wsSelect.value;
            const poolName = poolSelect.value;
            const rg = wsSelect.selectedOptions[0]?.getAttribute('data-rg');

            if (!subId || !wsName || !poolName) {
                showError('Please select subscription, workspace, and Spark pool');
                return;
            }

            vscode.postMessage({
                command: 'saveConfiguration',
                config: {
                    name: nameInput.value,
                    subscriptionId: subId,
                    subscriptionName: subSelect.selectedOptions[0].text,
                    workspaceName: wsName,
                    resourceGroup: rg,
                    sparkPoolName: poolName,
                    accountId: 'default'
                }
            });
        }

        function activateConfig(id) {
            vscode.postMessage({ command: 'activateConfiguration', id: id });
        }

        function deleteConfig(id) {
            if (confirm('Are you sure you want to delete this configuration?')) {
                vscode.postMessage({ command: 'deleteConfiguration', id: id });
            }
        }

        function loadAccounts() {
            vscode.postMessage({ command: 'loadAccounts' });
        }

        function switchAccount(accountId) {
            vscode.postMessage({ command: 'switchAccount', accountId: accountId });
        }

        function authenticateAzure() {
            vscode.postMessage({ command: 'loadSubscriptions' });
            showSuccess('Re-authenticating with Azure...');
        }

        function openAzureCLI() {
            showSuccess('Check the output channel for Azure CLI commands');
        }

        function showCreateWorkspace() {
            alert('Workspace creation will open Azure Portal or show CLI command');
            const subId = document.getElementById('subscriptionSelect').value;
            if (!subId) {
                showError('Please select a subscription first');
                return;
            }
            vscode.postMessage({ 
                command: 'createWorkspace',
                data: { subscriptionId: subId }
            });
        }

        function resetForm() {
            document.getElementById('configName').value = '';
            document.getElementById('subscriptionSelect').selectedIndex = 0;
            document.getElementById('workspaceSelect').innerHTML = '<option value="">Select a workspace...</option>';
            document.getElementById('sparkPoolSelect').innerHTML = '<option value="">Select a Spark pool...</option>';
        }

        function showError(message) {
            const container = document.getElementById('error-container');
            container.innerHTML = \`<div class="error">❌ \${message}</div>\`;
            setTimeout(() => container.innerHTML = '', 5000);
        }

        function showSuccess(message) {
            const container = document.getElementById('error-container');
            container.innerHTML = \`<div class="success">✅ \${message}</div>\`;
            setTimeout(() => container.innerHTML = '', 3000);
        }

        // Initial load
        vscode.postMessage({ command: 'refresh' });
    </script>
</body>
</html>`;
    }
}
