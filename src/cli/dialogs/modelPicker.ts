import readline from 'readline';
import chalk from 'chalk';
import { AntriConfig, ModelInfo } from '../../types.js';
import { configManager } from '../../core/config.js';
import { getAvailableModels } from '../../providers/models.js';
import { PROVIDERS_LIST } from './providerPicker.js';
import { log, colors } from '../../utils/logger.js';

/**
 * Interactive Model Picker Dialog matching refrence_model_picker.png
 */
export async function showModelPickerDialog(config: AntriConfig): Promise<ModelInfo | null> {
  const providerName =
    PROVIDERS_LIST.find((p) => p.id === config.provider)?.name || config.provider;

  // Show quick loading indicator while fetching models from provider API
  process.stdout.write(chalk.hex('#64748b')(`Loading models for ${providerName}...\r`));
  const allModels = await getAvailableModels(config);
  process.stdout.write('\x1b[2K\r'); // Clear loading line

  return new Promise((resolve) => {
    let searchQuery = '';
    let selectedIndex = 0;
    let renderedLines = 0;

    // Find initial index matching current model if possible
    const initialIdx = allModels.findIndex((m) => m.id === config.model);
    if (initialIdx !== -1) selectedIndex = initialIdx;

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

    const getFilteredModels = (): ModelInfo[] => {
      if (!searchQuery.trim()) return allModels;
      const q = searchQuery.toLowerCase().trim();
      return allModels.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q)
      );
    };

    const render = () => {
      eraseDialog();

      const filtered = getFilteredModels();
      const totalCount = filtered.length;

      if (selectedIndex >= totalCount) selectedIndex = Math.max(0, totalCount - 1);
      if (selectedIndex < 0) selectedIndex = 0;

      const lines: string[] = [];

      // 1. Header matching refrence_model_picker.png
      lines.push(chalk.bold.hex('#c084fc')('Select model'));
      lines.push(
        chalk.hex('#94a3b8')(
          `Showing models for ${chalk.cyan(providerName)}. Sets the default for new sessions.`
        )
      );
      lines.push('');

      // 2. Search input bar
      const searchPrompt = chalk.bold.white('> ');
      const searchDisplay = searchQuery.length
        ? chalk.white(searchQuery) + chalk.bgWhite.black(' ')
        : chalk.hex('#475569')('Type to search models...');
      lines.push(`${searchPrompt}${searchDisplay}`);
      lines.push('');

      // 3. Paginated Model List (window of up to 10 visible items)
      const pageSize = 10;
      let startIdx = Math.max(0, Math.min(selectedIndex - Math.floor(pageSize / 2), totalCount - pageSize));
      if (startIdx < 0) startIdx = 0;
      const visibleItems = filtered.slice(startIdx, startIdx + pageSize);

      let lastCategory = '';

      if (totalCount === 0) {
        lines.push(chalk.hex('#64748b')('  (No models found matching your search)'));
      } else {
        for (let i = 0; i < visibleItems.length; i++) {
          const item = visibleItems[i];
          const actualIndex = startIdx + i;
          const isSelected = actualIndex === selectedIndex;
          const isCurrent = item.id === config.model;

          // Print category header if changed and not searching
          if (item.category !== lastCategory && !searchQuery.trim()) {
            lastCategory = item.category;
            lines.push(chalk.hex('#64748b')(item.category));
          }

          const col1Width = 30;
          const displayName = item.name.length > col1Width - 2 ? item.name.slice(0, col1Width - 3) + '...' : item.name;
          const col1 = displayName.padEnd(col1Width);
          const col2 = item.description;
          const checkmark = isCurrent ? chalk.green(' √') : '';

          if (isSelected) {
            const rowContent = ` ${col1} ${col2}${checkmark} `;
            lines.push(chalk.bgRgb(46, 41, 84).bold.white(rowContent));
          } else {
            const nameCol = chalk.hex('#e2e8f0')(col1);
            const descCol = chalk.hex('#64748b')(col2);
            lines.push(` ${nameCol} ${descCol}${checkmark}`);
          }
        }
      }

      lines.push('');

      // 4. Pagination status & controls footer
      const endIdx = Math.min(startIdx + pageSize, totalCount);
      const paginationInfo = totalCount > 0
        ? `Showing ${startIdx + 1}-${endIdx} of ${totalCount}${startIdx > 0 ? ' · ↑ more' : ''}${endIdx < totalCount ? ' · ↓ more' : ''}`
        : '0 models';

      lines.push(chalk.hex('#64748b')(paginationInfo));
      lines.push('');
      lines.push(chalk.italic.hex('#64748b')('type to search · ↑/↓ navigate · enter to select · esc to cancel'));

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

    const onKeypress = (str: string, key: readline.Key) => {
      if (!key) {
        if (str) {
          searchQuery += str;
          selectedIndex = 0;
          render();
        }
        return;
      }

      if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        cleanup();
        resolve(null);
        return;
      }

      if (key.name === 'up') {
        const filtered = getFilteredModels();
        if (filtered.length > 0) {
          selectedIndex = (selectedIndex - 1 + filtered.length) % filtered.length;
          render();
        }
        return;
      }

      if (key.name === 'down') {
        const filtered = getFilteredModels();
        if (filtered.length > 0) {
          selectedIndex = (selectedIndex + 1) % filtered.length;
          render();
        }
        return;
      }

      if (key.name === 'backspace') {
        if (searchQuery.length > 0) {
          searchQuery = searchQuery.slice(0, -1);
          selectedIndex = 0;
          render();
        }
        return;
      }

      if (key.name === 'return' || key.name === 'enter') {
        const filtered = getFilteredModels();
        if (filtered.length > 0) {
          const chosen = filtered[selectedIndex];
          cleanup();
          resolve(chosen);
        } else {
          cleanup();
          resolve(null);
        }
        return;
      }

      // Regular character typed into search
      if (str && !key.ctrl && !key.meta) {
        searchQuery += str;
        selectedIndex = 0;
        render();
      }
    };

    stdin.on('keypress', onKeypress);
    render();
  });
}

/**
 * Handles the full model picker workflow
 */
export async function runModelPickerWorkflow(): Promise<void> {
  const currentConfig = configManager.get();
  const chosenModel = await showModelPickerDialog(currentConfig);

  if (chosenModel) {
    configManager.set('model', chosenModel.id);
    if (chosenModel.provider !== currentConfig.provider) {
      configManager.setProvider(chosenModel.provider, chosenModel.id);
    }
    log.success(`Active model switched to ${colors.primary(chosenModel.name)} (${chalk.cyan(chosenModel.id)})`);
  }
}
