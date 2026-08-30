import fs from 'fs';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';
import { AntriConfig, ProviderType, DebateDepth, AgentMode } from '../types.js';
import { Updater } from './updater.js';

// Load .env if present
dotenv.config();

export const DEFAULT_CONFIG: AntriConfig = {
  version: Updater.CURRENT_VERSION,
  provider: 'gemini',
  model: 'gemini-3.5-flash',
  mode: 'vibe',
  alwaysAllow: false,
  apiKeys: {
    gemini: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY || process.env.ANTRI_API_KEY,
    openai: process.env.OPENAI_API_KEY,
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

function getCurrentUserId(): string {
  try {
    const authPath = path.join(os.homedir(), '.antri', 'auth.json');
    if (fs.existsSync(authPath)) {
      const raw = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
      const user = raw.user || raw;
      if (user && user.email && typeof user.email === 'string') {
        const clean = user.email.toLowerCase().trim();
        return user.userId || clean.replace(/[^a-z0-9_]/g, '_');
      }
    }
  } catch (_) {}
  return 'default_user';
}

function getPartitionConfigFile(userId?: string): string {
  const uid = userId || getCurrentUserId();
  const dir = path.join(os.homedir(), '.antri', 'partitions', uid);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, 'config.json');
}

const LOCAL_CONFIG_FILE = path.join(process.cwd(), '.antrirc.json');

export class ConfigManager {
  private config: AntriConfig;
  private currentUserId: string = 'default_user';

  constructor() {
    this.currentUserId = getCurrentUserId();
    this.config = this.loadConfig();
  }

  public reloadForUser(userId?: string): AntriConfig {
    this.currentUserId = userId || getCurrentUserId();
    this.config = this.loadConfig(this.currentUserId);
    return this.config;
  }

  public getCurrentUserId(): string {
    return this.currentUserId;
  }

  private loadConfig(targetUserId?: string): AntriConfig {
    const uid = targetUserId || this.currentUserId;
    const isGuest = uid === 'default_user';

    let merged: AntriConfig = {
      ...DEFAULT_CONFIG,
      apiKeys: isGuest ? { ...DEFAULT_CONFIG.apiKeys } : {},
      customBaseUrls: { ...DEFAULT_CONFIG.customBaseUrls },
    };

    let hasSavedProvider = false;
    const partitionFile = getPartitionConfigFile(uid);

    // 1. Try to load user partition config (~/.antri/partitions/<userId>/config.json)
    if (fs.existsSync(partitionFile)) {
      try {
        const raw = fs.readFileSync(partitionFile, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.provider) hasSavedProvider = true;
        merged = { ...merged, ...parsed, apiKeys: { ...merged.apiKeys, ...(parsed.apiKeys || {}) } };
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
        merged = { ...merged, ...parsed, apiKeys: { ...merged.apiKeys, ...(parsed.apiKeys || {}) } };
      } catch {
        // Ignore read errors
      }
    }

    // Always enforce the actual package runtime version (never stale from saved config)
    merged.version = DEFAULT_CONFIG.version;

    // Only auto-detect if in guest mode or if explicit keys are configured
    if (isGuest && !hasSavedProvider && !merged.apiKeys.gemini && !process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY && !process.env.GOOGLE_GENAI_API_KEY) {
      if (merged.apiKeys.openai || process.env.OPENAI_API_KEY) {
        merged.provider = 'openai';
        merged.model = 'gpt-4o';
      } else if (merged.apiKeys.deepseek || process.env.DEEPSEEK_API_KEY) {
        merged.provider = 'deepseek';
        merged.model = 'deepseek-v4-flash-(latest)';
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
        merged.model = 'meta/llama-3.2-11b-vision-instruct';
      } else if (merged.apiKeys.openrouter || process.env.OPENROUTER_API_KEY) {
        merged.provider = 'openrouter';
        merged.model = 'anthropic/claude-3.5-sonnet';
      } else {
        merged.provider = 'mock';
      }
    }

    // Auto-migrate any EOL model to active verified model
    if (merged.model === 'meta/llama-3.1-8b-instruct') {
      merged.model = 'meta/llama-3.2-11b-vision-instruct';
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

  public getApiKey(provider: string): string | undefined {
    const formattedProvider = provider.replace(/-/g, '_');
    return (this.config.apiKeys as any)[formattedProvider];
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
          this.config.model = 'meta/llama-3.2-11b-vision-instruct';
          break;
        case 'openai':
          this.config.model = 'gpt-4o';
          break;
        case 'gemini':
          this.config.model = 'gemini-3.5-flash';
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
          this.config.model = 'gemini-3.5-flash';
          break;
      }
    }
    this.saveGlobalConfig();
  }

  public hasActiveApiKey(targetProvider?: ProviderType): { configured: boolean; provider: ProviderType; envVar: string; key?: string } {
    const provider = targetProvider || this.config.provider;
    const isGuest = this.currentUserId === 'default_user';
    let key: string | undefined;
    let envVar = 'API_KEY';

    switch (provider) {
      case 'gemini':
        key = this.config.apiKeys.gemini || (isGuest ? (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY) : undefined);
        envVar = 'GEMINI_API_KEY';
        break;
      case 'deepseek':
        key = this.config.apiKeys.deepseek || (isGuest ? (process.env.DEEPSEEK_API_KEY || process.env.ANTRI_API_KEY) : undefined);
        envVar = 'DEEPSEEK_API_KEY';
        break;
      case 'openai':
        key = this.config.apiKeys.openai || (isGuest ? process.env.OPENAI_API_KEY : undefined);
        envVar = 'OPENAI_API_KEY';
        break;
      case 'anthropic':
        key = this.config.apiKeys.anthropic || (isGuest ? process.env.ANTHROPIC_API_KEY : undefined);
        envVar = 'ANTHROPIC_API_KEY';
        break;
      case 'nvidia-nim':
        key = this.config.apiKeys.nvidia_nim || (isGuest ? (process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY) : undefined);
        envVar = 'NVIDIA_API_KEY';
        break;
      case 'cerebras':
        key = this.config.apiKeys.cerebras || (isGuest ? process.env.CEREBRAS_API_KEY : undefined);
        envVar = 'CEREBRAS_API_KEY';
        break;
      case 'cohere':
        key = this.config.apiKeys.cohere || (isGuest ? process.env.COHERE_API_KEY : undefined);
        envVar = 'COHERE_API_KEY';
        break;
      case 'vortex':
        key = this.config.apiKeys.vortex || (isGuest ? process.env.VORTEX_API_KEY : undefined);
        envVar = 'VORTEX_API_KEY';
        break;
      case 'opencode':
        key = this.config.apiKeys.opencode || (isGuest ? process.env.OPENCODE_API_KEY : undefined);
        envVar = 'OPENCODE_API_KEY';
        break;
      case 'openrouter':
        key = this.config.apiKeys.openrouter || (isGuest ? process.env.OPENROUTER_API_KEY : undefined);
        envVar = 'OPENROUTER_API_KEY';
        break;
      case 'custom':
        key = this.config.apiKeys.custom || (isGuest ? process.env.CUSTOM_API_KEY : undefined);
        envVar = 'CUSTOM_API_KEY';
        break;
      case 'ollama':
        return { configured: true, provider, envVar: 'OLLAMA_BASE_URL', key: 'ollama' };
      case 'mock':
        return { configured: false, provider, envVar: 'OPENAI_API_KEY / GEMINI_API_KEY / DEEPSEEK_API_KEY', key: undefined };
      default:
        key = undefined;
        envVar = 'API_KEY';
    }

    const configured = Boolean(key && typeof key === 'string' && key.trim().length > 0 && !key.startsWith('placeholder'));
    return { configured, provider, envVar, key };
  }

  public saveGlobalConfig(): void {
    try {
      const targetFile = getPartitionConfigFile(this.currentUserId);
      fs.writeFileSync(targetFile, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch {
      // Ignore save failures in restricted environments
    }
  }
}

export const configManager = new ConfigManager();
