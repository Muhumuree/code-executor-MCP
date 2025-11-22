import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import type { LLMProvider, LLMMessage, LLMResponse } from './types.js';

/**
 * Gemini message part (text content)
 */
interface GeminiMessagePart {
    text: string;
}

/**
 * Gemini chat message with role and parts
 */
interface GeminiMessage {
    role: 'user' | 'model';
    parts: GeminiMessagePart[];
}

export class GeminiProvider implements LLMProvider {
    private client: GoogleGenerativeAI;
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.client = new GoogleGenerativeAI(apiKey);
    }

    validateApiKey(): boolean {
        return !!this.apiKey;
    }

    async generateMessage(
        messages: LLMMessage[],
        systemPrompt: string | undefined,
        model: string,
        maxTokens: number
    ): Promise<LLMResponse> {
        try {
            const genModel = this.client.getGenerativeModel({
                model: model,
                systemInstruction: systemPrompt
            });

            const { history, lastUserMessage } = this.convertMessages(messages);

            const chat = genModel.startChat({
                history,
                generationConfig: {
                    maxOutputTokens: maxTokens,
                },
            });

            const result = await chat.sendMessage(lastUserMessage);
            const response = await result.response;
            const usage = response.usageMetadata;

            return {
                content: [{ type: 'text', text: response.text() }],
                stopReason: response.candidates?.[0]?.finishReason,
                model: model,
                usage: {
                    inputTokens: usage?.promptTokenCount || 0,
                    outputTokens: usage?.candidatesTokenCount || 0,
                },
            };
        } catch (error) {
            console.error('[GeminiProvider] API Error:', error);
            console.error('[GeminiProvider] Model:', model);
            console.error('[GeminiProvider] Error details:', JSON.stringify(error, null, 2));
            throw error;
        }
    }

    async *streamMessage(
        messages: LLMMessage[],
        systemPrompt: string | undefined,
        model: string,
        maxTokens: number
    ): AsyncGenerator<{ type: 'chunk'; content: string } | { type: 'usage'; inputTokens: number; outputTokens: number }, void, unknown> {
        const genModel = this.client.getGenerativeModel({
            model: model,
            systemInstruction: systemPrompt
        });

        const { history, lastUserMessage } = this.convertMessages(messages);

        const chat = genModel.startChat({
            history,
            generationConfig: {
                maxOutputTokens: maxTokens,
            },
        });

        const result = await chat.sendMessageStream(lastUserMessage);

        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
                yield { type: 'chunk', content: chunkText };
            }

            if (chunk.usageMetadata) {
                yield {
                    type: 'usage',
                    inputTokens: chunk.usageMetadata.promptTokenCount,
                    outputTokens: chunk.usageMetadata.candidatesTokenCount
                }
            }
        }
    }

    private convertMessages(messages: LLMMessage[]): { history: GeminiMessage[], lastUserMessage: string | GeminiMessagePart[] } {
        const convertedMessages = messages.map(msg => {
            let parts: GeminiMessagePart[];
            if (typeof msg.content === 'string') {
                parts = [{ text: msg.content }];
            } else {
                parts = msg.content.map(c => {
                    if (c.type === 'text') return { text: c.text };
                    // Ignore non-text content (image not supported)
                    return { text: '' };
                });
            }

            return {
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts
            } as GeminiMessage;
        });

        // Filter out system messages (handled via systemInstruction)
        const chatMessages = convertedMessages.filter(m => m.role === 'user' || m.role === 'model');

        const history: GeminiMessage[] = [];
        let lastUserMessage: string | GeminiMessagePart[] = '';

        const lastMsg = chatMessages[chatMessages.length - 1];
        if (lastMsg && lastMsg.role === 'user') {
            lastUserMessage = lastMsg.parts;
            history.push(...chatMessages.slice(0, -1));
        } else {
            history.push(...chatMessages);
            lastUserMessage = 'Continue';
        }

        return { history, lastUserMessage };
    }
}
