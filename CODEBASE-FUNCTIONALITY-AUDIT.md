# Code Executor MCP - Codebase Functionality Audit

**Project**: code-executor-mcp
**Version**: v0.8.1
**Last Updated**: 2025-11-18
**Search Scope**: `/src` (all TypeScript files)
**Purpose**: Identify existing CLI-compatible implementations for file system operations, configuration management, locking, and audit logging

---

## Executive Summary

The code-executor-mcp codebase has **PRODUCTION-READY** implementations for most requested functionality:

| Category | Status | Reusability | Notes |
|----------|--------|-------------|-------|
| **File System Operations** | ✅ Partial | Medium | Path canonicalization exists; no full backup service |
| **Configuration Management** | ✅ Complete | High | Production-ready config discovery & validation |
| **Lock File Management** | ❌ Missing | N/A | No PID-based locking implemented |
| **Audit Logging** | ✅ Complete | High | Production-ready append-only logs with AsyncLock |

---

## 1. FILE SYSTEM OPERATIONS

### 1.1 Path Canonicalization & Symlink Resolution

**Status**: PRODUCTION-READY (async-based)

**Location**: `/home/alexandrueremia/projects/code-executor-mcp/src/utils.ts`

**Function**: `isAllowedPath(path: string, allowedRoots: string[]): Promise<boolean>`
**Lines**: 172-205

**Implementation Details**:
```typescript
export async function isAllowedPath(path: string, allowedRoots: string[]): Promise<boolean> {
  // Uses fs.realpath() for symlink resolution
  const resolvedPath = await realpath(path);
  // Validates path is within allowed roots
  if (resolvedPath === resolvedRoot || resolvedPath.startsWith(resolvedRoot + sep)) {
    return true;
  }
}
```

**Key Features**:
- ✅ Resolves symlinks to prevent escape attacks
- ✅ Canonicalizes paths via `fs.realpath()`
- ✅ Uses platform-agnostic `path.sep`
- ✅ Handles non-existent paths gracefully (returns `false`)
- ✅ Protects against `../../../` directory traversal
- ⚠️ **ASYNC ONLY** - Cannot be used in sync contexts

**Used By**:
- `src/security.ts` - Line 99, 113 (async validation)
- `src/handlers/tool-execution-handler.ts` (permission validation)

**Limitations**:
- Returns `Promise<boolean>` (async only)
- Does NOT create backup before operations
- Does NOT perform permission checks (just path validation)

---

### 1.2 Configuration File Operations

**Status**: PRODUCTION-READY

**Location**: `/home/alexandrueremia/projects/code-executor-mcp/src/config-discovery.ts`

**Class**: `ConfigDiscoveryService`
**Lines**: 46-332

**File Operations Implemented**:

| Operation | Method | Lines | Features |
|-----------|--------|-------|----------|
| **Read JSON** | `loadConfigFile()` | 172-184 | Parse with error handling, returns `null` on missing file |
| **Write JSON** | Not implemented | - | No write capability in current codebase |
| **File Exists** | `fileExists()` | 317-324 | Async check using `fs.access()` |
| **Path Resolution** | Multiple | See below | Resolves config paths from multiple sources |

**Configuration Search Paths** (priority order):
```typescript
const CONFIG_SEARCH_PATHS = [
  '.code-executor.json',                    // Project level (highest)
  path.join(homedir(), '.code-executor.json'),
  path.join(homedir(), '.config', 'code-executor', 'config.json'),
];

const MCP_CONFIG_SEARCH_PATHS = [
  '.mcp.json',
  path.join(homedir(), '.claude.json'),
  path.join(homedir(), '.config', 'claude-code', 'mcp.json'),
  path.join(homedir(), 'Library', 'Application Support', 'Claude', 'mcp.json'),
];
```

**Key Features**:
- ✅ Cascading configuration discovery
- ✅ Environment variable overrides
- ✅ Deep merge of configs (preserves priority)
- ✅ Zod schema validation
- ✅ Env variable reference resolution (`env:VAR_NAME`)
- ✅ Caching (single instance pattern)

**JSON Parsing Details**:
```typescript
// Lines 176-179
const content = await fs.readFile(absolutePath, 'utf-8');
const json = JSON.parse(content);
return this.resolveEnvReferences(json) as PartialConfig;
```

**Validation Schema**: `ConfigSchema` in `/src/config-types.ts` (Zod-based)
**Supported Env Vars**:
- `CODE_EXECUTOR_CONFIG_PATH` - Override default config path
- `MCP_CONFIG_PATH` - Override MCP config path
- `ALLOWED_PROJECTS` - Colon-separated allowed paths
- `ENABLE_AUDIT_LOG` - Enable audit logging
- `AUDIT_LOG_PATH` - Custom audit log path
- `DENO_PATH` - Custom Deno executable
- `POOL_MAX_CONCURRENT` - Connection pool size
- `POOL_QUEUE_SIZE` - Queue size
- `POOL_QUEUE_TIMEOUT_MS` - Queue timeout

**Limitations**:
- ❌ No write capability (read-only)
- ❌ No backup creation
- ❌ No in-place modification support
- ⚠️ ASYNC ONLY (`fs/promises`)

---

### 1.3 Schema Cache Disk Persistence

**Status**: PRODUCTION-READY

**Location**: `/home/alexandrueremia/projects/code-executor-mcp/src/schema-cache.ts`

**Methods**:
- `loadFromDisk()` - Lines 69-99
- `saveToDisk()` - Lines 104-132

**Disk Location**: `~/.code-executor/schema-cache.json`

**Disk Operations**:
```typescript
// Read: loadFromDisk() - Lines 71-72
const data = await fs.readFile(this.cachePath, 'utf-8');
const parsed = JSON.parse(data);

// Write: saveToDisk() - Lines 125
await fs.writeFile(this.cachePath, jsonPayload, 'utf-8');
```

**Concurrency Protection**:
- ✅ Protected by AsyncLock (`await this.lock.acquire('disk-write', ...)`)
- ✅ Prevents race conditions on concurrent writes
- ✅ Safe for multi-threaded environments

**Key Features**:
- ✅ LRU cache with TTL (24 hours)
- ✅ Automatic eviction (max 1000 entries)
- ✅ Stale-on-error resilience
- ✅ Directory creation (`mkdir` with `recursive: true`)

**Limitations**:
- ❌ No backup before write
- ❌ No version checking
- ⚠️ Loads ENTIRE cache into memory (no streaming)

---

## 2. CONFIGURATION FILE MANAGEMENT

### 2.1 Configuration Discovery & Validation

**Status**: PRODUCTION-READY

**Location**: `/home/alexandrueremia/projects/code-executor-mcp/src/config-discovery.ts`
**Location**: `/home/alexandrueremia/projects/code-executor-mcp/src/config-types.ts`

**Class**: `ConfigDiscoveryService` with Zod schemas

**Configuration Schemas** (Zod-based):
```typescript
// Security config (config-types.ts, lines 46-57)
export const SecurityConfigSchema = z.object({
  defaultTimeoutMs: z.number().min(1000).max(300000).default(30000),
  maxTimeoutMs: z.number().min(1000).max(600000).default(300000),
  maxCodeSize: z.number().min(1000).max(1000000).default(100000),
  allowRead: z.array(z.string()).default([]),
  allowWrite: z.union([z.boolean(), z.array(z.string())]).default(false),
  allowNetwork: z.union([z.boolean(), z.array(z.string())]).default(['localhost']),
  enableAuditLog: z.boolean().default(false),
  auditLogPath: z.string().default('./audit.log'),
});

// Pool config (config-types.ts, lines 32-39)
export const PoolConfigSchema = z.object({
  maxConcurrent: z.number().int().min(1).max(1000).default(100),
  queueSize: z.number().int().min(1).max(1000).default(200),
  queueTimeoutMs: z.number().int().min(1000).max(300000).default(30000),
});
```

**Configuration Access** (`config.ts`):
- `getConfig()` - Returns validated Config object
- `getAllowedReadPaths()` - Get allowed read paths
- `getAllowedWritePaths()` - Get write paths (returns `false` if disabled)
- `getPoolConfig()` - Get connection pool config with Zod validation
- `getDenoPath()` - Get Deno executable path
- `getMCPConfigPath()` - Get MCP config file path

**Validation Features**:
- ✅ Zod runtime validation
- ✅ Type inference from schemas
- ✅ Clear error messages on validation failure
- ✅ Bounds checking (min/max values enforced)
- ✅ Default values provided for all fields

**Key Helper Functions**:
```typescript
// config.ts, lines 224-261
export function getPoolConfig(): PoolConfig {
  const parseEnvInt = (value: string | undefined, name: string): number | undefined => {
    if (!value) return undefined;
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new Error(`Invalid numeric value for ${name}...`);
    }
    return parsed;
  };
  // Validates and returns PoolConfigSchema
}
```

**Limitations**:
- ❌ No write capability
- ❌ No in-place config file modification
- ⚠️ No backup before changes

---

### 2.2 Environment Variable Resolution

**Status**: PRODUCTION-READY

**Location**: `/home/alexandrueremia/projects/code-executor-mcp/src/config-discovery.ts`
**Method**: `resolveEnvReferences()` - Lines 189-217

**Features**:
- ✅ Resolves `env:VAR_NAME` patterns in config files
- ✅ Recursive resolution (arrays and nested objects)
- ✅ Type validation (throws on missing variables)
- ✅ String pattern matching: `/^env:([A-Z_][A-Z0-9_]*)$/`

**Example**:
```json
{
  "allowRead": ["env:PROJECT_ROOT", "/tmp"]
}
```

Resolves to:
```json
{
  "allowRead": ["/path/to/project", "/tmp"]
}
```

---

## 3. LOCK FILE MANAGEMENT

### 3.1 PID-Based Locking

**Status**: ❌ NOT IMPLEMENTED

**Analysis**: The codebase does NOT include dedicated lock file/PID management:
- ❌ No `LockService` class
- ❌ No PID-based locking mechanism
- ❌ No process cleanup on lock file stale detection
- ❌ No concurrent access prevention

**What EXISTS Instead**:
- ✅ **AsyncLock** (async-lock library) - Used for protecting shared resources
  - Location: Multiple files (schema-cache.ts, audit-logger.ts)
  - Purpose: Mutex for concurrent disk writes
  - NOT suitable for: PID-based inter-process locking

**AsyncLock Usage**:
```typescript
// schema-cache.ts, line 106
await this.lock.acquire('disk-write', async () => {
  // Protected code
  await fs.writeFile(this.cachePath, jsonPayload, 'utf-8');
});
```

**Issue with AsyncLock for Lock Files**:
- ✅ Works within single Node.js process
- ❌ Does NOT work across multiple processes
- ❌ Lost when process exits
- ❌ No persistent lock files created

**Recommendation for CLI**:
If you need PID-based locking across processes, implement:
1. **Lock file creation**: `<lockdir>/.lock` with PID
2. **Stale detection**: Check if PID exists in process table
3. **Cleanup**: Remove lock file on graceful shutdown
4. **Timeout**: Auto-release after 1 hour (configurable)

---

## 4. AUDIT LOGGING

### 4.1 Append-Only Audit Log Implementation

**Status**: PRODUCTION-READY

**Location**: `/home/alexandrueremia/projects/code-executor-mcp/src/audit-logger.ts`

**Class**: `AuditLogger implements IAuditLogger`
**Lines**: 74-278

**Key Features**:
- ✅ Daily log rotation (audit-YYYY-MM-DD.log)
- ✅ 30-day retention (configurable via `AUDIT_LOG_RETENTION_DAYS`)
- ✅ JSONL format (one JSON object per line)
- ✅ AsyncLock protection for concurrent writes
- ✅ Automatic cleanup of old logs
- ✅ Directory creation with recursive flag

### 4.1.1 Append-Only Log Writing

**Method**: `log(entry: AuditLogEntry): Promise<void>`
**Lines**: 155-179

```typescript
async log(entry: AuditLogEntry): Promise<void> {
  // T076: Acquire lock for concurrent write protection
  await this.lock.acquire('log-write', async () => {
    // Ensure log directory exists
    await this.ensureLogDir();
    const logPath = this.getLogPath();

    // T077: JSONL format - one JSON object per line
    const jsonLine = JSON.stringify(entry) + '\n';

    // Append to log file (atomic write)
    try {
      await fs.appendFile(logPath, jsonLine, 'utf-8');
    } catch (error) {
      const err = normalizeError(error);
      throw new Error(`Failed to write audit log entry: ${err.message}`);
    }
  });
}
```

**Concurrency Safety**:
- ✅ AsyncLock prevents interleaved writes
- ✅ `fs.appendFile()` is atomic (O_APPEND flag)
- ✅ No data corruption under concurrent load
- ✅ Multiple threads safe

### 4.1.2 Daily Log Rotation

**Method**: `rotate(): Promise<void>`
**Lines**: 213-225

**File Naming Convention**: `audit-YYYY-MM-DD.log` (ISO 8601 format)

```typescript
private getLogFilename(): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `audit-${today}.log`;
}
```

**Rotation Logic**:
- Invalidates cached log file path at midnight UTC
- Creates new file on first write after rotation
- Protected by AsyncLock (prevents race conditions)

### 4.1.3 Retention Policy & Cleanup

**Method**: `cleanup(): Promise<void>`
**Lines**: 235-277

**Features**:
- Deletes logs older than `retentionDays` (default: 30)
- Automatic date parsing from filename
- Partial success handling (continues if one deletion fails)
- Configurable via `AUDIT_LOG_RETENTION_DAYS` env var

**Implementation**:
```typescript
// Parse date from filename (audit-2025-11-18.log)
const auditLogPattern = /^audit-(\d{4})-(\d{2})-(\d{2})\.log$/;
const match = filename.match(auditLogPattern);
const logDate = new Date(`${year}-${month}-${day}`);

// Delete if older than retention period
if (logDate < cutoffDate) {
  await fs.unlink(logPath);
}
```

### 4.1.4 Audit Log Entry Schema

**Location**: `/home/alexandrueremia/projects/code-executor-mcp/src/interfaces/audit-logger.ts`
**Lines**: 26-49

```typescript
export interface AuditLogEntry {
  timestamp: string;              // UTC ISO 8601
  correlationId: string;          // Request tracing
  eventType: AuditEventType;      // Tool call, auth failure, etc.
  clientId?: string;              // SHA-256 hashed (no plaintext API keys)
  clientIp?: string;              // For auth failures
  toolName?: string;              // MCP tool called
  paramsHash?: string;            // SHA-256 of params
  status: AuditStatus;            // success | failure | rejected
  errorMessage?: string;          // Sanitized (no secrets)
  latencyMs?: number;             // Request duration
  metadata?: Record<string, unknown>;
}
```

**Event Types**:
```typescript
type AuditEventType =
  | 'auth_failure'
  | 'rate_limited'
  | 'circuit_open'
  | 'queue_full'
  | 'tool_call'
  | 'shutdown'
  | 'discovery';
```

### 4.1.5 Audit Log Directory Structure

**Default Location**: `~/.code-executor/audit-logs/`

**Directory Creation**:
```typescript
// Lines 137-144
private async ensureLogDir(): Promise<void> {
  try {
    await fs.mkdir(this.logDir, { recursive: true });
  } catch (error) {
    const err = normalizeError(error);
    throw new Error(`Failed to create audit log directory ${this.logDir}...`);
  }
}
```

**Example File Structure**:
```
~/.code-executor/audit-logs/
├── audit-2025-11-18.log     (today)
├── audit-2025-11-17.log
├── audit-2025-11-16.log
└── audit-2025-10-19.log     (30 days old, cleaned up)
```

### 4.1.6 JSONL Format (Streaming-Friendly)

**Format**: One JSON object per line (NOT array-wrapped)

**Example**:
```jsonl
{"timestamp":"2025-11-18T10:30:00Z","correlationId":"req-123","eventType":"tool_call","toolName":"mcp__zen__codereview","status":"success"}
{"timestamp":"2025-11-18T10:30:15Z","correlationId":"req-124","eventType":"auth_failure","status":"rejected","errorMessage":"Invalid bearer token"}
```

**Benefits**:
- ✅ Streaming parsers can read line-by-line
- ✅ No array wrapping overhead
- ✅ No trailing comma issues
- ✅ Natural log file format (tail -f works)

### 4.1.7 Security Features

**No Sensitive Data**:
- API keys: Hashed with SHA-256 (stored as `clientId` hash)
- Params: Hashed with SHA-256 (stored as `paramsHash`)
- Error messages: Sanitized (no stack traces, secrets removed)

**Audit Trail**:
- Timestamp: UTC ISO 8601 for consistency
- Correlation ID: For distributed request tracing
- Client IP: Logged for auth failures

**Retention Policy**:
- Default: 30 days (compliance requirement)
- Configurable: `AUDIT_LOG_RETENTION_DAYS` env var
- Min/max: 1-365 days (enforced by Zod schema)

### 4.1.8 Error Handling

**Comprehensive Error Handling**:
- Uses `normalizeError()` for consistent error formatting
- Throws descriptive errors (include operation context)
- Continues partial cleanup on individual file failures
- Wraps all promises to prevent unhandled rejections

---

## 5. REUSABILITY ANALYSIS

### 5.1 What You Can Reuse (CLI-Safe)

| Component | File | Reusability | Effort | Notes |
|-----------|------|-------------|--------|-------|
| **Path canonicalization** | `utils.ts:isAllowedPath()` | High | Low | Async only; add sync wrapper if needed |
| **Config discovery** | `config-discovery.ts` | High | Low | Extract `findConfig()`, `loadConfigFile()` |
| **Config validation** | `config-types.ts` | High | Low | Zod schemas are standalone |
| **Audit logging** | `audit-logger.ts` | High | Medium | Direct reuse; AsyncLock dependency exists |
| **Error normalization** | `utils.ts:normalizeError()` | High | Low | Pure utility function |
| **JSONL formatting** | `audit-logger.ts:log()` | High | Low | Copy JSON.stringify + '\n' pattern |

### 5.2 What You Need to Build (CLI-Specific)

| Component | Reason | Complexity |
|-----------|--------|-----------|
| **PID-based locking** | Not in codebase; needed for process safety | Medium |
| **Backup service** | Not in codebase; needed before config writes | Medium |
| **Config file write** | Only read exists; need atomic writes | Low |
| **Lock cleanup** | Stale lock detection + removal | Low |

---

## 6. DEPENDENCIES

### 6.1 External Dependencies Used

```json
{
  "async-lock": "^1.4.1",    // AsyncLock for mutex protection
  "zod": "^3.x.x",           // Schema validation
  "lru-cache": "^10.x.x"     // LRU cache (schema-cache.ts)
}
```

### 6.2 Built-in Node.js APIs Used

```typescript
// File system
import { promises as fs } from 'fs';          // fs.readFile, fs.writeFile, fs.mkdir, fs.appendFile
import * as path from 'path';                 // path.join, path.resolve, path.dirname

// Utilities
import * as os from 'os';                     // os.homedir()
import * as crypto from 'crypto';             // crypto.createHash() for SHA-256

// Async
import AsyncLock from 'async-lock';          // Mutex for concurrent protection
```

---

## 7. CODE SNIPPETS FOR REUSE

### 7.1 Direct Reuse - AuditLogger

**File**: `/home/alexandrueremia/projects/code-executor-mcp/src/audit-logger.ts`

```typescript
// Copy these directly:
// 1. Class: AuditLogger (lines 74-278)
// 2. Interface: IAuditLogger (from interfaces/audit-logger.ts)
// 3. Dependency: async-lock

import AsyncLock from 'async-lock';
import { AuditLogger } from './audit-logger';

// Usage
const logger = new AuditLogger();
await logger.log({
  timestamp: new Date().toISOString(),
  correlationId: 'cli-cmd-123',
  eventType: 'tool_call',
  status: 'success'
});
```

### 7.2 Direct Reuse - Path Canonicalization

**File**: `/home/alexandrueremia/projects/code-executor-mcp/src/utils.ts`

```typescript
import { isAllowedPath } from './utils';

// Usage
const isValid = await isAllowedPath('/home/user/project/file.txt', ['/home/user/project']);
```

### 7.3 Direct Reuse - Config Discovery

**File**: `/home/alexandrueremia/projects/code-executor-mcp/src/config-discovery.ts`

```typescript
import { ConfigDiscoveryService } from './config-discovery';

const service = new ConfigDiscoveryService();
const config = await service.findConfig();
const allMcpConfigs = await service.findAllMCPConfigs();
```

### 7.4 Reuse with Adaptation - Configuration File Write

**Implement**:
```typescript
// Add to config-discovery.ts
async saveConfigFile(filePath: string, config: PartialConfig): Promise<void> {
  const absolutePath = path.resolve(filePath);

  // Backup existing file if it exists
  try {
    const backupPath = `${absolutePath}.backup`;
    await fs.copyFile(absolutePath, backupPath);
  } catch {
    // File doesn't exist or copy failed - not an error
  }

  // Write with atomic operation
  const jsonPayload = JSON.stringify(config, null, 2);
  const tempPath = `${absolutePath}.tmp`;
  await fs.writeFile(tempPath, jsonPayload, 'utf-8');

  // Atomic rename (atomic on modern filesystems)
  await fs.rename(tempPath, absolutePath);
}
```

### 7.5 Build New - PID-Based Locking

**Location**: Create `/home/alexandrueremia/projects/code-executor-mcp/src/pid-lock.ts`

```typescript
/**
 * PID-based lock file management for process safety
 */
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

export class PIDLock {
  private lockPath: string;

  constructor(lockFile: string = '~/.code-executor/.lock') {
    this.lockPath = path.resolve(lockFile);
  }

  async acquire(): Promise<void> {
    const lockDir = path.dirname(this.lockPath);
    await fs.mkdir(lockDir, { recursive: true });

    // Try to read existing lock
    try {
      const content = await fs.readFile(this.lockPath, 'utf-8');
      const pid = parseInt(content.trim(), 10);

      // Check if process still exists
      if (this.processExists(pid)) {
        throw new Error(`Lock held by process ${pid}`);
      }

      // Stale lock - remove it
      await fs.unlink(this.lockPath);
    } catch (error) {
      // Lock file doesn't exist - continue
    }

    // Create lock file with current PID
    await fs.writeFile(this.lockPath, String(process.pid), 'utf-8');
  }

  async release(): Promise<void> {
    try {
      await fs.unlink(this.lockPath);
    } catch {
      // Already released or doesn't exist - ignore
    }
  }

  private processExists(pid: number): boolean {
    try {
      process.kill(pid, 0);  // Signal 0 = check existence
      return true;
    } catch {
      return false;
    }
  }
}
```

---

## 8. RECOMMENDATIONS FOR CLI IMPLEMENTATION

### 8.1 Immediate Reuse (No Changes Needed)

1. **AuditLogger** - Copy class directly
2. **ConfigDiscoveryService** - Copy class directly (read-only)
3. **Error normalization** - Copy utility functions
4. **Path canonicalization** - Copy async version

### 8.2 Adapt Before Reuse

1. **Config file write** - Implement atomic write with backup
2. **Environment variable parsing** - Add CLI flag overrides
3. **Zod validation** - Create CLI-specific schemas (e.g., `--allowed-paths` flag)

### 8.3 Build New

1. **PID-based locking** - See section 7.5
2. **Lock cleanup** - Add stale lock detection
3. **Backup service** - Implement atomic file backup

### 8.4 Architecture Recommendations

```
CLI Service Architecture:
├── ConfigManager (reuse ConfigDiscoveryService)
├── AuditLogger (reuse AuditLogger)
├── LockManager (build new - PID-based)
├── BackupService (build new - atomic backups)
├── PathValidator (reuse isAllowedPath)
└── SecurityValidator (reuse from security.ts)
```

---

## 9. TESTING CONSIDERATIONS

### 9.1 Existing Test Coverage

- **AuditLogger**: Tests in codebase validate rotation, retention, JSONL format
- **ConfigDiscovery**: Environment variable resolution tested
- **Schema validation**: Zod-based validation tested

### 9.2 CLI-Specific Tests to Add

1. **Lock file contention** - Multiple processes acquiring locks
2. **Backup atomicity** - No partial writes on failure
3. **Config file corruption** - Recovery from invalid JSON
4. **Permission handling** - Files with wrong permissions

---

## 10. FILE REFERENCE GUIDE

### Configuration & Discovery
| File | Purpose | Reusable |
|------|---------|----------|
| `src/config-discovery.ts` | Config file discovery + merging | ✅ High |
| `src/config.ts` | Config access API | ✅ High |
| `src/config-types.ts` | Zod schemas | ✅ High |

### Audit Logging
| File | Purpose | Reusable |
|------|---------|----------|
| `src/audit-logger.ts` | Append-only audit log | ✅ High |
| `src/interfaces/audit-logger.ts` | IAuditLogger interface | ✅ High |

### File System Operations
| File | Purpose | Reusable |
|------|---------|----------|
| `src/utils.ts` | Path canonicalization + utilities | ✅ High |
| `src/security.ts` | Path validation | ✅ Medium |
| `src/schema-cache.ts` | Disk persistence example | ✅ Medium |

### Concurrency Protection
| File | Purpose | Reusable |
|------|---------|----------|
| `src/schema-cache.ts` | AsyncLock usage pattern | ✅ Medium |
| `src/audit-logger.ts` | AsyncLock usage pattern | ✅ Medium |

---

## Appendix A: AsyncLock Configuration

The codebase uses AsyncLock for protecting concurrent access:

```typescript
import AsyncLock from 'async-lock';

const lock = new AsyncLock();

// Single lock protection
await lock.acquire('key-name', async () => {
  // Code here runs exclusively (no concurrent access to this key)
  await fs.appendFile(path, data);
});

// Multiple locks (independent)
await lock.acquire('write', async () => { /* ... */ });  // Can run in parallel
await lock.acquire('read', async () => { /* ... */ });   // Different keys
```

**Note**: AsyncLock is **not** inter-process. For CLI cross-process safety, implement PID-based file locking.

---

## Appendix B: Environment Variables Supported

| Variable | Type | Default | Used By |
|----------|------|---------|---------|
| `CODE_EXECUTOR_CONFIG_PATH` | path | None | config-discovery.ts |
| `MCP_CONFIG_PATH` | path | None | config-discovery.ts |
| `ALLOWED_PROJECTS` | colon-sep paths | None | config.ts |
| `ENABLE_AUDIT_LOG` | bool | false | config.ts |
| `AUDIT_LOG_PATH` | path | ./audit.log | config.ts |
| `AUDIT_LOG_RETENTION_DAYS` | int | 30 | audit-logger.ts |
| `DENO_PATH` | path | deno | config.ts |
| `POOL_MAX_CONCURRENT` | int | 100 | config.ts |
| `POOL_QUEUE_SIZE` | int | 200 | config.ts |
| `POOL_QUEUE_TIMEOUT_MS` | int | 30000 | config.ts |
| `HOME` | path | System default | audit-logger.ts |
| `USERPROFILE` | path | System default | audit-logger.ts |

---

**End of Audit Report**
