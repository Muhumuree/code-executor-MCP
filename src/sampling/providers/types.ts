/**
 * Type definitions for Multi-Provider Sampling Support
 */

/**
 * Image source format (for future image support)
 *
 * **NOTE:** Image support is not yet implemented in any provider.
 * This type is reserved for future use.
 *
 * Supports both URL-based and base64-encoded images.
 */
export type ImageSource =
    | { type: 'url'; url: string }
    | { type: 'base64'; media_type: string; data: string };

/**
 * LLM message format (normalized across providers)
 */
export interface LLMMessage {
    /** Message role */
    role: 'user' | 'assistant' | 'system';
    /**
     * Message content (can be text or complex objects)
     *
     * **NOTE:** Image content is defined but not yet supported by providers.
     * Only text content is currently functional.
     */
    content: string | Array<{ type: 'text'; text: string } | { type: 'image'; source: ImageSource }>;
}

/**
 * LLM response format (normalized across providers)
 */
export interface LLMResponse {
    /** Response content */
    content: Array<{ type: 'text'; text: string }>;
    /** Reason the response ended */
    stopReason?: string;
    /** Model used for generation */
    model: string;
    /** Token usage information */
    usage?: {
        inputTokens: number;
        outputTokens: number;
    };
}

/**
 * Interface for LLM Providers
 */
export interface LLMProvider {
    /**
     * Generate a response from the LLM
     *
     * @param messages Conversation history
     * @param systemPrompt Optional system prompt
     * @param model Model to use
     * @param maxTokens Maximum tokens to generate
     * @returns Promise resolving to LLMResponse
     */
    generateMessage(
        messages: LLMMessage[],
        systemPrompt: string | undefined,
        model: string,
        maxTokens: number
    ): Promise<LLMResponse>;

    /**
     * Stream a response from the LLM
     *
     * @param messages Conversation history
     * @param systemPrompt Optional system prompt
     * @param model Model to use
     * @param maxTokens Maximum tokens to generate
     * @returns AsyncGenerator yielding chunks of text
     */
    streamMessage(
        messages: LLMMessage[],
        systemPrompt: string | undefined,
        model: string,
        maxTokens: number
    ): AsyncGenerator<{ type: 'chunk'; content: string } | { type: 'usage'; inputTokens: number; outputTokens: number }, void, unknown>;

    /**
     * Validate that the API key is present and valid (format-wise)
     *
     * @returns true if valid, false otherwise
     */
    validateApiKey(): boolean;
}
