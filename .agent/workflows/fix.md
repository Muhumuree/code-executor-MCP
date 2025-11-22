---
argument-hint: <description>
description: Fixes issues at root cause level, prevents quick hacks, enforces proper solutions
allowed-tools: Task, TodoWrite, Bash, Glob, Grep, Read, Edit, MultiEdit, Write, WebFetch, WebSearch, mcp__code-executor__executeTypescript
---

Fix $ARGUMENTS - Root Cause, Not Symptoms

**IMPORTANT** - if a gh issue is provided, please use the CLI to see it as the repo may be private.

## 🚨 ZERO TOLERANCE

**Forbidden Anti-Patterns:**

- ❌ `@ts-ignore`, `any` types without justification
- ❌ Unvalidated MCP tool parameters
- ❌ Direct process.env access, hardcoded secrets, MCP server URLs
- ❌ Sandbox escapes (eval, exec, __import__)

---

## 🧠 ULTRATHINK FIRST

**Before writing any code:**

1. **Root Cause Analysis** - Trace error to origin (not just symptoms)
2. **Map Dependencies** - Identify impacts across validator/cache/executor layers
3. **Question Assumptions** - One schema error can cascade through entire MCP server

---

## 🔍 INVESTIGATE

**Understanding Phase:**

- Use **project-librarian agent** to understand code structure
  - **CRITICAL:** For investigation ONLY, NOT for fixes
- Review **CLAUDE.md** and **docs/coding-standards.md** for MCP server patterns
- Check **CHANGELOG.md** for recent changes and known issues

---

## 🔧 FIX

**Implementation Requirements:**

- ✅ Fix root cause only (update in-place, NO duplicates)
- ✅ Apply SOLID/DRY/KISS principles
- ✅ Maintain type safety: TypeScript strict mode
- ✅ Validate ALL MCP tool parameters with AJV
- ✅ Ensure AsyncLock mutex for schema cache writes
- ✅ Preserve Deno sandbox security

**CRITICAL:** DO NOT USE SUB-AGENTS FOR FIXES - Direct implementation only

---

## ✅ VALIDATE

**Mandatory quality checks:**

```bash
npm run lint && npm run typecheck && npm run build && npm test
```

**NO CORNER CUTTING. FIX IT RIGHT.**

---

## ⚡ QUALITY CIRCUIT TRIGGER

**Automated quality enforcement after fix completes:**

1. **CRITICAL:** Run `npm run lint && npm run typecheck`
2. If TypeScript/ESLint errors → Fix immediately (ZERO TOLERANCE)
3. Run test suite to verify fix: `npm test`
4. **CRITICAL** invoke automatically `/code-review` on the fixes if >LOW issues were fixed
**Safety Limit:** Max 5 circuit iterations to prevent infinite loops