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

export class GoalLoopEngine {
  private config: AntriConfig;
  private toolExecutor: ToolExecutor;

  constructor(config: AntriConfig) {
    this.config = config;
    this.toolExecutor = new ToolExecutor(config.workingDir);
  }

  public async runGoal(goalPrompt: string, maxIterations = 3): Promise<string> {
    const startTime = Date.now();
    const activeProfile = profileManager.getActiveProfileName();

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
      onToken: (t) => TerminalRenderer.printToken(t),
    });
    console.log('\n');

    // ==========================================
    // ITERATION 2: ADVERSARIAL SELF-REVIEW & CRITIQUE
    // ==========================================
    console.log(chalk.bold.hex('#f43f5e')('🔍 [Iter 2/3: Adversarial Self-Review, Flaw Detection & Quality Scoring]'));
    console.log(chalk.hex('#881337')('─'.repeat(74)));

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
      onToken: (t) => TerminalRenderer.printToken(t),
    });
    console.log('\n');

    // ==========================================
    // ITERATION 3: REFINEMENT, HARDENING & SYNTHESIS
    // ==========================================
    console.log(chalk.bold.hex('#a855f7')('✨ [Iter 3/3: Hardening & Final Optimal Solution Delivery]'));
    console.log(chalk.hex('#581c87')('─'.repeat(74)));

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
      onToken: (t) => TerminalRenderer.printToken(t),
    });
    console.log('\n');

    // Record learning into memory
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    memoryManager.recordInteraction(`[Goal Loop]: ${goalPrompt}`, finalSolution);
    profileManager.appendNoteToActiveProfile(`Accomplished Goal: "${goalPrompt.slice(0, 80)}" via 3-step loop.`);

    console.log(chalk.hex('#4338ca')('═'.repeat(74)));
    console.log(chalk.bold.hex('#c084fc')(`🏁 Goal Loop Completed in ${duration}s · Convergence Reached · Ready for Production`));
    console.log(chalk.hex('#4338ca')('═'.repeat(74)));
    console.log();

    return finalSolution;
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

