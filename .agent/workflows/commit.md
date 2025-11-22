---
argument-hint: [message|--amend|--squash]
description: Creates proper git commits with validation for code-executor-mcp, follows TypeScript/MCP server standards, handles pre-commit hooks
allowed-tools: Bash, BashOutput, Read, Glob, Grep, TodoWrite, mcp__ide__getDiagnostics
---

Commit "$ARGUMENTS" - code-executor-mcp Project Standards

## 🚨 ZERO TOLERANCE

**Forbidden Actions:**

- ❌ NO force push to `develop`/`master`
- ❌ NO commits without validation
- ❌ NO `--amend` on others' work
- ❌ NO secrets in commits (API keys, database URLs, tokens)
- ❌ NEVER `--no-verify` without explicit user request
- ❌ NO `@ts-ignore` or `ignoreBuildErrors: true`
- ❌ NO hardcoded env vars (use validated env config)

---

## ✅ PRE-COMMIT VALIDATION

**Mandatory quality checks for code-executor-mcp:**

```bash
# 1. Code quality (TypeScript strict mode + ESLint)
npm run lint && npm run typecheck

# 2. Build verification (zero tolerance - must pass)
npm run build

# 3. Test coverage check
npm test

# 4. Review changes
git status && git diff --cached
```

---

## 🧪 TEST GATE

**code-executor-mcp testing strategy:**

| Change Type           | Test Requirement                        |
| --------------------- | --------------------------------------- |
| Validation logic      | Vitest tests MUST pass (≥90% coverage) |
| Schema caching        | Tests REQUIRED (concurrency, TTL)       |
| MCP tool handlers     | Integration tests RECOMMENDED           |
| Security features     | Tests REQUIRED (sandbox, permissions)   |
| Bug fixes             | Regression test REQUIRED                |
| NO tests for logic    | **BLOCK commit**                        |
| Tests fail            | **BLOCK commit**                        |

**Test commands:**
- All tests: `npm test`
- Watch mode: `npm run test:watch`
- Coverage: `npm run test:coverage`

---

## 📝 COMMIT MESSAGE FORMAT

```
feat(validator): add deep schema validation with AJV

Implement recursive validation for nested objects and arrays
to replace shallow custom validator.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Format Rules:**

- **Type:** `feat` / `fix` / `refactor` / `chore` / `docs` / `test`
- **Scope:** `(validator)` / `(cache)` / `(executor)` / `(mcp)` / `(security)` / `(config)`
- **Body:** Explain WHY (2-3 sentences max), not WHAT (code shows what)
- **Footer:** Always include Claude Code attribution (shown above)

---

## 🔒 SAFETY CHECKS

**code-executor-mcp Branch Protection:**

- ✅ Work on `develop` branch (main development)
- 🚨 `main` branch = stable releases (no direct commits, PR-only)
- 🚨 Schema cache = never commit `~/.code-executor/schema-cache.json`
- 🚨 Never commit `.env` files, API keys, or MCP server credentials

**Pre-Amend Checks:**

```bash
# Verify commit NOT pushed
git status  # Must show "Your branch is ahead"

# Check authorship BEFORE --amend
git log -1 --format='%an %ae'  # NEVER amend others' commits
```

**Hook Failures:**

- ONE retry allowed on pre-commit hook failures
- If hook modifies files → safe to amend ONLY if you own the commit
- Otherwise → create NEW commit

---

## ⚡ QUALITY CIRCUIT TRIGGER

**Auto-escalation before commit:**

1. **TypeScript errors** → **CRITICAL: Fix immediately** (strict mode enforced)
2. **ESLint errors** → **CRITICAL: Run `npm run lint` first**
3. **Build fails** → **CRITICAL: Run `npm run build` first**
4. **Tests fail** → **CRITICAL: Run tests and fix failures**
5. **Missing AJV validation** → **CRITICAL: Validate all MCP tool parameters**
6. Only commit when ALL checks pass

---

## 🎯 CODE-EXECUTOR-MCP SPECIFIC CHECKS

**Before committing, verify:**

- ✅ AJV validation on all MCP tool parameters
- ✅ Schema cache AsyncLock mutex for concurrent access
- ✅ Deno sandbox permissions properly restricted
- ✅ JSDoc comments on public functions
- ✅ Error handling with proper MCP error codes
- ✅ Vitest tests for new validation/caching logic
- ✅ No hardcoded MCP server URLs or credentials

**Security features:**
- ✅ Dangerous pattern detection (eval, exec, __import__)
- ✅ Path validation prevents directory traversal
- ✅ Rate limiting implemented
- ✅ Audit logs for tool executions

---

**Commit discipline = Project quality = MCP server reliability**

**Stack:** TypeScript 5.x + Node.js 20+ + @modelcontextprotocol/sdk + AJV + async-lock + Vitest
