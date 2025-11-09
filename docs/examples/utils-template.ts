/**
 * MCP Utilities Template
 *
 * ⚠️ COPY THIS FILE TO YOUR PROJECT - DO NOT IMPORT FROM THIS PACKAGE
 *
 * This file provides shared utilities for all your MCP wrappers:
 * - Type-safe globalThis interface
 * - Error handling wrapper
 * - JSON parsing utilities
 * - Result normalization
 *
 * Usage:
 * 1. Copy to src/lib/mcp/utils.ts
 * 2. Import in your wrapper files
 * 3. Use callMCPToolSafe() for all MCP calls
 */

/**
 * Type-safe interface for MCP globalThis
 */
export interface MCPGlobalThis extends globalThis {
  callMCPTool: (toolName: string, params: unknown) => Promise<unknown>;
}

/**
 * Type guard: Check if callMCPTool is available
 */
export function isMCPGlobalThis(obj: unknown): obj is MCPGlobalThis {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'callMCPTool' in obj &&
    typeof (obj as MCPGlobalThis).callMCPTool === 'function'
  );
}

/**
 * Get type-safe MCP caller
 */
export function getMCPCaller(): MCPGlobalThis['callMCPTool'] {
  if (!isMCPGlobalThis(globalThis)) {
    throw new Error('callMCPTool not available in globalThis');
  }
  return globalThis.callMCPTool;
}

/**
 * Parse MCP result to typed object
 */
export function parseMCPResult<T>(result: unknown): T {
  if (typeof result === 'string') {
    try {
      return JSON.parse(result) as T;
    } catch (error) {
      throw new Error(
        `Failed to parse MCP result: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  return result as T;
}

/**
 * Parse result to string
 */
export function parseStringResult(result: unknown): string {
  if (typeof result === 'string') {
    return result;
  }
  if (typeof result === 'object' && result !== null) {
    return JSON.stringify(result);
  }
  return String(result);
}

/**
 * Parse result to array
 */
export function parseArrayResult<T>(result: unknown): T[] {
  if (typeof result === 'string') {
    try {
      const parsed = JSON.parse(result);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [result as T];
    }
  }
  if (Array.isArray(result)) {
    return result;
  }
  return [result as T];
}

/**
 * Call MCP tool with error handling and context
 *
 * @param toolName - Full MCP tool name (e.g., 'mcp__zen__thinkdeep')
 * @param params - Tool parameters
 * @param context - Human-readable context for error messages
 * @returns Tool result
 *
 * @example
 * const result = await callMCPToolSafe(
 *   'mcp__zen__thinkdeep',
 *   { step: 'What is 2+2?', model: 'gemini-2.5-pro' },
 *   'zen thinkdeep'
 * );
 */
export async function callMCPToolSafe(
  toolName: string,
  params: unknown,
  context: string
): Promise<unknown> {
  try {
    const callMCPTool = getMCPCaller();
    return await callMCPTool(toolName, params);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to call ${context}: ${message}`);
  }
}

/**
 * Normalize error to Error instance
 */
export function normalizeError(error: unknown, context: string): Error {
  if (error instanceof Error) {
    return new Error(`${context}: ${error.message}`);
  }
  return new Error(`${context}: ${String(error)}`);
}
