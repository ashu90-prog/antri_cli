import chalk from 'chalk';
import { configManager } from '../core/config.js';
import { AntriAgent } from '../core/agent.js';
import { renderBanner } from './banner.js';
import { ShortcutHandler } from './shortcuts.js';
import { promptBoxReader } from './promptToolkit.js';

export async function startInteractiveSession(initialAgent?: AntriAgent): Promise<void> {
  const config = configManager.get();
  const agent = initialAgent || new AntriAgent(config);
  const shortcutHandler = new ShortcutHandler(agent);

  // Clear screen and show banner matching Home.png
  console.clear();
  renderBanner(config);

  // Continuous REPL loop - runs indefinitely until user exits
  while (true) {
    try {
      const currentConfig = configManager.get();
      promptBoxReader.updateModel(currentConfig.model);
      promptBoxReader.updateWorkingDir(currentConfig.workingDir);

      // Read boxed prompt with live prompt_toolkit autocomplete on '/'
      const input = await promptBoxReader.readPrompt('Ask your question...');
      const trimmed = (input || '').trim();

      if (!trimmed) {
        continue;
      }

      // Check shortcuts and slash commands
      const shortcutResult = await shortcutHandler.handle(trimmed, currentConfig);

      if (shortcutResult.shouldExit) {
        break;
      }

      if (shortcutResult.shouldClear) {
        continue;
      }

      if (shortcutResult.handled) {
        console.log();
        continue;
      }

      // Check authentication requirement before processing chat
      const { AuthManager } = await import('../cloud/auth.js');
      if (!AuthManager.isAuthenticated()) {
        console.log(chalk.bold.hex('#f43f5e')('\n🔒 AUTHENTICATION REQUIRED'));
        console.log(chalk.hex('#cbd5e1')('You must be logged into an ANTRI account to chat, execute tools, and synchronize profiles across devices.'));
        console.log(chalk.hex('#38bdf8')('👉 Please log in by typing: /login <your-email> (or /register <email> <password>)\n'));
        continue;
      }

      // Output single user prompt badge pill for chat queries
      promptBoxReader.printSubmittedPrompt(trimmed);

      // Normal chat query to the agent
      const reply = await agent.chat(trimmed);
      if (reply && !reply.startsWith('Request failed:') && !reply.startsWith('* Worked for')) {
        // If message was not already streamed to stdout by onToken
      }
      // Next iteration of loop will render the active prompt box at the new bottom!
    } catch (err: any) {
      console.error(chalk.red(`\nError: ${err.message}\n`));
    }
  }

  process.exit(0);
}
