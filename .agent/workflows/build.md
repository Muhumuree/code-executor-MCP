---
argument-hint: [clean|production]
description: Builds code-executor-mcp with strict TypeScript/ESLint enforcement, validates MCP server compilation
allowed-tools: Bash, BashOutput, KillShell, Read, TodoWrite, Glob
---

Build "$ARGUMENTS" (default: development)

## 🚨 CRITICAL BUILD LAWS

**Non-Negotiable Rules:**

- 📦 **ZERO TOLERANCE:** TypeScript/ESLint errors WILL fail build
- 🎯 **Fix FIRST error**, not loudest (root cause analysis)
- ⚙️ **Type Safety:** Full TypeScript strict mode enforcement
- 🔧 **Clean Build:** dist/ directory must compile successfully

---

## 🧹 CLEAN (Nuclear Option)

**When to clean:** Corrupted cache, mysterious build failures, or explicit `clean` argument

```bash
# Remove all build artifacts
rm -rf dist node_modules/.cache

# Clear schema cache
rm -rf ~/.code-executor/schema-cache.json

# Reinstall if package.json changed
npm install
```

---

## 🏗️ BUILD VALIDATION (MANDATORY SEQUENCE)

**MCP Server compilation chain:**

```
TypeScript Compilation → Type Checking → Linting → dist/ Output
```

**Why:** Type safety ensures MCP tool schemas are correctly typed and validated

---

## 🔍 COMMON FAILURES & FIXES

| Error                      | Root Cause                     | Solution                           |
| -------------------------- | ------------------------------ | ---------------------------------- |
| `Cannot find module`       | Invalid import path            | Check tsconfig.json paths          |
| `Type error in executor`   | Schema validation types wrong  | Check AJV types and validators     |
| `dist/ incomplete`         | Build interrupted              | `rm -rf dist && npm run build`     |
| `Schema cache error`       | Corrupted cache file           | `rm ~/.code-executor/schema-cache.json` |
| `@ts-ignore present`       | Type safety bypassed           | FORBIDDEN - Fix type issues        |

---

## ⚡ QUALITY CIRCUIT TRIGGER

### Pre-Build Validation

**ALWAYS run before build:**

```bash
npm run lint && npm run typecheck && npm run build
```

### Build Failure Escalation

**TypeScript/ESLint errors → STOP and fix immediately:**
- **Schema changes** → Verify schema-validator.ts types
- **Type errors in executors** → Check TypeScript/Python executor types
- **MCP SDK version mismatch** → Verify @modelcontextprotocol/sdk version

### Success Path

1. If build **PASSES** → Run test suite (`npm test`)
2. **EXCEPTION:** Skip if issue documented in development notes

**Safety Limit:** Max 5 circuit iterations to prevent infinite loops

---

**Type safety is LAW. Nuclear clean when corrupted.**