/**
 * Zen MCP Wrapper Template
 *
 * ⚠️ COPY THIS FILE TO YOUR PROJECT - DO NOT IMPORT FROM THIS PACKAGE
 *
 * Why? MCP servers update independently. This template shows the current
 * parameter schema, but zen-mcp-server may change at any time.
 *
 * Usage:
 * 1. Copy utils-template.ts to src/lib/mcp/utils.ts
 * 2. Copy this file to src/lib/mcp/zen.ts
 * 3. Install zen-mcp-server in your .mcp.json
 * 4. Adapt parameters to match YOUR installed zen version
 * 5. Maintain it when zen-mcp-server updates
 *
 * Last verified: 2024-11-09 with zen-mcp-server from BeehiveInnovations
 */

import { callMCPToolSafe, parseMCPResult, parseStringResult } from './utils';

/**
 * Available models for zen tools
 */
export type ZenModel =
  | 'gemini-2.5-pro'        // Recommended for deep thinking
  | 'gemini-2.5-flash'      // Faster, less thorough
  | 'o3-pro'                // OpenAI O3
  | 'o3-mini'
  | string;

/**
 * Deep reasoning with step tracking
 *
 * ⚠️ Parameters verified as of 2024-11-09
 * Check zen-mcp-server docs if this breaks after updates
 */
export async function zenThinkDeep(
  question: string,
  options: {
    model?: ZenModel;
    steps?: number;
  } = {}
): Promise<{
  status: 'pause_for_thinkdeep' | 'complete';
  content?: string;
  findings?: string;
  continuation_id?: string;
  thinkdeep_status?: {
    current_confidence: 'low' | 'medium' | 'high';
  };
}> {
  const { model = 'gemini-2.5-pro', steps = 1 } = options;

  const result = await callMCPToolSafe(
    'mcp__zen__thinkdeep',
    {
      step: question,              // Current param name (was 'query' before)
      step_number: 1,
      total_steps: steps,
      next_step_required: steps > 1,
      findings: '',                // Current: string (was array before)
      model                        // Current param name (was 'cli_name' before)
    },
    'zen thinkdeep'
  );

  return parseMCPResult(result);
}

/**
 * Code review with findings tracking
 */
export async function zenCodeReview(
  code: string,
  language: string,
  model: ZenModel = 'gemini-2.5-pro'
): Promise<{
  content: string;
  findings: any[];
}> {
  const result = await callMCPToolSafe(
    'mcp__zen__codereview',
    {
      code,
      language,
      findings: [],
      step: 'security-and-quality-review',
      step_number: 1,
      total_steps: 1,
      next_step_required: false,
      model
    },
    'zen codereview'
  );

  return parseMCPResult(result);
}

/**
 * Direct CLI execution
 */
export async function zenClink(
  prompt: string,
  persona: string = 'assistant',
  model: ZenModel = 'gemini-2.5-pro'
): Promise<string> {
  const result = await callMCPToolSafe(
    'mcp__zen__clink',
    {
      prompt,
      persona,
      model
    },
    'zen clink'
  );

  return parseStringResult(result);
}

/**
 * List available models
 */
export async function zenListModels(): Promise<{
  gemini: string[];
  openai: string[];
}> {
  const result = await callMCPToolSafe(
    'mcp__zen__listmodels',
    {},
    'zen listmodels'
  );

  return parseMCPResult(result);
}

// Add more zen tool wrappers as needed...
