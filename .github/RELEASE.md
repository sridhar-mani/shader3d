# Release Process

Releases are automated via GitHub Actions.

## Automatic Release

Commit with conventional commit messages:

```bash
git commit -m "fix: resolve parsing issue"   # patch bump
git commit -m "feat: add compute shaders"    # minor bump
git commit -m "feat!: breaking API change"   # major bump
git push origin main
```

The workflow will:
1. Detect version bump from commit messages
2. Update all package.json files
3. Create git tag
4. Create GitHub Release
5. Publish to npm

## Manual Release

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Pre-release

```bash
git tag v0.1.0-beta.1
git push origin v0.1.0-beta.1
```

Beta/alpha/rc tags are published with matching npm tags.
