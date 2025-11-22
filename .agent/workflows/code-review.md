---
argument-hint: [file-or-pattern]
description: Performs comprehensive code review after implementation, checks MCP server standards, invokes code-guardian agent
allowed-tools: Task, TodoWrite, Bash, Glob, Grep, Read, WebSearch, mcp__code-executor__executeTypescript
---

Code Review "$ARGUMENTS" (or last changes if empty)

## 📋 CONTEXT

**Project:** code-executor-mcp - Universal MCP server with progressive disclosure

**Stack:** TypeScript 5.x + Node.js 20+ + @modelcontextprotocol/sdk + AJV + async-lock + Vitest + Deno sandbox

**Development Phase:** v0.3.x (pre-1.0 beta)

**Review Philosophy:**

- ❌ NO enterprise bullshit or theoretical concerns
- ✅ Focus on what code ACTUALLY does (not fantasy scenarios)
- ✅ Check architecture standards in **docs/architecture.md** and **CLAUDE.md**
- ✅ REAL issues that break builds only
- ✅ MCP Server Quality: schema validation, security, type safety

---

## 🛡️ INVOKE CODE-GUARDIAN (MANDATORY)

**Use Task tool with code-guardian agent:**

```
Review type: "full"
Project: "code-executor-mcp - MCP Server with progressive disclosure"
Context: "DEVELOPMENT - Apply DEVELOPMENT CONTEXT FILTERS first: Working+tested code stays. Prove issues with measurements, not theory. REJECT production theater (scaling, monitoring, circuit breakers). Report ONLY: build breaks, proven security holes, actual bugs."
Focus: SOLID/DRY/KISS violations, MCP SDK patterns, AJV schema validation, security sandbox escapes, actual bugs
```

---

## 🚨 CRITICAL VIOLATIONS (ZERO TOLERANCE)

- ❌ Hardcoded secrets, API keys, MCP server URLs
- ❌ `@ts-ignore` without explicit justification
- ❌ Missing schema validation for MCP tool parameters
- ❌ Sandbox escapes (eval, exec, __import__ in Deno)
- ❌ Direct file system access without permission checks
- ❌ `any` types without explicit justification
- ❌ Missing error handling in executor wrappers
- ❌ Schema cache race conditions (missing AsyncLock)
- ❌ Unvalidated MCP client pool connections

---

## ✅ REAL REVIEW CHECKLIST

**Build & Standards:**

- Will it compile? (`npm run build`)
- Pass TypeScript strict mode? (`npm run typecheck`)
- Pass linting? (`npm run lint`)
- Node.js 20+ compatible?

**MCP Server Patterns:**

- MCP SDK @modelcontextprotocol/sdk used correctly
- All tool schemas properly defined
- Tool handlers return correct response format
- Error handling with proper MCP error codes

**Type Safety & Validation:**

- All MCP tool parameters validated with AJV
- Deep recursive validation (nested objects/arrays)
- No type coercion (strict type checking)
- Schema cache properly typed

**Security:**

- Deno sandbox permissions minimal (read/write/net restrictions)
- Dangerous pattern detection (eval, exec, path traversal)
- Rate limiting implemented
- Audit logs for tool executions
- No sensitive data in error messages

**Concurrency & Caching:**

- AsyncLock mutex for schema cache writes
- No race conditions on concurrent tool calls
- TTL handling correct (24h default)
- Stale-on-error pattern implemented

**Testing:**

- Vitest tests exist for new code
- 90%+ coverage for validation/caching code
- Edge cases tested (concurrent access, TTL expiration)
- Mock external dependencies (MCPClientPool, fs)

---

## 🙅 SKIP PRODUCTION THEATER

**Filter out these nonsense concerns:**

- ❌ "Not production-ready" (we're on DEVELOP)
- ❌ "Needs enterprise monitoring"
- ❌ "99.99% uptime" requirements
- ❌ "Horizontal scaling" concerns
- ❌ "Circuit breakers" overkill

**We're on DEVELOP, not running a bank. REAL ISSUES ONLY.**

---

## ✅ VALIDATE

**Mandatory quality checks:**

```bash
npm run lint && npm run typecheck && npm run build
```

**Additional checks:**

```bash
# Check for hardcoded secrets
grep -r "sk-" src/ || echo "OK: No API keys found"
grep -r "process.env" src/ | grep -v "NODE_ENV" || echo "OK: No direct env access"

# Verify schema validation
grep -r "validate(" src/ | wc -l

# Check Deno sandbox permissions
grep -r "dangerouslyDisableSandbox" src/ && echo "WARNING: Sandbox disabled"

# Verify AsyncLock usage
grep -r "schemaLock" src/schema-cache.ts || echo "ERROR: Missing mutex"
```

---

## ⚡ QUALITY CIRCUIT TRIGGER

**Automated enforcement after review completes:**

1. If severity ≥ MEDIUM → **CRITICAL: automatically INVOKE /fix immediately**
2. If >2 LOW severity issues → **CRITICAL: automatically INVOKE /fix immediately**

**Safety Limit:** Max 5 circuit iterations to prevent infinite loops