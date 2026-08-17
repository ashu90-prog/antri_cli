import { LLMProvider } from './base.js';
import { OpenAICompatibleProvider } from './openai.js';
import { GeminiProvider } from './gemini.js';
import { AnthropicProvider } from './anthropic.js';
import { MockProvider } from './mock.js';
import { AntriConfig, ProviderType } from '../types.js';

export function createProvider(config: AntriConfig): LLMProvider {
  const providerType: ProviderType = config.provider;

  switch (providerType) {
    case 'cerebras':
      return new OpenAICompatibleProvider({
        name: 'cerebras',
        apiKey: config.apiKeys.cerebras || process.env.CEREBRAS_API_KEY,
        baseUrl: config.customBaseUrls?.cerebras || 'https://api.cerebras.ai/v1',
        model: config.model || 'llama-3.3-70b',
      });

    case 'cohere':
      return new OpenAICompatibleProvider({
        name: 'cohere',
        apiKey: config.apiKeys.cohere || process.env.COHERE_API_KEY,
        baseUrl: config.customBaseUrls?.cohere || 'https://api.cohere.com/v2',
        model: config.model || 'command-r-plus-08-2024',
      });

    case 'vortex':
      return new OpenAICompatibleProvider({
        name: 'vortex',
        apiKey: config.apiKeys.vortex || process.env.VORTEX_API_KEY,
        baseUrl: config.customBaseUrls?.vortex || 'https://api.vortex.ai/v1',
        model: config.model || 'vortex-llama-3.3-70b-instruct',
      });

    case 'opencode':
      return new OpenAICompatibleProvider({
        name: 'opencode',
        apiKey: config.apiKeys.opencode || process.env.OPENCODE_API_KEY,
        baseUrl: config.customBaseUrls?.opencode || 'https://api.opencode.ai/v1',
        model: config.model || 'opencode/deepseek-coder-v2.5',
      });

    case 'ollama':
      return new OpenAICompatibleProvider({
        name: 'ollama',
        apiKey: 'ollama',
        baseUrl: (config.customBaseUrls?.ollama || 'http://localhost:11434') + '/v1',
        model: config.model || 'llama3.3:70b',
      });

    case 'anthropic':
      return new AnthropicProvider({
        apiKey: config.apiKeys.anthropic || process.env.ANTHROPIC_API_KEY,
        model: config.model || 'claude-3-7-sonnet-20250219',
      });

    case 'nvidia-nim':
      return new OpenAICompatibleProvider({
        name: 'nvidia-nim',
        apiKey: config.apiKeys.nvidia_nim || process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY,
        baseUrl: config.customBaseUrls?.nvidia_nim || 'https://integrate.api.nvidia.com/v1',
        model: config.model || 'meta/llama-3.1-8b-instruct',
      });

    case 'openai':
      return new OpenAICompatibleProvider({
        name: 'openai',
        apiKey: config.apiKeys.openai || process.env.OPENAI_API_KEY,
        baseUrl: config.customBaseUrls?.openai || 'https://api.openai.com/v1',
        model: config.model || 'gpt-4o',
      });

    case 'gemini':
      return new GeminiProvider({
        apiKey: config.apiKeys.gemini || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
        model: config.model || 'gemini-2.5-flash',
      });

    case 'deepseek':
      return new OpenAICompatibleProvider({
        name: 'deepseek',
        apiKey: config.apiKeys.deepseek || process.env.DEEPSEEK_API_KEY,
        baseUrl: config.customBaseUrls?.deepseek || 'https://api.deepseek.com/v1',
        model: config.model || 'deepseek-v4-flash-(latest)',
      });

    case 'custom':
      return new OpenAICompatibleProvider({
        name: 'custom',
        apiKey: config.apiKeys.custom || 'custom-key',
        baseUrl: config.customBaseUrls?.custom || 'http://localhost:8000/v1',
        model: config.model || 'custom-model',
      });

    case 'openrouter':
      return new OpenAICompatibleProvider({
        name: 'openrouter',
        apiKey: config.apiKeys.openrouter || process.env.OPENROUTER_API_KEY,
        baseUrl: 'https://openrouter.ai/api/v1',
        model: config.model || 'deepseek/deepseek-r1',
      });

    case 'mock':
    default:
      return new MockProvider();
  }
}
