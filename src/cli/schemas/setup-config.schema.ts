/**
 * SetupConfig AJV Schema - JSON Schema for configuration validation
 *
 * **RESPONSIBILITY (SRP):** Define validation rules for SetupConfig interface
 * **WHY:** AJV schema provides runtime validation (TypeScript only validates at compile-time)
 * **SECURITY:** Prevents invalid configurations that could cause runtime errors or security issues
 */

import type { JSONSchemaType } from 'ajv';
import type { SetupConfig } from '../types.js';

/**
 * JSON Schema for SetupConfig validation
 *
 * **VALIDATION RULES:**
 * - proxyPort: 1024-65535 (unprivileged ports)
 * - executionTimeout: 1000-600000ms (1s to 10min)
 * - rateLimit: 1-1000 requests/minute
 * - auditLogPath: Non-empty string (absolute path validation done separately)
 * - schemaCacheTTL: 1-168 hours (1 hour to 1 week)
 *
 * **WHY THESE RANGES:**
 * - proxyPort: Avoid privileged ports (<1024), prevent conflicts with ephemeral ports (>65535)
 * - executionTimeout: Minimum 1s prevents premature timeouts, max 10min prevents infinite hangs
 * - rateLimit: Minimum 1 req/min prevents DoS, max 1000 req/min prevents resource exhaustion
 * - schemaCacheTTL: Minimum 1h reduces network overhead, max 1 week balances freshness/performance
 */
export const setupConfigSchema: JSONSchemaType<SetupConfig> = {
  type: 'object',
  properties: {
    proxyPort: {
      type: 'integer',
      minimum: 1024,
      maximum: 65535,
      description: 'Proxy server port for MCP tool calls (unprivileged ports only)',
    },
    executionTimeout: {
      type: 'integer',
      minimum: 1000,
      maximum: 600000,
      description: 'Execution timeout for MCP tool calls in milliseconds (1s to 10min)',
    },
    rateLimit: {
      type: 'integer',
      minimum: 1,
      maximum: 1000,
      description: 'Rate limit for MCP proxy requests (requests per minute)',
    },
    auditLogPath: {
      type: 'string',
      minLength: 1,
      description: 'Audit log file path (absolute path)',
    },
    schemaCacheTTL: {
      type: 'integer',
      minimum: 1,
      maximum: 168,
      description: 'Schema cache TTL in hours (1 hour to 1 week)',
    },
  },
  required: ['proxyPort', 'executionTimeout', 'rateLimit', 'auditLogPath', 'schemaCacheTTL'],
  additionalProperties: false,
};
