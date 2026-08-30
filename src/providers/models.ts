import { ModelInfo, ProviderType, AntriConfig } from '../types.js';

export const VERIFIED_NVIDIA_MODELS: string[] = [
  'meta/llama-3.2-11b-vision-instruct',
  'stepfun-ai/step-3.7-flash',
  'nvidia/nemotron-3-nano-30b-a3b',
  'openai/gpt-oss-20b',
  'minimaxai/minimax-m3',
  'nvidia/llama-3.3-nemotron-super-49b-v1.5',
  'thinkingmachines/inkling',
  'nvidia/nemotron-3-super-120b-a12b',
  'nvidia/nemotron-3-ultra-550b-a55b',
  'nvidia/nemotron-3.5-lightning-30b-a3b',
  'nvidia/nvidia-nemotron-nano-9b-v2',
  'nvidia/nemotron-mini-4b-instruct',
];

// Comprehensive catalog of preset models per provider
export const PROVIDER_CATALOGS: Record<ProviderType, ModelInfo[]> = {
  // Cerebras (Ultra-fast Cerebras CS-3 wafer scale engine)
  'cerebras': [
    {
      id: 'gpt-oss-120b',
      name: 'GPT OSS 120B (Cerebras)',
      provider: 'cerebras',
      category: 'Cerebras Ultra-Fast',
      description: 'Flagship 120B reasoning model running at ultra-fast speeds on Cerebras CS-3',
      contextWindow: 128000,
    },
    {
      id: 'gemma-4-31b',
      name: 'Gemma 4 31B (Cerebras)',
      provider: 'cerebras',
      category: 'Cerebras Ultra-Fast',
      description: 'Ultra-fast 31B model with sub-10ms response latency on Cerebras CS-3',
      contextWindow: 128000,
    },
    {
      id: 'llama-3.3-70b',
      name: 'Llama 3.3 70B (Cerebras)',
      provider: 'cerebras',
      category: 'Cerebras Ultra-Fast',
      description: 'Meta Llama 3.3 70B running at ultra-fast ~2,000 tokens/sec on Cerebras CS-3',
      contextWindow: 128000,
    },
    {
      id: 'llama3.1-70b',
      name: 'Llama 3.1 70B (Cerebras)',
      provider: 'cerebras',
      category: 'Cerebras Ultra-Fast',
      description: 'Llama 3.1 70B instruction-tuned model with sub-second time-to-first-token',
      contextWindow: 128000,
    },
    {
      id: 'llama3.1-8b',
      name: 'Llama 3.1 8B (Cerebras)',
      provider: 'cerebras',
      category: 'Cerebras Ultra-Fast',
      description: 'blazing-fast 8B model running at ~1,800+ tokens/sec for rapid iteration',
      contextWindow: 128000,
    },
    {
      id: 'qwen-2.5-coder-32b',
      name: 'Qwen 2.5 Coder 32B (Cerebras)',
      provider: 'cerebras',
      category: 'Cerebras Coding',
      description: 'specialized coding LLM on Cerebras high-speed hardware architecture',
      contextWindow: 32768,
    },
    {
      id: 'qwen-2.5-72b',
      name: 'Qwen 2.5 72B (Cerebras)',
      provider: 'cerebras',
      category: 'Cerebras Reasoning',
      description: '72B dense open reasoning and multilingual model on Cerebras cloud',
      contextWindow: 128000,
    },
  ],

  // Cohere (Enterprise, RAG & Command Family)
  'cohere': [
    {
      id: 'command-r-plus-08-2024',
      name: 'Command R+ (08-2024)',
      provider: 'cohere',
      category: 'Command R+ Family',
      description: 'Cohere flagship model optimized for complex reasoning, agents, tool use & multilingual coding',
      contextWindow: 128000,
    },
    {
      id: 'command-r-plus',
      name: 'Command R+',
      provider: 'cohere',
      category: 'Command R+ Family',
      description: 'enterprise-grade reasoning model with state-of-the-art citation and tool execution',
      contextWindow: 128000,
    },
    {
      id: 'command-r-08-2024',
      name: 'Command R (08-2024)',
      provider: 'cohere',
      category: 'Command R Family',
      description: 'scalable, high-efficiency 128K context model for conversational programming',
      contextWindow: 128000,
    },
    {
      id: 'command-r',
      name: 'Command R',
      provider: 'cohere',
      category: 'Command R Family',
      description: 'fast general-purpose enterprise model with strong coding and RAG capabilities',
      contextWindow: 128000,
    },
    {
      id: 'command-r7b-12-2024',
      name: 'Command R7B',
      provider: 'cohere',
      category: 'Command Lightweight',
      description: 'ultra-fast 7B parameter reasoning and lightweight tool execution model',
      contextWindow: 128000,
    },
    {
      id: 'command-light',
      name: 'Command Light',
      provider: 'cohere',
      category: 'Command Lightweight',
      description: 'low-latency lightweight model for quick code assistance and simple queries',
      contextWindow: 4096,
    },
  ],

  // Vortex API (High-throughput inference cluster)
  'vortex': [
    {
      id: 'vortex-llama-3.3-70b-instruct',
      name: 'Vortex Llama 3.3 70B',
      provider: 'vortex',
      category: 'Vortex Frontier',
      description: 'high-throughput Llama 3.3 70B on Vortex distributed GPU cluster',
      contextWindow: 128000,
    },
    {
      id: 'vortex-deepseek-r1-full',
      name: 'Vortex DeepSeek R1 671B',
      provider: 'vortex',
      category: 'Vortex Reasoning',
      description: 'full 671B DeepSeek R1 chain-of-thought reasoning served on Vortex API',
      contextWindow: 64000,
    },
    {
      id: 'vortex-deepseek-v3',
      name: 'Vortex DeepSeek V3 671B',
      provider: 'vortex',
      category: 'Vortex Frontier',
      description: '671B MoE base and coding assistant model with ultra-fast latency',
      contextWindow: 64000,
    },
    {
      id: 'vortex-qwen-2.5-coder-32b',
      name: 'Vortex Qwen 2.5 Coder 32B',
      provider: 'vortex',
      category: 'Vortex Coding',
      description: 'specialized programming intelligence with 32K context on Vortex',
      contextWindow: 32768,
    },
    {
      id: 'vortex-mistral-large-2411',
      name: 'Vortex Mistral Large 2',
      provider: 'vortex',
      category: 'Vortex Frontier',
      description: '123B parameter flagship model from Mistral AI on Vortex cluster',
      contextWindow: 128000,
    },
    {
      id: 'vortex-hermes-3-llama-3.1-70b',
      name: 'Vortex Hermes 3 70B',
      provider: 'vortex',
      category: 'Vortex Open Models',
      description: 'Nous Research Hermes 3 instruction model on Vortex infrastructure',
      contextWindow: 128000,
    },
  ],

  // OpenCode API (Specialized code generation & agent models)
  'opencode': [
    {
      id: 'opencode/deepseek-coder-v2.5',
      name: 'OpenCode DeepSeek Coder V2.5',
      provider: 'opencode',
      category: 'OpenCode Dedicated',
      description: 'specialized multi-language programming and repository reasoning model',
      contextWindow: 128000,
    },
    {
      id: 'opencode/qwen2.5-coder-32b-instruct',
      name: 'OpenCode Qwen 2.5 Coder 32B',
      provider: 'opencode',
      category: 'OpenCode Dedicated',
      description: 'fine-tuned high accuracy coding model supporting 92 programming languages',
      contextWindow: 32768,
    },
    {
      id: 'opencode/deepseek-r1-code',
      name: 'OpenCode DeepSeek R1 Code',
      provider: 'opencode',
      category: 'OpenCode Reasoning',
      description: 'chain-of-thought code verification and architectural synthesis model',
      contextWindow: 64000,
    },
    {
      id: 'opencode/starcoder2-15b',
      name: 'OpenCode StarCoder2 15B',
      provider: 'opencode',
      category: 'OpenCode Dedicated',
      description: 'transparent open-source code completion and refactoring model',
      contextWindow: 16384,
    },
    {
      id: 'opencode/codellama-70b',
      name: 'OpenCode CodeLlama 70B',
      provider: 'opencode',
      category: 'OpenCode Dedicated',
      description: 'high-capacity 70B code synthesis and unit-test authoring model',
      contextWindow: 100000,
    },
    {
      id: 'opencode/wizardcoder-33b',
      name: 'OpenCode WizardCoder 33B',
      provider: 'opencode',
      category: 'OpenCode Dedicated',
      description: 'Evol-Instruct trained model for intricate algorithmic logic and scripts',
      contextWindow: 32768,
    },
  ],

  // NVIDIA NIM Models (Verified Active Models + Complete Catalog)
  'nvidia-nim': [
    // Verified Active
    { id: 'meta/llama-3.2-11b-vision-instruct', name: 'Llama 3.2 11B Vision', provider: 'nvidia-nim', category: '⭐ Active & Verified', description: 'multimodal vision and text model with 128K context' },
    { id: 'stepfun-ai/step-3.7-flash', name: 'Step 3.7 Flash', provider: 'nvidia-nim', category: '⭐ Active & Verified', description: 'blazing-fast multimodal sparse-MoE reasoning model' },
    { id: 'nvidia/nemotron-3-nano-30b-a3b', name: 'Nemotron 3 Nano 30B', provider: 'nvidia-nim', category: '⭐ Active & Verified', description: 'compact 30B MoE model tuned for agentic reasoning' },
    { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B', provider: 'nvidia-nim', category: '⭐ Active & Verified', description: 'open weights GPT-architecture model on NIM' },
    { id: 'minimaxai/minimax-m3', name: 'MiniMax M3', provider: 'nvidia-nim', category: '⭐ Active & Verified', description: 'multilingual high-speed model on NVIDIA NIM' },
    { id: 'nvidia/llama-3.3-nemotron-super-49b-v1.5', name: 'Nemotron Super 49B v1.5', provider: 'nvidia-nim', category: '⭐ Active & Verified', description: 'super high performance reasoning & coding LLM' },
    { id: 'thinkingmachines/inkling', name: 'Inkling MoE', provider: 'nvidia-nim', category: '⭐ Active & Verified', description: 'multimodal MoE reasoning at high throughput' },

    // Moonshot AI
    { id: 'moonshotai/kimi-k2.6', name: 'Kimi K2.6', provider: 'nvidia-nim', category: 'Moonshot AI', description: 'Moonshot AI model hosted on NVIDIA NIM' },

    // 01.AI
    { id: '01-ai/yi-large', name: 'Yi Large', provider: 'nvidia-nim', category: '01.AI', description: '01.AI flagship model on NVIDIA NIM' },

    // Meta Llama Family
    { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct', provider: 'nvidia-nim', category: 'Meta Llama', description: 'flagship open weights 70B model with high reasoning' },
    { id: 'meta/llama-3.1-70b-instruct', name: 'Llama 3.1 70B Instruct', provider: 'nvidia-nim', category: 'Meta Llama', description: 'high-capability open model with 128K context' },
    { id: 'meta/llama-3.1-405b-instruct', name: 'Llama 3.1 405B Instruct', provider: 'nvidia-nim', category: 'Meta Llama', description: 'frontier-scale 405B parameter model for deep coding' },
    { id: 'meta/muse-glimmer-30b', name: 'Muse Glimmer 30B', provider: 'nvidia-nim', category: 'Meta Llama', description: 'Meta creative and synthetic model on NIM' },

    // DeepSeek on NVIDIA NIM
    { id: 'deepseek-ai/deepseek-r1', name: 'DeepSeek R1 (NIM)', provider: 'nvidia-nim', category: 'DeepSeek (NVIDIA)', description: 'NVIDIA-accelerated DeepSeek R1 reasoning' },
    { id: 'deepseek-ai/deepseek-v3', name: 'DeepSeek V3 (NIM)', provider: 'nvidia-nim', category: 'DeepSeek (NVIDIA)', description: '671B MoE frontier coding and conversational model' },
    { id: 'deepseek-ai/deepseek-coder-6.7b-instruct', name: 'DeepSeek Coder 6.7B', provider: 'nvidia-nim', category: 'DeepSeek (NVIDIA)', description: 'specialized coding assistant model' },

    // NVIDIA Nemotron Family
    { id: 'nvidia/nemotron-3-super-120b-a12b', name: 'Nemotron 3 Super 120B', provider: 'nvidia-nim', category: 'NVIDIA Nemotron', description: 'large-scale MoE reasoning engine' },
    { id: 'nvidia/nemotron-3-ultra-550b-a55b', name: 'Nemotron 3 Ultra 550B', provider: 'nvidia-nim', category: 'NVIDIA Nemotron', description: '550B frontier MoE flagship for autonomous agents' },
    { id: 'nvidia/nemotron-3.5-lightning-30b-a3b', name: 'Nemotron 3.5 Lightning 30B', provider: 'nvidia-nim', category: 'NVIDIA Nemotron', description: 'accelerated low-latency MoE for interactive coding' },
    { id: 'nvidia/nvidia-nemotron-nano-9b-v2', name: 'Nemotron Nano 9B v2', provider: 'nvidia-nim', category: 'NVIDIA Nemotron', description: 'ultra-efficient 9B model optimized for coding' },
    { id: 'nvidia/nemotron-mini-4b-instruct', name: 'Nemotron Mini 4B Instruct', provider: 'nvidia-nim', category: 'NVIDIA Nemotron', description: 'compact 4B lightweight instruction tuned model' },
    { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Nemotron 70B Instruct', provider: 'nvidia-nim', category: 'NVIDIA Nemotron', description: 'custom tuned by NVIDIA for top benchmark scores' },

    // Qwen Family on NVIDIA NIM
    { id: 'qwen/qwen2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B', provider: 'nvidia-nim', category: 'Qwen', description: 'specialized coding LLM on TensorRT-LLM' },
    { id: 'qwen/qwen2.5-72b-instruct', name: 'Qwen 2.5 72B Instruct', provider: 'nvidia-nim', category: 'Qwen', description: 'general purpose large open model' },
    { id: 'qwen/qwen2.5-7b-instruct', name: 'Qwen 2.5 7b Instruct', provider: 'nvidia-nim', category: 'Qwen', description: 'efficient 7B model for conversational agents' },

    // Mistral Family on NVIDIA NIM
    { id: 'mistralai/mistral-large-2-instruct', name: 'Mistral Large 2', provider: 'nvidia-nim', category: 'Mistral AI', description: '123B frontier model with top-tier code generation' },
    { id: 'mistralai/mixtral-8x22b-instruct-v0.1', name: 'Mixtral 8x22B Instruct', provider: 'nvidia-nim', category: 'Mistral AI', description: 'high-capacity Sparse MoE model' },
    { id: 'mistralai/mixtral-8x7b-instruct-v0.1', name: 'Mixtral 8x7B Instruct', provider: 'nvidia-nim', category: 'Mistral AI', description: 'popular efficient MoE model' },

    // Google Gemma on NVIDIA NIM
    { id: 'google/gemma-2-27b-it', name: 'Gemma 2 27B IT', provider: 'nvidia-nim', category: 'Google Gemma', description: 'Google open weights model' },
    { id: 'google/gemma-2-9b-it', name: 'Gemma 2 9B IT', provider: 'nvidia-nim', category: 'Google Gemma', description: 'compact Gemma 2 model' },

    // Microsoft Phi on NVIDIA NIM
    { id: 'microsoft/phi-3.5-moe-instruct', name: 'Phi 3.5 MoE Instruct', provider: 'nvidia-nim', category: 'Microsoft Phi', description: '16x3.8B Mixture of Experts with 128K context' },
    { id: 'microsoft/phi-3.5-mini-instruct', name: 'Phi 3.5 Mini Instruct', provider: 'nvidia-nim', category: 'Microsoft Phi', description: '3.8B model with strong reasoning' },
  ],

  // Anthropic Claude Models
  'anthropic': [
    {
      id: 'claude-3-7-sonnet-20250219',
      name: 'Claude 3.7 Sonnet',
      provider: 'anthropic',
      category: 'Claude 3.7',
      description: 'hybrid reasoning & coding frontier model with controllable thinking',
      contextWindow: 200000,
    },
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet (Latest)',
      provider: 'anthropic',
      category: 'Claude 3.5',
      description: 'industry standard for coding, autonomous agent execution & tool use',
      contextWindow: 200000,
    },
    {
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku',
      provider: 'anthropic',
      category: 'Claude 3.5',
      description: 'blazing-fast intelligence with high code comprehension & low cost',
      contextWindow: 200000,
    },
    {
      id: 'claude-3-opus-20240229',
      name: 'Claude 3.5 Opus',
      provider: 'anthropic',
      category: 'Claude 3',
      description: 'complex reasoning and deep mathematical & architectural analysis',
      contextWindow: 200000,
    },
  ],

  // OpenAI Models
  'openai': [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      category: 'GPT-4o',
      description: 'flagship omni multimodal model with high speed and coding strength',
      contextWindow: 128000,
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openai',
      category: 'GPT-4o',
      description: 'fast and cost-efficient model for focused programming tasks',
      contextWindow: 128000,
    },
    {
      id: 'o1',
      name: 'OpenAI o1',
      provider: 'openai',
      category: 'Reasoning (o1 / o3)',
      description: 'deep chain-of-thought reasoning for complex algorithms and logic',
      contextWindow: 200000,
    },
    {
      id: 'o3-mini',
      name: 'OpenAI o3-mini',
      provider: 'openai',
      category: 'Reasoning (o1 / o3)',
      description: 'high-speed frontier reasoning model with exceptional STEM performance',
      contextWindow: 200000,
    },
    {
      id: 'gpt-4.5-preview',
      name: 'GPT-4.5 Preview',
      provider: 'openai',
      category: 'GPT-4.5',
      description: 'frontier scale general intelligence with deep world knowledge',
      contextWindow: 128000,
    },
  ],

  // Google Gemini Models (Primary Google GenAI Suite)
  'gemini': [
    {
      id: 'gemini-3.5-flash',
      name: 'Gemini 3.5 Flash',
      provider: 'gemini',
      category: 'Gemini 3.5',
      description: 'Default high-efficiency agentic coding, reasoning & 1M context via Google GenAI SDK',
      contextWindow: 1000000,
    },
    {
      id: 'gemini-3.7-flash',
      name: 'Gemini 3.7 Flash',
      provider: 'gemini',
      category: 'Gemini 3.7',
      description: 'Flagship hybrid reasoning, agentic coding & 1M context via Google GenAI SDK',
      contextWindow: 1000000,
    },
    {
      id: 'gemini-3.7-pro',
      name: 'Gemini 3.7 Pro',
      provider: 'gemini',
      category: 'Gemini 3.7',
      description: 'State-of-the-art multimodal reasoning and long-horizon software engineering',
      contextWindow: 2000000,
    },
    {
      id: 'gemini-3.5-pro',
      name: 'Gemini 3.5 Pro',
      provider: 'gemini',
      category: 'Gemini 3.5',
      description: 'Advanced agentic coding with high-depth architectural problem solving',
      contextWindow: 2000000,
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      provider: 'gemini',
      category: 'Gemini 2.5',
      description: 'Next-gen high-efficiency speed & 1M context with native tool use',
      contextWindow: 1000000,
    },
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      provider: 'gemini',
      category: 'Gemini 2.5',
      description: 'Advanced reasoning, multimodal & agentic coding with 2M context',
      contextWindow: 2000000,
    },
    {
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      provider: 'gemini',
      category: 'Gemini 2.0',
      description: 'Second generation multimodal real-time agent engine',
      contextWindow: 1000000,
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      provider: 'gemini',
      category: 'Gemini 1.5',
      description: 'Massive 2M token context for whole repository ingestion',
      contextWindow: 2000000,
    },
  ],

  // DeepSeek Models
  'deepseek': [
    {
      id: 'deepseek-chat',
      name: 'DeepSeek Chat (V3)',
      provider: 'deepseek',
      category: 'DeepSeek V3',
      description: 'state-of-the-art 671B MoE model for coding, architecture & chat',
      contextWindow: 64000,
    },
    {
      id: 'deepseek-reasoner',
      name: 'DeepSeek Reasoner (R1)',
      provider: 'deepseek',
      category: 'DeepSeek R1',
      description: 'pure chain-of-thought open reasoning rivaling top proprietary models',
      contextWindow: 64000,
    },
    {
      id: 'deepseek-v4-flash-(latest)',
      name: 'DeepSeek V4 Flash',
      provider: 'deepseek',
      category: 'DeepSeek Flash',
      description: 'blazing-fast code assistant with high reasoning and low latency',
      contextWindow: 64000,
    },
  ],

  // Ollama (Local)
  'ollama': [
    {
      id: 'llama3.3:70b',
      name: 'Llama 3.3 70B',
      provider: 'ollama',
      category: 'Ollama Models',
      description: 'flagship local offline model with 128K context',
      contextWindow: 128000,
    },
    {
      id: 'llama3.1:8b',
      name: 'Llama 3.1 8B',
      provider: 'ollama',
      category: 'Ollama Models',
      description: 'lightweight local fast model for daily coding',
      contextWindow: 128000,
    },
    {
      id: 'deepseek-r1:latest',
      name: 'DeepSeek R1 (Local)',
      provider: 'ollama',
      category: 'Ollama Models',
      description: 'local reasoning model running fully on your machine',
      contextWindow: 32768,
    },
    {
      id: 'qwen2.5-coder:32b',
      name: 'Qwen 2.5 Coder 32B',
      provider: 'ollama',
      category: 'Ollama Models',
      description: 'specialized coding assistant running offline on GPU',
      contextWindow: 32768,
    },
  ],

  // OpenRouter Models
  'openrouter': [
    {
      id: 'deepseek/deepseek-r1',
      name: 'DeepSeek R1',
      provider: 'openrouter',
      category: 'OpenRouter',
      description: 'open frontier reasoning model routed via OpenRouter',
      contextWindow: 64000,
    },
    {
      id: 'anthropic/claude-3.5-sonnet',
      name: 'Claude 3.5 Sonnet',
      provider: 'openrouter',
      category: 'OpenRouter',
      description: 'top-rated coding intelligence via OpenRouter',
      contextWindow: 200000,
    },
    {
      id: 'openai/gpt-4o',
      name: 'GPT-4o',
      provider: 'openrouter',
      category: 'OpenRouter',
      description: 'flagship OpenAI model routed through unified API',
      contextWindow: 128000,
    },
  ],

  // Custom
  'custom': [
    {
      id: 'custom-model',
      name: 'Custom Endpoint Model',
      provider: 'custom',
      category: 'Custom Provider',
      description: 'user-defined OpenAI-compatible model endpoint',
    },
  ],

  // Mock
  'mock': [
    {
      id: 'deepseek-v4-flash-(latest)',
      name: 'DeepSeek V4 Flash (Demo)',
      provider: 'mock',
      category: 'Demo / Mock',
      description: 'built-in offline interactive assistant demo',
    },
  ],
};

/**
 * Returns available models scoped strictly to the active provider
 */
export async function getAvailableModels(config: AntriConfig): Promise<ModelInfo[]> {
  const currentProvider = config.provider;

  // 1. Ollama live fetching
  if (currentProvider === 'ollama') {
    try {
      const baseUrl = config.customBaseUrls?.ollama || 'http://localhost:11434';
      const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = (await res.json()) as any;
        if (data.models && Array.isArray(data.models) && data.models.length > 0) {
          const installedModels: ModelInfo[] = data.models.map((m: any) => ({
            id: m.name,
            name: m.name,
            provider: 'ollama',
            category: 'Installed Local Models',
            description: `Local model (${Math.round((m.size || 0) / (1024 * 1024 * 1024))}GB) · ${m.details?.family || 'llm'}`,
          }));
          return installedModels;
        }
      }
    } catch {
      // Fallback
    }
    return PROVIDER_CATALOGS['ollama'];
  }

  // 2. NVIDIA NIM live fetching: fetch ALL models from API endpoint
  if (currentProvider === 'nvidia-nim') {
    const apiKey = config.apiKeys.nvidia_nim || process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY;
    if (apiKey) {
      try {
        const baseUrl = config.customBaseUrls?.nvidia_nim || 'https://integrate.api.nvidia.com/v1';
        const res = await fetch(`${baseUrl}/models`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(3000),
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            const allFetchedModels: ModelInfo[] = data.data.map((m: any) => {
              const modelId = m.id || m.name;
              const owner = m.owned_by || modelId.split('/')[0] || 'nvidia';

              // Format clean display name
              const parts = modelId.split('/');
              const shortName = parts.length > 1 ? parts[1] : parts[0];
              const formattedName = shortName
                .replace(/-/g, ' ')
                .replace(/\b\w/g, (l: string) => l.toUpperCase());

              const isVerified = VERIFIED_NVIDIA_MODELS.includes(modelId);
              let category = isVerified ? '⭐ Active & Verified' : (owner.charAt(0).toUpperCase() + owner.slice(1));

              return {
                id: modelId,
                name: `${formattedName} (${owner})`,
                provider: 'nvidia-nim',
                category,
                description: isVerified ? 'Verified active model on NVIDIA NIM' : `Model on NVIDIA NIM (${modelId})`,
              };
            });

            // Sort verified models to the top
            allFetchedModels.sort((a, b) => {
              const aV = a.category.startsWith('⭐') ? 0 : 1;
              const bV = b.category.startsWith('⭐') ? 0 : 1;
              return aV - bV;
            });

            return allFetchedModels;
          }
        }
      } catch {
        // Fallback
      }
    }
    return PROVIDER_CATALOGS['nvidia-nim'];
  }

  // 3. OpenAI live fetching
  if (currentProvider === 'openai') {
    const apiKey = config.apiKeys.openai || process.env.OPENAI_API_KEY;
    if (apiKey) {
      try {
        const baseUrl = config.customBaseUrls?.openai || 'https://api.openai.com/v1';
        const res = await fetch(`${baseUrl}/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(2500),
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            const relevant = data.data.filter((m: any) =>
              m.id.startsWith('gpt-4') || m.id.startsWith('o1') || m.id.startsWith('o3') || m.id.startsWith('chatgpt-')
            );
            if (relevant.length > 0) {
              return relevant.map((m: any) => ({
                id: m.id,
                name: m.id.toUpperCase(),
                provider: 'openai',
                category: m.id.startsWith('o1') || m.id.startsWith('o3') ? 'Reasoning Models' : 'GPT Models',
                description: `OpenAI model (${m.id})`,
              }));
            }
          }
        }
      } catch {
        // Fallback
      }
    }
    return PROVIDER_CATALOGS['openai'];
  }

  // 4. Return provider's preset catalog
  const catalog = PROVIDER_CATALOGS[currentProvider];
  return catalog && catalog.length > 0 ? catalog : PROVIDER_CATALOGS['mock'];
}
