# Development Setup Guide

This guide will help you set up and run the Azure Synapse Notebook Editor extension.

## Prerequisites

- **Node.js**: Version 18.x or higher
- **npm**: Comes with Node.js
- **Visual Studio Code**: Version 1.85.0 or higher

## Setup Steps

### 1. Install Dependencies

Open a terminal in the project root and run:

```bash
npm install
```

This will install all required dependencies including:

- TypeScript
- VS Code extension API types
- Webpack and build tools
- ESLint for code linting

### 2. Build the Extension

Compile the TypeScript code:

```bash
npm run compile
```

Or watch for changes during development:

```bash
npm run watch
```

### 3. Run the Extension

1. Open this folder in VS Code
2. Press **F5** to launch the Extension Development Host
3. A new VS Code window will open with the extension loaded
4. In the new window, open or create a `.synapse` or `.ipynb` file
5. The notebook should open in VS Code's notebook editor

### 4. Test the Extension

In the Extension Development Host window:

1. **Open Sample Notebook**: Open `sample.synapse` file
2. **Create New Notebook**:
   - Press Ctrl+Shift+P
   - Type "Synapse: Create New Notebook"
3. **Add Cells**:
   - Use the `+` buttons in the toolbar
   - Or use Command Palette commands
4. **Edit Cells**: Click on cells to edit code or markdown
5. **Save Changes**: Ctrl+S to save the notebook

## Development Workflow

### Making Changes

1. Edit files in the `src/` directory
2. The extension will automatically recompile if you're running `npm run watch`
3. Press Ctrl+R in the Extension Development Host to reload the extension
4. Test your changes

### Debugging

- Set breakpoints in your TypeScript code
- Use the Debug Console in the main VS Code window
- View console output in the Extension Development Host's Developer Tools (Help > Toggle Developer Tools)

## Project Structure

```
synapse_notebook/
├── src/
│   ├── extension.ts              # Main extension entry point
│   ├── notebookSerializer.ts     # Notebook serialization logic
│   └── synapseNotebookTypes.ts   # Type definitions
├── .vscode/
│   ├── launch.json               # Debug configuration
│   ├── tasks.json                # Build tasks
│   └── settings.json             # Workspace settings
├── dist/                         # Compiled output (generated)
├── node_modules/                 # Dependencies (generated)
├── package.json                  # Extension manifest
├── tsconfig.json                 # TypeScript configuration
├── webpack.config.js             # Webpack build configuration
└── README.md                     # Documentation
```

## Building for Distribution

To create a `.vsix` package for distribution:

1. Install vsce (if not already installed):

   ```bash
   npm install -g @vscode/vsce
   ```

2. Package the extension:

   ```bash
   npm run package
   vsce package
   ```

3. This creates a `.vsix` file you can distribute or install

## Common Issues

### Extension Not Loading

- Make sure you ran `npm install`
- Check that compilation succeeded: `npm run compile`
- Look for errors in the Debug Console

### Changes Not Appearing

- Reload the Extension Development Host: Ctrl+R
- Make sure watch mode is running: `npm run watch`
- Check the Problems panel for TypeScript errors

### Notebook Not Opening

- Verify the file extension is `.synapse` or `.ipynb`
- Check the Developer Tools console for errors (Help > Toggle Developer Tools)
- Make sure the notebook has valid JSON syntax

## Next Steps

### Adding Features

Some ideas for enhancement:

- **Kernel Support**: Add actual PySpark/SQL kernel execution
- **Azure Integration**: Connect to Azure Synapse workspace
- **Code Completion**: Add IntelliSense for Spark APIs
- **Cell Execution**: Implement cell execution capabilities
- **Output Formatting**: Enhanced rendering for charts and tables

### Testing

Consider adding:

- Unit tests for the serializer
- Integration tests for notebook operations
- Test notebooks with various cell types and outputs

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Notebook API](https://code.visualstudio.com/api/extension-guides/notebook)
- [Azure Synapse Documentation](https://docs.microsoft.com/azure/synapse-analytics/)
- [Jupyter Notebook Format](https://nbformat.readthedocs.io/)

## Support

If you encounter issues:

1. Check the Debug Console for errors
2. Review the VS Code extension logs
3. Open an issue on GitHub with details
