# Pre-Publishing Checklist

Before you can publish the extension, complete these steps:

## 1. Update Publisher Information

Edit `package.json` and replace these placeholders:

```json
{
  "publisher": "your-publisher-name", // ← Change this to your publisher ID
  "author": {
    "name": "Your Name" // ← Change this to your name
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/your-username/synapse-notebook-editor" // ← Update URL
  },
  "bugs": {
    "url": "https://github.com/your-username/synapse-notebook-editor/issues" // ← Update URL
  },
  "homepage": "https://github.com/your-username/synapse-notebook-editor#readme" // ← Update URL
}
```

## 2. Create a Publisher Account

If you don't have a publisher account yet:

1. Go to https://marketplace.visualstudio.com/manage
2. Sign in with your Microsoft account
3. Click **"Create Publisher"**
4. Choose a unique publisher ID (use this in package.json)

## 3. Create a Personal Access Token (PAT)

1. Go to https://dev.azure.com
2. Click **User Settings** → **Personal Access Tokens**
3. Click **"+ New Token"**
4. Set:
   - Name: "VS Code Extension Publishing"
   - Scopes: **Marketplace (Manage)**
5. Copy the token (you won't see it again!)

## 4. (Optional) Add an Icon

Create a 128x128 PNG icon named `icon.png` in the root folder, then add to package.json:

```json
{
  "icon": "icon.png"
}
```

## 5. Package the Extension

```powershell
vsce package
```

This creates a `.vsix` file you can test locally.

## 6. Test Locally

1. Open VS Code
2. Extensions view → `...` menu → **"Install from VSIX..."**
3. Select your `.vsix` file
4. Test thoroughly!

## 7. Publish

```powershell
# Login with your publisher name
vsce login your-actual-publisher-name

# When prompted, paste your PAT

# Publish
vsce publish
```

## Done!

Your extension will be available on the marketplace in 5-10 minutes at:
`https://marketplace.visualstudio.com/items?itemName=your-publisher-name.synapse-notebook-editor`

---

See [PUBLISHING.md](PUBLISHING.md) for detailed instructions.
