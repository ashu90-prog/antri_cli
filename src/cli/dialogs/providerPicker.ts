import readline from 'readline';
import chalk from 'chalk';
import { AntriConfig, ProviderType } from '../../types.js';
import { configManager } from '../../core/config.js';
import { log, colors } from '../../utils/logger.js';

export interface ProviderOption {
  id: ProviderType;
  name: string;
  recommended?: boolean;
  requiresKey: boolean;
  defaultBaseUrl?: string;
  envVar: string;
}

export const PROVIDERS_LIST: ProviderOption[] = [
  {
    id: 'cerebras',
    name: 'Cerebras (Ultra-Fast CS-3)',
    requiresKey: true,
    defaultBaseUrl: 'https://api.cerebras.ai/v1',
    envVar: 'CEREBRAS_API_KEY',
  },
  {
    id: 'cohere',
    name: 'Cohere (Command R+)',
    requiresKey: true,
    defaultBaseUrl: 'https://api.cohere.com/v2',
    envVar: 'COHERE_API_KEY',
  },
  {
    id: 'vortex',
    name: 'Vortex API',
    requiresKey: true,
    defaultBaseUrl: 'https://api.vortex.ai/v1',
    envVar: 'VORTEX_API_KEY',
  },
  {
    id: 'opencode',
    name: 'OpenCode API',
    requiresKey: true,
    defaultBaseUrl: 'https://api.opencode.ai/v1',
    envVar: 'OPENCODE_API_KEY',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    recommended: true,
    requiresKey: true,
    envVar: 'DEEPSEEK_API_KEY',
  },
  {
    id: 'nvidia-nim',
    name: 'NVIDIA NIM',
    requiresKey: true,
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
    envVar: 'NVIDIA_API_KEY',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    requiresKey: true,
    envVar: 'OPENAI_API_KEY',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    requiresKey: true,
    envVar: 'ANTHROPIC_API_KEY',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    requiresKey: true,
    envVar: 'GEMINI_API_KEY',
  },
  {
    id: 'ollama',
    name: 'Ollama (Local Offline)',
    requiresKey: false,
    defaultBaseUrl: 'http://localhost:11434',
    envVar: 'OLLAMA_BASE_URL',
  },
  {
    id: 'custom',
    name: 'Custom (OpenAI-compatible)',
    requiresKey: false,
    defaultBaseUrl: 'http://localhost:8000/v1',
    envVar: 'CUSTOM_BASE_URL',
  },
];

/**
 * Interactive Provider Selection Dialog matching refrence_provider.png
 */
export async function showProviderPickerDialog(config: AntriConfig): Promise<ProviderType | null> {
  return new Promise((resolve) => {
    let selectedIndex = 0;
    // Default selected index to current provider
    const currentIdx = PROVIDERS_LIST.findIndex((p) => p.id === config.provider);
    if (currentIdx !== -1) selectedIndex = currentIdx;

    let renderedLines = 0;
    const stdin = process.stdin;
    const stdout = process.stdout;

    readline.emitKeypressEvents(stdin);
    const isRawSupported = stdin.isTTY && typeof stdin.setRawMode === 'function';
    if (isRawSupported) {
      stdin.setRawMode(true);
    }
    stdin.resume();

    stdout.write('\x1b[?25l'); // Hide cursor

    const eraseDialog = () => {
      if (renderedLines > 0) {
        stdout.write('\x1b[2K\r');
        for (let i = 1; i < renderedLines; i++) {
          stdout.write('\x1b[1A\x1b[2K\r');
        }
        renderedLines = 0;
      }
    };

    const render = () => {
      eraseDialog();

      const lines: string[] = [];

      // Header matching refrence_provider.png
      const title = chalk.bold.hex('#c084fc')('Select AI Provider');
      const currentProviderName =
        PROVIDERS_LIST.find((p) => p.id === config.provider)?.name || config.provider;
      const currentLabel = chalk.hex('#64748b')(' Current: ') + chalk.hex('#4ade80')(currentProviderName);
      lines.push(`${title}${currentLabel}`);
      lines.push(chalk.hex('#64748b')('Available Providers:'));
      lines.push('');

      // List of providers
      for (let i = 0; i < PROVIDERS_LIST.length; i++) {
        const item = PROVIDERS_LIST[i];
        const isSelected = i === selectedIndex;
        const recTag = item.recommended ? chalk.hex('#64748b')(' (recommended)') : '';

        if (isSelected) {
          lines.push(chalk.bold.hex('#a5b4fc')(`> ${item.name}${recTag}`));
        } else {
          lines.push(chalk.hex('#94a3b8')(`  ${item.name}${recTag}`));
        }
      }

      lines.push('');
      lines.push(chalk.italic.hex('#64748b')('Press ESC to cancel'));

      stdout.write(lines.join('\n'));
      renderedLines = lines.length;
    };

    const cleanup = () => {
      eraseDialog();
      stdin.removeListener('keypress', onKeypress);
      if (isRawSupported) {
        stdin.setRawMode(false);
      }
      stdout.write('\x1b[2K\r');
      stdout.write('\x1b[?25h');
    };

    const onKeypress = async (str: string, key: readline.Key) => {
      if (!key) return;

      if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        cleanup();
        resolve(null);
        return;
      }

      if (key.name === 'up') {
        selectedIndex = (selectedIndex - 1 + PROVIDERS_LIST.length) % PROVIDERS_LIST.length;
        render();
        return;
      }

      if (key.name === 'down') {
        selectedIndex = (selectedIndex + 1) % PROVIDERS_LIST.length;
        render();
        return;
      }

      if (key.name === 'return' || key.name === 'enter') {
        const chosen = PROVIDERS_LIST[selectedIndex];
        cleanup();
        resolve(chosen.id);
        return;
      }
    };

    stdin.on('keypress', onKeypress);
    render();
  });
}

/**
 * Handles the full connect workflow including prompting for missing keys/URLs
 */
export async function runConnectWorkflow(): Promise<void> {
  const currentConfig = configManager.get();
  const chosenProvider = await showProviderPickerDialog(currentConfig);

  if (!chosenProvider) {
    return;
  }

  const option = PROVIDERS_LIST.find((p) => p.id === chosenProvider);
  if (!option) return;

  // If provider needs API key and none is set, prompt user
  const currentKey = (currentConfig.apiKeys as any)[chosenProvider.replace(/-/g, '_')];

  if (chosenProvider === 'ollama') {
    configManager.setProvider('ollama');
    log.success(`Connected to ${colors.primary('Ollama (Local)')}!`);
    console.log(chalk.hex('#64748b')('Use /models to view installed local models.'));
    return;
  }

  if (chosenProvider === 'custom') {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const promptAsync = (q: string) => new Promise<string>((res) => rl.question(q, res));

    console.log(chalk.bold.hex('#a5b4fc')('\n⚙ Custom OpenAI-compatible Provider Setup:'));
    const url = (await promptAsync(chalk.cyan('Base URL (e.g. http://localhost:8000/v1): '))) || 'http://localhost:8000/v1';
    const key = (await promptAsync(chalk.cyan('API Key (optional): '))) || 'custom-key';
    const model = (await promptAsync(chalk.cyan('Model Name: '))) || 'custom-model';
    rl.close();

    configManager.setBaseUrl('custom', url.trim());
    configManager.setApiKey('custom', key.trim());
    configManager.setProvider('custom', model.trim());
    log.success(`Connected to Custom Provider at ${colors.primary(url)}!`);
    return;
  }

  if (option.requiresKey && !currentKey) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const promptAsync = (q: string) => new Promise<string>((res) => rl.question(q, res));

    console.log(chalk.bold.hex('#a5b4fc')(`\n🔑 Enter API Key for ${option.name}:`));
    console.log(chalk.hex('#64748b')(`(Or set ${option.envVar} in your .env file)`));
    const enteredKey = await promptAsync(chalk.cyan('> '));
    rl.close();

    if (enteredKey.trim()) {
      configManager.setApiKey(chosenProvider, enteredKey.trim());
      configManager.setProvider(chosenProvider);
      log.success(`API key saved and connected to ${colors.primary(option.name)}!`);
      console.log(chalk.hex('#64748b')('Use /models to choose your model.'));
    } else {
      configManager.setProvider(chosenProvider);
      log.info(`Provider set to ${colors.primary(option.name)} (No API key saved yet).`);
    }
  } else {
    configManager.setProvider(chosenProvider);
    log.success(`Switched provider to ${colors.primary(option.name)}! (Model: ${configManager.get().model})`);
    console.log(chalk.hex('#64748b')('Use /models to choose or switch models.'));
  }
}
