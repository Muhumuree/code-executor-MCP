---
description: Analyzes root CLAUDE.md and extracts area-specific content into local CLAUDE.md files
allowed-tools: Read, Write, Edit, Grep, Glob, TodoWrite
---

# Split CLAUDE.md Context - Extract Area-Specific Documentation

## 🎯 GOAL
Reduce root CLAUDE.md by extracting area-specific content to local CLAUDE.md files in relevant directories.

## 📋 PROCESS

### 1. Analyze Root CLAUDE.md
Read `CLAUDE.md` and identify sections that are:
- Directory-specific (e.g., `servers/`, `prisma/`, `src/app/`, `docs/`)
- Tool-specific (e.g., MCP servers, testing, deployment)
- Feature-specific (e.g., i18n, auth, database patterns)

### 2. Map Content to Directories
For each area-specific section, determine target directory:
- MCP server docs → `servers/CLAUDE.md`
- Database patterns → `prisma/CLAUDE.md`
- Testing strategy → `tests/CLAUDE.md` or `vitest.config.ts` directory
- Deployment → `.github/CLAUDE.md` or `vercel/CLAUDE.md`

### 3. Extract & Create Local Files
- Create new CLAUDE.md in target directory with extracted content
- Add reference in root: `**Area docs:** @servers/CLAUDE.md (MCP server details)`
- Remove extracted content from root CLAUDE.md

### 4. Validate
- Backup root: `cp CLAUDE.md CLAUDE.md.backup-$(date +%Y%m%d-%H%M%S)`
- Verify all content preserved (no information loss)
- Check root reduced by 30-50%
- Test: confirm local CLAUDE.md files loaded in respective directories
