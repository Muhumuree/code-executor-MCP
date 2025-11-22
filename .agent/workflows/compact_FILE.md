---
argument-hint: [target-file]
description: Consolidates AGENTS.md files by removing duplicates, tightening verbose sections, migrating to child files
allowed-tools: Read, Edit, Write, Bash, Grep, TodoWrite
---

# Consolidate AGENTS.md "$ARGUMENTS" (or main AGENTS.md if empty)

## 🎯 GOAL

Transform kitchen-sink AGENTS.md files into efficient entry points:

- **Target:** 40-65% reduction, ZERO info loss
- **Method:** Constitution + Navigation Map + Quick Reference

---

## 📋 PROCESS

### 1. Backup & Analyze

`cp $TARGET $TARGET.backup-$(date +%Y%m%d-%H%M%S) && wc -l < $TARGET`

**Find:** Duplicates in child files (REMOVE) | Verbose sections (TIGHTEN) | Misplaced details (MOVE)

### 2. Actions

**REMOVE** - Already in child files (grep verify first)
**MOVE** - Migrate to correct child file
**TIGHTEN** - Multi-line → pipe-separated (`**Runtime:** Node 24 | **Frontend:** React 19`)
**REFERENCE** - Use `@child/AGENTS.md` pointers

### 3. Validate

`wc -l AGENTS.md && grep -c "CRITICAL\|NEVER" AGENTS.md`

### 4. Audit against backup

**CRITICAL** Check the new compacted AGENTS.md file, gainst its backup, make sure no information was missed.

---

## ✅ MANDATORY CHECKLIST

- [ ] Backup created with timestamp
- [ ] Remove duplicates (grep verify in child files FIRST)
- [ ] Move content to correct child files
- [ ] Tighten verbose sections (pipe-separated)
- [ ] Preserve ALL CRITICAL/NEVER/MANDATORY rules
- [ ] 40-65% reduction achieved
- [ ] All info preserved (grep verification)
- [ ] Audit of compacted version against the backup file

---

**Detailed Guide:** docs/claude-md-consolidation-guide.md