/**
 * CLIWizard - Interactive CLI wizard for code-executor-mcp setup
 *
 * **RESPONSIBILITY (SRP):** Orchestrate interactive CLI prompts for setup wizard
 * **WHY:** Centralized wizard logic separates UI concerns from business logic
 */

import prompts from 'prompts';
import type { ToolDetector } from './tool-detector.js';
import type { AIToolMetadata } from './tool-registry.js';

/**
 * CLIWizard - Main orchestrator for setup wizard
 *
 * **DESIGN:** Composition over inheritance (uses ToolDetector via DI)
 */
export class CLIWizard {
  constructor(
    private readonly toolDetector: ToolDetector
  ) {}

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
}
