# Release Process

This document describes how to create a new release of Shader3D.

## Prerequisites

1. **npm Account**: You need an npm account with publish access to the `@shader3d` organization
2. **NPM_TOKEN**: A GitHub secret `NPM_TOKEN` must be set with your npm authentication token
3. **Permissions**: You need write access to the repository

## Creating a Release

### 1. Update Version Numbers

Update the version in all package.json files:

```bash
# Update version in each package
npm version <new-version> --workspaces --no-git-tag-version
```

Or manually update:
- `packages/core/package.json`
- `packages/runtime/package.json`
- `packages/vite-plugin/package.json`
- `packages/ladder/package.json`

### 2. Update Changelog

Update CHANGELOG.md with the new version's changes.

### 3. Commit and Tag

```bash
git add .
git commit -m "chore: release v<version>"
git tag v<version>
git push origin main --tags
```

### 4. Automatic Release

Once you push the tag, the GitHub Actions workflow will:
1. Create a GitHub Release
2. Build all packages
3. Publish to npm

## Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features, backward compatible
- **PATCH** (0.0.1): Bug fixes, backward compatible

### Pre-release Versions

- `v0.1.0-alpha.1` - Alpha release (unstable, for testing)
- `v0.1.0-beta.1` - Beta release (feature complete, testing)
- `v0.1.0-rc.1` - Release candidate (final testing)

## Manual Publishing

If you need to publish manually:

```bash
# Build all packages
npm run build

# Publish each package
cd packages/core && npm publish --access public
cd ../runtime && npm publish --access public
cd ../vite-plugin && npm publish --access public
cd ../ladder && npm publish --access public
```

## Troubleshooting

### npm Token Issues

If publishing fails with authentication errors:
1. Generate a new npm token: `npm token create`
2. Update the `NPM_TOKEN` secret in GitHub repository settings

### Build Failures

If the build fails:
1. Check the CI logs for errors
2. Run `npm run build` locally to reproduce
3. Fix any TypeScript or build errors

### Failed Publish

If npm publish fails:
1. Check if the version already exists on npm
2. Verify the package name is correct
3. Ensure you have publish permissions
