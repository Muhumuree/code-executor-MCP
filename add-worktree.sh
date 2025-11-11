#!/bin/bash
# Helper script to create a new worktree with symlinked planning files
#
# Usage: ./add-worktree.sh <branch-name>
# Example: ./add-worktree.sh feature/new-feature

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <branch-name>"
    echo "Example: $0 feature/new-feature"
    exit 1
fi

BRANCH_NAME="$1"
MAIN_REPO="/home/alexandrueremia/projects/code-executor-mcp"
WORKTREE_NAME="code-executor-mcp-$(echo $BRANCH_NAME | sed 's|/|-|g')"
WORKTREE_PATH="/home/alexandrueremia/projects/$WORKTREE_NAME"

echo "Creating worktree for branch: $BRANCH_NAME"
echo "Worktree path: $WORKTREE_PATH"

# Create worktree
cd "$MAIN_REPO"
git worktree add "../$WORKTREE_NAME" "$BRANCH_NAME"

# Create symlinks
cd "$WORKTREE_PATH"
ln -s ../code-executor-mcp/.specify .specify
ln -s ../code-executor-mcp/.bmad .bmad
ln -s ../code-executor-mcp/.bmad-ephemeral .bmad-ephemeral
ln -s ../code-executor-mcp/.claude .claude
ln -s ../code-executor-mcp/specs specs
ln -s ../code-executor-mcp/PUBLISHING.md PUBLISHING.md

echo ""
echo "✓ Worktree created successfully!"
echo "✓ Planning files symlinked:"
echo "  • .bmad/"
echo "  • .bmad-ephemeral/"
echo "  • .claude/"
echo "  • .specify/"
echo "  • specs/"
echo "  • PUBLISHING.md"
echo ""
echo "To use this worktree:"
echo "  cd $WORKTREE_PATH"
