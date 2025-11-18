/**
 * ModuleFormatDetector - Detects ES Module vs CommonJS format from package.json
 *
 * **RESPONSIBILITY (SRP):** Single responsibility to detect module system format
 * **WHY:** Wrapper generation needs to know import syntax (import vs require)
 *
 * **DETECTION LOGIC:**
 * 1. Read package.json "type" field:
 *    - "module" → ESM (ES Modules)
 *    - "commonjs" → CommonJS
 *    - missing/null/undefined → CommonJS (Node.js default)
 * 2. Missing package.json → CommonJS (Node.js default)
 *
 * **USAGE:**
 * - Wrapper generation: Determine import/export syntax for generated code
 * - Validation: Check if project supports ESM features
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Module format types supported by Node.js
 */
export type ModuleFormat = 'esm' | 'commonjs';

/**
 * Module format detection result
 */
export interface ModuleFormatResult {
  /**
   * Detected module format
   */
  format: ModuleFormat;

  /**
   * Source of the detection
   * - "package.json": Explicit "type" field
   * - "package.json (default)": No "type" field (default to CommonJS)
   * - "no package.json (default)": Missing package.json (default to CommonJS)
   */
  source: string;
}

/**
 * package.json structure (minimal subset for module detection)
 */
interface PackageJson {
  type?: string | null;
  name?: string;
  version?: string;
  [key: string]: unknown;
}

/**
 * ModuleFormatDetector - Service for detecting ES Module vs CommonJS format
 *
 * **PRINCIPLES:**
 * - SRP: Single responsibility - module format detection only
 * - Type Safety: TypeScript strict mode + runtime validation
 * - Fail-Fast: Clear errors for invalid package.json
 *
 * **SECURITY:**
 * - Path normalization: Remove trailing slashes
 * - JSON validation: Reject malformed JSON, invalid "type" values
 * - Error handling: Distinguish ENOENT (missing file) from other errors
 */
export class ModuleFormatDetector {
  /**
   * Detect module format from package.json in the given directory
   *
   * **ALGORITHM:**
   * 1. Read package.json from directory
   * 2. Parse JSON (throw on malformed JSON)
   * 3. Validate "type" field (throw on invalid value)
   * 4. Return format + source
   *
   * **EDGE CASES:**
   * - Missing package.json → Default to CommonJS
   * - Missing "type" field → Default to CommonJS
   * - Null/undefined "type" → Default to CommonJS
   * - Invalid JSON → Throw descriptive error
   * - Invalid "type" value → Throw descriptive error
   *
   * @param projectPath - Absolute path to project directory
   * @returns Module format result with source
   * @throws Error if package.json contains invalid JSON or invalid "type" value
   *
   * @example
   * ```typescript
   * const detector = new ModuleFormatDetector();
   * const result = await detector.detectModuleFormat('/path/to/project');
   * // result: { format: 'esm', source: 'package.json' }
   * ```
   */
  async detectModuleFormat(projectPath: string): Promise<ModuleFormatResult> {
    // Normalize path (remove trailing slash)
    const normalizedPath = projectPath.replace(/\/$/, '');
    const packageJsonPath = path.join(normalizedPath, 'package.json');

    try {
      // Read package.json
      const content = await fs.readFile(packageJsonPath, 'utf8');

      // Parse JSON (throws on malformed JSON)
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (error) {
        throw new Error(
          `Invalid JSON in package.json at ${packageJsonPath}: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      // Validate parsed content is an object
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error(`package.json must be an object, got ${typeof parsed} at ${packageJsonPath}`);
      }

      const packageJson = parsed as PackageJson;

      // Extract "type" field (default to undefined if missing)
      const typeField = packageJson.type;

      // Handle missing/null/undefined "type" field (default to CommonJS)
      if (typeField === undefined || typeField === null) {
        return {
          format: 'commonjs',
          source: 'package.json (default)'
        };
      }

      // Validate "type" field value
      if (typeField !== 'module' && typeField !== 'commonjs') {
        throw new Error(
          `Invalid "type" field in package.json at ${packageJsonPath}: "${typeField}" (expected "module" or "commonjs")`
        );
      }

      // Return format based on "type" field
      return {
        format: typeField === 'module' ? 'esm' : 'commonjs',
        source: 'package.json'
      };

    } catch (error) {
      // Handle missing package.json (ENOENT) → Default to CommonJS
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          format: 'commonjs',
          source: 'no package.json (default)'
        };
      }

      // Re-throw all other errors (invalid JSON, invalid "type", permission errors)
      throw error;
    }
  }

  /**
   * Check if project uses ES Modules (convenience method)
   *
   * **USAGE:** Quick check without caring about source/details
   *
   * @param projectPath - Absolute path to project directory
   * @returns true if ESM, false if CommonJS
   *
   * @example
   * ```typescript
   * const detector = new ModuleFormatDetector();
   * const isESM = await detector.isESM('/path/to/project');
   * if (isESM) {
   *   // Use import/export syntax
   * } else {
   *   // Use require/module.exports syntax
   * }
   * ```
   */
  async isESM(projectPath: string): Promise<boolean> {
    const result = await this.detectModuleFormat(projectPath);
    return result.format === 'esm';
  }

  /**
   * Get recommended import syntax for the project's module format
   *
   * **USAGE:** Documentation, error messages, wrapper generation hints
   *
   * @param projectPath - Absolute path to project directory
   * @returns Import syntax example string
   *
   * @example
   * ```typescript
   * const detector = new ModuleFormatDetector();
   * const syntax = await detector.getImportSyntax('/path/to/project');
   * // ESM: "import { tool } from 'package';\nexport { wrapper };"
   * // CommonJS: "const { tool } = require('package');\nmodule.exports = { wrapper };"
   * ```
   */
  async getImportSyntax(projectPath: string): Promise<string> {
    const result = await this.detectModuleFormat(projectPath);

    if (result.format === 'esm') {
      return `import { tool } from 'package';\nexport { wrapper };`;
    } else {
      return `const { tool } = require('package');\nmodule.exports = { wrapper };`;
    }
  }
}
