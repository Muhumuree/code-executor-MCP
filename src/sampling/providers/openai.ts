import OpenAI from 'openai';
import type { LLMProvider, LLMMessage, LLMResponse } from './types.js';

export class OpenAIProvider implements LLMProvider {
    private client: OpenAI;

    constructor(apiKey: string, baseURL?: string) {
        this.client = new OpenAI({
            apiKey,
            baseURL,
        });
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
        const openAIMessages = this.convertMessages(messages, systemPrompt);

        const response = await this.client.chat.completions.create({
            model,
            messages: openAIMessages,
            max_tokens: maxTokens,
        });

        const choice = response.choices[0];
        if (!choice) {
            throw new Error('No choices returned from OpenAI');
        }

        return {
            content: [{ type: 'text', text: choice.message.content || '' }],
            stopReason: choice.finish_reason,
            model: response.model,
            usage: {
                inputTokens: response.usage?.prompt_tokens || 0,
                outputTokens: response.usage?.completion_tokens || 0,
            },
        };
    }

    async *streamMessage(
        messages: LLMMessage[],
        systemPrompt: string | undefined,
        model: string,
        maxTokens: number
    ): AsyncGenerator<{ type: 'chunk'; content: string } | { type: 'usage'; inputTokens: number; outputTokens: number }, void, unknown> {
        const openAIMessages = this.convertMessages(messages, systemPrompt);

        const stream = await this.client.chat.completions.create({
            model,
            messages: openAIMessages,
            max_tokens: maxTokens,
            stream: true,
            stream_options: { include_usage: true },
        });

        for await (const chunk of stream) {
            if (chunk.choices && chunk.choices.length > 0) {
                const choice = chunk.choices[0];
                if (choice) {
                    const delta = choice.delta;
                    if (delta.content) {
                        yield { type: 'chunk', content: delta.content };
                    }
                }
            }

            if (chunk.usage) {
                yield {
                    type: 'usage',
                    inputTokens: chunk.usage.prompt_tokens,
                    outputTokens: chunk.usage.completion_tokens,
                };
            }
        }
    }

    private convertMessages(messages: LLMMessage[], systemPrompt?: string): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
        const openAIMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

        if (systemPrompt) {
            openAIMessages.push({ role: 'system', content: systemPrompt });
        }

        for (const msg of messages) {
            // OpenAI accepts string or array of text content parts
            let content: string | OpenAI.Chat.Completions.ChatCompletionContentPartText[];

            if (typeof msg.content === 'string') {
                content = msg.content;
            } else {
                // Filter text-only content and map to OpenAI text format
                content = msg.content
                    .filter(c => c.type === 'text')
                    .map(c => ({
                        type: 'text' as const,
                        text: (c as { text: string }).text
                    })) as OpenAI.Chat.Completions.ChatCompletionContentPartText[];
            }

            if (msg.role === 'system') {
                // System messages must be strings in OpenAI
                const systemContent = typeof content === 'string'
                    ? content
                    : content.map(p => p.text).join('\n');
                openAIMessages.push({ role: 'system', content: systemContent });
            } else if (msg.role === 'user') {
                openAIMessages.push({ role: 'user', content });
            } else if (msg.role === 'assistant') {
                // Assistant messages accept string or text parts (not image/refusal parts)
                openAIMessages.push({
                    role: 'assistant',
                    content: typeof content === 'string' ? content : content as OpenAI.Chat.Completions.ChatCompletionContentPartText[]
                });
            }
        }

        return openAIMessages;
    }
}
