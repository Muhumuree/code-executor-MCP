/**
 * ToolDetector Service - Detect installed AI development tools
 *
 * **RESPONSIBILITY (SRP):** Detect which AI tools are installed by checking config file existence
 * **WHY SEPARATE:** Tool detection logic isolated from registry (OCP - extend without modifying)
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import {
  getSupportedToolsForPlatform,
  type AIToolMetadata,
} from './tool-registry.js';

/**
 * ToolDetector - Detect installed AI development tools on current system
 *
 * **DESIGN:** Parallel checks using Promise.all for performance (O(1) amortized)
 */
export class ToolDetector {
  /**
   * Resolve config path for current platform
   *
   * **RESPONSIBILITY:** Path resolution logic (SRP - separate from registry data)
   * **WHY HERE:** Detection service owns path resolution, registry owns metadata
   *
   * @param tool Tool metadata
   * @returns Absolute path to config file or undefined if not supported on platform
   */
  private resolveConfigPath(tool: AIToolMetadata): string | undefined {
    const platform = process.platform as 'linux' | 'darwin' | 'win32';
    const configPath = tool.configPaths[platform];

    if (!configPath) {
      return undefined;
    }

    // Expand both Unix (~) and Windows (%APPDATA%) paths
    return configPath
      .replace(/^~/, os.homedir())
      .replace(/%APPDATA%/g, process.env.APPDATA || '');
  }
  /**
   * Detect all installed AI tools by checking config file existence
   *
   * **PERFORMANCE:** Parallelizes checks across all tools using Promise.all
   * **ERROR HANDLING:** Gracefully handles permission errors (treats as not installed)
   *
   * @returns Array of installed tool metadata
   */
  async detectInstalledTools(): Promise<AIToolMetadata[]> {
    const supportedTools = getSupportedToolsForPlatform();

    // Parallel checks for performance (O(1) amortized complexity)
    const results = await Promise.all(
      supportedTools.map(async (tool) => {
        const isInstalled = await this.isToolInstalled(tool);
        return isInstalled ? tool : null;
      })
    );

    // Filter out null values (tools not installed)
    return results.filter((tool): tool is AIToolMetadata => tool !== null);
  }

  /**
   * Check if a specific tool is installed
   *
   * **VALIDATION:** Checks config file existence with read permission (fs.constants.R_OK)
   * **ERROR HANDLING:** Returns false on ENOENT, EACCES, or undefined config path
   *
   * @param tool Tool metadata
   * @returns True if config file exists and is readable
   */
  async isToolInstalled(tool: AIToolMetadata): Promise<boolean> {
    const configPath = this.resolveConfigPath(tool);

    // Tool not supported on current platform
    if (!configPath) {
      return false;
    }

    try {
      // Check if config file exists with read permission
      await fs.access(configPath, fs.constants.R_OK);
      return true;
    } catch {
      // File not found or permission denied
      return false;
    }
  }

  /**
   * Get count of installed tools
   *
   * **USE CASE:** Quick check for wizard flow (skip detection if 0 tools)
   *
   * @returns Number of installed tools
   */
  async getInstalledToolCount(): Promise<number> {
    const installedTools = await this.detectInstalledTools();
    return installedTools.length;
  }
}
