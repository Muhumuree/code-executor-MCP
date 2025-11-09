# Release Guide

This document describes the release process for `code-executor-mcp`.

## Pre-Release Checklist

- [ ] All tests passing (`npm test`)
- [ ] Type checking clean (`npm run typecheck`)
- [ ] Build successful (`npm run build`)
- [ ] Version number updated in `package.json`
- [ ] CHANGELOG.md updated with release notes
- [ ] Documentation reviewed and updated
- [ ] Security audit clean (`npm audit`)

## Release Process

### 1. Prepare Release

```bash
# Ensure clean working directory
git status

# Run all checks
npm run typecheck && npm test && npm run build

# Update version (choose one)
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0
```

### 2. Create GitHub Release

```bash
# Push version tag
git push origin main --tags

# Create GitHub release
# Go to: https://github.com/aberemia24/code-executor-MCP/releases/new
# - Select the version tag
# - Add release title: "v1.0.0 - Initial Release"
# - Add release notes from CHANGELOG.md
# - Publish release
```

### 3. Automated Publishing

When you publish a GitHub release, the GitHub Actions workflow will automatically:
1. Run all tests
2. Build the package
3. Publish to npm with provenance

**No manual npm publish needed!**

### 4. Manual Publishing (if needed)

If automatic publishing fails, you can publish manually:

```bash
# Login to npm (one time)
npm login

# Publish with provenance
npm publish --provenance --access public
```

## Version Strategy

- **Patch** (1.0.x) - Bug fixes, security patches
- **Minor** (1.x.0) - New features, backward compatible
- **Major** (x.0.0) - Breaking changes

## Post-Release

1. **Verify npm package**: https://www.npmjs.com/package/code-executor-mcp
2. **Test installation**: `npm install -g code-executor-mcp@latest`
3. **Update documentation** if needed
4. **Announce release** on GitHub Discussions

## Troubleshooting

### Publish fails with "need auth"

```bash
# Create npm token: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
# Add to GitHub secrets as NPM_TOKEN
```

### CI fails on tests

Check the GitHub Actions logs:
https://github.com/aberemia24/code-executor-MCP/actions

### Package size too large

Check what's being included:
```bash
npm pack --dry-run
```

Adjust `.npmignore` or `files` field in `package.json`.

## Release Notes Template

```markdown
## v1.0.0 - YYYY-MM-DD

### Features
- ✨ New TypeScript executor with Deno sandbox
- ✨ Python execution support (optional)
- ✨ Rate limiting with token bucket algorithm
- ✨ Configuration discovery system

### Security
- 🔒 Enhanced audit logging
- 🔒 Dangerous pattern detection (JS/TS + Python)
- 🔒 Path validation and sandboxing

### Documentation
- 📖 Comprehensive README with examples
- 📖 Security policy (SECURITY.md)
- 📖 Contributing guidelines (CONTRIBUTING.md)

### Testing
- ✅ 105 tests passing
- ✅ 90%+ coverage
- ✅ CI/CD with GitHub Actions

### Breaking Changes
None

### Migration Guide
First release - no migration needed.
```

## Support

- **Issues**: https://github.com/aberemia24/code-executor-MCP/issues
- **Email**: aberemia@gmail.com
- **Documentation**: https://github.com/aberemia24/code-executor-MCP#readme
