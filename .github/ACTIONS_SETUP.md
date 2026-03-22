# GitHub Actions Setup

This repository uses GitHub Actions for automated publishing to the VS Code Marketplace.

## Workflows

### 1. CI (`ci.yml`)
Runs on every push and pull request to `main`:
- Installs dependencies
- Compiles TypeScript
- Packages extension
- Uploads VSIX as artifact

### 2. Publish (`publish.yml`)
Automatically publishes to VS Code Marketplace:
- Triggers on push to `main` or release creation
- Compiles and packages extension
- Publishes to marketplace using VSCE_PAT token
- Uploads VSIX as artifact

## Setup Instructions

### 1. Create Personal Access Token (PAT) for VS Code Marketplace

1. Go to [Azure DevOps](https://dev.azure.com/)
2. Sign in with your Microsoft account
3. Click on **User Settings** (gear icon) → **Personal Access Tokens**
4. Click **+ New Token**
5. Configure:
   - **Name**: `VSCE Publishing Token` (or any name)
   - **Organization**: Select **All accessible organizations**
   - **Expiration**: Choose duration (recommend 1 year)
   - **Scopes**: Select **Custom defined**
   - Under **Marketplace**, check:
     - ✅ **Acquire**
     - ✅ **Publish**
     - ✅ **Manage**
6. Click **Create**
7. **IMPORTANT**: Copy the token immediately (you won't see it again)

### 2. Add PAT to GitHub Repository Secrets

1. Go to your GitHub repository: https://github.com/raj-iwt/synapse-notebook-editor
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add secret:
   - **Name**: `VSCE_PAT`
   - **Value**: Paste the PAT from step 1
5. Click **Add secret**

### 3. Verify Setup

Push a commit to `main` branch:
```bash
git add .github/
git commit -m "Add GitHub Actions workflows"
git push origin main
```

Check the **Actions** tab in your repository to see workflows running.

## Manual Trigger

You can manually trigger the publish workflow:
1. Go to **Actions** tab
2. Select **Publish Extension**
3. Click **Run workflow**
4. Choose branch and click **Run workflow**

## What Happens on Push

When you push to `main`:
1. **CI workflow** runs tests and validates build
2. **Publish workflow** automatically publishes to marketplace
3. Extension version in `package.json` must be updated for each publish

## Version Management

Before pushing to `main`, always update version in `package.json`:
```json
{
  "version": "0.4.5"  // Increment this
}
```

Also update `CHANGELOG.md` with changes.

## Publishing Schedule

- **Immediate**: On every push to `main` (if version changed)
- **Release-based**: Create GitHub release for major versions
- **Manual**: Trigger workflow manually if needed

## Troubleshooting

### "Extension already exists at this version"
- Update version number in `package.json`
- Commit and push again

### "Failed to publish: Unauthorized"
- Check that `VSCE_PAT` secret is set correctly
- Verify PAT hasn't expired
- Ensure PAT has correct marketplace permissions

### Workflow doesn't run
- Check that workflows are enabled in repository settings
- Verify `.yml` files are in `.github/workflows/` directory
- Check Actions tab for error messages
