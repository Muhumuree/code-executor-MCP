# Git Worktrees Setup Guide

## Overview

This repository uses git worktrees to work on multiple branches simultaneously while sharing planning files across all branches.

## Architecture

- **Main worktree** (`develop` branch): `/home/alexandrueremia/projects/code-executor-mcp`
  - Contains the REAL planning directories (source of truth)
- **Additional worktrees**: One per branch, located in `/home/alexandrueremia/projects/`
  - Use symlinks to access shared planning files

## Shared Planning Files

These files/directories are shared across ALL worktrees:
- `.bmad/` - BMAD framework state
- `.bmad-ephemeral/` - Sprint status, stories, context files
- `.specify/` - Workflow scripts, templates, memory
- `.claude/` - AI agent instructions
- `specs/` - Feature specifications
- `PUBLISHING.md` - Publishing documentation

All files are stored ONCE in the `develop` branch worktree and symlinked elsewhere.

## Existing Worktrees

| Branch | Worktree Path |
|--------|---------------|
| `develop` | `/home/alexandrueremia/projects/code-executor-mcp` (main) |
| `main` | `/home/alexandrueremia/projects/code-executor-mcp-main` |
| `001-in-sandbox-discovery` | `/home/alexandrueremia/projects/code-executor-mcp-001-discovery` |

## Common Operations

### List all worktrees
```bash
cd ~/projects/code-executor-mcp
git worktree list
```

### Add a new worktree (EASY WAY)
```bash
./add-worktree.sh <branch-name>

# Example: Create worktree for existing branch
./add-worktree.sh feature/new-feature

# Example: Create worktree for new branch
git branch feature/amazing-feature
./add-worktree.sh feature/amazing-feature
```

### Add a new worktree (MANUAL WAY)
```bash
# 1. Create worktree
cd ~/projects/code-executor-mcp
git worktree add ../code-executor-mcp-<branch-name> <branch-name>

# 2. Create symlinks
cd ../code-executor-mcp-<branch-name>
ln -s ../code-executor-mcp/.specify .specify
ln -s ../code-executor-mcp/.bmad .bmad
ln -s ../code-executor-mcp/.bmad-ephemeral .bmad-ephemeral
ln -s ../code-executor-mcp/.claude .claude
ln -s ../code-executor-mcp/specs specs
ln -s ../code-executor-mcp/PUBLISHING.md PUBLISHING.md

# 3. Verify
ls -la | grep -E '(\.bmad|\.specify|\.claude|specs|PUBLISHING)'
```

### Remove a worktree (EASY WAY)
```bash
./remove-worktree.sh <branch-name>

# Example
./remove-worktree.sh feature/new-feature
```

### Remove a worktree (MANUAL WAY)
```bash
# From the main worktree
cd ~/projects/code-executor-mcp
git worktree remove --force ../code-executor-mcp-<branch-name>
```

### Switch between worktrees
```bash
# Just use cd!
cd ~/projects/code-executor-mcp                # develop
cd ~/projects/code-executor-mcp-main           # main
cd ~/projects/code-executor-mcp-001-discovery  # 001-in-sandbox-discovery
```

### Update planning files (visible in ALL worktrees)
```bash
# Edit from ANY worktree - changes appear everywhere
cd ~/projects/code-executor-mcp-main
echo "Story 2-1" >> .bmad-ephemeral/sprint-status.yaml

# Immediately visible in other worktrees
cat ~/projects/code-executor-mcp/.bmad-ephemeral/sprint-status.yaml
```

## How .specify/ Scripts Work with Worktrees

**Branch-aware scripts detect the correct branch:**

```bash
# Run script from main worktree
cd ~/projects/code-executor-mcp-main
.specify/scripts/common.sh get_current_branch

# Returns: "main" (correct!)
# Even though script file lives in develop worktree,
# git commands execute in the CURRENT worktree context
```

**Why this works:**
- Scripts use `git rev-parse --abbrev-ref HEAD`
- Git commands execute in the working directory (not where script lives)
- Each worktree has its own `.git` file pointing to the correct branch

## Important Notes

### DO's ✓
- Edit planning files from any worktree (they're shared)
- Use `git worktree list` to see all worktrees
- Use helper scripts for consistency
- Keep `develop` worktree as the canonical location for planning files

### DON'Ts ✗
- Don't delete the main `develop` worktree (contains real planning files)
- Don't commit planning files (they're .gitignored)
- Don't manually delete worktree directories (use `git worktree remove`)
- Don't break symlinks (they point to develop worktree)

## Troubleshooting

### Symlink appears broken
```bash
# Check if develop worktree still exists
ls ~/projects/code-executor-mcp/.bmad-ephemeral

# Recreate symlink if needed
cd <worktree-path>
rm -f .bmad-ephemeral
ln -s ../code-executor-mcp/.bmad-ephemeral .bmad-ephemeral
```

### Planning files not visible
```bash
# Verify symlinks exist
ls -la <worktree-path> | grep -E '(\.bmad|\.specify|specs|PUBLISHING)'

# If missing, recreate them
cd <worktree-path>
ln -s ../code-executor-mcp/.bmad .bmad
ln -s ../code-executor-mcp/.bmad-ephemeral .bmad-ephemeral
ln -s ../code-executor-mcp/.claude .claude
ln -s ../code-executor-mcp/.specify .specify
ln -s ../code-executor-mcp/specs specs
ln -s ../code-executor-mcp/PUBLISHING.md PUBLISHING.md
```

### Git shows planning files in status
```bash
# This shouldn't happen (.gitignore covers them)
# If it does, check .gitignore is correct
cat .gitignore | grep -E '(bmad|specify|specs|PUBLISHING|claude)'
```

## Benefits of This Setup

1. **Work on multiple branches simultaneously** without switching
2. **Shared planning context** - one set of stories/specs for all branches
3. **No git pollution** - planning files never committed
4. **Easy branch comparison** - open multiple worktrees in different terminals
5. **IDE-friendly** - each worktree is a separate directory (can open multiple VS Code windows)
6. **No data loss on merge** - planning files created on any branch immediately available everywhere

## Maintenance

### Prune deleted worktrees
```bash
cd ~/projects/code-executor-mcp
git worktree prune
```

### Check worktree status
```bash
cd ~/projects/code-executor-mcp
git worktree list
```

---

**Created:** 2025-11-11
**Last Updated:** 2025-11-11
