# Azure Synapse Notebook Editor

A Visual Studio Code extension for editing, uploading, and executing Azure Synapse notebooks directly from VS Code.

## Features

- **🚀 Upload & Execute**: Upload and run notebooks on your Synapse Spark pool directly from VS Code
- **📊 Real-time Status**: Monitor notebook execution with live status updates
- **🔗 Azure Integration**: Connect to your Synapse workspace with Azure authentication
- **Native Notebook Support**: Edit Azure Synapse notebooks (`.synapse`, `.ipynb`, and `.json` files) with VS Code's built-in notebook interface
- **Code Cell Support**: Create and edit PySpark, SQL, Scala, and C# cells
- **Markdown Cells**: Add documentation and markdown cells to your notebooks
- **Synapse Metadata**: Preserves all Synapse-specific metadata including:
  - Big Data Pool configurations
  - Session properties (driver/executor settings)
  - Kernel specifications
  - Widget state
- **Magic Commands**: Full support for Synapse magic commands (`%%pyspark`, `%%sql`, `%%spark`, `%%csharp`)
- **Output Preservation**: Maintains cell outputs when editing notebooks
- **JSON Support**: Open and edit JSON files containing Synapse notebook content

## Installation

### From Source

1. Clone this repository
2. Run `npm install` to install dependencies
3. Press F5 to open a new VS Code window with the extension loaded
4. Create or open a `.synapse` or `.ipynb` file

### From VSIX

1. Download the `.vsix` file from releases
2. In VS Code, go to Extensions view (Ctrl+Shift+X)
3. Click the `...` menu and select "Install from VSIX..."
4. Select the downloaded `.vsix` file

## Usage

### Setting Up Synapse Connection

Before executing notebooks, configure your Synapse workspace with our **interactive wizard**:

1. Open Command Palette (Ctrl+Shift+P)
2. Run **"Synapse: Configure Workspace"**
3. The wizard will guide you through:
   - **Azure Authentication** - Sign in once
   - **Select Subscription** - Choose from your Azure subscriptions
   - **Select Workspace** - Pick from available Synapse workspaces
   - **Select Spark Pool** - Choose the Spark pool to use

No need to remember exact names - just browse and select from lists!

### Executing Notebooks

Once configured, you can execute notebooks directly:

**Option 1: Toolbar Button**

- Open any Synapse notebook
- Click the **"Upload and Execute"** button (▶️ icon) in the notebook toolbar

**Option 2: Command Palette**

- Open Command Palette (Ctrl+Shift+P)
- Run **"Synapse: Upload and Execute Notebook"**

**What happens:**

1. Notebook is uploaded to your Synapse workspace
2. Execution starts on the configured Spark pool
3. Status updates appear in the "Synapse Notebook" output channel
4. Status bar shows real-time progress
5. Notification when execution completes

### Creating a New Notebook

1. Open the Command Palette (Ctrl+Shift+P)
2. Type "Synapse: Create New Notebook"
3. A new notebook will open with a default Python cell

### Opening Existing Notebooks

**Standard Formats:**

- `.synapse` files - Open automatically as notebooks
- `.ipynb` files - Open automatically as notebooks

**JSON Files:**

- Right-click any `.json` file with notebook content
- Select **"Open With..."** → **"Azure Synapse Notebook"**
- The file will open as an editable notebook in the same tab
- All changes save back to the original JSON file

### Adding Cells

**Via Command Palette:**

- "Synapse: Add Code Cell" - Adds a new code cell
- "Synapse: Add Markdown Cell" - Adds a new markdown cell

**Via Notebook UI:**

- Use the `+` buttons in the notebook toolbar
- Click between cells to add new cells

### Language Support

The extension supports multiple languages for code cells:

- **Python/PySpark** - Default language for Synapse notebooks
- **SQL** - Use `%%sql` magic command
- **Scala** - Use `%%spark` magic command
- **C#** - Use `%%csharp` magic command

### Magic Commands

Use Synapse magic commands at the beginning of cells:

```python
%%pyspark
df = spark.read.csv("abfss://...")
df.show()
```

```sql
%%sql
SELECT * FROM database.table LIMIT 10
```

## Configuration

The extension preserves Synapse-specific settings in the notebook metadata:

- **Big Data Pool**: Spark pool configuration
- **Session Properties**: Driver and executor settings
- **Kernel Specifications**: Language and kernel settings

These are automatically preserved when editing and saving notebooks.

## File Formats

The extension supports:

- `.synapse` files - Synapse-specific notebook format (opens as notebook by default)
- `.ipynb` files - Standard Jupyter notebook format with Synapse metadata (opens as notebook by default)
- `.json` files - JSON files with Synapse notebook structure (opens as notebook via "Open With..." menu)

All formats use the same underlying JSON structure with Synapse-specific extensions.

## Cell Execution

**Important:** This extension does not support cell execution. To execute notebook cells:

1. **Azure Synapse Studio**: Upload your notebook to [synapse.azure.com](https://synapse.azure.com) and execute there
2. **Synapse Spark Pool**: Use Azure Synapse Analytics with a configured Spark pool
3. **Future**: Synapse workspace connectivity may be added in future versions

## Development

### Building

```bash
npm install
npm run compile
```

### Running Tests

```bash
npm test
```

### Packaging

```bash
npm run package
vsce package
```

## Prerequisites

### For Editing Only

- Visual Studio Code 1.85.0 or higher

### For Notebook Execution

- Azure Synapse Analytics workspace
- Apache Spark pool configured in your workspace
- Azure authentication (Azure CLI or VS Code Azure account)
- Synapse Contributor or Administrator role

## Requirements

- Visual Studio Code 1.85.0 or higher
- Node.js 18.x or higher (for development)

## Known Issues

- Individual cell execution (like Jupyter kernels) is not supported - only full notebook execution
- Some advanced Synapse features may require the Synapse Studio interface
- Execution monitoring is polled every 5 seconds (not real-time streaming)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for release history.

## Support

For issues and feature requests, please visit the [GitHub repository](https://github.com/your-repo/synapse-notebook-editor).
