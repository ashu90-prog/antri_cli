import readline from 'readline';
import chalk from 'chalk';
import { SlashCommand } from '../types.js';
import { ToolInspector } from './renderer.js';
import { FilePickerService } from './dialogs/filePicker.js';
import { profileManager } from '../profiles/profileManager.js';
import { configManager } from '../core/config.js';

export const PROMPT_TOOLKIT_COMMANDS: SlashCommand[] = [
  { name: '/plan', description: 'Switch to Plan Mode: Discuss and design architectural plans with agent before coding' },
  { name: '/vibe', description: 'Switch to Vibe Mode: Direct conversation where agent actively writes code in flow' },
  { name: '/desktop', description: 'Launch the lightweight ANTRI Desktop Control Plane in app window' },
  { name: '/mobile', description: 'Launch the standalone ANTRI Mobile App server' },
  { name: '/sync', description: 'Sync Thinking Profiles and Memory with Google Cloud Firestore' },
  { name: '/login', description: 'Log in to your ANTRI account to access your private Firestore profiles' },
  { name: '/whoami', description: 'Show currently authenticated ANTRI account' },
  { name: '/logout', description: 'Log out from your ANTRI account' },
  { name: '/alwaysallow', description: 'Toggle Always-Allow permission for sensitive tools (web search, python, shell)' },
  { name: '/goal', description: 'Run autonomous multi-step goal loop: plan, critique, refine & deliver' },
  { name: '/silent-goal', description: 'Run Goal Loop optimization silently in background and deliver final plan' },
  { name: '/loop', description: 'Iterate on a task until optimal battle-tested result is achieved' },
  { name: '/arch', description: 'Generate an interactive visual architecture diagram of the current workspace codebase' },
  { name: '/imagine', description: 'Create a visual code architecture diagram & graph artifact' },
  { name: '/mindmap', description: 'Create an interactive visual mind map and concept tree artifact' },
  { name: '/view', description: 'Generate an interactive HTML application or plan artifact' },
  { name: '/artifacts', description: 'View all generated interactive HTML, graph, and mind map artifacts' },
  { name: '/fix', description: 'Automatically diagnose and repair bugs or failing tests in current project' },
  { name: '/selfheal', description: 'Run ANTRI health check, diagnose blocking bugs & auto-heal storage' },
  { name: '/profile', description: 'Switch or create user thinking profiles (profile_1, profile_2...)' },
  { name: '/notes', description: 'View active profile notes & adaptive thinking insights' },
  { name: '/update', description: 'Self-update ANTRI Code CLI to latest release without lockfile churn' },
  { name: '/debate', description: 'Trigger Dialectic Engine multi-persona self-debate & consensus' },
  { name: '/silent-debate', description: 'Run Dialectic debate silently in background and deliver final consensus' },
  { name: '/depth', description: 'Set debate depth: /depth <quick|deep|rigorous>' },
  { name: '/meta', description: 'View Meta-Optimization metrics, success rates & self-healing stats' },
  { name: '/skills', description: 'List built-in & dynamically synthesized custom skills' },
  { name: '/memory', description: 'View Persistent Memory & knowledge compounding status' },
  { name: '/consolidate', description: 'Run post-session reflection & lifelong learning loop' },
  { name: '/learn', description: 'Save a persistent rule or knowledge item: /learn <text>' },
  { name: '/models', description: 'Switch between ANTRI Code models' },
  { name: '/connect', description: 'Connect to an AI Provider (Ollama, Anthropic, NVIDIA NIM, OpenAI, Gemini...)' },
  { name: '/tools', description: 'View detailed logs of recently executed tools (Ctrl+O)' },
  { name: '/add-dir', description: 'Add directory to workspace context' },
  { name: '/worktree', description: 'Create, list, or switch git worktrees - /worktree [name|list|remove <name>]' },
  { name: '/agents', description: 'Manage agent configurations' },
  { name: '/clear (new)', description: 'Start a new session with empty context; previous stays on disk, resumable with /resume' },
  { name: '/clone', description: 'Clone the current branch into a new session and switch to it' },
  { name: '/theme', description: 'Switch between dark and light themes' },
  { name: '/compact', description: 'Compact the conversation history' },
  { name: '/compact-mode', description: 'Select a compact mode to compact sessions' },
  { name: '/help', description: 'View help and command reference' },
  { name: '/history', description: 'View session conversation history' },
  { name: '/export', description: 'Export conversation transcript to markdown' },
  { name: '/read', description: 'Quickly read a file from the workspace' },
  { name: '/ls', description: 'List files in workspace' },
  { name: '/run', description: 'Execute a shell command' },
  { name: '/config', description: 'Show active configuration and key status' },
  { name: '/exit', description: 'Exit ANTRI Code session' },
];

export class PromptBoxReader {
  private activeModel: string;
  private workingDir: string;
  private renderedLines: number = 0;

  constructor(activeModel = 'meta/llama-3.2-11b-vision-instruct', workingDir = process.cwd()) {
    this.activeModel = activeModel;
    this.workingDir = workingDir;
  }

  public updateModel(newModel: string): void {
    this.activeModel = newModel;
  }

  public updateWorkingDir(newDir: string): void {
    this.workingDir = newDir;
  }

  public async readPrompt(placeholder = 'Ask your question...'): Promise<string> {
    return new Promise((resolve) => {
      let inputBuffer = '';
      let selectedIndex = 0;
      let fileSelectedIndex = 0;
      this.renderedLines = 0;

      const stdin = process.stdin;
      const stdout = process.stdout;

      readline.emitKeypressEvents(stdin);
      const isRawSupported = stdin.isTTY && typeof stdin.setRawMode === 'function';
      if (isRawSupported) {
        stdin.setRawMode(true);
      }
      stdin.resume();

      stdout.write('\x1b[?25l'); // Hide native cursor while redrawing

      const eraseBox = () => {
        if (this.renderedLines > 0) {
          stdout.write('\x1b[2K\r');
          for (let i = 1; i < this.renderedLines; i++) {
            stdout.write('\x1b[1A\x1b[2K\r');
          }
          this.renderedLines = 0;
        }
      };

      const getMatchingCommands = (): SlashCommand[] => {
        if (!inputBuffer.startsWith('/')) return [];
        const clean = inputBuffer.toLowerCase();
        return PROMPT_TOOLKIT_COMMANDS.filter((cmd) => {
          const baseName = cmd.name.split(' ')[0].toLowerCase();
          return baseName.startsWith(clean) || cmd.name.toLowerCase().startsWith(clean);
        });
      };

      // Detect active @ attachment query at cursor
      const getAttachmentQuery = (): { query: string; startIndex: number } | null => {
        const lastAtIdx = inputBuffer.lastIndexOf('@');
        if (lastAtIdx === -1) return null;
        if (lastAtIdx > 0 && inputBuffer[lastAtIdx - 1] !== ' ') return null;
        const query = inputBuffer.slice(lastAtIdx + 1);
        if (query.includes(' ')) return null;
        return { query, startIndex: lastAtIdx };
      };

      const render = () => {
        eraseBox();

        const lines: string[] = [];
        const divider = chalk.hex('#2d3748')('─'.repeat(Math.min(stdout.columns || 80, 80)));

        const attachmentInfo = getAttachmentQuery();
        const slashMatches = getMatchingCommands();
        const activeProfile = profileManager.getActiveProfileName();
        const currentConfig = configManager.get();
        const activeMode = (currentConfig.mode || 'vibe').toUpperCase();

        // 1. SLASH COMMAND MODE (Matching prompt_toolkit.png & refrence_model_command_prompt_toolkit.png)
        if (slashMatches.length > 0 && inputBuffer.startsWith('/')) {
          if (selectedIndex >= slashMatches.length) selectedIndex = 0;
          if (selectedIndex < 0) selectedIndex = slashMatches.length - 1;

          const promptSymbol = chalk.bold.white('> ');
          const cursor = chalk.bgWhite.black(' ');
          const typedText = chalk.white(inputBuffer) + cursor;

          let rightTag = '';
          if (inputBuffer.startsWith('/model')) {
            rightTag = chalk.hex('#64748b')(`          ${this.activeModel} (current)`);
          } else if (inputBuffer.startsWith('/profile')) {
            rightTag = chalk.hex('#64748b')(`          ${activeProfile} (active)`);
          } else if (inputBuffer.startsWith('/plan') || inputBuffer.startsWith('/vibe')) {
            rightTag = chalk.hex('#64748b')(`          ${activeMode} mode`);
          }

          lines.push(`${promptSymbol}${typedText}${rightTag}`);
          lines.push(divider);

          const maxVisible = 8;
          const displayMatches = slashMatches.slice(0, maxVisible);

          for (let i = 0; i < displayMatches.length; i++) {
            const cmd = displayMatches[i];
            const isSelected = i === selectedIndex;
            const nameCol = cmd.name.padEnd(20);
            const descCol = cmd.description;

            if (isSelected) {
              lines.push(chalk.bgRgb(46, 41, 84).bold.white(` ${nameCol} ${descCol} `));
            } else {
              lines.push(` ${chalk.hex('#e2e8f0')(nameCol)} ${chalk.hex('#94a3b8')(descCol)}`);
            }
          }
        }
        // 2. ATTACHMENT PICKER MODE (Matching refrence_attachment_picker.png)
        else if (attachmentInfo !== null && !inputBuffer.startsWith('/')) {
          const promptSymbol = chalk.bold.white('> ');
          const cursor = chalk.bgWhite.black(' ');
          lines.push(`${promptSymbol}${chalk.white(inputBuffer)}${cursor}`);
          lines.push(divider);

          const { currentDir, items } = FilePickerService.listDirectory(
            this.workingDir,
            attachmentInfo.query
          );

          if (fileSelectedIndex >= items.length) fileSelectedIndex = Math.max(0, items.length - 1);
          if (fileSelectedIndex < 0) fileSelectedIndex = 0;

          lines.push(chalk.hex('#94a3b8')(`Files: ${currentDir}`));
          lines.push('');

          const maxVisible = 8;
          let startIdx = Math.max(0, Math.min(fileSelectedIndex - Math.floor(maxVisible / 2), items.length - maxVisible));
          if (startIdx < 0) startIdx = 0;
          const visibleItems = items.slice(startIdx, startIdx + maxVisible);

          if (items.length === 0) {
            lines.push(chalk.hex('#64748b')('  (No files found)'));
          } else {
            for (let i = 0; i < visibleItems.length; i++) {
              const item = visibleItems[i];
              const actualIdx = startIdx + i;
              const isSelected = actualIdx === fileSelectedIndex;
              const displayName = item.name;

              if (isSelected) {
                lines.push(chalk.bgRgb(46, 41, 84).bold.white(`  ${displayName} `));
              } else {
                const color = item.isDirectory ? chalk.hex('#818cf8') : chalk.hex('#e2e8f0');
                lines.push(`  ${color(displayName)}`);
              }
            }
          }

          lines.push('');
          lines.push(chalk.italic.hex('#64748b')('↑↓ navigate · → to open folder · Enter to select · Esc to close'));
        }
        // 3. NORMAL TEXT PROMPT BOX
        else {
          lines.push(divider);
          const promptSymbol = chalk.bold.white('> ');
          const cursor = chalk.bgWhite.black(' ');

          let textDisplay = '';
          if (inputBuffer.length === 0) {
            textDisplay = chalk.hex('#64748b')(placeholder) + cursor;
          } else {
            textDisplay = chalk.white(inputBuffer) + cursor;
          }

          lines.push(`${promptSymbol}${textDisplay}`);
          lines.push(divider);
          const modeHint = activeMode === 'PLAN' ? chalk.cyan('/plan [PLAN MODE]') : chalk.magenta('/vibe [VIBE MODE]');
          lines.push(chalk.hex('#64748b')(`? shortcuts · ${modeHint} · /profile [${activeProfile}] · @ files`));
        }

        stdout.write(lines.join('\n'));
        this.renderedLines = lines.length;
      };

      const cleanup = () => {
        eraseBox();
        stdin.removeListener('keypress', onKeypress);
        if (isRawSupported) {
          stdin.setRawMode(false);
        }
        stdout.write('\x1b[?25h'); // Restore cursor
      };

      const onKeypress = (str: string, key: readline.Key) => {
        if (!key) {
          if (str) {
            inputBuffer += str;
            selectedIndex = 0;
            fileSelectedIndex = 0;
            render();
          }
          return;
        }

        // Ctrl+C to exit
        if (key.ctrl && key.name === 'c') {
          cleanup();
          process.exit(0);
        }

        // Ctrl+O to inspect tools
        if (key.ctrl && key.name === 'o') {
          cleanup();
          ToolInspector.showDetailedLogs();
          resolve('');
          return;
        }

        // Escape to dismiss popups
        if (key.name === 'escape') {
          const attachInfo = getAttachmentQuery();
          if (attachInfo !== null) {
            inputBuffer = inputBuffer.slice(0, attachInfo.startIndex);
            render();
            return;
          }
          if (inputBuffer.startsWith('/')) {
            inputBuffer = '';
            render();
            return;
          }
        }

        const attachmentInfo = getAttachmentQuery();
        const slashMatches = getMatchingCommands();

        // ------------------ ATTACHMENT PICKER KEYS ------------------
        if (attachmentInfo !== null && !inputBuffer.startsWith('/')) {
          const { items } = FilePickerService.listDirectory(
            this.workingDir,
            attachmentInfo.query
          );

          if (key.name === 'up') {
            if (items.length > 0) {
              fileSelectedIndex = (fileSelectedIndex - 1 + items.length) % items.length;
              render();
            }
            return;
          }

          if (key.name === 'down') {
            if (items.length > 0) {
              fileSelectedIndex = (fileSelectedIndex + 1) % items.length;
              render();
            }
            return;
          }

          if (key.name === 'right' || key.name === 'tab') {
            if (items.length > 0 && fileSelectedIndex < items.length) {
              const selectedItem = items[fileSelectedIndex];
              if (selectedItem.isDirectory) {
                if (selectedItem.name === '../') {
                  const parts = attachmentInfo.query.split(/[/\\]/);
                  parts.pop();
                  parts.pop();
                  const newQ = parts.length > 0 ? parts.join('/') + '/' : '';
                  inputBuffer = inputBuffer.slice(0, attachmentInfo.startIndex + 1) + newQ;
                } else {
                  inputBuffer = inputBuffer.slice(0, attachmentInfo.startIndex + 1) + selectedItem.relativePath;
                }
                fileSelectedIndex = 0;
                render();
                return;
              } else {
                inputBuffer = inputBuffer.slice(0, attachmentInfo.startIndex + 1) + selectedItem.relativePath + ' ';
                fileSelectedIndex = 0;
                render();
                return;
              }
            }
          }

          if (key.name === 'return' || key.name === 'enter') {
            if (items.length > 0 && fileSelectedIndex < items.length) {
              const selectedItem = items[fileSelectedIndex];
              if (selectedItem.isDirectory && selectedItem.name !== '../') {
                inputBuffer = inputBuffer.slice(0, attachmentInfo.startIndex + 1) + selectedItem.relativePath;
                fileSelectedIndex = 0;
                render();
                return;
              } else if (selectedItem.name === '../') {
                const parts = attachmentInfo.query.split(/[/\\]/);
                parts.pop();
                parts.pop();
                const newQ = parts.length > 0 ? parts.join('/') + '/' : '';
                inputBuffer = inputBuffer.slice(0, attachmentInfo.startIndex + 1) + newQ;
                fileSelectedIndex = 0;
                render();
                return;
              } else {
                inputBuffer = inputBuffer.slice(0, attachmentInfo.startIndex + 1) + selectedItem.relativePath + ' ';
                fileSelectedIndex = 0;
                render();
                return;
              }
            }
          }
        }

        // ------------------ SLASH COMMANDS KEYS ------------------
        if (slashMatches.length > 0 && inputBuffer.startsWith('/')) {
          if (key.name === 'up') {
            selectedIndex = (selectedIndex - 1 + slashMatches.length) % slashMatches.length;
            render();
            return;
          }

          if (key.name === 'down') {
            selectedIndex = (selectedIndex + 1) % slashMatches.length;
            render();
            return;
          }

          if (key.name === 'tab') {
            const rawCmd = slashMatches[selectedIndex].name.split(' ')[0];
            inputBuffer = rawCmd;
            selectedIndex = 0;
            render();
            return;
          }

          if (key.name === 'return' || key.name === 'enter') {
            const rawCmd = slashMatches[selectedIndex].name.split(' ')[0];
            const result = rawCmd;
            cleanup();
            resolve(result);
            return;
          }
        }

        // Enter on normal input
        if (key.name === 'return' || key.name === 'enter') {
          const result = inputBuffer;
          cleanup();
          resolve(result);
          return;
        }

        // Backspace
        if (key.name === 'backspace') {
          if (inputBuffer.length > 0) {
            inputBuffer = inputBuffer.slice(0, -1);
            selectedIndex = 0;
            fileSelectedIndex = 0;
            render();
          }
          return;
        }

        // Printable characters
        if (str && !key.ctrl && !key.meta) {
          inputBuffer += str;
          selectedIndex = 0;
          fileSelectedIndex = 0;
          render();
        }
      };

      stdin.on('keypress', onKeypress);
      render();
    });
  }

  public printSubmittedPrompt(prompt: string): void {
    if (!prompt.trim()) return;
    const badge = chalk.bgRgb(43, 38, 86).bold.white(` > ${prompt} `);
    console.log();
    console.log(badge);
    console.log();
  }
}

export const promptBoxReader = new PromptBoxReader();
