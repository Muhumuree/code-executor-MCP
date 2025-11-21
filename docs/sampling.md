# MCP Sampling Guide

**Version:** 0.4.0
**Status:** Beta
**Last Updated:** 2025-01-20

## Table of Contents

1. [What is MCP Sampling?](#what-is-mcp-sampling)
2. [Why Use Sampling?](#why-use-sampling)
3. [How It Works](#how-it-works)
4. [Quick Start](#quick-start)
5. [API Reference](#api-reference)
6. [Security Model](#security-model)
7. [Configuration](#configuration)
8. [Troubleshooting](#troubleshooting)
9. [Performance](#performance)
10. [FAQ](#faq)

---

## What is MCP Sampling?

MCP Sampling enables TypeScript and Python code running in sandboxed environments to invoke Claude (via Anthropic's API) through a simple interface. Instead of just executing code, your sandbox can now "ask Claude for help" during execution.

**Key Features:**
- Simple API: `llm.ask(prompt)` and `llm.think({messages, ...})`
- Security-first design: rate limiting, content filtering, system prompt allowlist
- Automatic redaction: Secrets and PII detected and filtered from responses
- Audit logging: All sampling calls logged with SHA-256 hashes (no plaintext)
- Dual runtime support: TypeScript (Deno) and Python (Pyodide)

---

## Why Use Sampling?

### Use Cases

**1. Code Analysis with Context**
```typescript
// Analyze code and ask Claude for insights
const code = await callMCPTool('mcp__filesystem__read_file', { path: './complex.ts' });
const analysis = await llm.ask(`Analyze this code for security issues:\n\n${code}`);
console.log(analysis);
```

**2. Multi-Step Reasoning**
```python
# Python example: Multi-turn conversation
response1 = await llm.think([
    {"role": "user", "content": "What are the top 3 security risks in web apps?"}
])
print(response1)

# Follow-up question
response2 = await llm.think([
    {"role": "user", "content": "What are the top 3 security risks in web apps?"},
    {"role": "assistant", "content": response1},
    {"role": "user", "content": "How do I prevent XSS attacks?"}
])
print(response2)
```

**3. Data Processing with LLM**
```typescript
// Process each file with Claude
const files = await callMCPTool('mcp__filesystem__list_directory', { path: './data' });
for (const file of files.entries) {
  const content = await callMCPTool('mcp__filesystem__read_file', { path: file.path });
  const summary = await llm.ask(`Summarize this document: ${content}`);
  console.log(`${file.name}: ${summary}`);
}
```

---

## How It Works

### Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│ Sandbox (Deno/Pyodide)                              │
│                                                     │
│  User Code:  await llm.ask("prompt")                │
│       ↓                                              │
│  Bridge Client: HTTP POST to localhost:PORT         │
└─────────────────────────────────────────────────────┘
              ↓ (Bearer Token Auth)
┌─────────────────────────────────────────────────────┐
│ SamplingBridgeServer (Ephemeral HTTP Server)        │
│                                                     │
│  1. ✅ Validate Bearer Token (timing-safe)          │
│  2. ✅ Check Rate Limits (10 rounds, 10k tokens)    │
│  3. ✅ Validate System Prompt (allowlist)           │
│  4. 🔄 Forward to Claude API (Anthropic SDK)        │
│  5. ✅ Filter Response (secrets/PII redaction)      │
│  6. 📝 Audit Log (SHA-256 hashes only)              │
│       ↓                                              │
│  Return: { response, tokensUsed, durationMs }       │
└─────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────┐
│ Claude API (Anthropic)                              │
│                                                     │
│  Model: claude-sonnet-4-5 (default)                 │
│  Response: { content, stop_reason, usage }          │
└─────────────────────────────────────────────────────┘
```

### Security Layers

1. **Bearer Token Authentication**: Each bridge server session generates a unique 256-bit cryptographically secure token. Only code with this token can access Claude.

2. **Rate Limiting**: Prevents infinite loops and resource exhaustion:
   - Max 10 rounds per execution (configurable)
   - Max 10,000 tokens per execution (configurable)
   - Returns 429 with quota remaining when exceeded

3. **System Prompt Allowlist**: Only pre-approved system prompts are allowed. Default allowlist:
   - Empty string (no system prompt)
   - "You are a helpful assistant"
   - "You are a code analysis expert"

4. **Content Filtering**: Automatically detects and redacts:
   - **Secrets**: OpenAI keys (sk-...), GitHub tokens (ghp_...), AWS keys (AKIA*), JWT tokens (eyJ...)
   - **PII**: Emails, SSNs, credit card numbers
   - Redaction format: `[REDACTED_SECRET]` or `[REDACTED_PII]`

5. **Audit Logging**: All sampling calls logged with:
   - Timestamp, execution ID, round number
   - Model, token usage, duration
   - SHA-256 hashes of prompts/responses (no plaintext)
   - Content filter violations (type and count)

---

## Quick Start

### 1. Enable Sampling

**Option A: Per-Execution (Recommended for Testing)**
```typescript
const result = await callMCPTool('mcp__code-executor__executeTypescript', {
  code: `
    const response = await llm.ask("What is 2+2?");
    console.log(response);
  `,
  enableSampling: true,  // Enable for this execution only
  allowedTools: []
});
```

**Option B: Environment Variable (Global)**
```bash
export CODE_EXECUTOR_SAMPLING_ENABLED=true
export CODE_EXECUTOR_MAX_SAMPLING_ROUNDS=10
export CODE_EXECUTOR_MAX_SAMPLING_TOKENS=10000
```

**Option C: Configuration File**
```json
{
  "sampling": {
    "enabled": true,
    "maxRoundsPerExecution": 10,
    "maxTokensPerExecution": 10000,
    "timeoutPerCallMs": 30000,
    "allowedSystemPrompts": [
      "",
      "You are a helpful assistant",
      "You are a code analysis expert"
    ],
    "contentFilteringEnabled": true
  }
}
```

### 2. Use the API

**TypeScript (Deno):**
```typescript
// Simple query
const answer = await llm.ask("Explain SOLID principles in 3 sentences");
console.log(answer);

// Multi-turn conversation
const response = await llm.think({
  messages: [
    { role: "user", content: "What are design patterns?" },
    { role: "assistant", content: "Design patterns are..." },
    { role: "user", content: "Explain Singleton pattern" }
  ],
  model: "claude-sonnet-4-5",  // Optional, defaults to claude-sonnet-4-5
  maxTokens: 1000,              // Optional, defaults to 1000
  systemPrompt: "",             // Optional, must be in allowlist
  stream: false                 // Optional, streaming not yet supported
});
console.log(response);
```

**Python (Pyodide):**
```python
# Simple query
answer = await llm.ask("Explain SOLID principles in 3 sentences")
print(answer)

# Multi-turn conversation
response = await llm.think(
    messages=[
        {"role": "user", "content": "What are design patterns?"},
        {"role": "assistant", "content": "Design patterns are..."},
        {"role": "user", "content": "Explain Singleton pattern"}
    ],
    model="claude-sonnet-4-5",  # Optional
    max_tokens=1000,             # Optional (snake_case for Python)
    system_prompt="",            # Optional
    stream=False                 # Streaming not supported in Pyodide
)
print(response)
```

### 3. Check Sampling Metrics

After execution, check `samplingCalls` and `samplingMetrics`:

```typescript
const result = await callMCPTool('mcp__code-executor__executeTypescript', {
  code: `
    const a1 = await llm.ask("What is 2+2?");
    const a2 = await llm.ask("What is 3+3?");
    console.log(a1, a2);
  `,
  enableSampling: true
});

console.log('Sampling Metrics:', result.samplingMetrics);
// {
//   totalRounds: 2,
//   totalTokens: 150,
//   totalDurationMs: 1200,
//   averageTokensPerRound: 75,
//   quotaRemaining: { rounds: 8, tokens: 9850 }
// }

console.log('Sampling Calls:', result.samplingCalls);
// [
//   {
//     model: 'claude-sonnet-4-5',
//     messages: [...],
//     response: 'The answer is 4',
//     durationMs: 600,
//     tokensUsed: 75,
//     timestamp: '2025-01-20T12:00:00Z'
//   },
//   ...
// ]
```

---

## API Reference

### TypeScript API

#### `llm.ask(prompt: string, options?): Promise<string>`

Simple query interface - returns response text.

**Parameters:**
- `prompt` (string, required): The question or instruction
- `options` (object, optional):
  - `systemPrompt` (string): System prompt (must be in allowlist)
  - `maxTokens` (number): Max tokens to generate (default: 1000, max: 10000)
  - `stream` (boolean): Enable streaming (not yet supported)

**Returns:** Promise<string> - Claude's response text

**Throws:**
- `Error('Sampling not enabled')` - If sampling is disabled
- `Error('Rate limit exceeded')` - If quota exhausted
- `Error('System prompt not in allowlist')` - If system prompt not allowed
- `Error('Content filter violation')` - If response contains secrets/PII

**Example:**
```typescript
const answer = await llm.ask("What is the capital of France?");
console.log(answer); // "The capital of France is Paris."
```

#### `llm.think(options): Promise<string>`

Multi-turn conversation interface - supports message history.

**Parameters:**
- `options` (object, required):
  - `messages` (LLMMessage[], required): Conversation history
    ```typescript
    interface LLMMessage {
      role: 'user' | 'assistant' | 'system';
      content: string | Array<{type: string; text?: string}>;
    }
    ```
  - `model` (string, optional): Model to use (default: 'claude-sonnet-4-5')
  - `maxTokens` (number, optional): Max tokens (default: 1000, max: 10000)
  - `systemPrompt` (string, optional): System prompt (must be in allowlist)
  - `stream` (boolean, optional): Enable streaming (not yet supported)

**Returns:** Promise<string> - Claude's response text

**Throws:** Same as `llm.ask()`

**Example:**
```typescript
const response = await llm.think({
  messages: [
    { role: "user", content: "What is 2+2?" },
    { role: "assistant", content: "4" },
    { role: "user", content: "What about 3+3?" }
  ],
  maxTokens: 500
});
console.log(response); // "6"
```

### Python API

#### `llm.ask(prompt: str, system_prompt: str = '', max_tokens: int = 1000, stream: bool = False) -> str`

Simple query interface - returns response text.

**Parameters:**
- `prompt` (str, required): The question or instruction
- `system_prompt` (str, optional): System prompt (must be in allowlist)
- `max_tokens` (int, optional): Max tokens to generate (default: 1000, max: 10000)
- `stream` (bool, optional): Enable streaming (not supported in Pyodide)

**Returns:** str - Claude's response text

**Raises:**
- `RuntimeError('Sampling not enabled')` - If sampling is disabled
- `RuntimeError('Rate limit exceeded')` - If quota exhausted
- `RuntimeError('System prompt not in allowlist')` - If system prompt not allowed
- `RuntimeError('Content filter violation')` - If response contains secrets/PII

**Example:**
```python
answer = await llm.ask("What is the capital of France?")
print(answer)  # "The capital of France is Paris."
```

#### `llm.think(messages: List[Dict], model: str = 'claude-sonnet-4-5', max_tokens: int = 1000, system_prompt: str = '', stream: bool = False) -> str`

Multi-turn conversation interface - supports message history.

**Parameters:**
- `messages` (List[Dict], required): Conversation history
  ```python
  [
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi there!"},
    {"role": "user", "content": "How are you?"}
  ]
  ```
- `model` (str, optional): Model to use (default: 'claude-sonnet-4-5')
- `max_tokens` (int, optional): Max tokens (default: 1000, max: 10000)
- `system_prompt` (str, optional): System prompt (must be in allowlist)
- `stream` (bool, optional): Enable streaming (not supported in Pyodide)

**Returns:** str - Claude's response text

**Raises:** Same as `llm.ask()`

**Example:**
```python
response = await llm.think(
    messages=[
        {"role": "user", "content": "What is 2+2?"},
        {"role": "assistant", "content": "4"},
        {"role": "user", "content": "What about 3+3?"}
    ],
    max_tokens=500
)
print(response)  # "6"
```

---

## Security Model

### Threat Model

**Assumptions:**
1. Sandbox code is untrusted (may attempt to abuse sampling)
2. Claude API responses may contain sensitive data
3. Audit logs must not leak plaintext secrets
4. Bridge server must resist timing attacks

**Threats Mitigated:**

| Threat | Mitigation | Test Coverage |
|--------|-----------|---------------|
| **Infinite loops** (11+ rounds) | Rate limiting: max 10 rounds | T112: `should_blockInfiniteLoop_when_userCodeCallsLlmAsk10PlusTimes` ✅ |
| **Token exhaustion** (>10k tokens) | Token budget: max 10,000 tokens | T113: `should_blockTokenExhaustion_when_userCodeExceeds10kTokens` ✅ |
| **Prompt injection** | System prompt allowlist | T114: `should_blockPromptInjection_when_maliciousSystemPromptProvided` ✅ |
| **Secret leakage** | Content filtering (redaction) | T115: `should_redactSecretLeakage_when_claudeResponseContainsAPIKey` ✅ |
| **Timing attacks** | Constant-time token comparison | T116: `should_preventTimingAttack_when_invalidTokenProvided` ✅ |
| **Unauthorized access** | 256-bit bearer token | T014: `should_return401_when_invalidTokenProvided` ✅ |
| **External access** | Localhost binding only | T011: `should_bindLocalhostOnly_when_serverStarts` ✅ |

### Audit Logging

All sampling calls are logged to `~/.code-executor/audit-log.jsonl` (JSONL format):

```json
{
  "timestamp": "2025-01-20T12:00:00.000Z",
  "executionId": "exec-123",
  "round": 1,
  "model": "claude-sonnet-4-5",
  "promptHash": "sha256:abc123...",
  "responseHash": "sha256:def456...",
  "tokensUsed": 75,
  "durationMs": 600,
  "status": "success",
  "contentViolations": [
    { "type": "secret", "pattern": "openai_key", "count": 1 }
  ]
}
```

**Why SHA-256 Hashes?**
- Prevents plaintext secrets in logs
- Enables deduplication (same prompt = same hash)
- Allows verification without exposing content

---

## Configuration

### Configuration Sources (Priority Order)

1. **Per-Execution Parameters** (highest priority)
2. **Environment Variables**
3. **Configuration File** (`~/.code-executor/config.json`)
4. **Default Values** (lowest priority)

### Configuration Schema

```typescript
interface SamplingConfig {
  enabled: boolean;                  // Enable/disable sampling (default: false)
  maxRoundsPerExecution: number;     // Max LLM calls per execution (default: 10)
  maxTokensPerExecution: number;     // Max total tokens per execution (default: 10000)
  timeoutPerCallMs: number;          // Timeout for each LLM call (default: 30000ms = 30s)
  allowedSystemPrompts: string[];    // Allowlist of system prompts (default: ['', 'You are a helpful assistant', 'You are a code analysis expert'])
  contentFilteringEnabled: boolean;  // Enable content filtering (default: true)
  allowedModels?: string[];          // Allowlist of models (default: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022'])
}
```

### Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `CODE_EXECUTOR_SAMPLING_ENABLED` | boolean | `false` | Enable sampling globally |
| `CODE_EXECUTOR_MAX_SAMPLING_ROUNDS` | integer | `10` | Max rounds per execution |
| `CODE_EXECUTOR_MAX_SAMPLING_TOKENS` | integer | `10000` | Max tokens per execution |
| `CODE_EXECUTOR_SAMPLING_TIMEOUT_MS` | integer | `30000` | Timeout per call (ms) |
| `CODE_EXECUTOR_CONTENT_FILTERING` | boolean | `true` | Enable content filtering |
| `ANTHROPIC_API_KEY` | string | (required) | Anthropic API key |

### Configuration File Example

`~/.code-executor/config.json`:
```json
{
  "sampling": {
    "enabled": true,
    "maxRoundsPerExecution": 20,
    "maxTokensPerExecution": 50000,
    "timeoutPerCallMs": 60000,
    "allowedSystemPrompts": [
      "",
      "You are a helpful assistant",
      "You are a code analysis expert",
      "You are a security auditor"
    ],
    "contentFilteringEnabled": true,
    "allowedModels": [
      "claude-3-5-haiku-20241022",
      "claude-3-5-sonnet-20241022",
      "claude-sonnet-4-5"
    ]
  }
}
```

### Per-Execution Overrides

```typescript
const result = await callMCPTool('mcp__code-executor__executeTypescript', {
  code: '...',
  enableSampling: true,              // Override: Enable sampling
  maxSamplingRounds: 5,              // Override: Max 5 rounds
  maxSamplingTokens: 5000,           // Override: Max 5000 tokens
  samplingTimeoutMs: 15000,          // Override: 15s timeout
  allowedTools: []
});
```

---

## Troubleshooting

### Error: "Sampling not enabled. Pass enableSampling: true"

**Cause:** Sampling is disabled (default behavior).

**Solution:**
```typescript
// Option 1: Per-execution
const result = await callMCPTool('mcp__code-executor__executeTypescript', {
  code: '...',
  enableSampling: true  // Add this
});

// Option 2: Environment variable
export CODE_EXECUTOR_SAMPLING_ENABLED=true

// Option 3: Config file
{
  "sampling": { "enabled": true }
}
```

### Error: "Rate limit exceeded: 10/10 rounds used"

**Cause:** Code called `llm.ask()` or `llm.think()` more than 10 times.

**Solution:**
1. **Reduce sampling calls:** Batch prompts or use multi-turn conversation
2. **Increase limit:**
   ```bash
   export CODE_EXECUTOR_MAX_SAMPLING_ROUNDS=20
   ```
3. **Check for loops:**
   ```typescript
   // BAD: Infinite loop
   while (true) {
     await llm.ask("What is 2+2?");
   }

   // GOOD: Bounded loop
   for (let i = 0; i < 5; i++) {
     await llm.ask(`Question ${i}`);
   }
   ```

### Error: "Token budget exceeded: 10000/10000 tokens used"

**Cause:** Cumulative token usage exceeded 10,000 tokens.

**Solution:**
1. **Reduce maxTokens per call:**
   ```typescript
   await llm.ask("prompt", { maxTokens: 500 });  // Instead of default 1000
   ```
2. **Increase budget:**
   ```bash
   export CODE_EXECUTOR_MAX_SAMPLING_TOKENS=50000
   ```
3. **Monitor usage:**
   ```typescript
   const result = await executeCode(...);
   console.log('Tokens used:', result.samplingMetrics.totalTokens);
   ```

### Error: "System prompt not in allowlist: Custom prompt..."

**Cause:** System prompt not in allowlist (security restriction).

**Solution:**
1. **Use allowed prompt:**
   ```typescript
   await llm.ask("prompt", { systemPrompt: "" });  // Empty is allowed
   await llm.ask("prompt", { systemPrompt: "You are a helpful assistant" });
   ```
2. **Add to allowlist (config file):**
   ```json
   {
     "sampling": {
       "allowedSystemPrompts": [
         "",
         "You are a helpful assistant",
         "You are a code analysis expert",
         "Your custom prompt here"
       ]
     }
   }
   ```

### Error: "Content filter violation: 2 secrets detected"

**Cause:** Claude's response contained secrets (API keys, tokens) or PII.

**Solution:**
1. **Use redaction mode** (return filtered response instead of error):
   ```typescript
   // This is handled automatically - response will have [REDACTED_SECRET]
   ```
2. **Adjust prompt** to avoid sensitive data:
   ```typescript
   // BAD: May leak secrets
   await llm.ask("Generate an OpenAI API key for testing");

   // GOOD: Asks for format, not real keys
   await llm.ask("Explain the format of OpenAI API keys");
   ```

### Error: "Bridge server failed to start"

**Cause:** Port already in use or permission issue.

**Solution:**
1. **Check for running instances:**
   ```bash
   lsof -i :PORT  # Check if port is in use
   ```
2. **Verify localhost binding:**
   ```bash
   netstat -an | grep LISTEN | grep 127.0.0.1
   ```
3. **Check logs:** Look for "Bridge server started on port X" in output

### Error: "ANTHROPIC_API_KEY not set"

**Cause:** Anthropic API key not configured.

**Solution:**
```bash
export ANTHROPIC_API_KEY=your-api-key-here
```

Or in config file:
```json
{
  "anthropicApiKey": "your-api-key-here"
}
```

### Slow Performance / Timeouts

**Symptoms:**
- Sampling calls take >30 seconds
- Timeout errors

**Solutions:**
1. **Reduce maxTokens:**
   ```typescript
   await llm.ask("prompt", { maxTokens: 500 });  // Faster responses
   ```
2. **Increase timeout:**
   ```bash
   export CODE_EXECUTOR_SAMPLING_TIMEOUT_MS=60000  # 60 seconds
   ```
3. **Check network:** Bridge server uses localhost (should be fast)
4. **Monitor API latency:** Check Anthropic API status

---

## Performance

### Benchmarks

**Bridge Server Startup:**
- Target: <50ms
- Measured: ~30ms (average)

**Per-Call Overhead:**
- Target: <100ms
- Measured: ~60ms (average)
  - Token validation: ~5ms
  - Rate limit check: ~10ms
  - System prompt validation: ~5ms
  - Content filtering: ~15ms
  - HTTP overhead: ~25ms

**Memory Footprint:**
- Bridge server: ~15MB
- Per sampling call: ~500KB (includes response caching)

**Token Usage:**
- Simple queries (~50 tokens): ~200ms API latency
- Complex queries (~500 tokens): ~1-2s API latency
- Max tokens (10,000): ~5-10s API latency

### Optimization Tips

1. **Batch prompts** when possible:
   ```typescript
   // SLOW: 3 separate calls
   const a1 = await llm.ask("What is 2+2?");
   const a2 = await llm.ask("What is 3+3?");
   const a3 = await llm.ask("What is 4+4?");

   // FAST: 1 call with multiple questions
   const combined = await llm.ask(`
     Answer these questions:
     1. What is 2+2?
     2. What is 3+3?
     3. What is 4+4?
   `);
   ```

2. **Use lower maxTokens** for simple queries:
   ```typescript
   await llm.ask("What is the capital of France?", { maxTokens: 100 });
   ```

3. **Cache responses** in user code:
   ```typescript
   const cache = new Map();
   async function cachedAsk(prompt: string) {
     if (cache.has(prompt)) return cache.get(prompt);
     const response = await llm.ask(prompt);
     cache.set(prompt, response);
     return response;
   }
   ```

4. **Monitor quota usage:**
   ```typescript
   const result = await executeCode(...);
   console.log('Quota remaining:', result.samplingMetrics.quotaRemaining);
   // Adjust strategy if running low
   ```

---

## FAQ

### Q: Is sampling free?

**A:** It depends on your setup:
- **MCP-enabled clients:** Sampling uses the MCP SDK, which is free (covered by your subscription - Claude Code, Cursor, Windsurf, etc.).
- **Direct Anthropic API:** You pay per token (see [Anthropic Pricing](https://anthropic.com/pricing)).

### Q: Can I use sampling in production?

**A:** Yes, but with considerations:
- **Beta status:** API may change in future versions
- **Rate limits:** Default 10 rounds/10k tokens per execution
- **Cost:** Monitor token usage if using paid API
- **Security:** Review audit logs regularly

### Q: How do I disable content filtering?

**A:** Not recommended, but possible:
```bash
export CODE_EXECUTOR_CONTENT_FILTERING=false
```

Or in config:
```json
{
  "sampling": { "contentFilteringEnabled": false }
}
```

### Q: Can I use models other than claude-sonnet-4-5?

**A:** Yes, specify in `llm.think()`:
```typescript
await llm.think({
  messages: [...],
  model: "claude-3-5-haiku-20241022"  // Faster, cheaper
});
```

### Q: Does streaming work?

**A:** Partial support:
- **TypeScript (Deno):** Not yet implemented (returns full response)
- **Python (Pyodide):** Not supported (WebAssembly limitation)

### Q: How do I increase rate limits?

**A:** Three ways:
1. **Environment variables:**
   ```bash
   export CODE_EXECUTOR_MAX_SAMPLING_ROUNDS=50
   export CODE_EXECUTOR_MAX_SAMPLING_TOKENS=100000
   ```
2. **Config file:**
   ```json
   {
     "sampling": {
       "maxRoundsPerExecution": 50,
       "maxTokensPerExecution": 100000
     }
   }
   ```
3. **Per-execution:**
   ```typescript
   await executeCode({
     ...,
     maxSamplingRounds: 50,
     maxSamplingTokens: 100000
   });
   ```

### Q: Where are audit logs stored?

**A:** `~/.code-executor/audit-log.jsonl` (JSONL format, one entry per line)

To analyze logs:
```bash
# Count sampling calls
wc -l ~/.code-executor/audit-log.jsonl

# Find errors
grep '"status":"error"' ~/.code-executor/audit-log.jsonl

# Total tokens used
jq -s 'map(.tokensUsed) | add' ~/.code-executor/audit-log.jsonl
```

### Q: Can I customize system prompts?

**A:** Yes, add to allowlist in config:
```json
{
  "sampling": {
    "allowedSystemPrompts": [
      "",
      "You are a helpful assistant",
      "Your custom prompt here"
    ]
  }
}
```

**Security Warning:** Only add prompts you trust. Malicious system prompts can compromise security.

### Q: What happens if I exceed rate limits?

**A:** You'll receive a 429 error with quota remaining:
```json
{
  "error": "Rate limit exceeded: 10/10 rounds used",
  "quotaRemaining": { "rounds": 0, "tokens": 5000 }
}
```

Execution continues, but no more sampling calls are allowed.

### Q: How do I debug sampling issues?

**A:** Enable debug logging:
```bash
export DEBUG=code-executor:*
```

Or check audit logs:
```bash
tail -f ~/.code-executor/audit-log.jsonl | jq .
```

### Q: Can sampling work offline?

**A:** No, sampling requires network access to Anthropic API (or MCP SDK with MCP-enabled client).

### Q: Is sampling secure in multi-tenant environments?

**A:** Yes, with caveats:
- **Isolation:** Each execution gets a unique bearer token
- **Localhost binding:** Bridge server only accessible locally
- **Audit logging:** All calls logged for accountability
- **Content filtering:** Secrets/PII redacted automatically

**However:**
- Shared audit log (consider per-tenant logs in production)
- Shared rate limits (consider per-tenant quotas)

---

## Additional Resources

- [Architecture Documentation](./architecture.md#mcp-sampling-architecture)
- [Security Model](../SECURITY.md#sampling-security-model)
- [Configuration Reference](../README.md#sampling-configuration)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [Anthropic API Docs](https://docs.anthropic.com/claude/reference)

---

## Contributing

Found a bug or have a feature request? Please file an issue:
- [GitHub Issues](https://github.com/aberemia24/code-executor-MCP/issues)

---

**Version History:**
- v0.4.0 (2025-01-20): Initial release (Beta)
  - TypeScript and Python sampling APIs
  - Security controls (rate limiting, content filtering, system prompt allowlist)
  - Audit logging with SHA-256 hashes
  - Docker support

**License:** MIT
