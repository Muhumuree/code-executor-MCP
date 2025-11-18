/**
 * CLIWizard - Interactive CLI wizard for code-executor-mcp setup
 *
 * **RESPONSIBILITY (SRP):** Orchestrate interactive CLI prompts for setup wizard
 * **WHY:** Centralized wizard logic separates UI concerns from business logic
 */

import prompts from 'prompts';
import Ajv from 'ajv';
import type { ToolDetector } from './tool-detector.js';
import type { AIToolMetadata } from './tool-registry.js';
import type { SetupConfig } from './types.js';
import { setupConfigSchema } from './schemas/setup-config.schema.js';

/**
 * CLIWizard - Main orchestrator for setup wizard
 *
 * **DESIGN:** Composition over inheritance (uses ToolDetector via DI)
 */
export class CLIWizard {
  private readonly ajv: Ajv;

  constructor(
    private readonly toolDetector: ToolDetector
  ) {
    this.ajv = new Ajv();
  }

  /**
   * Validate prompt response and throw on cancellation
   *
   * **WHY:** DRY - Extract repeated cancellation check (used 5 times)
   * **RETURNS:** Validated response value or throws
   *
   * @throws Error if user cancelled (null response or undefined field)
   */
  private validateResponse<T extends Record<string, unknown>>(
    response: T | null,
    fieldName: keyof T
  ): T[keyof T] {
    if (!response || response[fieldName] === undefined) {
      throw new Error('Configuration cancelled by user');
    }
    return response[fieldName];
  }

  /**
   * Prompt user to select AI development tools
   *
   * **VALIDATION:** Minimum 1 tool must be selected
   * **RETURNS:** Array of selected tool metadata (preserves selection order)
   *
   * @throws Error if no tools installed
   * @returns Selected tools in user's selection order
   */
  async selectTools(): Promise<AIToolMetadata[]> {
    // Detect installed tools
    const installedTools = await this.toolDetector.detectInstalledTools();

    if (installedTools.length === 0) {
      throw new Error(
        'No AI tools detected. Please install at least one supported tool:\n' +
        '- Claude Code (https://code.claude.com)\n' +
        '- Cursor (https://cursor.sh)\n' +
        '- Windsurf (https://windsurf.ai)'
      );
    }

    // Create prompt choices from installed tools
    const choices = installedTools.map(tool => ({
      title: tool.name,
      value: tool.id,
      description: `${tool.description} (${tool.website})`,
    }));

    // Multi-select prompt with validation
    const response = await prompts({
      type: 'multiselect',
      name: 'selectedTools',
      message: 'Select AI development tools to configure',
      choices,
      hint: '- Space to select. Return to submit',
      validate: (selected: string[]) => {
        if (selected.length === 0) {
          return 'You must select at least one tool';
        }
        return true;
      },
    });

    // Handle cancelled prompts (user pressed Ctrl+C/ESC or null response)
    if (!response?.selectedTools || response.selectedTools.length === 0) {
      return [];
    }

    // Map selected IDs back to full metadata, preserving selection order
    // TypeScript narrows type automatically after guard (no assertion needed)
    const selectedToolIds: string[] = response.selectedTools;

    return selectedToolIds.map((id: string) => {
      const tool = installedTools.find(t => t.id === id);
      if (!tool) {
        throw new Error(
          `Selected tool '${id}' is no longer available. ` +
          `It may have been uninstalled after detection. ` +
          `Please re-run the wizard.`
        );
      }
      return tool;
    });
  }

  /**
   * Prompt user for configuration settings
   *
   * **VALIDATION:** Each prompt validates input range per setupConfigSchema
   * **RETRY:** Prompts library automatically retries on validation failure
   * **DEFAULTS:** Shows recommended defaults for quick setup
   * **SECURITY:** Final AJV validation before returning (prevent divergence)
   *
   * @throws Error if user cancels (Ctrl+C/ESC) or validation fails
   * @returns SetupConfig object with validated configuration
   */
  async askConfigQuestions(): Promise<SetupConfig> {
    // Proxy Port
    const proxyPort = this.validateResponse(
      await prompts({
        type: 'number',
        name: 'proxyPort',
        message: 'Proxy server port',
        initial: 3000,
        validate: (value: number) => {
          if (value < 1024 || value > 65535) {
            return 'Port must be between 1024 and 65535 (unprivileged ports)';
          }
          return true;
        },
      }),
      'proxyPort'
    ) as number;

    // Execution Timeout
    const executionTimeout = this.validateResponse(
      await prompts({
        type: 'number',
        name: 'executionTimeout',
        message: 'Execution timeout (milliseconds)',
        initial: 120000,
        validate: (value: number) => {
          if (value < 1000 || value > 600000) {
            return 'Timeout must be between 1000ms (1s) and 600000ms (10min)';
          }
          return true;
        },
      }),
      'executionTimeout'
    ) as number;

    // Rate Limit
    const rateLimit = this.validateResponse(
      await prompts({
        type: 'number',
        name: 'rateLimit',
        message: 'Rate limit (requests per minute)',
        initial: 30,
        validate: (value: number) => {
          if (value < 1 || value > 1000) {
            return 'Rate limit must be between 1 and 1000 requests/minute';
          }
          return true;
        },
      }),
      'rateLimit'
    ) as number;

    // Audit Log Path
    const auditLogPath = this.validateResponse(
      await prompts({
        type: 'text',
        name: 'auditLogPath',
        message: 'Audit log file path',
        initial: '~/.code-executor/audit-logs/audit.jsonl',
        validate: (value: string) => {
          if (!value || value.trim().length === 0) {
            return 'Audit log path cannot be empty';
          }
          return true;
        },
      }),
      'auditLogPath'
    ) as string;

    // Schema Cache TTL
    const schemaCacheTTL = this.validateResponse(
      await prompts({
        type: 'number',
        name: 'schemaCacheTTL',
        message: 'Schema cache TTL (hours)',
        initial: 24,
        validate: (value: number) => {
          if (value < 1 || value > 168) {
            return 'Schema cache TTL must be between 1 hour and 168 hours (1 week)';
          }
          return true;
        },
      }),
      'schemaCacheTTL'
    ) as number;

    // Build config object
    const config: SetupConfig = {
      proxyPort,
      executionTimeout,
      rateLimit,
      auditLogPath,
      schemaCacheTTL,
    };

    // Runtime AJV validation (security: prevent prompt/schema divergence)
    const validate = this.ajv.compile(setupConfigSchema);
    if (!validate(config)) {
      const errors = this.ajv.errorsText(validate.errors);
      throw new Error(`Configuration validation failed: ${errors}`);
    }

    return config;
  }
}
