# Change Log

All notable changes to the "synapse-notebook-editor" extension will be documented in this file.

## [0.4.5] - 2026-03-22

### Added

- 🚀 **GitHub Actions CI/CD**: Automated publishing to VS Code Marketplace
- ✅ **CI Workflow**: Automatic build and test on every push/PR
- 📦 **Publish Workflow**: Auto-publish to marketplace on main branch push
- 📚 **Setup Documentation**: Complete guide for PAT configuration
- 🎯 **Artifact Uploads**: VSIX files automatically uploaded after builds

### DevOps

- Automated extension publishing on version updates
- Build validation on pull requests
- Manual workflow trigger capability
- 30-day artifact retention for VSIX packages

### Repository

- Now hosted on GitHub: https://github.com/raj-iwt/synapse-notebook-editor
- Public repository with MIT license
- Automated release process configured

## [0.4.4] - 2026-03-22

### Fixed

- ⏱️ **Pipeline Sync Delay**: Added 2-second wait after pipeline creation for Azure registration
- 🔍 **Better Error Handling**: Separate error handling for pipeline creation vs execution
- 💬 **Improved Messages**: Clearer feedback about pipeline creation process
- ✅ **404 Troubleshooting**: Enhanced error messages with specific troubleshooting steps

### Technical Details

The "Entity not found" error occurred because Azure Synapse needs time to register pipelines after creation. The extension now:

1. Creates the pipeline
2. Waits 2 seconds for registration
3. Triggers the pipeline run
4. Monitors execution
5. Cleans up after completion

### Alternative: Upload-Only Mode

If execution continues to have issues, consider using the extension primarily for:

- Editing notebooks in VS Code
- Uploading to Synapse workspace
- Executing manually in Synapse Studio (better UI, logs, debugging)

## [0.4.3] - 2026-03-22

### Fixed

- 🔧 **HTTP 400 Error**: Fixed by switching from Livy batch API to Azure Synapse Pipeline API
- 🚀 **Proper Execution Method**: Now uses Pipeline with SynapseNotebook activity (enterprise standard)
- 🧹 **Pipeline Cleanup**: Automatically removes temporary pipelines after execution
- 📊 **Better Status Tracking**: Uses pipeline run status (Queued, InProgress, Succeeded, Failed)
- 💬 **Improved Messages**: Clearer feedback about pipeline creation and execution progress

### Technical Changes

- Execution now creates temporary pipeline with NotebookActivity
- Uses `/pipelines/{name}/createRun` API for execution
- Monitors via `/pipelineruns/{runId}` endpoint
- Automatic cleanup of temporary pipelines
- Better error messages with troubleshooting tips

### Why This Approach?

Azure Synapse doesn't provide a direct "execute notebook" REST API. The standard enterprise method is to use Pipelines with Notebook Activities, which is what major organizations use for programmatic notebook execution.

## [0.4.2] - 2026-03-22

### Fixed

- 🐛 **Notebook Execution API**: Fixed 404 error by using correct Livy Spark batch API
- 🔧 **Upload Payload**: Enhanced notebook upload with proper metadata structure
- 📡 **API Endpoints**: Switched from non-existent `/notebooks/{name}/execute` to Livy batches API
- ✅ **Status Mapping**: Proper mapping of Livy batch states to execution status
- 📝 **Error Messages**: Improved error messages with HTTP status codes and details

### Technical Changes

- Now uses Livy API (`/livyApi/versions/2019-11-01-preview/sparkPools/{pool}/batches`)
- Notebook upload includes required `a365ComputeOptions` metadata
- Batch job submission with Spark configurations
- Proper state mapping: success → Succeeded, error/dead → Failed, killed → Cancelled

## [0.4.1] - 2026-03-22

### Added

- 📊 **Workspace Status Bar**: Persistent status bar showing current workspace and Spark pool
- 🖱️ **Clickable Status**: Click workspace info to open configuration manager
- 🔄 **Auto-refresh**: Status bar updates automatically when configuration changes
- 📍 **Smart Display**: Shows only when Synapse notebooks are open
- ⚠️ **Configuration Warning**: Clear indicator when no workspace is configured

### Improved

- Separated execution status from workspace information
- Status bar provides quick access to configuration management
- Enhanced visibility of current workspace and pool selection
- Better user experience with always-visible workspace context

## [0.4.0] - 2026-03-22

### Added

- 📊 **Configuration Manager UI**: Rich webview panel for managing configurations
- 📋 **Multiple Configurations**: Save and switch between multiple workspace configurations
- 🔄 **Quick Switching**: Activate any saved configuration with one click
- 📁 **Configuration List**: View all saved configurations in a clean interface
- 🎯 **Tabbed Interface**: Organize features into tabs (Saved, New, Accounts)
- 🔗 **Workspace Creation Helper**: Guidance for creating new workspaces via Portal or CLI
- 💾 **Persistent Storage**: Configurations saved globally across VS Code sessions
- ⚙️ **Visual Selection**: Browse resources with descriptions and metadata
- 📝 **Configuration Details**: See subscription, resource group, and pool info
- 🗑️ **Delete Configurations**: Remove configurations you no longer need

### Commands

- `Synapse: Manage Configurations` - Opens the configuration manager webview

### User Experience

- Webview panel with tabs for different tasks
- Visual workspace selection with dropdowns
- Save multiple configurations with custom names
- One-click activation of saved configurations
- Configuration persistence across sessions
- Support for workspace creation workflows

## [0.3.0] - 2026-03-22

### Added

- 🎯 **Interactive Azure Resource Selection**: Browse and select from your Azure resources
- 📋 **Subscription Picker**: View and choose from all your Azure subscriptions
- 🏢 **Workspace Picker**: Select Synapse workspace from list (no more typing names!)
- ⚡ **Spark Pool Picker**: Choose Spark pool with size and node count information
- 🔍 **Resource Discovery**: Automatically discover all available resources
- 💾 **Enhanced Configuration**: Saves subscription ID and resource group for better tracking

### Improved

- Configuration wizard now uses Azure Resource Manager API
- Better error messages with troubleshooting tips
- Progress indicators during resource loading
- Detailed configuration output in output channel

### User Experience

- No need to know exact workspace/pool names
- Visual selection with descriptions (location, node info)
- Validates resources exist before saving configuration
- Single authentication flow for entire setup

## [0.2.0] - 2026-03-22

### Added

- 🚀 **Notebook Execution Support**: Upload and execute notebooks directly from VS Code
- 🔗 **Azure Synapse Integration**: Connect to your Synapse workspace with Azure authentication
- 📊 **Execution Status Tracking**: Real-time status updates in output channel and status bar
- 🔘 **Toolbar Buttons**: One-click "Upload and Execute" button in notebook toolbar
- ⚙️ **Workspace Configuration**: Easy setup wizard for Synapse workspace and Spark pool
- 📈 **Execution Monitoring**: Poll notebook runs and display completion status
- 💾 **Automatic Upload**: Notebooks are automatically uploaded before execution

### Features

- Configure Synapse workspace connection (workspace name, Spark pool)
- Azure AD authentication using DefaultAzureCredential
- Upload notebooks to Synapse workspace via REST API
- Execute notebooks on configured Spark pool
- Monitor execution status with progress updates
- View execution results in dedicated output channel
- Status bar integration showing current execution state

### Commands

- `Synapse: Configure Workspace` - Set up connection to Synapse workspace
- `Synapse: Upload and Execute Notebook` - Upload and run the current notebook

## [0.1.2] - 2026-03-21

### Changed

- Simplified extension to focus on editing capabilities only
- Removed kernel selection (not needed without execution support)
- Clarified in documentation that this is an editor-only extension

### Notes

- Cell execution requires Azure Synapse Studio or Synapse Spark pool connection
- Future versions may add Synapse workspace connectivity for execution

## [0.1.1] - 2026-03-21

### Added

- Kernel selection support (later removed in 0.1.2)

## [0.1.0] - 2026-03-19

### Added

- Initial release
- Basic notebook serialization for Azure Synapse notebooks
- Support for .synapse, .ipynb, and .json file formats
- Code and markdown cell editing
- Preservation of Synapse-specific metadata
- Commands:
  - Create New Notebook
  - Add Code Cell
  - Add Markdown Cell
- Support for Synapse magic commands (%%pyspark, %%sql, %%spark, %%csharp)
- Output preservation when editing notebooks
- Language detection for code cells

### Features

- Native VS Code notebook interface for Synapse notebooks
- Full metadata preservation (Big Data Pool, session properties, kernelspec)
- Multi-language support (Python, SQL, Scala, C#)
