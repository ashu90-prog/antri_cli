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

// Self-update command: antri update
program
  .command('update')
  .description('Self-update ANTRI Code CLI to latest release without lockfile churn')
  .action(async () => {
    await Updater.update();
    process.exit(0);
  });

program.parse(normalizedArgv);
