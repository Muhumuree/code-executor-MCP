---
trigger: always_on
---

# Code Executor MCP - Coding Standards

**Project:** MCP orchestration server | **Stack:** Node.js 22+ | TypeScript 5.x (strict) | Vitest 4.0 | AJV 8.x | Deno 2.x

## ⚡ ZERO TOLERANCE

Build fails on violations. NO workarounds. **Priority:** Security > Validation > Architecture > Style

## 🔴 CRITICAL RULES

### Security & Validation
- **AJV validation MANDATORY** - ALL MCP tool calls validated (deep recursive, no bypass)
- **NO type coercion** - Strict type checking (integer ≠ number)
- **Sandbox isolation** - Deno permissions minimal, dangerous pattern detection
- **AsyncLock MANDATORY** - ALL concurrent disk writes (schema cache, audit logs)
- **Audit everything** - Tool calls, executions, failures with timestamps
- **NO hardcoded secrets** - Env vars only, validated with Zod

### Architecture
- **SOLID** - SRP strict | NO God Objects | KISS | DRY pragmatic | YAGNI
- **NO ANY types** - Use `unknown` + type guards
- **Progressive disclosure** - Tools loaded on-demand, not upfront
- **Race condition free** - AsyncLock mutex for all shared resources

### Testing & Quality
- **TDD MANDATORY** - Business logic and validation (98%+ coverage)
- **Edge cases first** - Nested objects, concurrent access, TTL expiration
- **Fake timers** - Use `vi.useFakeTimers()` for time-based tests (NO setTimeout)
- **Coverage goals** - Validation 98%+ | Caching 70%+ | Overall 90%+

## 🧠 STACK

**Runtime:** Node.js 22+ LTS | **Executors:** Deno 2.x (TS), Python 3.9+ | **Testing:** Vitest 4.0 | **Validation:** AJV 8.x
**MCP:** @modelcontextprotocol/sdk | **Concurrency:** async-lock | **Transport:** STDIO + HTTP/SSE

## 📋 PATTERNS

### Schema Validation (AJV)
```typescript
const result = validator.validate(params, schema);
if (!result.valid) throw new Error(validator.formatError(toolName, params, schema, result));
```

### Cache Access (AsyncLock)
```typescript
await this.lock.acquire('cache-write', async () => { await fs.writeFile(cachePath, data); });
```

### MCP Tool Calls (Progressive Disclosure)
```typescript
const result = await callMCPTool('mcp__zen__codereview', { step: '...', step_number: 1 });
```

## 🧪 TESTING

| Component | Coverage | Approach |
|-----------|----------|----------|
| Validation | 98%+ | TDD: RED→GREEN→REFACTOR |
| Caching | 70%+ | Race conditions, TTL, concurrency |
| Executors | 80%+ | Sandbox escapes, permissions |
| Security | 95%+ | Input validation, pattern detection |

**Pass rates:** Validation ≥98% | Core ≥90% | Integration ≥80%

### Test Standards
```typescript
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
vi.advanceTimersByTime(150); // Deterministic time control
```

## 🚀 BUILD

- **NO suppression** - `ignoreBuildErrors: false` | NO `@ts-ignore`
- **TypeScript strict** - Full strict mode enabled
- **Pre-commit** - `npm run lint && npm run typecheck && npm run build && npm test`
- **Environment** - Node.js v22.x LTS | npm | TypeScript 5.x strict

## 📐 REFERENCE

### Naming
| Element | Format | Example |
|---------|--------|---------|
| Files | kebab-case | `schema-cache.ts` |
| Classes | PascalCase | `SchemaValidator` |
| Functions | camelCase | `getToolSchema()` |
| Constants | UPPER_SNAKE | `DEFAULT_TTL_MS` |

### Commands
```bash
npm run lint && npm run typecheck && npm run build && npm test  # Pre-commit
npm run server     # Start MCP server
npm test           # Run all tests
npm run typecheck  # TypeScript check
```

## 🚫 FORBIDDEN

### Validation
❌ Skipping AJV validation | ❌ Type coercion | ❌ Shallow validation | ❌ Bypassing schema checks

### Build
❌ `@ts-ignore` | ❌ `any` types | ❌ `ignoreBuildErrors: true` | ❌ Unvalidated inputs

### Concurrency
❌ Concurrent writes without mutex | ❌ Shared resource without lock

### Security
❌ Hardcoded secrets | ❌ Missing sandbox permissions | ❌ Path traversal | ❌ Command injection

### Testing
❌ `setTimeout` in tests | ❌ Skipping edge cases | ❌ Missing coverage on validation

### Deprecated
❌ Custom shallow validation | ❌ Wrappers as primary approach | ❌ Unprotected disk writes

## 🔒 SECURITY

### Input Validation
- **ALL external inputs** validated (MCP calls, env vars, file paths)
- **Deep recursive** - Nested objects, arrays, constraints, enums
- **Type strict** - No coercion (integer vs number)

### Sandbox Isolation
- **Deno minimal permissions** - Read/write/net restricted
- **Dangerous patterns blocked** - eval, exec, __import__, pickle.loads
- **Path validation** - No directory traversal
- **Rate limiting** - 30 req/min default

### Audit Logging
- **ALL executions** logged (timestamp, tool, params hash, status)
- **NO sensitive data** in logs

## 📊 METRICS

**Coverage:** Validation 98.27% | Cache 74% | Overall 90%+
**Token Savings:** 98% (141k → 1.6k tokens)
**Build:** <30s | **Test:** <60s

---

**Version:** 0.3.1 | **Node.js:** v22.x LTS | **Enforcement:** ESLint + TypeScript strict + pre-commit + CI/CD
