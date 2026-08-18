import fs from 'fs';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';
import { AntriConfig, ProviderType, DebateDepth, AgentMode } from '../types.js';

// Load .env if present
dotenv.config();

export const DEFAULT_CONFIG: AntriConfig = {
  version: '1.45.0',
  provider: 'deepseek',
  model: 'deepseek-v4-flash-(latest)',
  mode: 'vibe',
  alwaysAllow: false,
  apiKeys: {
    deepseek: process.env.DEEPSEEK_API_KEY || process.env.ANTRI_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    gemini: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    nvidia_nim: process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY,
    cohere: process.env.COHERE_API_KEY,
    cerebras: process.env.CEREBRAS_API_KEY,
    vortex: process.env.VORTEX_API_KEY,
    opencode: process.env.OPENCODE_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    custom: process.env.CUSTOM_API_KEY,
  },
  customBaseUrls: {
    deepseek: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
    openai: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    ollama: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    nvidia_nim: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
    cohere: process.env.COHERE_BASE_URL || 'https://api.cohere.com/v2',
    cerebras: process.env.CEREBRAS_BASE_URL || 'https://api.cerebras.ai/v1',
    vortex: process.env.VORTEX_BASE_URL || 'https://api.vortex.ai/v1',
    opencode: process.env.OPENCODE_BASE_URL || 'https://api.opencode.ai/v1',
    custom: process.env.CUSTOM_BASE_URL || 'http://localhost:8000/v1',
  },
  workingDir: process.cwd(),
  autoExecuteTools: true,
  debateDepth: 'deep',
};

const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.antri');
const GLOBAL_CONFIG_FILE = path.join(GLOBAL_CONFIG_DIR, 'config.json');
const LOCAL_CONFIG_FILE = path.join(process.cwd(), '.antrirc.json');

export class ConfigManager {
  private config: AntriConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): AntriConfig {
    let merged = { ...DEFAULT_CONFIG };

    let hasSavedProvider = false;

    // 1. Try to load global ~/.antri/config.json
    if (fs.existsSync(GLOBAL_CONFIG_FILE)) {
      try {
        const raw = fs.readFileSync(GLOBAL_CONFIG_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.provider) hasSavedProvider = true;
        merged = { ...merged, ...parsed };
      } catch {
        // Ignore read errors
      }
    }

    // 2. Try to load local ./.antrirc.json
    if (fs.existsSync(LOCAL_CONFIG_FILE)) {
      try {
        const raw = fs.readFileSync(LOCAL_CONFIG_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.provider) hasSavedProvider = true;
        merged = { ...merged, ...parsed };
      } catch {
        // Ignore read errors
      }
    }

    // Always enforce the actual package runtime version (never stale from saved config)
    merged.version = DEFAULT_CONFIG.version;

    // Only auto-detect if the user has NOT previously chosen and saved a provider
    if (!hasSavedProvider && !merged.apiKeys.deepseek && !process.env.DEEPSEEK_API_KEY) {
      if (merged.apiKeys.openai || process.env.OPENAI_API_KEY) {
        merged.provider = 'openai';
        merged.model = 'gpt-4o';
      } else if (merged.apiKeys.gemini || process.env.GEMINI_API_KEY) {
        merged.provider = 'gemini';
        merged.model = 'gemini-2.5-flash';
      } else if (merged.apiKeys.anthropic || process.env.ANTHROPIC_API_KEY) {
        merged.provider = 'anthropic';
        merged.model = 'claude-3-7-sonnet-20250219';
      } else if (merged.apiKeys.cerebras || process.env.CEREBRAS_API_KEY) {
        merged.provider = 'cerebras';
        merged.model = 'gpt-oss-120b';
      } else if (merged.apiKeys.cohere || process.env.COHERE_API_KEY) {
        merged.provider = 'cohere';
        merged.model = 'command-r-plus-08-2024';
      } else if (merged.apiKeys.vortex || process.env.VORTEX_API_KEY) {
        merged.provider = 'vortex';
        merged.model = 'vortex-llama-3.3-70b-instruct';
      } else if (merged.apiKeys.opencode || process.env.OPENCODE_API_KEY) {
        merged.provider = 'opencode';
        merged.model = 'opencode/deepseek-coder-v2.5';
      } else if (merged.apiKeys.nvidia_nim || process.env.NVIDIA_API_KEY) {
        merged.provider = 'nvidia-nim';
        merged.model = 'meta/llama-3.1-8b-instruct';
      } else if (merged.apiKeys.openrouter || process.env.OPENROUTER_API_KEY) {
        merged.provider = 'openrouter';
        merged.model = 'anthropic/claude-3.5-sonnet';
      } else {
        merged.provider = 'mock';
      }
    }

    return merged;
  }

  public get(): AntriConfig {
    return this.config;
  }

  public set<K extends keyof AntriConfig>(key: K, value: AntriConfig[K]): void {
    this.config[key] = value;
    this.saveGlobalConfig();
  }

  public setMode(mode: AgentMode): void {
    this.config.mode = mode;
    this.saveGlobalConfig();
  }

  public setAlwaysAllow(allow: boolean): void {
    this.config.alwaysAllow = allow;
    this.saveGlobalConfig();
  }

  public setApiKey(provider: string, key: string): void {
    const formattedProvider = provider.replace(/-/g, '_');
    (this.config.apiKeys as any)[formattedProvider] = key;
    this.saveGlobalConfig();
  }

  public setBaseUrl(provider: string, url: string): void {
    const formattedProvider = provider.replace(/-/g, '_');
    if (!this.config.customBaseUrls) {
      this.config.customBaseUrls = {};
    }
    (this.config.customBaseUrls as any)[formattedProvider] = url;
    this.saveGlobalConfig();
  }

  public setProvider(provider: ProviderType, defaultModel?: string): void {
    this.config.provider = provider;
    if (defaultModel) {
      this.config.model = defaultModel;
    } else {
      switch (provider) {
        case 'cerebras':
          this.config.model = 'gpt-oss-120b';
          break;
        case 'cohere':
          this.config.model = 'command-r-plus-08-2024';
          break;
        case 'vortex':
          this.config.model = 'vortex-llama-3.3-70b-instruct';
          break;
        case 'opencode':
          this.config.model = 'opencode/deepseek-coder-v2.5';
          break;
        case 'ollama':
          this.config.model = 'llama3.3:70b';
          break;
        case 'anthropic':
          this.config.model = 'claude-3-7-sonnet-20250219';
          break;
        case 'nvidia-nim':
          this.config.model = 'meta/llama-3.1-8b-instruct';
          break;
        case 'openai':
          this.config.model = 'gpt-4o';
          break;
        case 'gemini':
          this.config.model = 'gemini-2.5-flash';
          break;
        case 'deepseek':
          this.config.model = 'deepseek-v4-flash-(latest)';
          break;
        case 'custom':
          this.config.model = 'custom-model';
          break;
        case 'openrouter':
          this.config.model = 'deepseek/deepseek-r1';
          break;
        case 'mock':
          this.config.model = 'deepseek-v4-flash-(latest)';
          break;
      }
    }
    this.saveGlobalConfig();
  }

  public saveGlobalConfig(): void {
    try {
      if (!fs.existsSync(GLOBAL_CONFIG_DIR)) {
        fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
      }
      fs.writeFileSync(GLOBAL_CONFIG_FILE, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch {
      // Ignore save failures in restricted environments
    }
  }
}

export const configManager = new ConfigManager();
