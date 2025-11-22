import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, LLMMessage, LLMResponse } from './types.js';

export class AnthropicProvider implements LLMProvider {
    private client: Anthropic;

    constructor(apiKey: string) {
        this.client = new Anthropic({ apiKey });
    }

    validateApiKey(): boolean {
        return !!this.client.apiKey;
    }

    async generateMessage(
        messages: LLMMessage[],
        systemPrompt: string | undefined,
        model: string,
        maxTokens: number
    ): Promise<LLMResponse> {
        const anthropicMessages = this.convertMessages(messages);

        const response = await this.client.messages.create({
            model,
            max_tokens: maxTokens,
            messages: anthropicMessages,
            system: systemPrompt,
        });

        return {
            content: response.content.map(block => {
                if (block.type === 'text') {
                    return { type: 'text', text: block.text };
                }
                return { type: 'text', text: JSON.stringify(block) }; // Fallback for non-text blocks
            }),
            stopReason: response.stop_reason || undefined,
            model: response.model,
            usage: {
                inputTokens: response.usage.input_tokens,
                outputTokens: response.usage.output_tokens,
            },
        };
    }

    async *streamMessage(
        messages: LLMMessage[],
        systemPrompt: string | undefined,
        model: string,
        maxTokens: number
    ): AsyncGenerator<{ type: 'chunk'; content: string } | { type: 'usage'; inputTokens: number; outputTokens: number }, void, unknown> {
        const anthropicMessages = this.convertMessages(messages);

        const stream = this.client.messages.stream({
            model,
            max_tokens: maxTokens,
            messages: anthropicMessages,
            system: systemPrompt,
        });

        for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                yield { type: 'chunk', content: event.delta.text };
            } else if (event.type === 'message_delta' && event.usage) {
                yield {
                    type: 'usage',
                    inputTokens: 0, // Anthropic stream doesn't send input tokens in message_delta? Need to check.
                    // Actually, message_start has input tokens, message_delta has output tokens.
                    // The stream helper might abstract this.
                    // Let's look at the raw events or the stream helper.
                    // The stream helper emits events.
                    outputTokens: event.usage.output_tokens,
                };
            } else if (event.type === 'message_start' && event.message.usage) {
                yield {
                    type: 'usage',
                    inputTokens: event.message.usage.input_tokens,
                    outputTokens: 0
                }
            }
        }
    }

    private convertMessages(messages: LLMMessage[]): Anthropic.MessageParam[] {
        return messages.map(msg => {
            // Anthropic expects content to be string or array of blocks
            let content: string | Anthropic.ContentBlockParam[];

            if (typeof msg.content === 'string') {
                content = msg.content;
            } else {
                content = msg.content.map(c => {
                    if (c.type === 'text') {
                        return { type: 'text', text: c.text };
                    }
                    // Image support not implemented yet
                    // Throw error for unsupported content types instead of unsafe casting
                    throw new Error(`Unsupported content type '${c.type}' for Anthropic provider. Only 'text' is supported.`);
                });
            }

            return {
                role: msg.role === 'system' ? 'user' : msg.role, // Anthropic uses top-level system param, not role
                content,
            };
        });
    }
}
