# Quick Start: Executing Synapse Notebooks in VS Code

This guide will help you set up and start executing Azure Synapse notebooks directly from VS Code.

## Step 1: Install the Extension

1. Install the extension from VSIX file:
   - Open VS Code
   - Go to Extensions view (Ctrl+Shift+X)
   - Click `...` menu → "Install from VSIX..."
   - Select `synapse-notebook-editor-0.2.0.vsix`

## Step 2: Authenticate with Azure

Make sure you're authenticated with Azure. Choose one of these methods:

**Method A: Azure CLI**

```bash
az login
```

**Method B: VS Code Azure Account**

- Install the "Azure Account" extension
- Sign in to Azure from VS Code status bar

## Step 3: Configure Your Synapse Workspace (Interactive!)

1. Open Command Palette: `Ctrl+Shift+P`
2. Run: **"Synapse: Configure Workspace"**
3. Follow the interactive prompts:

   **a) Authentication**
   - Extension will authenticate with Azure automatically
   - Uses your Azure CLI or VS Code Azure Account credentials

   **b) Select Subscription**
   - A list of your Azure subscriptions will appear
   - Choose the subscription containing your Synapse workspace

   **c) Select Workspace**
   - See all Synapse workspaces in that subscription
   - Each shows location and resource group
   - Select your workspace

   **d) Select Spark Pool**
   - View all Spark pools in the workspace
   - Shows node size and count for each pool
   - Choose the pool you want to use

4. Configuration is saved automatically!

**What you'll see:**

```
Starting Azure Synapse configuration...
════════════════════════════════════════════════════════════
🔐 Authenticating with Azure...
Please sign in if prompted.
✓ Configuration saved:
  Subscription: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  Workspace: myworkspace
  Resource Group: my-rg
  Spark Pool: sparkpool1
🔗 Connecting to Synapse workspace...
✓ Successfully connected to Azure Synapse
```

## Step 4: Open a Notebook

Open any Synapse notebook file:

- `.synapse` files
- `.ipynb` files
- `.json` files with notebook content (use "Open With" → "Azure Synapse Notebook")

## Step 5: Execute the Notebook

**Using the Toolbar Button:**

1. Look for the **▶️ Run icon** in the notebook toolbar (top-right)
2. Click **"Upload and Execute"**

**Using the Command Palette:**

1. Press `Ctrl+Shift+P`
2. Run: **"Synapse: Upload and Execute Notebook"**

## What Happens Next

1. **Upload**: The notebook is uploaded to your Synapse workspace
2. **Execute**: Execution starts on your configured Spark pool
3. **Monitor**: Status updates appear in:
   - Output panel ("Synapse Notebook" channel)
   - Status bar (bottom of VS Code)
4. **Complete**: You'll get a notification when done

## Viewing Execution Status

### Output Channel

- View → Output → Select "Synapse Notebook"
- Shows detailed execution log
- Displays timestamps and status changes

### Status Bar

- Bottom-right of VS Code window
- Shows spinning icon while running
- Shows check mark ✓ on success
- Shows error icon on failure

## Example Output

```
Starting notebook execution: my-notebook
════════════════════════════════════════════════════════════
📤 Uploading notebook to Synapse...
✓ Upload complete

▶️  Starting execution...
✓ Execution started (Run ID: abc123...)

⏳ Waiting for completion...
[10:30:45] Status: Running
[10:31:50] Status: Running
[10:32:55] ✓ Execution completed successfully
End time: 2026-03-22T10:32:55Z
```

## Troubleshooting

### Authentication Failed

- Make sure you're logged in: `az login`
- Check you have proper role (Synapse Contributor or Administrator)
- Verify workspace name is correct

### Upload Failed

- Check workspace name is exactly as it appears in Azure Portal
- Ensure you have write permissions on the workspace
- Verify Spark pool exists and is running

### Execution Timeout

- Execution waits up to 5 minutes by default
- For longer-running notebooks, check Azure Synapse Studio for results
- Status may continue in the Synapse portal

### "No Synapse workspace configured"

- Run "Synapse: Configure Workspace" command first
- Configuration is saved globally for all VS Code sessions

## Tips

- **Save before executing**: Make sure to save your notebook first
- **Check Spark pool status**: Ensure your Spark pool is running (not paused)
- **View in Synapse Studio**: You can view the same notebook run in Synapse Studio
- **Re-configure**: Run configure command again to change workspace/pool

## Next Steps

- Create new notebooks with sample PySpark code
- Upload multiple notebooks to your workspace
- Monitor long-running jobs in Synapse Studio
- Configure bigger Spark pools for larger workloads

## Common Commands

| Command                      | Shortcut       | Description                 |
| ---------------------------- | -------------- | --------------------------- |
| Synapse: Configure Workspace |                | Set up workspace connection |
| Synapse: Upload and Execute  | Toolbar button | Run current notebook        |
| Synapse: Create New Notebook |                | Create blank notebook       |

## Need Help?

- Check the Output panel for detailed error messages
- Visit Azure Synapse Studio to verify workspace configuration
- Ensure Spark pool is in "Running" state, not "Paused"

Happy notebook editing and executing! 🚀
