import type { LLMProvider } from './types.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { GeminiProvider } from './gemini.js';
import type { SamplingConfig } from '../../config/types.js';

export class ProviderFactory {
    static createProvider(config: SamplingConfig): LLMProvider | null {
        if (!config.enabled) {
            return null;
        }

        const providerType = config.provider;
        const apiKeys = config.apiKeys || {};

        switch (providerType) {
            case 'anthropic':
                if (!apiKeys.anthropic) return null;
                return new AnthropicProvider(apiKeys.anthropic);

            case 'openai':
                if (!apiKeys.openai) return null;
                return new OpenAIProvider(apiKeys.openai, config.baseUrl);

            case 'grok':
                if (!apiKeys.grok) return null;
                return new OpenAIProvider(apiKeys.grok, config.baseUrl || 'https://api.x.ai/v1');

            case 'perplexity':
                if (!apiKeys.perplexity) return null;
                return new OpenAIProvider(apiKeys.perplexity, config.baseUrl || 'https://api.perplexity.ai');

            case 'gemini':
                if (!apiKeys.gemini) return null;
                return new GeminiProvider(apiKeys.gemini);

            default:
                console.warn(`[Sampling] Unknown provider: ${providerType}`);
                return null;
        }
    }
}
