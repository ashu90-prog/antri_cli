#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { configManager } from './core/config.js';
import { AntriAgent } from './core/agent.js';
import { startInteractiveSession } from './cli/prompt.js';
import { renderBanner, renderDivider } from './cli/banner.js';
import { DebateDepth, ProviderType, AgentMode } from './types.js';
import { DialecticEngine } from './core/dialectic.js';
import { GoalLoopEngine } from './core/goalLoop.js';
import { Updater } from './core/updater.js';
import { DesktopServer } from './desktop/server.js';
import { MobileServer } from './mobile/server.js';

// Pre-process argv to support -alwaysallow syntax
const normalizedArgv = process.argv.map((arg) => {
  if (arg === '-alwaysallow' || arg === '-always-allow') {
    return '--alwaysallow';
  }
  return arg;
});

const program = new Command();
const currentConfig = configManager.get();

program
  .name('antri')
  .description('ANTRI Code - An intelligent, terminal-first AI coding chatbot, proactive facilitator, and autonomous meta-agent')
  .version(currentConfig.version, '-v, --version', 'Output the current version')
  .option('-p, --prompt <text>', 'One-shot prompt to process directly')
  .option('-g, --goal <objective>', 'Run autonomous multi-iteration goal execution & refinement loop')
  .option('-d, --debate <query>', 'Trigger Dialectic Engine multi-persona self-debate & consensus')
  .option('--depth <level>', 'Set debate depth: quick, deep, or rigorous', 'deep')
  .option('--mode <mode>', 'Operating mode: "plan" (collaborative design) or "vibe" (direct coding)')
  .option('--alwaysallow', 'Always allow sensitive tools (web search, shell execution, python) without prompting')
  .option('--desktop', 'Launch the lightweight ANTRI Desktop Control Plane in app mode')
  .option('--mobile', 'Launch the standalone ANTRI Mobile App server')
  .option('-m, --model <name>', 'Specify model to use (e.g. meta/llama-3.1-8b-instruct, gpt-4o, claude-3-7-sonnet)')
  .option('--provider <name>', 'Specify provider (cerebras, cohere, vortex, opencode, nvidia-nim, openai, gemini, anthropic, ollama, deepseek, mock)')
  .option('-w, --dir <path>', 'Working directory for workspace tools', process.cwd())
  .action(async (options) => {
    // Override configs with CLI options if provided
    if (options.model) {
      configManager.set('model', options.model);
    }
    if (options.provider) {
      configManager.setProvider(options.provider as ProviderType, options.model);
    }
    if (options.dir) {
      configManager.set('workingDir', options.dir);
    }
    if (options.depth && ['quick', 'deep', 'rigorous'].includes(options.depth.toLowerCase())) {
      configManager.set('debateDepth', options.depth.toLowerCase() as DebateDepth);
    }
    if (options.mode && ['plan', 'vibe'].includes(options.mode.toLowerCase())) {
      configManager.setMode(options.mode.toLowerCase() as AgentMode);
    }
    if (options.alwaysallow) {
      configManager.setAlwaysAllow(true);
    }

    const config = configManager.get();

    // 0a. Desktop Mode Flag
    if (options.desktop) {
      await DesktopServer.launchDesktop();
      return;
    }

    // 0b. Mobile Mode Flag
    if (options.mobile) {
      await MobileServer.launchMobile();
      return;
    }

    // 1. Goal Loop CLI Mode
    if (options.goal) {
      renderBanner(config);
      const goalEngine = new GoalLoopEngine(config);
      await goalEngine.runGoal(options.goal);
      process.exit(0);
    }

    // 2. Dialectic Debate CLI Mode
    if (options.debate) {
      renderBanner(config);
      const engine = new DialecticEngine(config);
      await engine.debate(options.debate, config.debateDepth || 'deep');
      process.exit(0);
    }

    // 3. One-shot Prompt CLI Mode
    if (options.prompt) {
      const agent = new AntriAgent(config);
      renderBanner(config);
      renderDivider();
      console.log(chalk.bold.white(`> ${options.prompt}\n`));
      await agent.chat(options.prompt);
      console.log();
      renderDivider();
      process.exit(0);
    }

    // 4. Full Continuous Interactive REPL Session
    const agent = new AntriAgent(config);
    await startInteractiveSession(agent);
  });

// Desktop App Command: antri desktop
program
  .command('desktop')
  .description('Launch the lightweight ANTRI Desktop Control Plane')
  .action(async () => {
    await DesktopServer.launchDesktop();
  });

// Mobile App Command: antri mobile
program
  .command('mobile')
  .description('Launch the standalone ANTRI Mobile App server')
  .action(async () => {
    await MobileServer.launchMobile();
  });

// Google Cloud Firestore Sync command: antri sync [push|pull|config]
program
  .command('sync [action] [param1] [param2]')
  .description('Synchronize Thinking Profiles and Memory with Google Cloud Firestore')
  .action(async (action, param1, param2) => {
    const { FirestoreSyncManager } = await import('./cloud/firestore.js');
    if (action === 'config') {
      const projectId = param1 || '';
      const syncKey = param2 || 'default_user';
      FirestoreSyncManager.saveSyncConfig(projectId, syncKey);
      console.log(chalk.green(`Google Cloud Firestore sync configured for project: ${chalk.bold.white(projectId)} (Key: ${syncKey})`));
      return;
    }
    if (action === 'push') {
      console.log(chalk.cyan('Pushing local profiles to Google Cloud Firestore...'));
      const res = await FirestoreSyncManager.pushToFirestore();
      if (res.success) {
        console.log(chalk.green(`Successfully pushed ${res.count} profiles to Google Cloud Firestore.`));
      } else {
        console.log(chalk.red(`Sync failed: ${res.error}`));
      }
      return;
    }
    if (action === 'pull') {
      console.log(chalk.cyan('Pulling profiles from Google Cloud Firestore...'));
      const res = await FirestoreSyncManager.pullFromFirestore();
      if (res.success) {
        console.log(chalk.green(`Successfully pulled ${res.count} profiles from Google Cloud Firestore.`));
      } else {
        console.log(chalk.red(`Pull failed: ${res.error}`));
      }
      return;
    }

    // Default status
    const cfg = FirestoreSyncManager.getSyncConfig();
    console.log(chalk.bold.hex('#c084fc')('\n☁️ Google Cloud Firestore Sync Status'));
    console.log(`• Project ID:  ${cfg.projectId ? chalk.green(cfg.projectId) : chalk.yellow('Not configured (Run "antri sync config <project-id>")')}`);
    console.log(`• Sync Key:    ${chalk.cyan(cfg.syncKey)}`);
    console.log(`• Last Synced: ${chalk.gray(cfg.lastSynced || 'Never')}`);
    console.log(chalk.hex('#64748b')('\nCommands:\n  antri sync config <gcp-project-id> [sync-key]\n  antri sync push\n  antri sync pull\n'));
  });

// Account Auth Commands: antri login / antri register / antri whoami / antri logout
program
  .command('login [email]')
  .description('Log in to your ANTRI account via Google / Email web UI or CLI')
  .action(async (email) => {
    if (!email) {
      const { BrowserAuthServer } = await import('./cloud/browserAuth.js');
      const user = await BrowserAuthServer.startLoginFlow();
      if (user) {
        console.log(chalk.green(`\n✅ Authenticated as: ${chalk.bold.white(user.email)} (Partition: ${user.userId})`));
        console.log(chalk.gray('Your private thinking profiles and memory are now active and synced to your account.\n'));
      }
      return;
    }

    const { AuthManager } = await import('./cloud/auth.js');
    const res = await AuthManager.login(email);
    if (res.success && res.user) {
      console.log(chalk.green(`\n✅ Logged in as: ${chalk.bold.white(res.user.email)} (Partition: ${res.user.userId})`));
      console.log(chalk.gray('Your private thinking profiles and memory are now active and synced to your account.\n'));
    } else {
      console.log(chalk.red(`\n❌ Login failed: ${res.error}\n`));
    }
  });

program
  .command('whoami')
  .description('Show currently authenticated ANTRI user account')
  .action(async () => {
    const { AuthManager } = await import('./cloud/auth.js');
    const user = AuthManager.getCurrentUser();
    if (user) {
      console.log(chalk.bold.hex('#c084fc')('\n👤 Active Account'));
      console.log(`• Email:     ${chalk.green(user.email)}`);
      console.log(`• User ID:   ${chalk.cyan(user.userId)}`);
      console.log(`• Logged In: ${chalk.gray(user.loggedInAt)}\n`);
    } else {
      console.log(chalk.yellow('\nℹ Not logged in. Using local profile storage. Run "antri login <email>" to sign in.\n'));
    }
  });

program
  .command('logout')
  .description('Log out from your ANTRI account')
  .action(async () => {
    const { AuthManager } = await import('./cloud/auth.js');
    AuthManager.logout();
    console.log(chalk.green('\n✅ Logged out successfully. Reverted to local session.\n'));
  });

// Autonomous project bug fix command: antri fix [description]
program
  .command('fix [description...]')
  .description('Automatically diagnose and repair bugs, failing tests, or syntax errors in the current project')
  .action(async (descriptionArgs) => {
    const description = descriptionArgs && descriptionArgs.length > 0 ? descriptionArgs.join(' ') : undefined;
    const { ProjectBugFixer } = await import('./core/fixer.js');
    const res = await ProjectBugFixer.runFix(description);
    if (!res.success && res.reason !== 'verification_failed') {
      process.exit(1);
    }
  });

// ANTRI Health & Self-Healing Doctor command: antri doctor / antri selfheal
program
  .command('doctor')
  .alias('selfheal')
  .description('Run ANTRI system health checks, repair local storage, and diagnose blocking bugs')
  .action(async () => {
    const { SelfDebugger } = await import('./core/debugger.js');
    const config = configManager.get();
    await SelfDebugger.runSelfDoctor(config);
  });

// Self-update command: antri update
program
  .command('update')
  .description('Self-update ANTRI Code CLI to latest release without lockfile churn')
  .action(async () => {
    await Updater.update();
    process.exit(0);
  });

program.parse(normalizedArgv);

