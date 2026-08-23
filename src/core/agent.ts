import ora, { Ora } from 'ora';
import chalk from 'chalk';
import { AntriConfig, ChatMessage, ToolCall, ToolResult } from '../types.js';
import { createProvider } from '../providers/index.js';
import { ConversationHistory } from './history.js';
import { getAllActiveTools, ToolExecutor } from './tools.js';
import { TerminalRenderer } from '../cli/renderer.js';
import { FilePickerService } from '../cli/dialogs/filePicker.js';
import { CitationEngine } from './citations.js';
import { memoryManager } from '../memory/manager.js';
import { profileManager } from '../profiles/profileManager.js';
import { skillManager } from '../skills/skillManager.js';
import { SelfDebugger } from './debugger.js';
import { metaOptimizer } from './metaOptimizer.js';
import { sessionManager } from './sessionManager.js';
import { log } from '../utils/logger.js';

export class AntriAgent {
  private config: AntriConfig;
  private history: ConversationHistory;
  private toolExecutor: ToolExecutor;
  private citationEngine: CitationEngine;

  constructor(config: AntriConfig, history?: ConversationHistory) {
    this.config = config;
    this.history = history || new ConversationHistory();
    if (!history) {
      this.syncHistoryFromActiveSession();
    }
    this.toolExecutor = new ToolExecutor(config.workingDir);
    this.citationEngine = new CitationEngine();
  }

  public syncHistoryFromActiveSession(): void {
    const active = sessionManager.getActiveSession();
    this.history.setMessages(active.messages || []);
  }

  public getHistory(): ConversationHistory {
    return this.history;
  }

  public updateConfig(newConfig: AntriConfig): void {
    this.config = newConfig;
    this.toolExecutor = new ToolExecutor(newConfig.workingDir);
  }

  private buildSystemPrompt(recalledMemoryContext = '', activeSkillContext = ''): string {
    const activeProfileName = profileManager.getActiveProfileName();
    const activeProfileContent = profileManager.getActiveProfileContent();
    const mode = this.config.mode || 'vibe';

    let modeDirective = '';
    if (mode === 'plan') {
      modeDirective = `
⚡ ACTIVE OPERATING MODE: PLAN MODE
- You are in PLAN MODE. Your primary goal is to collaborate with the user on high-level architecture, design specifications, and step-by-step implementation blueprints BEFORE writing code.
- Propose structured phased roadmaps (Phase 1, Phase 2, etc.) and list necessary file additions/modifications.
- Ask sharp clarifying questions regarding trade-offs, tech choices, or edge cases.
- Do NOT prematurely modify codebase files or execute destructive actions without presenting the plan first and getting user alignment.`;
    } else {
      modeDirective = `
⚡ ACTIVE OPERATING MODE: VIBE MODE
- You are in VIBE MODE. You directly chat with the user and immediately implement features, write code, run commands, and execute tools in continuous flow.
- Deliver working, high-quality, production-ready code with maximum speed and precision.`;
    }

    const allSkills = skillManager.listSkills();
    const skillListSummary = allSkills
      .slice(0, 15)
      .map((s) => `- ${s.name} (${s.id}): ${s.description.slice(0, 80)}`)
      .join('\n');

    const basePrompt = `You are ANTRI Code, an intelligent, terminal-first AI coding companion, proactive facilitator, and autonomous meta-agent.

Core Behavioral Principles:
1. Direct Conversation & Natural Dialogue: When the user sends a greeting (e.g. "hello", "hi", "hey", "who are you"), asks questions, or chats, ALWAYS respond directly with helpful, friendly conversational text. NEVER execute 'run_command' (e.g. echo, printf) or any workspace tool to deliver greetings, conversational messages, or chat responses. Tools are strictly for genuine workspace operations (editing files, running tests, executing builds, git, artifacts).
2. Lead the Way & Guide Step-by-Step: Don't just give passive answers. Proactively lead the way, lay out step-by-step execution roadmaps, and propose the next logical milestones.
3. Ask Clarifying Questions: Whenever a requirement is underspecified, has multiple architectural paths, or involves technical trade-offs, ask concise, targeted clarifying questions to ensure perfect alignment with the user's vision.
4. Adaptive Note-Taking & Feedback Capture: Pay close attention to user feedback, preferred conventions, and mental models. Continuously adapt your explanations and code to their unique thinking style.
${modeDirective}

Tooling & Workspace Capabilities:
1. Workspace & Coding Tools: read_file (inspect files with line ranges), write_file (create/overwrite files), edit_file (precise search & replace block editing), create_directory (folder creation), delete_file (remove files/folders), find_files (glob/name discovery), grep_search (regex/text code search with line numbers), file_info (inspect size, lines, dates), git_diff (inspect git changes/diffs), list_dir, search_files, run_command (terminal execution), create_artifact.
2. Autonomous Silent Debate & Goal Engines: run_silent_debate (secret multi-perspective adversarial consensus for deep research & architecture), run_silent_goal (secret 3-step goal loop optimizer).
3. Sandboxed Runtime: execute_python (run safe isolated Python code scripts).
4. Markdown Skills System: activate_skill (activate specialized expert instructions from .md skills).
5. Web & Research Tools: web_search (multi-provider search without API key), scrape_url (deep readable content extraction into Markdown), and crawl_docs (recursive documentation crawler).
6. Persistent Lifelong Memory & Active RAG Context: Utilize user profile preferences, project conventions, and accumulated notes in active context naturally.

Available Skills in Ecosystem:
${skillListSummary}

Autonomous Guidelines:
- 🚨 CONVERSATIONAL & GREETING RULE: ALWAYS respond directly in plain text for greetings, general conversation, or conceptual questions. NEVER call 'run_command' (echo/printf) to send messages or say hello to the user.
- 🚨 EMOJI USAGE RULE: You MUST use emojis, but keep them minimal and tasteful — MAXIMUM 2 EMOJIS in your entire response (e.g. in a section header or key bullet point). Never exceed 2 emojis total across your entire response.
- 🎨 Claude-Style Multi-Page Interactive Artifacts & Visual Graphs (/imagine & /view):
  - 🌐 World-Class Aesthetic & Deeply Interactive Multi-Page HTML Applications (/view & visual requests):
    - When the user asks for a plan, routine, guide, dashboard, workout, diet, roadmaps, calculator, or UI (e.g. "generate me a 7 day workout plan", "2 day football stretching plan", "/view ...", "build an interactive tracker"), you MUST build an exceptionally polished, responsive, and fully interactive **MULTI-PAGE Single-Page Application (SPA)** with CSS and JavaScript:
    - 💎 VISUAL DESIGN & AESTHETIC REQUIREMENTS (CSS):
      1. ☀️ LIGHT & LUMINOUS AESTHETIC FIRST (MANDATORY DEFAULT):
         - For all artifacts, interactive SPAs, plans, and mindmaps, prioritize elegant, ultra-clean, and bright LIGHT COLOR PALETTES maximum in the background:
           background: radial-gradient(circle at 15% 15%, rgba(99, 102, 241, 0.08) 0%, transparent 40%), radial-gradient(circle at 85% 85%, rgba(236, 72, 153, 0.08) 0%, transparent 40%), #f8fafc;
         - Layered Translucent Glass Cards:
           background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(226, 232, 240, 0.85); border-radius: 16px; box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.05); padding: 20px; margin-bottom: 16px; color: #0f172a;
         - High-Contrast Crisp Typography: Text color MUST be deep slate/charcoal (#0f172a, #1e293b, #334155) for effortless legibility.
      2. 🎨 POSTER GRADIENTS (IF DARK THEME IS USED):
         - NEVER use solid, flat, boring black (#000000) or dull plain dark.
         - If a dark gradient is selected, use rich artistic POSTER MESH GRADIENTS with ambient radiant auras:
           background: radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.25) 0%, transparent 50%), radial-gradient(circle at 90% 80%, rgba(236, 72, 153, 0.22) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.18) 0%, transparent 60%), #0d1322;
         - Use glowing multi-color gradient borders, neon accents, and graphic poster flair.
      3. Vibrant Accent Gradients & Glowing Badges:
         - Electric Indigo: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)
         - Emerald Mint: linear-gradient(135deg, #059669 0%, #10b981 100%)
         - Sunset Rose: linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)
         - Violet Aura: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)
      4. Typography & Responsiveness:
         - System font stack: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
         - Fluid responsive layout (max-width: 800px; margin: 0 auto; padding: 16px;).
         - Responsive grids: grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px;
    - ⚡ DEEP JAVASCRIPT INTERACTIVITY REQUIREMENTS:
      1. Horizontal Scrolling Tab Bar: Sticky header with smooth touch scrolling, active gradient pill indicator, and instant view switching with fadeInSlide animation. Provide at least 3 to 10 distinct navigable pages/tabs (e.g. [Overview] [Day 1] [Day 2] ... [Day 7] [Interactive Stopwatch/Timer] [Macro & Metrics Calculator]).
      2. Bottom Stepper Navigation: "← Previous" and "Next →" footer buttons on every view for effortless linear walkthrough.
      3. Live Interactive Stopwatch & Rest Timer Widget: Complete with Play, Pause, Reset buttons, quick preset chips (+15s, +30s, +60s), digital clock readout (00:45), and animated visual progress bar.
      4. Dynamic Interactive Checklist & Real-Time Progress Bar: Checkable task/exercise tiles that dynamically recalculate the percentage progress bar (e.g. "4/7 Completed - 57%") and animate smoothly.
      5. Interactive Metric Sliders & Calculators: Live sliders/inputs for reps, weight, stretch duration, or calorie targets that calculate totals dynamically.
    - Wrap the complete multi-page HTML inside:
      <antri_artifact id="art_UNIQUE_ID" type="html" title="DESCRIPTIVE TITLE">
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>/* complete aesthetic aurora glassmorphism css */</style>
      </head>
      <body>
        <!-- sticky header, scrolling tabs, page views, timer, dynamic checklists, footer stepper -->
        <script>/* complete interactive js for tabs, timers, checklists, calculators */</script>
      </body>
      </html>
      </antri_artifact>
  - 📊 Visual Architecture & Flowchart Graphs (/imagine):
    - When the user asks to visualize code architecture, diagrams, or uses /imagine, generate a comprehensive, highly-detailed Mermaid diagram wrapped in:
      <antri_artifact id="graph_UNIQUE_ID" type="graph" title="ARCHITECTURE TITLE">
      graph TD
        ...
      </antri_artifact>
  - 🧠 Interactive Visual Mind Maps (/mindmap & concept hierarchies):
    - When the user asks for a mind map, concept map, brainstorming tree, topic breakdown, knowledge tree, or uses /mindmap, generate a comprehensive, highly-structured Mermaid mindmap wrapped in:
      <antri_artifact id="mindmap_UNIQUE_ID" type="mindmap" title="MINDMAP TITLE">
      mindmap
        root((Central Topic))
          Key Branch 1
            Subtopic A
              Detail 1
              Detail 2
            Subtopic B
          Key Branch 2
            Subtopic C
            Subtopic D
          Key Branch 3
            Subtopic E
      </antri_artifact>
    - Use expressive Mermaid mindmap shapes where helpful: \`root((Circle))\`, \`[Square/Box]\`, \`(Rounded)\`, \`))Bang((\`, \`)Cloud(\`, \`{{Hexagon}}\`.
- 💡 Autonomous Silent Debate & Goal Execution: For complex research queries ("research on this topic", "evaluate the best architecture for X vs Y", "compare tradeoffs", "deep dive into..."), or multi-step goal planning, you can autonomously execute 'run_silent_debate' or 'run_silent_goal' to debate and harden the solution secretly behind the scenes, and output the authoritative final conclusion with a header badge:
  - If debate was used: Start output with \`> ⚔️ [Dialectic Debate Synthesized]\`
  - If goal loop was used: Start output with \`> 🎯 [Goal Loop Plan Synthesized]\`
- If a task involves specialized engineering domains (e.g. code review, system design, debugging, security, API design, database modeling, performance, test automation, UX, DevOps), apply relevant skill guidelines.
- If a user asks for complex calculation, data analysis, or scripting, use 'execute_python'.
- If a user asks for external technical documentation, library APIs, or external code facts, autonomously call 'web_search', 'scrape_url', or 'crawl_docs'.
- 🚨 STRICT CONVERSATIONAL & EMPATHY RULE: NEVER call 'web_search' or any research tool on personal statements, personal life events, grief, bereavement, emotional expressions, personal names, or conversational sharing (e.g. "I lost my father in 2021", "my father passed away and he liked workout so that's why i like it too", "My mother passed away", "My name is..."). Respond directly and authentically with genuine human empathy, warmth, and active listening.
- 🧠 PERMANENT COGNITIVE RECALL & MOTIVATION MEMORY: When the user shares personal history, loved ones, loss, or foundational motivations (e.g., carrying on a parent's passion for fitness/coding/philosophy), recognize that this is permanently preserved in your active profile notes. Honor this connection in your responses and seamlessly recall their background, motivations, and preferences whenever relevant.
- 'web_search' is STRICTLY for software frameworks, coding syntax, API documentation, error traces, and explicit web queries.
- If a user attaches a file ([Attached File: ...]), examine the provided content directly.
- When the user asks what you know about them, their thinking style, hobbies, or background, answer conversationally and concisely like a helpful human partner. Synthesize the known facts smoothly without dumping raw markdown files, section headers, or unformatted template boilerplate.
- Cite sources clearly when using web research.
- Write clean, production-grade, typed code.`;

    const profileContext = profileManager.getAllProfileContext(this.config.workingDir);

    const context = `\n\nWorkspace context:
- Current Working Directory: ${this.config.workingDir}
- Active Model: ${this.config.model}
- Active Mode: ${mode.toUpperCase()}
- Active Profile: ${activeProfileName}${profileContext}${recalledMemoryContext}${activeSkillContext}`;

    return basePrompt + context;
  }

  public async chat(
    userPrompt: string,
    onStreamToken?: (token: string) => void,
    onToolCall?: (toolCall: ToolCall) => void
  ): Promise<string> {
    const { AuthManager } = await import('../cloud/auth.js');
    const { RateLimiter } = await import('../security/rateLimiter.js');

    if (!AuthManager.isAuthenticated()) {
      const authRequiredMsg = `🔒 **AUTHENTICATION REQUIRED**\n\nYou must be logged in to chat with ANTRI, execute tools, and synchronize profiles across devices.\n\n👉 Please type \`/login <your-email>\` (or \`/register <email> <password>\`) to proceed.`;
      console.log(chalk.hex('#f43f5e')(authRequiredMsg));
      return authRequiredMsg;
    }

    const currentUser = AuthManager.getCurrentUser()!;

    const rateCheck = RateLimiter.checkLimit(currentUser.userId, 'chat');
    if (!rateCheck.allowed) {
      const throttledMsg = `⚠️ **RATE LIMIT EXCEEDED**\n\nRequest throttled for security. Please wait **${rateCheck.retryAfterSeconds}s** before sending another message.`;
      console.log(chalk.yellow(throttledMsg));
      return throttledMsg;
    }

    const startTime = Date.now();
    const activeProfileName = profileManager.getActiveProfileName();

    // 1. Extract Real-Time Insights, Identity, Philosophy & Thinking Style Preferences into Profile & Notes Silently
    const notedInsight = profileManager.extractAndRecordNotes(userPrompt, this.config.workingDir);
    if (notedInsight) {
      await memoryManager.learn(notedInsight, 'lesson_learned', this.config.workingDir);
    }

    // 2. Check for Relevant or Triggered Markdown Skills (.md)
    let skillContext = '';
    const relevantSkills = skillManager.findRelevantSkills(userPrompt);
    if (relevantSkills.length > 0) {
      const skillNames = relevantSkills.map((s) => chalk.bold.cyan(s.name)).join(', ');
      console.log(chalk.hex('#f59e0b')(`⚡ Activated Skill(s): ${skillNames}`));
      skillContext = `\n\n--- ⚡ ACTIVATED SPECIALIST SKILL INSTRUCTIONS ---\n` +
        relevantSkills.map((s) => `### Skill: ${s.name} (${s.category})\n${s.instructions}`).join('\n\n') +
        `\n---------------------------------------------------`;
    }

    // 3. Autonomous Self-Recall into Persistent Memory Hierarchy
    const geminiKey = this.config.apiKeys.gemini || process.env.GEMINI_API_KEY;
    const { contextText, recalled } = await memoryManager.selfRecall(
      userPrompt,
      this.config.workingDir,
      geminiKey
    );

    if (recalled.hasMemories && (recalled.semanticInsights.length > 0 || recalled.workspaceConventions.length > 0)) {
      const matchCount = recalled.semanticInsights.length + recalled.workspaceConventions.length;
      console.log(chalk.hex('#818cf8')(`🧠 Recalled ${matchCount} relevant memory item(s) from persistent store`));
    }

    // 4. Resolve any @file attachments in userPrompt
    const { enhancedPrompt, attachedFiles } = FilePickerService.extractAndReadAttachments(
      userPrompt,
      this.config.workingDir
    );

    if (attachedFiles.length > 0) {
      console.log(chalk.hex('#64748b')(`📎 Attached file(s): ${attachedFiles.map((f) => chalk.cyan(f)).join(', ')}`));
    }

    // 5. Add user message to active session & history
    const userMsg: ChatMessage = {
      role: 'user',
      content: enhancedPrompt,
    };
    this.history.addMessage(userMsg);
    sessionManager.addMessageToActiveSession(userMsg);

    const response = await this.runAgentLoop(0, contextText, skillContext, onStreamToken, onToolCall);

    // 5b. Parse and persist any interactive Claude-style artifacts (<antri_artifact>...</antri_artifact>)
    const { artifactManager } = await import('./artifactManager.js');
    const activeSession = sessionManager.getActiveSession();
    artifactManager.parseAndStoreArtifacts(
      response,
      activeSession?.id || 'cli_session',
      activeSession?.title || 'CLI Session'
    );

    // 6. Record interaction into persistent episodic memory & meta-optimizer
    memoryManager.recordInteraction(userPrompt, response);
    const duration = Date.now() - startTime;
    metaOptimizer.recordQuerySuccess(duration);

    const elapsed = Math.max(0.1, duration / 1000).toFixed(0);
    const modeTag = (this.config.mode || 'vibe').toUpperCase();
    console.log(chalk.hex('#64748b')(`* Worked for ${elapsed}s · Mode: ${modeTag} · Profile: ${activeProfileName}`));
    console.log();

    return response;
  }

  private async runAgentLoop(
    depth = 0,
    memoryContext = '',
    skillContext = '',
    onStreamToken?: (token: string) => void,
    onToolCall?: (toolCall: ToolCall) => void
  ): Promise<string> {
    if (depth > 6) {
      log.warn('Max agent tool iteration depth reached.');
      return '';
    }

    const provider = createProvider(this.config);
    const systemPrompt = this.buildSystemPrompt(memoryContext, skillContext);

    const messagesWithSystem: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...this.history.getMessages(),
    ];

    const modeLabel = this.config.mode === 'plan' ? 'Planning & Designing Roadmap...' : 'Thinking & Writing Code...';
    let spinner: Ora | null = ora({
      text: chalk.hex('#a5b4fc')(modeLabel),
      spinner: 'dots',
      color: 'cyan',
    }).start();

    let hasStreamedTokens = false;
    let fullResponse = '';
    const pendingToolCalls: ToolCall[] = [];

    try {
      const activeTools = this.config.autoExecuteTools ? getAllActiveTools() : [];

      fullResponse = await provider.sendMessageStream(
        messagesWithSystem,
        activeTools,
        {
          onToken: (token: string) => {
            if (spinner) {
              spinner.stop();
              spinner = null;
            }
            if (!hasStreamedTokens) {
              hasStreamedTokens = true;
            }
            TerminalRenderer.printToken(token);
            if (onStreamToken) {
              onStreamToken(token);
            }
          },
          onToolCall: (toolCall: ToolCall) => {
            if (spinner) {
              spinner.stop();
              spinner = null;
            }
            pendingToolCalls.push(toolCall);
            if (onToolCall) {
              onToolCall(toolCall);
            }
          },
        }
      );

      if (spinner) {
        spinner.stop();
        spinner = null;
      }

      if (hasStreamedTokens) {
        console.log(); // Newline after stream
        console.log();
      }

      // 1. Intercept pure conversational echo/printf commands so they render directly to user without tool badge or loop recursion
      if (pendingToolCalls.length === 1 && pendingToolCalls[0].function.name === 'run_command') {
        let parsedArgs: any = {};
        try {
          parsedArgs = JSON.parse(pendingToolCalls[0].function.arguments || '{}');
        } catch {
          parsedArgs = {};
        }
        const { extractEchoMessage } = await import('./tools.js');
        const echoMessage = extractEchoMessage(parsedArgs.command || '');
        if (echoMessage) {
          TerminalRenderer.printToken(echoMessage);
          console.log();
          console.log();
          if (onStreamToken) {
            onStreamToken(echoMessage);
          }

          const directMsg: ChatMessage = {
            role: 'assistant',
            content: echoMessage,
          };
          this.history.addMessage(directMsg);
          sessionManager.addMessageToActiveSession(directMsg);
          return echoMessage;
        }
      }

      // Record assistant message to active session & history
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: fullResponse,
        tool_calls: pendingToolCalls.length > 0 ? pendingToolCalls : undefined,
      };
      this.history.addMessage(assistantMsg);
      sessionManager.addMessageToActiveSession(assistantMsg);

      // If LLM produced tool calls, execute them and continue loop
      if (pendingToolCalls.length > 0) {
        for (const tc of pendingToolCalls) {
          let parsedArgs: any = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments || '{}');
          } catch {
            parsedArgs = {};
          }

          const toolStart = Date.now();
          let result: ToolResult = await this.toolExecutor.execute(tc.function.name, parsedArgs, tc.id);

          // Autonomous Self-Debugging Loop on tool failure
          if (result.error) {
            metaOptimizer.recordToolExecution(tc.function.name, Date.now() - toolStart, true);
            const repair = await SelfDebugger.autoDebugAndRepair(
              tc,
              result,
              this.config,
              (n, a, id) => this.toolExecutor.execute(n, a, id)
            );

            if (repair.repaired && repair.repairedResult) {
              result = repair.repairedResult;
              metaOptimizer.recordSelfHealing();
            }
          } else {
            metaOptimizer.recordToolExecution(tc.function.name, Date.now() - toolStart, false);
          }

          // Track citations if web search or scrape
          if (tc.function.name === 'web_search' && parsedArgs.query) {
            this.citationEngine.addSource(`Web Search: ${parsedArgs.query}`, `https://duckduckgo.com/?q=${encodeURIComponent(parsedArgs.query)}`, undefined, 'DuckDuckGo');
          } else if (tc.function.name === 'scrape_url' && parsedArgs.url) {
            this.citationEngine.addSource(`Scraped URL`, parsedArgs.url, undefined, 'Web Reader');
          } else if (tc.function.name === 'crawl_docs' && parsedArgs.url) {
            this.citationEngine.addSource(`Documentation Root`, parsedArgs.url, undefined, 'Doc Crawler');
          }

          // Output compact single-line tool usage
          TerminalRenderer.printToolCompact(tc, result);

          this.history.addMessage({
            role: 'tool',
            name: tc.function.name,
            tool_call_id: tc.id,
            content: result.output,
          });
        }

        // Loop back to let assistant interpret tool results
        return await this.runAgentLoop(depth + 1, memoryContext, skillContext, onStreamToken, onToolCall);
      }

      // Filter any accidental model boilerplate explaining the tool
      if (fullResponse.includes('The function `run_command` is used') || fullResponse.includes('echo statement that prints a greeting')) {
        fullResponse = fullResponse
          .replace(/The function `run_command` is used to execute a shell command in the workspace\. In this case, the command is an echo statement that prints a greeting message\./gi, '')
          .replace(/The function `run_command` is used[\s\S]*?greeting message\./gi, '')
          .trim();
      }

      return fullResponse;
    } catch (err: any) {
      if (spinner) {
        spinner.stop();
      }
      log.error(`Request failed: ${err.message}`);
      
      const errorMsg = `\n${chalk.red.bold('❌ Request Failed:')} ${chalk.red(err.message)}\n\n` +
        `${chalk.yellow.bold('💡 Troubleshooting & Quick Fixes:')}\n` +
        `• ${chalk.cyan('/model')}    - Select a different verified model for active provider '${this.config.provider}'\n` +
        `• ${chalk.cyan('/provider')} - Switch to another AI provider (e.g. cerebras, deepseek, gemini, openai, ollama)\n` +
        `• ${chalk.cyan('/key')}      - Update or set your API key (e.g. /key ${this.config.provider} <your-api-key>)\n`;
      
      console.log(errorMsg);
      return `Request failed: ${err.message}`;
    }
  }

  public getToolExecutor(): ToolExecutor {
    return this.toolExecutor;
  }
}
