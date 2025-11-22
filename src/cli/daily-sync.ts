/**
 * DailySyncService - Incremental wrapper regeneration based on schema hash changes
 *
 * **RESPONSIBILITY (SRP):** Detect MCP schema changes and regenerate only modified wrappers
 * **WHY:** Daily automated sync should be fast (skip unchanged) and incremental (minimize work)
 * **USAGE:** Called by platform-specific schedulers (systemd timer, launchd agent, Task Scheduler)
 *
 * **ARCHITECTURE:**
 * - Reads wrapper manifest (~/.code-executor/wrapper-manifest.json)
 * - For each wrapper, fetches current MCP schema and computes SHA-256 hash
 * - Compares current hash with stored hash in manifest
 * - Regenerates wrappers only if hashes differ (incremental update)
 * - Updates manifest with new hashes and timestamps
 *
 * **DESIGN PATTERN:** Strategy (hash comparison strategy), Command (regeneration as command)
 * **PRINCIPLE:** Open-Closed (extensible for different hash strategies without modification)
 */

import { promises as fs } from 'fs';
import { createHash } from 'crypto';
import * as path from 'path';
import type { WrapperManifest, WrapperEntry } from './types.js';
import { WrapperGenerator } from './wrapper-generator.js';

/**
 * DailySyncOptions - Configuration for daily sync service
 *
 * **USAGE:** Passed to DailySyncService constructor
 */
export interface DailySyncOptions {
  /**
   * Absolute path to wrapper manifest file
   *
   * **DEFAULT:** ~/.code-executor/wrapper-manifest.json
   * **FORMAT:** JSON file with WrapperManifest structure
   */
  manifestPath: string;

  /**
   * Absolute path to wrapper output directory
   *
   * **DEFAULT:** ~/.code-executor/wrappers
   * **STRUCTURE:** wrappers/typescript/, wrappers/python/
   */
  wrapperOutputDir: string;

  /**
   * Absolute path to template directory
   *
   * **DEFAULT:** Project root templates/ directory
   * **CONTENTS:** typescript-wrapper.hbs, python-wrapper.hbs
   */
  templateDir: string;
}

/**
 * DailySyncResult - Result of daily sync operation
 *
 * **USAGE:** Returned by DailySyncService.sync()
 */
export interface DailySyncResult {
  /**
   * Whether sync was skipped (no manifest, empty manifest, or read error)
   */
  skipped: boolean;

  /**
   * Reason for skipping (if skipped === true)
   */
  reason?: string;

  /**
   * List of wrappers that were regenerated (schema hash changed)
   *
   * **FORMAT:** 'mcpName (language)' (e.g., 'filesystem (typescript)')
   */
  regenerated: string[];

  /**
   * List of wrappers that were unchanged (schema hash same)
   *
   * **FORMAT:** 'mcpName (language)' (e.g., 'github (python)')
   */
  unchanged: string[];

  /**
   * List of wrappers that failed to regenerate (with error message)
   *
   * **FORMAT:** 'mcpName (language): error message'
   */
  failed: string[];

  /**
   * Total execution time in milliseconds
   */
  durationMs: number;
}

/**
 * DailySyncService - Daily sync service for incremental wrapper regeneration
 *
 * **RESPONSIBILITY (SRP):** Detect schema changes and regenerate wrappers incrementally
 * **WHY:** Minimize daily sync execution time by skipping unchanged wrappers
 */
export class DailySyncService {
  private manifestPath: string;
  private wrapperGenerator: WrapperGenerator;

  /**
   * Constructor
   *
   * **VALIDATION:**
   * - manifestPath must be absolute (security: prevent path traversal)
   * - wrapperOutputDir must be absolute (security: prevent path traversal)
   * - templateDir must be absolute (security: prevent path traversal)
   *
   * **DEPENDENCY INJECTION:**
   * - wrapperGenerator can be injected for testing (mocking)
   * - If not provided, creates default WrapperGenerator instance
   *
   * @param options Daily sync configuration
   * @param wrapperGenerator Optional WrapperGenerator instance (DI for testing)
   * @throws Error if paths are not absolute
   */
  constructor(options: DailySyncOptions, wrapperGenerator?: WrapperGenerator) {
    // Validation: all paths must be absolute (security)
    if (!path.isAbsolute(options.manifestPath)) {
      throw new Error('manifestPath must be absolute');
    }
    if (!path.isAbsolute(options.wrapperOutputDir)) {
      throw new Error('wrapperOutputDir must be absolute');
    }
    if (!path.isAbsolute(options.templateDir)) {
      throw new Error('templateDir must be absolute');
    }

    this.manifestPath = options.manifestPath;

    // Dependency Injection: use provided generator or create default
    this.wrapperGenerator = wrapperGenerator ?? new WrapperGenerator({
      outputDir: options.wrapperOutputDir,
      templateDir: options.templateDir,
      manifestPath: options.manifestPath,
    });
  }

  /**
   * Execute daily sync
   *
   * **BEHAVIOR:**
   * 1. Read wrapper manifest from disk
   * 2. For each wrapper entry:
   *    a. Compute current schema hash (fetch MCP schemas, hash them)
   *    b. Compare with stored hash in manifest
   *    c. If different, regenerate wrapper using WrapperGenerator
   *    d. If same, skip regeneration
   * 3. Return sync result with regenerated/unchanged/failed counts
   *
   * **ERROR HANDLING:**
   * - Manifest not found → skip sync (not an error, first run scenario)
   * - Manifest read error → skip sync with error message
   * - Individual wrapper regeneration failure → log and continue (partial failure OK)
   *
   * @returns DailySyncResult Sync result summary
   */
  async sync(): Promise<DailySyncResult> {
    const startTime = Date.now();
    const result: DailySyncResult = {
      skipped: false,
      regenerated: [],
      unchanged: [],
      failed: [],
      durationMs: 0,
    };

    try {
      // Step 1: Read manifest
      const manifest = await this.readManifest();

      // Skip if manifest doesn't exist
      if (!manifest) {
        result.skipped = true;
        result.reason = 'Manifest not found (first run or no wrappers generated yet)';
        result.durationMs = Date.now() - startTime;
        return result;
      }

      // Skip if manifest has no wrappers
      if (manifest.wrappers.length === 0) {
        result.skipped = true;
        result.reason = 'No wrappers in manifest (nothing to sync)';
        result.durationMs = Date.now() - startTime;
        return result;
      }

      // Step 2: Process each wrapper entry
      for (const wrapper of manifest.wrappers) {
        const wrapperKey = `${wrapper.mcpName} (${wrapper.language})`;

        try {
          // Compute current schema hash
          const currentHash = await this.computeCurrentSchemaHash(wrapper.mcpName);

          // Compare with stored hash
          if (currentHash === wrapper.schemaHash) {
            // Schema unchanged → skip regeneration
            result.unchanged.push(wrapperKey);
          } else {
            // Schema changed → regenerate wrapper
            const success = await this.regenerateWrapper(wrapper);

            if (success) {
              result.regenerated.push(wrapperKey);
            } else {
              result.failed.push(`${wrapperKey}: Regeneration failed (see logs)`);
            }
          }
        } catch (error: unknown) {
          // Individual wrapper failure → log and continue
          const errorMessage = this.formatError(error);
          result.failed.push(`${wrapperKey}: ${errorMessage}`);
        }
      }
    } catch (error: unknown) {
      // Manifest read error → skip sync
      result.skipped = true;
      result.reason = `Failed to read manifest: ${this.formatError(error)}`;
    }

    result.durationMs = Date.now() - startTime;
    return result;
  }

  /**
   * Read wrapper manifest from disk
   *
   * **ERROR HANDLING:**
   * - File not found → return null (not an error, first run scenario)
   * - JSON parse error → throw (invalid manifest structure)
   *
   * @returns WrapperManifest | null Manifest object or null if not found
   * @throws Error if manifest exists but is invalid JSON
   */
  private async readManifest(): Promise<WrapperManifest | null> {
    try {
      const manifestJson = await fs.readFile(this.manifestPath, 'utf8');
      const parsed = JSON.parse(manifestJson) as unknown;

      // Validate manifest structure (runtime type checking)
      if (!this.isValidWrapperManifest(parsed)) {
        throw new Error('Invalid manifest structure: missing required fields (version, generatedAt, wrappers)');
      }

      return parsed;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File not found → return null (first run scenario)
        return null;
      }
      // Other errors (JSON parse, permission, validation) → throw
      throw error;
    }
  }

  /**
   * Validate WrapperManifest structure (runtime type guard)
   *
   * **WHY:** Type assertions without runtime validation = `any` backdoor
   * **PRINCIPLE:** Validate ALL external inputs (manifest is disk-based external input)
   *
   * @param value Unknown value to validate
   * @returns boolean true if valid WrapperManifest structure
   */
  private isValidWrapperManifest(value: unknown): value is WrapperManifest {
    if (typeof value !== 'object' || value === null) return false;

    const obj = value as Record<string, unknown>;

    // Validate required fields
    if (typeof obj.version !== 'string') return false;
    if (typeof obj.generatedAt !== 'string') return false;
    if (!Array.isArray(obj.wrappers)) return false;

    // Validate each wrapper entry (basic structure check)
    for (const wrapper of obj.wrappers) {
      if (typeof wrapper !== 'object' || wrapper === null) return false;

      const entry = wrapper as Record<string, unknown>;
      if (typeof entry.mcpName !== 'string') return false;
      if (entry.language !== 'typescript' && entry.language !== 'python') return false;
      if (typeof entry.schemaHash !== 'string') return false;
      if (typeof entry.outputPath !== 'string') return false;
      if (typeof entry.generatedAt !== 'string') return false;
      if (entry.status !== 'success' && entry.status !== 'failed') return false;
    }

    return true;
  }

  /**
   * Format error for user-friendly display (DRY utility)
   *
   * **WHY:** Eliminate duplicated error formatting pattern
   *
   * @param error Unknown error value
   * @returns string Formatted error message
   */
  private formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  /**
   * Compute current schema hash for an MCP server
   *
   * **ALGORITHM:**
   * 1. Fetch current MCP tool schemas (via MCP Client Pool or discovery)
   * 2. Normalize schemas (sort keys, remove timestamps)
   * 3. Compute SHA-256 hash of normalized schemas
   *
   * **IMPLEMENTATION NOTE (Phase 9 MVP stub):**
   * - Current: Returns deterministic stub hash (testing only)
   * - Phase 10 TODO (#70): Integrate with MCPClientPool.discoverMCPTools()
   * - Algorithm:
   *   1. Call discoverMCPTools({ search: [mcpName] })
   *   2. Extract tools array, sort by name (deterministic order)
   *   3. JSON.stringify with sorted keys
   *   4. Compute SHA-256 hash
   * - Migration: Replace stub when Phase 8 (wrapper-generator) completes
   *
   * @param mcpName MCP server name (e.g., 'filesystem', 'github')
   * @returns Promise<string> SHA-256 hash of current schemas (hex string)
   */
  private async computeCurrentSchemaHash(mcpName: string): Promise<string> {
    // TODO (#70): Implement full schema fetching and hashing (see implementation note above)
    // For now, return a deterministic hash based on MCP name (stub)
    const hash = createHash('sha256');
    hash.update(`${mcpName}-stub-hash`);
    return hash.digest('hex');
  }

  /**
   * Regenerate wrapper for a wrapper entry
   *
   * **BEHAVIOR:**
   * 1. Extract MCP server config from wrapper entry
   * 2. Call WrapperGenerator.generateWrapper() with current config
   * 3. Return true if generation succeeds, false otherwise
   *
   * **IMPLEMENTATION NOTE (Phase 9 MVP stub):**
   * - Current: Always returns true (testing only)
   * - Phase 10 TODO (#70): Reconstruct MCPServerSelection from wrapper entry
   * - Algorithm:
   *   1. Extract mcpName, language from wrapper entry
   *   2. Construct MCPServerSelection object (needs MCP config lookup)
   *   3. Call this.wrapperGenerator.generateWrapper(mcpSelection, language, moduleFormat)
   *   4. Return result.success
   * - Migration: Replace stub when Phase 8 (wrapper-generator) completes
   *
   * @param wrapper Wrapper entry from manifest
   * @returns Promise<boolean> true if regeneration succeeded, false otherwise
   */
  private async regenerateWrapper(_wrapper: WrapperEntry): Promise<boolean> {
    // TODO (#70): Implement full wrapper regeneration (see implementation note above)
    // For now, return success (stub)
    return true;
  }
}
