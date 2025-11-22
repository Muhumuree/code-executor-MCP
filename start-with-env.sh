#!/bin/bash
# Wrapper script to start code-executor-mcp with environment variables
# Workaround for Claude Code issue #1254 (env vars not propagated to MCP servers)

set -e

# Load .env file if it exists
if [ -f .env ]; then
  echo "Loading environment variables from .env..." >&2
  set -a  # Automatically export all variables
  source .env
  set +a  # Disable auto-export
else
  echo "Warning: .env file not found. Copy .env.example to .env and configure." >&2
  exit 1
fi

# Start the MCP server
echo "Starting Code Executor MCP Server with environment variables..." >&2
exec node dist/index.js "$@"
