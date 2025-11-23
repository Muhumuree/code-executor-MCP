#!/usr/bin/env node
/**
 * Daily Sync CLI - Wrapper regeneration command
 *
 * **RESPONSIBILITY (SRP):** Run daily sync service to detect schema changes and regenerate wrappers
 * **WHY:** Scheduled task entry point for automated wrapper maintenance
 * **USAGE:** npx code-executor-mcp sync-wrappers
 */

import { DailySyncService } from './daily-sync.js';
import { MCPClientPool } from '../mcp/client-pool.js';
import { SchemaCache } from '../validation/schema-cache.js';
import { WrapperGenerator } from './wrapper-generator.js';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';

/**
 * Main entry point for daily sync CLI
 */
async function main(): Promise<void> {
  try {
    console.log('🔄 Starting daily wrapper sync...\n');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const codeExecutorDir = path.join(os.homedir(), '.code-executor');
    const manifestPath = path.join(codeExecutorDir, 'wrapper-manifest.json');
    const wrapperOutputDir = path.join(codeExecutorDir, 'wrappers');
    const templateDir = path.join(__dirname, '..', '..', 'templates');

    // Initialize MCP Client Pool
    const pool = new MCPClientPool();
    await pool.initialize();

    // Initialize Schema Cache with MCPClientPool as schemaProvider
    // SchemaCache constructor: (schemaProvider, ttlMs, cachePath, maxCacheSize)
    const cache = new SchemaCache(
      pool,  // schemaProvider (FIRST parameter!)
      86400000,  // ttlMs (24 hours)
      path.join(codeExecutorDir, 'schema-cache.json'),  // cachePath
      1000  // maxCacheSize
    );

    // Initialize Wrapper Generator
    const wrapperGenerator = new WrapperGenerator({
      outputDir: wrapperOutputDir,
      templateDir,
      manifestPath
    });

    // Initialize daily sync service
    const dailySync = new DailySyncService({
      manifestPath,
      wrapperOutputDir,
      templateDir,
      mcpClientPool: pool,
      schemaCache: cache,
      wrapperGenerator
    });

    console.log('📊 Checking for schema changes...\n');

    const result = await dailySync.sync();

    console.log('\n📊 Daily Sync Results:');
    console.log(`⏱️  Duration: ${result.durationMs}ms`);

    if (result.skipped) {
      console.log(`⏭️  Skipped: ${result.reason}`);
    } else {
      console.log(`✅ Unchanged: ${result.unchanged.length}`);
      result.unchanged.forEach(w => console.log(`   - ${w}`));

      console.log(`🔄 Regenerated: ${result.regenerated.length}`);
      result.regenerated.forEach(w => console.log(`   - ${w}`));

      console.log(`❌ Failed: ${result.failed.length}`);
      result.failed.forEach(w => console.log(`   - ${w}`));
    }

    await pool.disconnect();

    console.log('\n✅ Daily sync complete!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Daily sync failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run
main().catch(error => {
  console.error('Fatal:', error);
  process.exit(1);
});
