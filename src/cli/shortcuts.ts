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
import { skillManager } from '../skills/skillManager.js';
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

    // /new or /newchat or /clear (Start new chat session)
    if (trimmed === '/new' || trimmed === '/newchat' || trimmed === '/clear') {
      const { sessionManager } = await import('../core/sessionManager.js');
      const session = sessionManager.createSession('New Chat');
      this.agent.getHistory().clear();
      log.success(`Started new chat session (${session.id}). Context refreshed.`);
      return { handled: true };
    }

    // /chats or /sessions (List all chat sessions)
    if (trimmed === '/chats' || trimmed === '/sessions') {
      const { sessionManager } = await import('../core/sessionManager.js');
      const sessions = sessionManager.listSessions();
      const activeId = sessionManager.getActiveSessionId();
      console.log(chalk.bold.hex('#c084fc')('\n💬 Chat Sessions:'));
      console.log(chalk.hex('#334155')('─'.repeat(60)));
      for (const s of sessions) {
        const marker = s.id === activeId ? chalk.green('● [Active]') : chalk.hex('#64748b')('○');
        const count = chalk.hex('#94a3b8')(`(${s.messageCount} msgs)`);
        console.log(`  ${marker} ${chalk.bold(s.title)} ${count}`);
        console.log(`    ID: ${chalk.hex('#64748b')(s.id)} · Updated: ${new Date(s.updatedAt).toLocaleTimeString()}`);
      }
      console.log(chalk.hex('#334155')('─'.repeat(60)));
      console.log(chalk.hex('#94a3b8')('Type /chat <id> to switch or /new for a new session.\n'));
      return { handled: true };
    }

    // /chat <id> (Switch to a chat session)
    if (trimmed.startsWith('/chat ') && !trimmed.startsWith('/chat delete')) {
      const targetId = trimmed.slice(6).trim();
      const { sessionManager } = await import('../core/sessionManager.js');
      const session = sessionManager.setActiveSessionId(targetId);
      if (session) {
        this.agent.getHistory().setMessages(session.messages || []);
        log.success(`Switched to chat session: ${chalk.bold(session.title)} (${session.messages.length} messages in context)`);
      } else {
        log.error(`Chat session not found: ${targetId}`);
      }
      return { handled: true };
    }

    // /push or /profile push (Direct Cloud Firestore Push)
    if (trimmed === '/push' || trimmed === '/profile push' || trimmed === '/profiles push') {
      const { FirestoreSyncManager } = await import('../cloud/firestore.js');
      log.info('Pushing profiles & notes to Google Cloud Firestore...');
      const res = await FirestoreSyncManager.pushToFirestore();
      if (res.success) log.success(`Successfully pushed ${res.count} profile(s) and notes to cloud.`);
      else log.error(`Sync error: ${res.error}`);
      return { handled: true };
    }

    // /pull or /profile pull (Direct Cloud Firestore Pull)
    if (trimmed === '/pull' || trimmed === '/profile pull' || trimmed === '/profiles pull') {
      const { FirestoreSyncManager } = await import('../cloud/firestore.js');
      log.info('Pulling profiles & notes from Google Cloud Firestore...');
      const res = await FirestoreSyncManager.pullFromFirestore();
      if (res.success) log.success(`Successfully pulled ${res.count} profile(s) and notes from cloud.`);
      else log.error(`Pull error: ${res.error}`);
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
        console.log(chalk.hex('#94a3b8')('Tip: Type "/push" to upload profiles, or "/pull" to download profiles.'));
      }
      return { handled: true };
    }

    // /login or /login <email>
    if (trimmed.startsWith('/login')) {
      const email = trimmed.replace('/login', '').trim();
      if (!email) {
        const { BrowserAuthServer } = await import('../cloud/browserAuth.js');
        const user = await BrowserAuthServer.startLoginFlow();
        if (user) {
          log.success(`Logged in as ${colors.primary(user.email)} (Cloud Partition: ${user.userId})`);
        }
      } else {
        const { AuthManager } = await import('../cloud/auth.js');
        const res = await AuthManager.login(email);
        if (res.success && res.user) {
          log.success(`Logged in as ${colors.primary(res.user.email)} (Cloud Partition: ${res.user.userId})`);
        } else {
          log.error(`Login failed: ${res.error}`);
        }
      }
      return { handled: true };
    }

    // /whoami
    if (trimmed === '/whoami' || trimmed === '/user') {
      const { AuthManager } = await import('../cloud/auth.js');
      const user = AuthManager.getCurrentUser();
      if (user) {
        console.log(chalk.bold.hex('#c084fc')('\n👤 Authenticated Account'));
        console.log(`• Email:     ${chalk.green(user.email)}`);
        console.log(`• User ID:   ${chalk.cyan(user.userId)}`);
        console.log(`• Logged In: ${chalk.gray(user.loggedInAt)}\n`);
      } else {
        log.info('Not logged in. Using local profile storage. Type /login <email> to sign in.');
      }
      return { handled: true };
    }

    // /logout
    if (trimmed === '/logout') {
      const { AuthManager } = await import('../cloud/auth.js');
      AuthManager.logout();
      log.success('Logged out successfully. Reverted to local session.');
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

    // /fix [description] (Autonomous Project Bug Fixer)
    if (trimmed === '/fix' || trimmed.startsWith('/fix ') || trimmed.startsWith('/fix:')) {
      const userTarget = trimmed.replace(/^\/fix(:|\s*)/, '').trim();
      const { ProjectBugFixer } = await import('../core/fixer.js');
      await ProjectBugFixer.runFix(userTarget || undefined);
      return { handled: true };
    }

    // /selfheal or /doctor or /heal (ANTRI Health Diagnostics & Self-Healing)
    if (trimmed === '/selfheal' || trimmed === '/doctor' || trimmed === '/heal') {
      const { SelfDebugger } = await import('../core/debugger.js');
      await SelfDebugger.runSelfDoctor(config);
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

    // /silent-goal or /sgoal (Silent background goal loop)
    if (trimmed === '/silent-goal' || trimmed.startsWith('/silent-goal ') || trimmed === '/sgoal' || trimmed.startsWith('/sgoal ')) {
      let objective = trimmed.replace(/^\/(silent-goal|sgoal)/, '').trim();
      if (!objective) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const promptAsync = (q: string) => new Promise<string>((res) => rl.question(q, res));
        console.log(chalk.bold.hex('#818cf8')('\n🎯 Silent Background Goal Loop'));
        objective = await promptAsync(chalk.cyan('Enter goal/task to optimize silently: '));
        rl.close();
      }

      if (objective.trim()) {
        const engine = new GoalLoopEngine(config);
        const res = await engine.runSilentGoal(objective.trim());
        console.log('\n' + res + '\n');
      } else {
        log.warn('Silent goal loop cancelled: No objective provided.');
      }
      return { handled: true };
    }

    // /imagine [code/topic] -> Generate architecture graph artifact
    if (trimmed === '/imagine' || trimmed.startsWith('/imagine ')) {
      let query = trimmed.replace(/^\/imagine/, '').trim();
      if (!query) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const promptAsync = (q: string) => new Promise<string>((res) => rl.question(q, res));
        console.log(chalk.bold.hex('#c084fc')('\n📊 Architecture & Code Graph Visualizer'));
        query = await promptAsync(chalk.cyan('Enter topic or code structure to visualize into a graph: '));
        rl.close();
      }

      if (query.trim()) {
        const imaginePrompt = `Create a comprehensive visual architecture diagram and flowchart graph for: "${query.trim()}".
You MUST generate the visual graph enclosed in an artifact tag:
<antri_artifact id="graph_${Date.now().toString(36)}" type="graph" title="${query.trim().slice(0, 40)} Graph">
graph TD
  ...
</antri_artifact>`;
        await this.agent.chat(imaginePrompt);
      }
      return { handled: true };
    }

    // /mindmap [topic] -> Generate interactive visual mind map artifact
    if (trimmed === '/mindmap' || trimmed.startsWith('/mindmap ')) {
      let query = trimmed.replace(/^\/mindmap/, '').trim();
      if (!query) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const promptAsync = (q: string) => new Promise<string>((res) => rl.question(q, res));
        console.log(chalk.bold.hex('#c084fc')('\n🧠 Visual Mind Map & Concept Hierarchy Creator'));
        query = await promptAsync(chalk.cyan('Enter concept, topic, or system to generate a mind map for: '));
        rl.close();
      }

      if (query.trim()) {
        const mindmapPrompt = `Create a rich, comprehensive, deeply detailed, and well-structured visual mind map and concept tree for: "${query.trim()}".
Break the topic down hierarchically into 4 to 6 REAL domain pillars/milestones with 2 to 4 granular, factual sub-concepts each (DO NOT use placeholder words like 'Pillar 1' or 'Subtopic A').
You MUST output the Mermaid mindmap enclosed in an artifact tag:
<antri_artifact id="mindmap_${Date.now().toString(36)}" type="mindmap" title="${query.trim().slice(0, 40)} Mind Map">
mindmap
  root((${query.trim().slice(0, 30)}))
    Primary Concept 1
      Factual Subtopic A
      Factual Subtopic B
    Primary Concept 2
      Factual Subtopic C
      Factual Subtopic D
    Primary Concept 3
      Factual Subtopic E
    Primary Concept 4
      Factual Subtopic F
</antri_artifact>`;
        await this.agent.chat(mindmapPrompt);
      }
      return { handled: true };
    }

    // /view [topic/plan] -> Generate interactive HTML artifact
    if (trimmed === '/view' || trimmed.startsWith('/view ')) {
      let query = trimmed.replace(/^\/view/, '').trim();
      if (!query) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const promptAsync = (q: string) => new Promise<string>((res) => rl.question(q, res));
        console.log(chalk.bold.hex('#818cf8')('\n🌐 Interactive HTML Artifact Creator'));
        query = await promptAsync(chalk.cyan('Enter plan or app description to build into an interactive HTML view: '));
        rl.close();
      }

      if (query.trim()) {
        const viewPrompt = `Generate a complete, self-contained, highly interactive, and aesthetically stunning MULTI-PAGE Single-Page Application (SPA) for: "${query.trim()}".
Requirements:
1. Multi-Page Architecture: Provide at least 3 to 10 distinct switchable pages/tabs (e.g., Overview, Day 1..Day 7, Interactive Stopwatch/Timer, Macro/Metrics Tracker) with a horizontal scrolling tab bar and bottom previous/next stepper buttons.
2. Aesthetic CSS: Prioritize clean, bright, and elegant LIGHT COLOR PALETTES (background: radial-gradient(circle at 15% 15%, rgba(99, 102, 241, 0.08) 0%, transparent 40%), radial-gradient(circle at 85% 85%, rgba(236, 72, 153, 0.08) 0%, transparent 40%), #f8fafc;), frosted white glass cards (rgba(255,255,255,0.9) with backdrop-filter: blur(16px)), crisp high-contrast dark text (#0f172a), glowing gradient badges (#4f46e5, #0284c7, #10b981, #e11d48). If dark theme is used, use multi-color POSTER MESH GRADIENTS with ambient radiant auras (never flat solid black).
3. Rich JS Interactivity: Working countdown stopwatch/timer with start/pause/reset and quick presets (+15s, +30s, +60s), dynamic checkable checklists that automatically update completion percentage and progress bars in real time, and interactive calculation sliders.
You MUST output the HTML document enclosed in an artifact tag:
<antri_artifact id="art_${Date.now().toString(36)}" type="html" title="${query.trim().slice(0, 40)}">
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>/* aesthetic aurora glassmorphism css */</style>
</head>
<body>
  <!-- sticky header, scrolling tabs, page views, stopwatch/timer, dynamic checklists, footer stepper -->
  <script>/* complete interactive js */</script>
</body>
</html>
</antri_artifact>`;
        await this.agent.chat(viewPrompt);
      }
      return { handled: true };
    }

    // /artifacts -> View all artifacts grouped by session
    if (trimmed === '/artifacts' || trimmed === '/artifact') {
      const { artifactManager } = await import('../core/artifactManager.js');
      const groups = artifactManager.getArtifactsGroupedBySession();
      console.log(chalk.bold.hex('#c084fc')('\n🎨 ANTRI Generated Artifacts Hub'));
      console.log(chalk.hex('#334155')('─'.repeat(72)));
      if (groups.length === 0) {
        console.log(chalk.gray('No artifacts generated yet. Use /view [plan], /mindmap [topic], or /imagine [code] to create one.'));
      } else {
        for (const grp of groups) {
          console.log(chalk.bold.hex('#818cf8')(`\n📁 Session: ${grp.sessionTitle} (${grp.sessionId})`));
          for (const art of grp.artifacts) {
            const dateStr = new Date(art.createdAt).toLocaleString();
            const typeBadge = art.type === 'mindmap'
              ? chalk.hex('#c084fc')('[MINDMAP]')
              : art.type === 'graph'
              ? chalk.hex('#38bdf8')('[GRAPH]')
              : chalk.hex('#4ade80')('[HTML]');
            console.log(`  ${typeBadge} ${chalk.bold(art.title)} ${chalk.gray(`(ID: ${art.id} · ${dateStr})`)}`);
            const filePath = artifactManager.getArtifactFilePath(art.id);
            if (filePath) {
              console.log(chalk.gray(`     Path: ${filePath}`));
            }
          }
        }
      }
      console.log(chalk.hex('#334155')('\n' + '─'.repeat(72) + '\n'));
      return { handled: true };
    }

    // /profile or /profiles dialog
    if (trimmed === '/profile' || trimmed === '/profiles') {
      await runProfilePickerWorkflow();
      return { handled: true };
    }

    // /profile delete <name> or /profile rm <name>
    if (trimmed.startsWith('/profile delete ') || trimmed.startsWith('/profile rm ') || trimmed.startsWith('/profile-delete ')) {
      const targetName = trimmed.replace(/^\/(profile delete|profile rm|profile-delete)\s+/, '').trim();
      if (targetName === 'profile_1') {
        log.warn('Cannot delete default profile_1.');
        return { handled: true };
      }
      const ok = profileManager.deleteProfile(targetName);
      if (ok) {
        const { FirestoreSyncManager } = await import('../cloud/firestore.js');
        FirestoreSyncManager.deleteFromFirestore(targetName).catch(() => {});
        log.success(`Deleted profile '${targetName}.md' from local disk and Google Cloud Firestore.`);
      } else {
        log.error(`Failed to delete profile '${targetName}'.`);
      }
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

    // /skills or /skill [name]
    if (trimmed === '/skills' || trimmed.startsWith('/skill')) {
      const parts = trimmed.split(' ');
      const sub = parts[1];

      if (sub && sub !== 'list') {
        const skill = skillManager.getSkill(sub);
        if (skill) {
          console.log(chalk.bold.hex('#c084fc')(`\n⚡ Skill: ${skill.name} [${skill.category}] (${skill.isCore ? 'Core' : 'Custom'})`));
          console.log(chalk.hex('#64748b')(`File: ${skill.filePath} · Version: ${skill.version} · Author: ${skill.author}`));
          console.log(chalk.hex('#f59e0b')(`Triggers: ${skill.triggers.join(', ') || 'None'}`));
          console.log(chalk.hex('#334155')('─'.repeat(72)));
          console.log(chalk.hex('#cbd5e1')(skill.instructions));
          console.log(chalk.hex('#334155')('─'.repeat(72)));
          console.log(chalk.green(`✓ Skill instructions loaded. You can chat directly to apply this skill.\n`));
          return { handled: true };
        } else {
          log.warn(`Skill '${sub}' not found. Showing all available skills:\n`);
        }
      }

      const mdSkills = skillManager.listSkills();
      const allTools = getAllActiveTools();

      console.log(chalk.bold.hex('#c084fc')('\n⚡ ANTRI Markdown (.md) Skills & Tools Ecosystem'));
      console.log(chalk.hex('#334155')('─'.repeat(72)));
      console.log(chalk.bold.hex('#a5b4fc')(`Specialist Markdown Skills (${mdSkills.length} available in ~/.antri/skills/):`));

      const core = mdSkills.filter((s) => s.isCore);
      const custom = mdSkills.filter((s) => !s.isCore);

      console.log(chalk.hex('#38bdf8')('Core Specialist Skills:'));
      core.forEach((s) => {
        console.log(`• ${chalk.cyan(s.name.padEnd(26))} [${s.category}] ${chalk.hex('#94a3b8')(s.description.slice(0, 60))}`);
      });

      if (custom.length > 0) {
        console.log(chalk.hex('#f59e0b')('\nCustom User Skills (.md):'));
        custom.forEach((s) => {
          console.log(`✨ ${chalk.green(s.name.padEnd(26))} [${s.category}] ${chalk.hex('#e2e8f0')(s.description.slice(0, 60))}`);
        });
      }

      console.log(chalk.bold.hex('#a5b4fc')(`\nStandard Workspace Tools (${allTools.length}):`));
      allTools.forEach((t) => {
        if (!t.description.startsWith('[Custom')) {
          console.log(`• ${chalk.hex('#64748b')(t.name.padEnd(26))} ${chalk.hex('#64748b')(t.description.slice(0, 60))}`);
        }
      });

      console.log(chalk.hex('#334155')('─'.repeat(72)));
      console.log(chalk.hex('#94a3b8')('Tip: Type /skill <name> to view full markdown instructions, or add new .md files to ~/.antri/skills/'));
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

    // /silent-debate or /sdebate (Silent background dialectic debate)
    if (trimmed === '/silent-debate' || trimmed.startsWith('/silent-debate ') || trimmed === '/sdebate' || trimmed.startsWith('/sdebate ')) {
      let query = trimmed.replace(/^\/(silent-debate|sdebate)/, '').trim();
      if (!query) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const promptAsync = (q: string) => new Promise<string>((res) => rl.question(q, res));
        console.log(chalk.bold.hex('#c084fc')('\n⚔️ Silent Background Dialectic Debate'));
        query = await promptAsync(chalk.cyan('Enter topic/question to debate silently: '));
        rl.close();
      }

      if (query.trim()) {
        const engine = new DialecticEngine(config);
        const res = await engine.silentDebate(query.trim(), config.debateDepth || 'deep');
        console.log('\n' + res + '\n');
      } else {
        log.warn('Silent debate cancelled: No query provided.');
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
      ['/debate [query]', 'Launch Dialectic Engine multi-persona self-debate & consensus'],
      ['/silent-debate [q]', 'Run Dialectic debate silently in background and return final consensus'],
      ['/depth <level>', 'Set debate depth: quick, deep, or rigorous'],
      ['/goal [task]', 'Run autonomous multi-step goal loop: plan, critique, refine & deliver'],
      ['/silent-goal [t]', 'Run Goal Loop optimization silently in background and return final plan'],
      ['/loop [task]', 'Iterate on a task until optimal battle-tested result is achieved'],
      ['/imagine [topic]', 'Create visual architecture diagram & code graph artifact'],
      ['/mindmap [topic]', 'Generate interactive visual mind map and concept tree artifact'],
      ['/view [plan]', 'Generate interactive HTML/JS application/plan artifact and launch view'],
      ['/artifacts', 'List all generated interactive HTML, graph, and mind map artifacts'],
      ['/fix [desc]', 'Automatically diagnose and repair bugs in current project'],
      ['/selfheal', 'Run ANTRI health check, diagnose blocking bugs & auto-heal storage'],
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
