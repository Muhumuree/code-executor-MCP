# Sampling Setup Guide

## Status: ✅ WORKING

Sampling functionality is now fully operational after fixing a critical bug in `SamplingBridgeServer`.

## What Was Fixed

**Bug**: The `SamplingBridgeServer` constructor only created the LLM provider when `samplingMode === 'direct'`. When MCP sampling mode was detected (via `createMessage` method), the provider was never created, causing fallback to fail when MCP sampling failed.

**Fix**: Modified constructor to ALWAYS create the provider if not already provided, regardless of sampling mode. This ensures the provider is available as a fallback when MCP sampling fails.

**File**: `src/core/server/sampling-bridge-server.ts:228-245`

## Setup Instructions

### 1. Create Environment File

```bash
cp .env.example .env
```

### 2. Configure API Keys

Edit `.env` and add your API key:

```bash
CODE_EXECUTOR_SAMPLING_ENABLED=true
CODE_EXECUTOR_AI_PROVIDER=gemini
GEMINI_API_KEY=your_actual_api_key_here
```

Supported providers:
- `gemini` - Google Gemini (recommended for testing)
- `anthropic` - Claude (requires ANTHROPIC_API_KEY)
- `openai` - OpenAI (requires OPENAI_API_KEY)
- `grok` - xAI Grok (requires GROK_API_KEY)
- `perplexity` - Perplexity (requires PERPLEXITY_API_KEY)

### 3. Wrapper Script (Recommended)

The wrapper script (`start-with-env.sh`) loads environment variables from `.env` before starting the server.

**.mcp.json configuration:**
```json
{
  "mcpServers": {
    "code-executor": {
      "command": "/absolute/path/to/start-with-env.sh",
      "args": [],
      "env": {
        "MCP_CONFIG_PATH": "/path/to/.mcp.json",
        "DENO_PATH": "/path/to/deno",
        "ENABLE_AUDIT_LOG": "true",
        "AUDIT_LOG_PATH": "/path/to/audit.log",
        "ALLOWED_PROJECTS": "/path1:/path2",
        "PYTHON_SANDBOX_READY": "true"
      }
    }
  }
}
```

### 4. Test Sampling

```typescript
await mcp__code-executor__executeTypescript({
  code: `
    const result = await llm.ask('What is 2+2?');
    console.log('Result:', result);
  `,
  enableSampling: true,
  allowedSamplingModels: ['gemini-2.0-flash-exp']
});
```

## How It Works

1. **Wrapper Script**: `start-with-env.sh` loads env vars from `.env` using `source`
2. **Config Loader**: `getSamplingConfig()` reads env vars from `process.env`
3. **Provider Factory**: Creates the appropriate LLM provider (Gemini, Claude, etc.)
4. **Sampling Bridge**: Handles MCP sampling with fallback to direct API

## Troubleshooting

### Sampling Still Fails?

1. **Check env vars are loaded:**
   ```bash
   pgrep -f "node dist/index.js" | head -1 | xargs -I {} sh -c 'cat /proc/{}/environ | tr "\0" "\n" | grep GEMINI_API_KEY'
   ```

2. **Verify wrapper script is used:**
   ```bash
   ps aux | grep start-with-env
   ```

3. **Check .env file exists:**
   ```bash
   cat .env
   ```

4. **Restart server:**
   Use `/mcp` command to reconnect

### Known Issues

- **Claude Code Issue #1254**: Environment variables from `.mcp.json` may not propagate correctly. The wrapper script workaround addresses this.

## Related Files

- `/home/alexandrueremia/projects/code-executor-mcp/start-with-env.sh` - Wrapper script
- `/home/alexandrueremia/projects/code-executor-mcp/.env` - Environment variables (gitignored)
- `/home/alexandrueremia/projects/code-executor-mcp/.env.example` - Template
- `src/core/server/sampling-bridge-server.ts` - Bug fix location
- `src/config/loader.ts` - Config loading
- `src/sampling/providers/factory.ts` - Provider creation

## Summary

**The bug is FIXED and sampling is WORKING.** The wrapper script approach ensures reliable environment variable loading until Claude Code resolves their upstream issue.
