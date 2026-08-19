export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: Role;
  content: string;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  timestamp?: number;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  preview?: string;
  isActive?: boolean;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export type ProviderType =
  | 'ollama'
  | 'anthropic'
  | 'nvidia-nim'
  | 'openai'
  | 'gemini'
  | 'deepseek'
  | 'cohere'
  | 'cerebras'
  | 'vortex'
  | 'opencode'
  | 'openrouter'
  | 'custom'
  | 'mock';

export interface ModelInfo {
  id: string;
  name: string;
  provider: ProviderType;
  category: string;
  description: string;
  contextWindow?: number;
  isFree?: boolean;
}

export interface ProfileInfo {
  id: string;
  name: string;
  filePath: string;
  isActive: boolean;
  notesCount: number;
  lastModified: number;
  preview: string;
}

export type DebateDepth = 'quick' | 'deep' | 'rigorous';
export type AgentMode = 'vibe' | 'plan';

export interface AntriConfig {
  provider: ProviderType;
  model: string;
  version: string;
  mode?: AgentMode;
  alwaysAllow?: boolean;
  apiKeys: {
    deepseek?: string;
    openai?: string;
    gemini?: string;
    anthropic?: string;
    nvidia_nim?: string;
    cohere?: string;
    cerebras?: string;
    vortex?: string;
    opencode?: string;
    openrouter?: string;
    custom?: string;
  };
  customBaseUrls?: {
    deepseek?: string;
    openai?: string;
    ollama?: string;
    nvidia_nim?: string;
    cohere?: string;
    cerebras?: string;
    vortex?: string;
    opencode?: string;
    custom?: string;
  };
  systemPrompt?: string;
  workingDir: string;
  autoExecuteTools: boolean;
  debateDepth?: DebateDepth;
  activeProfile?: string;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onToolCall?: (toolCall: ToolCall) => void;
  onError?: (err: Error) => void;
  onComplete?: (fullResponse: string) => void;
}

export interface ToolResult {
  tool_call_id: string;
  name: string;
  output: string;
  error?: boolean;
}

export interface SlashCommand {
  name: string;
  description: string;
  aliases?: string[];
}

export interface DialecticStage {
  persona: 'proposer' | 'adversary' | 'researcher' | 'judge';
  title: string;
  content: string;
  toolsUsed?: string[];
}

export interface DialecticResult {
  query: string;
  depth: DebateDepth;
  thesis: string;
  antithesis: string;
  verification?: string;
  synthesis: string;
  stages: DialecticStage[];
  sources?: string[];
}
