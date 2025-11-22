---
argument-hint: <description>
description: Use proactively to debug and investigate issues in the MCP server
allowed-tools: Task, TodoWrite, Bash, Glob, Grep, Read, Edit, MultiEdit, Write, WebFetch, WebSearch, mcp__code-executor__executeTypescript
---

Debug $ARGUMENTS - MCP Server Investigation

## 🔍 DEBUGGING APPROACH

**Use inquisitor agent for systematic debugging:**

1. **Root Cause Analysis** - Trace error to origin
2. **Systematic Investigation** - Use logs, tests, and code inspection
3. **No Code Modification** - Investigation only, fixes happen in /fix

## 🛠️ DEBUGGING TOOLS

**Code Executor:** Use `mcp__code-executor__executeTypescript` for:
- Multi-file analysis
- Stateful investigation workflows
- Schema validation testing
- MCP client pool inspection

## 🎯 COMMON DEBUG SCENARIOS

**Schema Validation Issues:**
- Check AJV validation errors
- Inspect schema cache state
- Verify nested object/array validation

**Concurrency Issues:**
- Check AsyncLock mutex behavior
- Inspect race condition patterns
- Verify TTL expiration handling

**MCP Client Issues:**
- Check MCP server connections
- Verify transport protocols (STDIO/HTTP)
- Inspect tool schema retrieval

**Security Issues:**
- Check Deno sandbox permissions
- Verify dangerous pattern detection
- Inspect audit logs