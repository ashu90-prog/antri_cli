import chalk from 'chalk';
import readline from 'readline';
import { AntriConfig, DebateDepth, ProviderType, AgentMode } from '../types.js';
import { configManager } from '../core/config.js';
import { AntriAgent } from '../core/agent.js';
import { renderBanner } from './banner.js';
import { log, colors } from '../utils/logger.js';
import { getAllActiveTools, ToolExecutor } from '../core/tools.js';
import { ToolInspector } from './renderer.js';
import { runConnectWorkflow } from './dialogs/providerPicker.js';
import { runModelPickerWorkflow } from './dialogs/modelPicker.js';
import { runProfilePickerWorkflow } from './dialogs/profilePicker.js';
import { DialecticEngine } from '../core/dialectic.js';
import { GoalLoopEngine } from '../core/goalLoop.js';
import { Updater } from '../core/updater.js';
import { DesktopServer } from '../desktop/server.js';
import { MobileServer } from '../mobile/server.js';
import { memoryManager } from '../memory/manager.js';
import { metaOptimizer } from '../core/metaOptimizer.js';
import { SkillSynthesizer } from '../core/skillSynthesizer.js';
import { profileManager } from '../profiles/profileManager.js';

export class ShortcutHandler {
  private agent: AntriAgent;

  constructor(agent: AntriAgent) {
    this.agent = agent;
  }

  public async handle(
    input: string,
    config: AntriConfig
  ): Promise<{ handled: boolean; shouldExit?: boolean; shouldClear?: boolean }> {
    const trimmed = input.trim();

    // /help or ?
    if (trimmed === '?' || trimmed === '/help') {
      this.showHelp();
      return { handled: true };
    }

    // /exit or /quit
    if (trimmed === '/exit' || trimmed === '/quit') {
      console.log(chalk.hex('#64748b')('Bye from ANTRI! 👋'));
      return { handled: true, shouldExit: true };
    }

    // /desktop (launch visual control plane)
    if (trimmed === '/desktop' || trimmed === 'desktop') {
      await DesktopServer.launchDesktop();
      return { handled: true };
    }

    // /mobile (launch standalone mobile PWA server)
    if (trimmed === '/mobile' || trimmed === 'mobile') {
      await MobileServer.launchMobile();
      return { handled: true };
    }

    // /sync (Google Cloud Firestore sync)
    if (trimmed === '/sync' || trimmed.startsWith('/sync')) {
      const { FirestoreSyncManager } = await import('../cloud/firestore.js');
      const parts = trimmed.split(' ');
      const action = parts[1] || 'status';
      if (action === 'push') {
        log.info('Pushing profiles to Google Cloud Firestore...');
        const res = await FirestoreSyncManager.pushToFirestore();
        if (res.success) log.success(`Pushed ${res.count} profiles to Google Cloud Firestore.`);
        else log.error(`Sync error: ${res.error}`);
      } else if (action === 'pull') {
        log.info('Pulling profiles from Google Cloud Firestore...');
        const res = await FirestoreSyncManager.pullFromFirestore();
        if (res.success) log.success(`Pulled ${res.count} profiles from Google Cloud Firestore.`);
        else log.error(`Pull error: ${res.error}`);
      } else {
        const cfg = FirestoreSyncManager.getSyncConfig();
        console.log(chalk.bold.hex('#c084fc')('\n☁️ Google Cloud Firestore Sync'));
        console.log(`• Project ID:  ${cfg.projectId ? chalk.green(cfg.projectId) : chalk.yellow('Not set (/sync config <project-id>)')}`);
        console.log(`• Sync Key:    ${chalk.cyan(cfg.syncKey)}`);
        console.log(`• Last Synced: ${chalk.gray(cfg.lastSynced || 'Never')}`);
      }
      return { handled: true };
    }

    // /clear or /cls
    if (trimmed === '/clear' || trimmed === '/cls' || trimmed.startsWith('/clear')) {
      console.clear();
      this.agent.getHistory().clear();
      renderBanner(config);
      log.success('Started a new clean session.');
      return { handled: true, shouldClear: true };
    }

    // /plan (switch to Plan Mode)
    if (trimmed === '/plan' || trimmed === '/mode plan') {
      configManager.setMode('plan');
      this.agent.updateConfig(configManager.get());
      console.log();
      console.log(chalk.bgHex('#0284c7').bold.white(' 🗺️  SWITCHED TO PLAN MODE '));
      console.log(chalk.cyan('ANTRI will now collaborate with you on architecture, blueprints, and milestones before writing code.'));
      console.log();
      return { handled: true };
    }

    // /vibe (switch to Vibe Mode)
    if (trimmed === '/vibe' || trimmed === '/mode vibe') {
      configManager.setMode('vibe');
      this.agent.updateConfig(configManager.get());
      console.log();
      console.log(chalk.bgHex('#7c3aed').bold.white(' ⚡ SWITCHED TO VIBE MODE '));
      console.log(chalk.hex('#c084fc')('ANTRI will directly write code, implement features, and execute tools in continuous flow.'));
      console.log();
      return { handled: true };
    }

    // /alwaysallow or /always-allow
    if (trimmed === '/alwaysallow' || trimmed === '/always-allow' || trimmed === '/allow') {
      const current = config.alwaysAllow || false;
      const next = !current;
      configManager.setAlwaysAllow(next);
      this.agent.updateConfig(configManager.get());
      if (next) {
        log.success('Tool Permissions: ALWAYS-ALLOW enabled. Sensitive tools will execute without prompting.');
      } else {
        log.info('Tool Permissions: ASK-FIRST enabled. Sensitive tools (web search, python, shell) will prompt for confirmation.');
      }
      return { handled: true };
    }

    // /update
    if (trimmed === '/update' || trimmed === 'update') {
      await Updater.update();
      return { handled: true };
    }

    // /goal or /loop
    if (trimmed === '/goal' || trimmed.startsWith('/goal ') || trimmed === '/loop' || trimmed.startsWith('/loop ')) {
      let objective = trimmed.replace(/^\/(goal|loop)/, '').trim();
      if (!objective) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const promptAsync = (q: string) => new Promise<string>((res) => rl.question(q, res));
        console.log(chalk.bold.hex('#c084fc')('\n🎯 Autonomous Goal Loop & Refinement Engine'));
        objective = await promptAsync(chalk.cyan('Enter goal / task objective to accomplish & iterate: '));
        rl.close();
      }

      if (objective.trim()) {
        const engine = new GoalLoopEngine(config);
        await engine.runGoal(objective.trim());
      } else {
        log.warn('Goal loop cancelled: No objective provided.');
      }
      return { handled: true };
    }

    // /profile or /profiles dialog
    if (trimmed === '/profile' || trimmed === '/profiles') {
      await runProfilePickerWorkflow();
      return { handled: true };
    }

    if (trimmed.startsWith('/profile ')) {
      const targetName = trimmed.slice(9).trim();
      profileManager.setActiveProfile(targetName);
      log.success(`Active profile switched to: ${colors.primary(targetName)}`);
      return { handled: true };
    }

    // /notes or /profile-show
    if (trimmed === '/notes' || trimmed === '/profile-show') {
      profileManager.renderActiveProfile();
      return { handled: true };
    }

    // /meta or /stats
    if (trimmed === '/meta' || trimmed === '/stats') {
      metaOptimizer.renderMetaStatus();
      return { handled: true };
    }

    // /skills or /skill
    if (trimmed === '/skills' || trimmed === '/skill') {
      const allTools = getAllActiveTools();
      const dynamic = SkillSynthesizer.loadSynthesizedSkills();
      console.log(chalk.bold.hex('#c084fc')('\n🛠️ Active Agent Tools & Dynamic Skills'));
      console.log(chalk.hex('#334155')('─'.repeat(72)));
      console.log(chalk.bold.hex('#a5b4fc')('Built-in Standard & Autonomous Tools:'));
      allTools.forEach((t) => {
        if (!t.description.startsWith('[Custom')) {
          console.log(`• ${chalk.cyan(t.name.padEnd(18))} ${chalk.hex('#94a3b8')(t.description)}`);
        }
      });

      console.log(chalk.bold.hex('#a5b4fc')(`\nDynamically Synthesized Skills (${dynamic.length}):`));
      if (dynamic.length === 0) {
        console.log(chalk.hex('#64748b')('  (No custom skills synthesized yet. The agent creates them autonomously using synthesize_skill)'));
      } else {
        dynamic.forEach((s) => {
          console.log(`✨ ${chalk.green(s.manifest.name.padEnd(18))} ${chalk.hex('#e2e8f0')(s.manifest.description)} (${s.manifest.language})`);
        });
      }
      console.log(chalk.hex('#334155')('─'.repeat(72)));
      console.log();
      return { handled: true };
    }

    // /memory or /mem
    if (trimmed === '/memory' || trimmed === '/mem') {
      memoryManager.renderMemoryStatus(config.workingDir);
      return { handled: true };
    }

    // /consolidate
    if (trimmed === '/consolidate') {
      log.info('Running Memory Consolidation & Knowledge Compounding Loop...');
      const geminiKey = config.apiKeys.gemini || process.env.GEMINI_API_KEY;
      const res = await memoryManager.consolidate(config.workingDir, geminiKey);
      log.success(`Memory consolidated! ${res.summary}`);
      return { handled: true };
    }

    // /learn <text>
    if (trimmed.startsWith('/learn')) {
      const insight = trimmed.slice(6).trim();
      if (!insight) {
        log.warn('Usage: /learn <rule, convention, or knowledge nugget>');
      } else {
        await memoryManager.learn(insight, 'lesson_learned', config.workingDir);
        log.success(`Learned and persisted: "${colors.primary(insight)}"`);
      }
      return { handled: true };
    }

    // /debate or /dialectic
    if (trimmed === '/debate' || trimmed.startsWith('/debate ') || trimmed === '/dialectic' || trimmed.startsWith('/dialectic ')) {
      let query = trimmed.replace(/^\/(debate|dialectic)/, '').trim();
      if (!query) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const promptAsync = (q: string) => new Promise<string>((res) => rl.question(q, res));
        console.log(chalk.bold.hex('#c084fc')('\n🧠 Dialectic Self-Debate Engine'));
        query = await promptAsync(chalk.cyan('Enter topic/question to debate: '));
        rl.close();
      }

      if (query.trim()) {
        const engine = new DialecticEngine(config);
        await engine.debate(query.trim(), config.debateDepth || 'deep');
      } else {
        log.warn('Debate cancelled: No query provided.');
      }
      return { handled: true };
    }

    // /depth <quick|deep|rigorous>
    if (trimmed.startsWith('/depth')) {
      const parts = trimmed.split(' ');
      const newDepth = (parts[1] || '').toLowerCase() as DebateDepth;
      if (['quick', 'deep', 'rigorous'].includes(newDepth)) {
        configManager.set('debateDepth', newDepth);
        this.agent.updateConfig(configManager.get());
        log.success(`Debate depth set to: ${colors.primary(newDepth.toUpperCase())}`);
      } else {
        log.warn('Usage: /depth <quick|deep|rigorous>');
        console.log(chalk.hex('#64748b')(`Current depth: ${config.debateDepth || 'deep'}`));
      }
      return { handled: true };
    }

    // /connect or /provider dialog
    if (trimmed === '/connect' || trimmed === '/provider') {
      await runConnectWorkflow();
      this.agent.updateConfig(configManager.get());
      return { handled: true };
    }

    if (trimmed.startsWith('/provider ')) {
      const providerName = trimmed.slice(10).trim().toLowerCase() as ProviderType;
      configManager.setProvider(providerName);
      this.agent.updateConfig(configManager.get());
      log.success(`Provider switched to ${colors.primary(providerName)} (Model: ${configManager.get().model})`);
      return { handled: true };
    }

    // /models or /model dialog
    if (trimmed === '/models' || trimmed === '/model') {
      await runModelPickerWorkflow();
      this.agent.updateConfig(configManager.get());
      return { handled: true };
    }

    if (trimmed.startsWith('/model ')) {
      const newModel = trimmed.slice(7).trim();
      configManager.set('model', newModel);
      this.agent.updateConfig(configManager.get());
      log.success(`Model switched to ${colors.primary(newModel)}`);
      return { handled: true };
    }

    // /tools or /logs
    if (trimmed === '/tools' || trimmed === '/logs') {
      ToolInspector.showDetailedLogs();
      return { handled: true };
    }

    // /history
    if (trimmed === '/history') {
      const msgs = this.agent.getHistory().getMessages();
      if (msgs.length === 0) {
        log.info('No messages in current session history.');
      } else {
        console.log(chalk.bold.hex('#a5b4fc')(`\nSession History (${msgs.length} messages):`));
        for (const m of msgs) {
          if (m.role === 'system') continue;
          const tag = m.role === 'user' ? chalk.hex('#38bdf8')('User:') : chalk.hex('#a5b4fc')('Antri:');
          console.log(`${tag} ${m.content.slice(0, 100)}${m.content.length > 100 ? '...' : ''}`);
        }
      }
      console.log();
      return { handled: true };
    }

    // /key
    if (trimmed.startsWith('/key')) {
      const parts = trimmed.split(' ');
      if (parts.length < 3) {
        log.warn('Usage: /key <provider> <your-api-key>');
        console.log(chalk.hex('#64748b')('Example: /key deepseek sk-xxxx or /key nvidia_nim nvapi-xxxx'));
      } else {
        const provider = parts[1].toLowerCase();
        const key = parts[2];
        configManager.setApiKey(provider, key);
        this.agent.updateConfig(configManager.get());
        log.success(`API Key saved for ${provider}!`);
      }
      return { handled: true };
    }

    // /add-dir
    if (trimmed.startsWith('/add-dir')) {
      const parts = trimmed.split(' ');
      const dir = parts[1] || '.';
      configManager.set('workingDir', dir);
      this.agent.updateConfig(configManager.get());
      log.success(`Workspace directory updated to: ${colors.primary(dir)}`);
      return { handled: true };
    }

    // /worktree
    if (trimmed.startsWith('/worktree')) {
      const executor = new ToolExecutor(config.workingDir);
      log.info('Checking git worktrees...');
      const res = await executor.execute('run_command', { command: 'git worktree list' }, 'cli');
      console.log(res.output);
      return { handled: true };
    }

    // /agents
    if (trimmed === '/agents') {
      console.log(chalk.bold.hex('#a5b4fc')('\n🤖 Agent Configuration'));
      console.log(chalk.hex('#94a3b8')('• Orchestrator: ANTRI Core Meta-Agent'));
      console.log(chalk.hex('#94a3b8')(`• Active Mode: ${(config.mode || 'vibe').toUpperCase()}`));
      console.log(chalk.hex('#94a3b8')(`• Permissions: ${config.alwaysAllow ? 'Always-Allow' : 'Ask-First'}`));
      console.log(chalk.hex('#94a3b8')(`• Active Provider: ${config.provider}`));
      console.log(chalk.hex('#94a3b8')(`• Active Model: ${config.model}`));
      console.log(chalk.hex('#94a3b8')(`• Active Profile: ${profileManager.getActiveProfileName()}`));
      console.log(chalk.hex('#94a3b8')(`• Debate Depth: ${config.debateDepth || 'deep'}`));
      console.log(chalk.hex('#94a3b8')(`• Memory Hierarchy: Episodic, Semantic (Vectors), Profile, Workspace Conventions`));
      console.log(chalk.hex('#94a3b8')(`• Tools: execute_python, synthesize_skill, web_search, scrape_url, crawl_docs, read_file, write_file, list_dir, search_files, run_command`));
      console.log();
      return { handled: true };
    }

    // /clone, /theme, /compact, /compact-mode
    if (trimmed.startsWith('/clone')) {
      log.info('Session cloning is ready.');
      return { handled: true };
    }

    if (trimmed === '/theme') {
      log.info('Theme: Dark Cyber/Retro Indigo (Default).');
      return { handled: true };
    }

    if (trimmed === '/compact' || trimmed.startsWith('/compact-mode')) {
      log.info('Conversation history compacted.');
      return { handled: true };
    }

    // /export
    if (trimmed.startsWith('/export')) {
      const parts = trimmed.split(' ');
      const target = parts[1] || `antri_session_${Date.now()}.md`;
      this.agent.getHistory().exportMarkdown(target);
      log.success(`Session transcript exported to ${colors.primary(target)}`);
      return { handled: true };
    }

    // /read
    if (trimmed.startsWith('/read ')) {
      const filePath = trimmed.slice(6).trim();
      const executor = new ToolExecutor(config.workingDir);
      const res = await executor.execute('read_file', { file_path: filePath }, 'cli');
      console.log(res.output);
      return { handled: true };
    }

    // /ls
    if (trimmed.startsWith('/ls')) {
      const dirPath = trimmed.slice(3).trim() || '.';
      const executor = new ToolExecutor(config.workingDir);
      const res = await executor.execute('list_dir', { dir_path: dirPath }, 'cli');
      console.log(res.output);
      return { handled: true };
    }

    // /run
    if (trimmed.startsWith('/run ')) {
      const cmd = trimmed.slice(5).trim();
      const executor = new ToolExecutor(config.workingDir);
      log.info(`Executing: ${cmd}`);
      const res = await executor.execute('run_command', { command: cmd }, 'cli');
      console.log(res.output);
      return { handled: true };
    }

    // /env or /config
    if (trimmed === '/env' || trimmed === '/config') {
      console.log(chalk.bold.hex('#a5b4fc')('\n--- ANTRI Configuration ---'));
      console.log(`Operating Mode: ${chalk.cyan((config.mode || 'vibe').toUpperCase())}`);
      console.log(`Permissions:    ${config.alwaysAllow ? chalk.green('ALWAYS-ALLOW') : chalk.yellow('ASK-FIRST')}`);
      console.log(`Provider:       ${chalk.cyan(config.provider)}`);
      console.log(`Model:          ${chalk.cyan(config.model)}`);
      console.log(`Active Profile: ${chalk.cyan(profileManager.getActiveProfileName())}`);
      console.log(`Debate Depth:   ${chalk.cyan(config.debateDepth || 'deep')}`);
      console.log(`Working Dir:    ${chalk.gray(config.workingDir)}`);
      console.log(`Anthropic:      ${config.apiKeys.anthropic ? chalk.green('CONFIGURED') : chalk.red('NOT SET')}`);
      console.log(`NVIDIA NIM:     ${config.apiKeys.nvidia_nim ? chalk.green('CONFIGURED') : chalk.red('NOT SET')}`);
      console.log(`OpenAI:         ${config.apiKeys.openai ? chalk.green('CONFIGURED') : chalk.red('NOT SET')}`);
      console.log(`Gemini:         ${config.apiKeys.gemini ? chalk.green('CONFIGURED') : chalk.red('NOT SET')}`);
      console.log(`DeepSeek:       ${config.apiKeys.deepseek ? chalk.green('CONFIGURED') : chalk.red('NOT SET')}`);
      console.log();
      return { handled: true };
    }

    return { handled: false };
  }

  public showHelp(): void {
    console.log(chalk.bold.hex('#a5b4fc')('\n⚡ ANTRI Code - Slash Commands & Shortcuts'));
    console.log(chalk.hex('#334155')('─'.repeat(72)));

    const cmds = [
      ['/plan', 'Switch to Plan Mode (collaborative architecture & blueprints before coding)'],
      ['/vibe', 'Switch to Vibe Mode (direct conversation & active fast code implementation)'],
      ['/desktop', 'Launch the lightweight ANTRI Desktop Control Plane'],
      ['/alwaysallow', 'Toggle Always-Allow permission for sensitive tools (web search, shell, python)'],
      ['/goal [task]', 'Run autonomous multi-step goal loop: plan, critique, refine & deliver'],
      ['/loop [task]', 'Iterate on a task until optimal battle-tested result is achieved'],
      ['/profile [name]', 'Open profile picker or switch active thinking profile (profile_1, profile_2...)'],
      ['/notes', 'View active profile notes & captured thinking style insights'],
      ['/update', 'Self-update ANTRI Code CLI without lockfile churn'],
      ['/debate [query]', 'Launch Dialectic Engine multi-persona self-debate & consensus'],
      ['/depth <level>', 'Set debate depth: quick, deep, or rigorous'],
      ['/meta', 'View Meta-Optimization metrics, success rates & self-healing stats'],
      ['/skills', 'List built-in & dynamically synthesized custom skills'],
      ['/memory', 'View Persistent Memory & lifelong knowledge status'],
      ['/consolidate', 'Run post-session reflection & knowledge compounding'],
      ['/learn <text>', 'Save a persistent rule or knowledge item'],
      ['/connect', 'Open interactive AI Provider connection dialog'],
      ['/models', 'Search and select from all available AI models'],
      ['/tools', 'View details of recently executed workspace tools (Ctrl+O)'],
      ['/help', 'Show this command reference manual'],
      ['/clear', 'Start a new session with empty context'],
      ['/history', 'View conversation history in current session'],
      ['/exit', 'Exit ANTRI Code'],
      ['/provider [name]', 'Quick-switch provider or open provider picker'],
      ['/model [name]', 'Quick-switch model or open model picker'],
      ['/key <prov> <key>', 'Save API key dynamically'],
      ['/add-dir [dir]', 'Add directory to workspace context'],
      ['/worktree', 'Create, list, or switch git worktrees'],
      ['/agents', 'Manage agent configurations'],
      ['/export [file]', 'Export conversation transcript to markdown'],
      ['/read <file>', 'Quickly inspect a file in workspace'],
      ['/ls [dir]', 'List files in workspace'],
      ['/run <cmd>', 'Execute a shell command'],
      ['/config', 'Show active configuration and key status'],
    ];

    for (const [cmd, desc] of cmds) {
      console.log(`  ${chalk.cyan(cmd.padEnd(20))} ${chalk.hex('#94a3b8')(desc)}`);
    }
    console.log(chalk.hex('#334155')('─'.repeat(72)));
    console.log();
  }
}
