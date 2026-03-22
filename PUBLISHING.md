# Publishing Guide

This guide will help you publish the Azure Synapse Notebook Editor extension to the VS Code Marketplace.

## Prerequisites

1. **Microsoft Account** - You'll need a Microsoft account to create a publisher
2. **Azure DevOps Organization** - Required for publishing
3. **Personal Access Token (PAT)** - To authenticate with the marketplace

## Step 1: Update Package Information

Before publishing, update these fields in `package.json`:

```json
{
  "publisher": "your-actual-publisher-name",
  "author": {
    "name": "Your Name"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/your-username/synapse-notebook-editor"
  }
}
```

## Step 2: Create a Publisher Account

1. Go to https://marketplace.visualstudio.com/manage
2. Sign in with your Microsoft account
3. Click **"Create Publisher"**
4. Choose a unique publisher ID (this will be your `publisher` field value)
5. Fill in display name and description
6. Save your publisher

## Step 3: Generate a Personal Access Token (PAT)

1. Go to https://dev.azure.com
2. Create or select an organization
3. Click on **User Settings** (top right) → **Personal Access Tokens**
4. Click **"+ New Token"**
5. Set these options:
   - **Name**: "VS Code Extension Publishing"
   - **Organization**: Select your organization
   - **Expiration**: Set your preferred expiration
   - **Scopes**: Select **"Marketplace" → "Manage"**
6. Click **"Create"**
7. **IMPORTANT**: Copy the token immediately (you won't see it again)

## Step 4: Install vsce (VS Code Extension CLI)

```powershell
npm install -g @vscode/vsce
```

## Step 5: Build and Package the Extension

```powershell
# Make sure everything compiles
npm run compile

# Package the extension
vsce package
```

This creates a `.vsix` file (e.g., `synapse-notebook-editor-0.1.0.vsix`)

## Step 6: Test the Package Locally

Before publishing, test the package:

1. Open VS Code
2. Go to Extensions view (Ctrl+Shift+X)
3. Click the `...` menu → **"Install from VSIX..."**
4. Select your `.vsix` file
5. Test all features thoroughly

## Step 7: Publish to Marketplace

### Option A: Using vsce (Recommended)

```powershell
# Login with your PAT
vsce login your-publisher-name

# Publish the extension
vsce publish
```

The `vsce publish` command will:

- Automatically increment the version
- Package the extension
- Upload to the marketplace

### Option B: Manual Upload

1. Go to https://marketplace.visualstudio.com/manage/publishers/your-publisher-name
2. Click **"+ New Extension"** → **"Visual Studio Code"**
3. Drag and drop your `.vsix` file
4. Click **"Upload"**

## Step 8: Verify Publication

1. Go to https://marketplace.visualstudio.com/
2. Search for "Azure Synapse Notebook Editor"
3. Verify your extension appears correctly
4. Wait 5-10 minutes for it to be available in VS Code

## Updating the Extension

When you want to publish updates:

```powershell
# Update version (patch/minor/major)
vsce publish patch  # 0.1.0 → 0.1.1
# or
vsce publish minor  # 0.1.0 → 0.2.0
# or
vsce publish major  # 0.1.0 → 1.0.0
```

## Important Notes

### What Gets Published

The `.vscodeignore` file controls what's included. These are excluded:

- `.vscode/` folder
- `src/` TypeScript source files
- `node_modules/`
- Test files
- `.git/` folder

### Best Practices

1. **Test Thoroughly**: Test in a clean VS Code install
2. **Version Numbers**: Follow semantic versioning (major.minor.patch)
3. **Changelog**: Update `CHANGELOG.md` with each release
4. **README**: Keep `README.md` updated with features and usage
5. **License**: Ensure `LICENSE` file is correct
6. **Icon**: Add an icon for better visibility (128x128 PNG)

### Adding an Icon

1. Create a 128x128 PNG icon
2. Save it as `icon.png` in the root folder
3. Add to `package.json`:
   ```json
   {
     "icon": "icon.png"
   }
   ```

## Security

- **Never commit your PAT** to version control
- Store PAT securely (password manager)
- Rotate PAT periodically
- Use scoped PAT (only "Marketplace: Manage")

## Troubleshooting

### "Publisher not found"

- Make sure you've created a publisher at the marketplace
- Use the exact publisher ID when logging in

### "Extension validation failed"

- Check `package.json` for required fields
- Ensure version is valid semver
- Verify all files referenced in package.json exist

### "File not found during packaging"

- Run `npm run package` to build first
- Check that `dist/extension.js` exists
- Verify webpack configuration

## Marketplace Statistics

After publishing, you can view:

- Install count
- Ratings and reviews
- Downloads over time

Access at: https://marketplace.visualstudio.com/manage/publishers/your-publisher-name

## Support and Updates

- Respond to issues on GitHub
- Monitor marketplace Q&A
- Update regularly with bug fixes
- Add new features based on user feedback

## Quick Reference

```powershell
# Install vsce
npm install -g @vscode/vsce

# Package
vsce package

# Login
vsce login your-publisher-name

# Publish
vsce publish

# Publish with version bump
vsce publish patch
vsce publish minor
vsce publish major

# Unpublish (use carefully!)
vsce unpublish your-publisher-name.synapse-notebook-editor
```

## Next Steps

1. Update `publisher` in package.json
2. Create publisher account
3. Generate PAT
4. Run `vsce package` to test
5. Install and test the .vsix locally
6. Run `vsce publish` to go live!

Good luck with your extension! 🚀
