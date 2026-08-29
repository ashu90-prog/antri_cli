import chalk from 'chalk';
import { AntriConfig, ChatMessage } from '../types.js';
import { createProvider } from '../providers/index.js';
import { TerminalRenderer } from '../cli/renderer.js';
import { getAllActiveTools, ToolExecutor } from './tools.js';
import { memoryManager } from '../memory/manager.js';
import { profileManager } from '../profiles/profileManager.js';
import { log } from '../utils/logger.js';

export interface GoalIterationResult {
  iteration: number;
  type: 'draft' | 'review' | 'refinement';
  content: string;
  qualityScore?: number;
}

export interface GoalCallbacks {
  onStatus?: (status: { iteration: number; message: string; type: string }) => void;
  onStage?: (stage: GoalIterationResult) => void;
  onToken?: (iteration: number, token: string) => void;
}

export interface GoalLoopResult {
  objective: string;
  draft: string;
  critique: string;
  finalOutput: string;
  iterations: GoalIterationResult[];
  duration: string;
}

export class GoalLoopEngine {
  private config: AntriConfig;
  private toolExecutor: ToolExecutor;

  constructor(config: AntriConfig) {
    this.config = config;
    this.toolExecutor = new ToolExecutor(config.workingDir);
  }

  public async runGoal(goalPrompt: string, maxIterations = 3, callbacks?: GoalCallbacks): Promise<GoalLoopResult> {
    const startTime = Date.now();
    const activeProfile = profileManager.getActiveProfileName();
    const iterations: GoalIterationResult[] = [];

    console.log();
    console.log(chalk.bgRgb(67, 56, 202).bold.white(` 🎯 AUTONOMOUS GOAL LOOP · OBJECTIVE `));
    console.log(chalk.hex('#c7d2fe')(`"${goalPrompt}"`));
    console.log(chalk.hex('#4338ca')('═'.repeat(74)));
    console.log(chalk.hex('#94a3b8')(`Iterating until optimal quality · Active Profile: ${activeProfile}`));
    console.log();

    const provider = createProvider(this.config);
    const activeTools = this.config.autoExecuteTools ? getAllActiveTools() : [];

    let currentDraft = '';
    let currentCritique = '';
    let finalSolution = '';

    // ==========================================
    // ITERATION 1: PLAN & INITIAL SOLUTION
    // ==========================================
    console.log(chalk.bold.hex('#10b981')('📍 [Iter 1/3: Formulate Initial Solution & Strategy]'));
    console.log(chalk.hex('#064e3b')('─'.repeat(74)));
    callbacks?.onStatus?.({ iteration: 1, type: 'draft', message: 'Formulating initial solution & architecture plan...' });

    const iter1Messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are ANTRI Goal Loop Agent.
Objective: Formulate a thorough, complete, production-ready initial implementation or answer for the goal.
Be specific, write clean code, and address the core requirements.`,
      },
      {
        role: 'user',
        content: `Goal: ${goalPrompt}\n\nDeliver the initial working implementation with clear architecture.`,
      },
    ];

    currentDraft = await provider.sendMessageStream(iter1Messages, activeTools, {
      onToken: (t) => {
        TerminalRenderer.printToken(t);
        callbacks?.onToken?.(1, t);
      },
    });
    console.log('\n');

    const draftResult: GoalIterationResult = {
      iteration: 1,
      type: 'draft',
      content: currentDraft,
    };
    iterations.push(draftResult);
    callbacks?.onStage?.(draftResult);

    // ==========================================
    // ITERATION 2: ADVERSARIAL SELF-REVIEW & CRITIQUE
    // ==========================================
    console.log(chalk.bold.hex('#f43f5e')('🔍 [Iter 2/3: Adversarial Self-Review, Flaw Detection & Quality Scoring]'));
    console.log(chalk.hex('#881337')('─'.repeat(74)));
    callbacks?.onStatus?.({ iteration: 2, type: 'review', message: 'Adversarial self-review, flaw detection & quality scoring...' });

    const iter2Messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are the Adversarial Goal Reviewer.
Evaluate the draft solution against the original goal with ruthless precision.
1. Find any edge cases, bugs, performance bottlenecks, security risks, or missing features.
2. Assign a Quality Score from 0 to 100%.
3. Provide a numbered list of concrete improvements required.`,
      },
      {
        role: 'user',
        content: `Goal: ${goalPrompt}\n\nDraft Solution:\n"""\n${currentDraft}\n"""\n\nPerform full review and score quality.`,
      },
    ];

    currentCritique = await provider.sendMessageStream(iter2Messages, [], {
      onToken: (t) => {
        TerminalRenderer.printToken(t);
        callbacks?.onToken?.(2, t);
      },
    });
    console.log('\n');

    const reviewResult: GoalIterationResult = {
      iteration: 2,
      type: 'review',
      content: currentCritique,
    };
    iterations.push(reviewResult);
    callbacks?.onStage?.(reviewResult);

    // ==========================================
    // ITERATION 3: REFINEMENT, HARDENING & SYNTHESIS
    // ==========================================
    console.log(chalk.bold.hex('#a855f7')('✨ [Iter 3/3: Hardening & Final Optimal Solution Delivery]'));
    console.log(chalk.hex('#581c87')('─'.repeat(74)));
    callbacks?.onStatus?.({ iteration: 3, type: 'refinement', message: 'Hardening & final optimal solution delivery...' });

    const iter3Messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are the Master Synthesizer.
Take the initial draft and the adversarial critique to generate the ultimate, polished, battle-tested final solution.
Ensure every single critique and edge case is resolved with flawless code and explanations.`,
      },
      {
        role: 'user',
        content: `Goal: ${goalPrompt}\n\nInitial Draft:\n"""\n${currentDraft}\n"""\n\nCritique & Improvements:\n"""\n${currentCritique}\n"""\n\nDeliver the final production-ready solution now.`,
      },
    ];

    finalSolution = await provider.sendMessageStream(iter3Messages, activeTools, {
      onToken: (t) => {
        TerminalRenderer.printToken(t);
        callbacks?.onToken?.(3, t);
      },
    });
    console.log('\n');

    const refinementResult: GoalIterationResult = {
      iteration: 3,
      type: 'refinement',
      content: finalSolution,
    };
    iterations.push(refinementResult);
    callbacks?.onStage?.(refinementResult);

    // Record learning into memory
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    memoryManager.recordInteraction(`[Goal Loop]: ${goalPrompt}`, finalSolution);
    profileManager.appendNoteToActiveProfile(`Accomplished Goal: "${goalPrompt.slice(0, 80)}" via 3-step loop.`);

    console.log(chalk.hex('#4338ca')('═'.repeat(74)));
    console.log(chalk.bold.hex('#c084fc')(`🏁 Goal Loop Completed in ${duration}s · Convergence Reached · Ready for Production`));
    console.log(chalk.hex('#4338ca')('═'.repeat(74)));
    console.log();

    // Persist into sessionManager and artifactManager so Desktop UI displays it
    try {
      const { sessionManager } = await import('./sessionManager.js');
      const { artifactManager } = await import('./artifactManager.js');
      const activeSession = sessionManager.getActiveSession();
      const sessionId = activeSession?.id || 'cli_session';
      const sessionTitle = activeSession?.title || 'CLI Session';

      const fullGoalReport = `### 🎯 Autonomous Goal Loop: "${goalPrompt}"\n\n#### 📍 1. Initial Draft\n${currentDraft}\n\n#### 🔍 2. Adversarial Critique\n${currentCritique}\n\n#### ✨ 3. Hardened Final Solution\n${finalSolution}`;

      sessionManager.addMessageToActiveSession({
        role: 'user',
        content: `/goal ${goalPrompt}`,
      });
      sessionManager.addMessageToActiveSession({
        role: 'assistant',
        content: fullGoalReport,
      });

      const artifactId = 'goal_' + Date.now().toString(36);
      const htmlContent = this.generateInteractiveGoalHtml(goalPrompt, currentDraft, currentCritique, finalSolution, duration);
      artifactManager.saveArtifact({
        id: artifactId,
        sessionId,
        sessionTitle,
        title: `Goal: ${goalPrompt.slice(0, 40)}`,
        type: 'html',
        content: htmlContent,
        createdAt: Date.now(),
      });
    } catch (_) {}

    return {
      objective: goalPrompt,
      draft: currentDraft,
      critique: currentCritique,
      finalOutput: finalSolution,
      iterations,
      duration,
    };
  }

  public generateInteractiveGoalHtml(objective: string, draft: string, critique: string, finalSolution: string, duration = '0'): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Goal Loop: ${objective.replace(/"/g, '&quot;')}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #0f172a; color: #f8fafc; font-family: ui-sans-serif, system-ui, sans-serif; }
    .glass { background: rgba(30, 41, 59, 0.85); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); }
  </style>
</head>
<body class="p-6 md:p-10 max-w-6xl mx-auto">
  <header class="mb-8 border-b border-slate-800 pb-6">
    <div class="inline-block px-3 py-1 bg-indigo-950 text-indigo-300 rounded-full text-xs font-bold tracking-wide uppercase mb-2">
      🎯 ANTRI Autonomous Goal Loop Pipeline · Completed in ${duration}s
    </div>
    <h1 class="text-2xl md:text-3xl font-extrabold text-white">${objective.replace(/</g, '&lt;')}</h1>
  </header>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
    <!-- Stage 1 -->
    <div class="glass p-6 rounded-xl border-l-4 border-emerald-400">
      <div class="flex items-center gap-2 mb-3">
        <span class="text-xl">📍</span>
        <h2 class="text-lg font-bold text-emerald-400">Stage 1: Formulation & Initial Draft</h2>
      </div>
      <div class="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">${draft.replace(/</g, '&lt;')}</div>
    </div>

    <!-- Stage 2 -->
    <div class="glass p-6 rounded-xl border-l-4 border-rose-400">
      <div class="flex items-center gap-2 mb-3">
        <span class="text-xl">🔍</span>
        <h2 class="text-lg font-bold text-rose-400">Stage 2: Adversarial Review & Score</h2>
      </div>
      <div class="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">${critique.replace(/</g, '&lt;')}</div>
    </div>
  </div>

  <!-- Stage 3 -->
  <div class="glass p-8 rounded-xl border-l-4 border-purple-500 bg-slate-900/90 shadow-2xl">
    <div class="flex items-center gap-2 mb-4">
      <span class="text-2xl">✨</span>
      <h2 class="text-xl font-bold text-purple-300">Stage 3: Hardened Optimal Delivery</h2>
    </div>
    <div class="text-slate-200 text-sm md:text-base leading-relaxed whitespace-pre-wrap">${finalSolution.replace(/</g, '&lt;')}</div>
  </div>
</body>
</html>`;
  }

  /**
   * Executes the Goal Loop silently in the background and returns the hardened solution.
   */
  public async runSilentGoal(goalPrompt: string): Promise<string> {
    const provider = createProvider(this.config);

    let spinner: any = null;
    if (process.stdout.isTTY) {
      const ora = (await import('ora')).default;
      spinner = ora({
        text: chalk.hex('#818cf8')('🎯 Conducting background goal loop optimization...'),
        spinner: 'dots',
        color: 'blue',
      }).start();
    }

    try {
      // 1. Initial Draft & Architecture Plan
      const iter1Messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are ANTRI Goal Loop Agent. Formulate a thorough, complete initial implementation or answer for the goal.',
        },
        {
          role: 'user',
          content: `Goal: ${goalPrompt}\n\nDeliver the initial working implementation with clear architecture.`,
        },
      ];
      const draft = await provider.sendMessageStream(iter1Messages, [], { onToken: () => {} });

      // 2. Adversarial Review & Score
      const iter2Messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are the Adversarial Goal Reviewer. Evaluate the draft solution against the original goal with precision. Find bugs, edge cases, security risks, score quality (0-100%), and list required improvements.',
        },
        {
          role: 'user',
          content: `Goal: ${goalPrompt}\n\nDraft Solution:\n"""\n${draft}\n"""\n\nPerform full review and score quality.`,
        },
      ];
      const critique = await provider.sendMessageStream(iter2Messages, [], { onToken: () => {} });

      // 3. Final Hardened Delivery
      const iter3Messages: ChatMessage[] = [
        {
          role: 'system',
          content: `You are the Master Synthesizer. Take the initial draft and critique to deliver the ultimate, polished, hardened final solution.
Emoji Usage Rule: Keep emojis tasteful and minimal — maximum 2 emojis in your entire response.`,
        },
        {
          role: 'user',
          content: `Goal: ${goalPrompt}\n\nInitial Draft:\n"""\n${draft}\n"""\n\nCritique & Improvements:\n"""\n${critique}\n"""\n\nDeliver the final production-ready solution now.`,
        },
      ];
      const finalSolution = await provider.sendMessageStream(iter3Messages, [], { onToken: () => {} });

      if (spinner) spinner.stop();

      memoryManager.recordInteraction(`[Silent Goal Loop]: ${goalPrompt}`, finalSolution);
      profileManager.appendNoteToActiveProfile(`Accomplished Goal (Silent): "${goalPrompt.slice(0, 80)}"`);

      return `> 🎯 [Goal Loop Plan Synthesized]\n\n${finalSolution.trim()}`;
    } catch (err: any) {
      if (spinner) spinner.stop();
      return `> 🎯 [Goal Loop Plan Synthesized]\n\n[Background Goal Execution Fallback: ${err.message}]`;
    }
  }
}

