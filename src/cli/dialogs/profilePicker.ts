import readline from 'readline';
import chalk from 'chalk';
import { profileManager } from '../../profiles/profileManager.js';
import { ProfileInfo } from '../../types.js';
import { log } from '../../utils/logger.js';

export class ProfilePicker {
  private profiles: ProfileInfo[] = [];
  private searchQuery: string = '';
  private selectedIndex: number = 0;
  private renderedLines: number = 0;

  constructor() {
    this.profiles = profileManager.listProfiles();
  }

  public async run(): Promise<string | null> {
    this.profiles = profileManager.listProfiles();
    this.searchQuery = '';
    this.selectedIndex = 0;

    return new Promise((resolve) => {
      const stdin = process.stdin;
      const stdout = process.stdout;

      readline.emitKeypressEvents(stdin);
      const isRawSupported = stdin.isTTY && typeof stdin.setRawMode === 'function';
      if (isRawSupported) {
        stdin.setRawMode(true);
      }
      stdin.resume();

      stdout.write('\x1b[?25l'); // Hide cursor

      const erase = () => {
        if (this.renderedLines > 0) {
          stdout.write('\x1b[2K\r');
          for (let i = 1; i < this.renderedLines; i++) {
            stdout.write('\x1b[1A\x1b[2K\r');
          }
          this.renderedLines = 0;
        }
      };

      const getFilteredOptions = (): { type: 'create' | 'profile'; data?: ProfileInfo; label: string }[] => {
        const options: { type: 'create' | 'profile'; data?: ProfileInfo; label: string }[] = [
          { type: 'create', label: '➕ [Create New Profile]' },
        ];

        const q = this.searchQuery.toLowerCase();
        const filteredProfiles = this.profiles.filter((p) => p.name.toLowerCase().includes(q));

        for (const p of filteredProfiles) {
          options.push({
            type: 'profile',
            data: p,
            label: `${p.name} ${p.isActive ? chalk.hex('#a5b4fc')('(active)') : ''} · ${chalk.gray(`${p.notesCount} notes`)}`,
          });
        }

        return options;
      };

      const render = () => {
        erase();

        const lines: string[] = [];
        const options = getFilteredOptions();
        const activeName = profileManager.getActiveProfileName();

        if (this.selectedIndex >= options.length) this.selectedIndex = Math.max(0, options.length - 1);
        if (this.selectedIndex < 0) this.selectedIndex = 0;

        lines.push(chalk.bold.hex('#c084fc')(`👤 Select Profile (Active: ${activeName})`));
        lines.push(chalk.hex('#475569')('─'.repeat(68)));

        // Search bar
        const searchDisplay = this.searchQuery
          ? chalk.white(this.searchQuery)
          : chalk.hex('#64748b')('Search profiles or select create...');
        lines.push(`🔍 ${searchDisplay}`);
        lines.push(chalk.hex('#475569')('─'.repeat(68)));

        const maxVisible = 10;
        const startIdx = Math.max(0, Math.min(this.selectedIndex - Math.floor(maxVisible / 2), options.length - maxVisible));
        const visibleOptions = options.slice(startIdx, startIdx + maxVisible);

        for (let i = 0; i < visibleOptions.length; i++) {
          const opt = visibleOptions[i];
          const actualIdx = startIdx + i;
          const isSelected = actualIdx === this.selectedIndex;

          if (isSelected) {
            lines.push(chalk.bgRgb(46, 41, 84).bold.white(`  ❯ ${opt.label} `));
          } else {
            lines.push(`    ${opt.label}`);
          }
        }

        lines.push(chalk.hex('#475569')('─'.repeat(68)));
        lines.push(chalk.italic.hex('#64748b')('↑↓ to navigate · Enter to select/create · Esc to cancel'));

        stdout.write(lines.join('\n'));
        this.renderedLines = lines.length;
      };

      const cleanup = () => {
        erase();
        stdin.removeListener('keypress', onKeypress);
        if (isRawSupported) {
          stdin.setRawMode(false);
        }
        stdout.write('\x1b[?25h'); // Restore cursor
      };

      const onKeypress = async (str: string, key: readline.Key) => {
        if (!key) {
          if (str) {
            this.searchQuery += str;
            this.selectedIndex = 0;
            render();
          }
          return;
        }

        if (key.ctrl && key.name === 'c') {
          cleanup();
          process.exit(0);
        }

        if (key.name === 'escape') {
          cleanup();
          resolve(null);
          return;
        }

        const options = getFilteredOptions();

        if (key.name === 'up') {
          if (options.length > 0) {
            this.selectedIndex = (this.selectedIndex - 1 + options.length) % options.length;
            render();
          }
          return;
        }

        if (key.name === 'down') {
          if (options.length > 0) {
            this.selectedIndex = (this.selectedIndex + 1) % options.length;
            render();
          }
          return;
        }

        if (key.name === 'return' || key.name === 'enter') {
          const selected = options[this.selectedIndex];
          cleanup();

          if (selected.type === 'create') {
            const newName = await this.promptForNewProfileName();
            if (newName) {
              profileManager.createProfile(newName);
              log.success(`Created and switched to new profile: ${chalk.cyan(newName)}!`);
              resolve(newName);
            } else {
              resolve(null);
            }
          } else if (selected.data) {
            profileManager.setActiveProfile(selected.data.name);
            log.success(`Switched active profile to: ${chalk.cyan(selected.data.name)}!`);
            resolve(selected.data.name);
          } else {
            resolve(null);
          }
          return;
        }

        if (key.name === 'backspace') {
          if (this.searchQuery.length > 0) {
            this.searchQuery = this.searchQuery.slice(0, -1);
            this.selectedIndex = 0;
            render();
          }
          return;
        }

        if (str && !key.ctrl && !key.meta) {
          this.searchQuery += str;
          this.selectedIndex = 0;
          render();
        }
      };

      stdin.on('keypress', onKeypress);
      render();
    });
  }

  private async promptForNewProfileName(): Promise<string | null> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((res) => {
      console.log();
      rl.question(chalk.bold.hex('#c084fc')('Enter name for new profile (e.g. profile_2, architect, backend_dev): '), (ans) => {
        rl.close();
        res(ans.trim() || null);
      });
    });
  }
}

export async function runProfilePickerWorkflow(): Promise<string | null> {
  const picker = new ProfilePicker();
  return await picker.run();
}
