#!/bin/bash
# Helper script to safely remove a worktree
#
# Usage: ./remove-worktree.sh <branch-name>
# Example: ./remove-worktree.sh feature/new-feature

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <branch-name>"
    echo "Example: $0 feature/new-feature"
    exit 1
fi

BRANCH_NAME="$1"
WORKTREE_NAME="code-executor-mcp-$(echo $BRANCH_NAME | sed 's|/|-|g')"
WORKTREE_PATH="/home/alexandrueremia/projects/$WORKTREE_NAME"
MAIN_REPO="/home/alexandrueremia/projects/code-executor-mcp"

echo "Removing worktree for branch: $BRANCH_NAME"
echo "Worktree path: $WORKTREE_PATH"

# Check if worktree exists
if [ ! -d "$WORKTREE_PATH" ]; then
    echo "Error: Worktree does not exist at $WORKTREE_PATH"
    exit 1
fi

# Remove worktree (this also removes symlinks)
cd "$MAIN_REPO"
git worktree remove --force "../$WORKTREE_NAME"

echo "✓ Worktree removed successfully!"
