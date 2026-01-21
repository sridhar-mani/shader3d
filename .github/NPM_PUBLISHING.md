# NPM Publishing Setup Guide

## Prerequisites for Publishing

### 1. NPM Account Setup
- Create an account at [npmjs.com](https://www.npmjs.com/signup)
- Verify your email address
- Enable 2FA (Two-Factor Authentication) for security

### 2. Create NPM Access Token

**Steps:**
1. Log in to npmjs.com
2. Click your profile picture → Access Tokens
3. Click "Generate New Token"
4. Select **"Automation"** type (for CI/CD)
5. Copy the token (you won't see it again!)

### 3. Add NPM_TOKEN to GitHub Secrets

**Steps:**
1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `NPM_TOKEN`
5. Value: Paste your npm token
6. Click "Add secret"

## Package Names & Scopes

Your packages use the `@shader3d` scope:
- `@shader3d/core`
- `@shader3d/runtime`
- `@shader3d/vite-plugin`
- `@shader3d/ladder`

### Important Notes:

1. **First-time publishing**: These packages don't need to exist beforehand
2. **Scoped packages**: By default, scoped packages are private (paid feature)
3. **Public publishing**: The workflow uses `--access public` flag to publish as public packages (free)

## Publishing Workflow

### Option 1: Manual Workflow Dispatch (Recommended for Beta)

1. Go to GitHub Actions tab
2. Select "Publish to npm" workflow
3. Click "Run workflow"
4. Fill in:
   - **Version**: `0.1.0-beta.1` (or your desired version)
   - **Tag**: `beta`
   - **Dry run**: Check this first to test without publishing
5. Click "Run workflow"

### Option 2: Git Tag (Automated)

```bash
# Update version in all package.json files first
npm version 0.1.0-beta.1 --workspaces

# Create and push tag
git tag v0.1.0-beta.1
git push origin v0.1.0-beta.1
```

This triggers both:
- Release workflow (creates GitHub release)
- Publish workflow (publishes to npm)

## Pre-Publishing Checklist

- [ ] NPM token added to GitHub secrets
- [ ] All package.json files have correct version
- [ ] All packages build successfully (`npm run build`)
- [ ] Test with dry-run first
- [ ] Verify package names are available on npm (search npmjs.com)

## Troubleshooting

### "Package name already exists"
- Change package names in all package.json files
- Or request transfer if you own the existing package

### "Authentication failed"
- Verify NPM_TOKEN secret is set correctly
- Check token hasn't expired
- Ensure token has "Automation" permissions

### "Access denied"
- Make sure you're logged into the npm account that owns the scope
- For first-time scoped packages, you may need to create the scope on npmjs.com first

## Beta Release Strategy

For beta releases:
1. Use version like `0.1.0-beta.1`
2. Use npm tag `beta` (not `latest`)
3. Users install with: `npm install @shader3d/core@beta`

For production:
1. Use version like `1.0.0`
2. Use npm tag `latest`
3. Users install with: `npm install @shader3d/core`
