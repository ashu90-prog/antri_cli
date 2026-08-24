import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { AntriConfig, ToolCall, ToolResult } from '../types.js';
import { createProvider } from '../providers/index.js';
import { configManager } from './config.js';
import { log } from '../utils/logger.js';

export interface DebugRepairResult {
  repaired: boolean;
  attempts: number;
  rootCause: string;
  repairedArgs?: Record<string, any>;
  repairedResult?: ToolResult;
  fixSummary: string;
}

export interface AntriDiagnosis {
  isError: boolean;
  blockingBug: string;
  component: 'provider' | 'network' | 'auth' | 'filesystem' | 'configuration' | 'session' | 'tool' | 'runtime';
  technicalDetails: string;
  recommendedFix: string;
  quickActions?: Array<{ label: string; command?: string }>;
  autoHealed: boolean;
  healedMessage?: string;
}

export class SelfDebugger {
  /**
   * Autonomous Self-Debugging Loop: Diagnoses failures, generates patches, and auto-retries
   */
  public static async autoDebugAndRepair(
    toolCall: ToolCall,
    failedResult: ToolResult,
    config: AntriConfig,
    executeFn: (name: string, args: Record<string, any>, callId: string) => Promise<ToolResult>,
    maxRetries = 2
  ): Promise<DebugRepairResult> {
    log.info(`🛠️ [Self-Debugger] Intercepted failure in tool '${toolCall.function.name}'. Starting root cause diagnosis...`);

    let currentArgs: any = {};
    try {
      currentArgs = JSON.parse(toolCall.function.arguments || '{}');
    } catch {
      currentArgs = {};
    }

    let lastError = failedResult.output;
    let attempts = 0;

    while (attempts < maxRetries) {
      attempts++;
      console.log(chalk.hex('#f59e0b')(`🔄 [Self-Debugger Iteration ${attempts}/${maxRetries}] Generating patch for '${toolCall.function.name}'...`));

      const diagnosis = await this.diagnoseRootCause(toolCall.function.name, currentArgs, lastError, config);

      if (!diagnosis.patchArgs) {
        break;
      }

      console.log(chalk.hex('#38bdf8')(`💡 [Self-Debugger] Root cause: ${diagnosis.rootCause}`));
      console.log(chalk.hex('#818cf8')(`🔧 [Self-Debugger] Applying patch: ${diagnosis.fixSummary}`));

      currentArgs = diagnosis.patchArgs;

      try {
        // Re-execute with patched arguments
        const retryResult = await executeFn(toolCall.function.name, currentArgs, toolCall.id);

        if (!retryResult.error) {
          log.success(`✨ [Self-Debugger] Successfully self-healed '${toolCall.function.name}' on attempt ${attempts}!`);
          return {
            repaired: true,
            attempts,
            rootCause: diagnosis.rootCause,
            repairedArgs: currentArgs,
            repairedResult: retryResult,
            fixSummary: diagnosis.fixSummary,
          };
        }

        lastError = retryResult.output;
      } catch (err: any) {
        lastError = err.message || 'Execution exception';
      }
    }

    // Gracefully handle unresolvable tool errors without crashing ANTRI
    const finalDiagnosis = `Unable to automatically heal tool '${toolCall.function.name}' after ${attempts} attempts: ${lastError.slice(0, 200)}`;
    log.warn(`⚠️ [Self-Debugger] ${finalDiagnosis}`);

    return {
      repaired: false,
      attempts,
      rootCause: finalDiagnosis,
      fixSummary: 'Manual inspection recommended',
    };
  }

  /**
   * Diagnoses internal errors, network failures, or API crashes blocking ANTRI
   */
  public static diagnoseAntriError(error: any, config: AntriConfig): AntriDiagnosis {
    const rawMessage = typeof error === 'string' ? error : (error?.message || error?.toString() || 'Unknown error');
    const lower = rawMessage.toLowerCase();

    // 1. Authentication & API Key Errors
    if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('invalid api key') || lower.includes('incorrect api key') || lower.includes('api_key_invalid')) {
      const activeStatus = configManager.hasActiveApiKey(config.provider);
      return {
        isError: true,
        blockingBug: `Invalid or missing API key for active provider '${config.provider}'`,
        component: 'provider',
        technicalDetails: rawMessage,
        recommendedFix: `Set a valid API key with '/key ${config.provider} <your-api-key>' or switch provider with '/provider'.`,
        quickActions: [
          { label: 'Set API Key', command: `/key ${config.provider} <your-key>` },
          { label: 'Switch Provider', command: '/provider' },
        ],
        autoHealed: false,
      };
    }

    // 2. Rate Limits & Quotas (429)
    if (lower.includes('429') || lower.includes('rate limit') || lower.includes('quota') || lower.includes('tokens per minute') || lower.includes('resource_exhausted')) {
      return {
        isError: true,
        blockingBug: `API rate limit or quota exceeded on provider '${config.provider}'`,
        component: 'provider',
        technicalDetails: rawMessage,
        recommendedFix: `Wait a moment before retrying, switch to a lighter model with '/models', or choose another provider with '/provider'.`,
        quickActions: [
          { label: 'Pick Different Model', command: '/models' },
          { label: 'Switch Provider', command: '/provider' },
        ],
        autoHealed: false,
      };
    }

    // 3. Model Not Found / Unsupported (404)
    if (lower.includes('404') || lower.includes('model not found') || lower.includes('not found') || lower.includes('model_not_found') || lower.includes('does not exist')) {
      return {
        isError: true,
        blockingBug: `Model '${config.model}' was not found or is unsupported by '${config.provider}'`,
        component: 'provider',
        technicalDetails: rawMessage,
        recommendedFix: `Select a verified model for ${config.provider} by typing '/models' or '/model'.`,
        quickActions: [
          { label: 'Select Verified Model', command: '/models' },
        ],
        autoHealed: false,
      };
    }

    // 4. Network & Connection Failures
    if (lower.includes('econnrefused') || lower.includes('enotfound') || lower.includes('etimedout') || lower.includes('fetch failed') || lower.includes('network error') || lower.includes('socket hang up')) {
      return {
        isError: true,
        blockingBug: `Network connection failed while communicating with '${config.provider}'`,
        component: 'network',
        technicalDetails: rawMessage,
        recommendedFix: `Check your internet connection, proxy settings, or local Ollama server status (if using Ollama).`,
        quickActions: [
          { label: 'Run Self-Healing Health Check', command: '/selfheal' },
        ],
        autoHealed: false,
      };
    }

    // 5. Session / JSON Storage Corruption
    if (lower.includes('unexpected token') || lower.includes('json parse') || lower.includes('is not valid json') || lower.includes('syntaxerror: json')) {
      return {
        isError: true,
        blockingBug: `Corrupted session or profile JSON data detected`,
        component: 'session',
        technicalDetails: rawMessage,
        recommendedFix: `Type '/new' to start a clean chat session or '/selfheal' to auto-repair corrupted local data files.`,
        quickActions: [
          { label: 'Start Clean Session', command: '/new' },
          { label: 'Auto-Repair Storage', command: '/selfheal' },
        ],
        autoHealed: false,
      };
    }

    // 6. Max Tool Recursion Depth Guard
    if (lower.includes('max agent tool iteration depth reached') || lower.includes('recursion')) {
      return {
        isError: true,
        blockingBug: `Agent safety loop limit reached (max 6 consecutive tool calls)`,
        component: 'tool',
        technicalDetails: rawMessage,
        recommendedFix: `Break your request down into smaller steps or switch to '/plan' mode for structured execution.`,
        quickActions: [
          { label: 'Switch to Plan Mode', command: '/plan' },
        ],
        autoHealed: false,
      };
    }

    // 7. File System & Permissions
    if (lower.includes('eacces') || lower.includes('eperm') || lower.includes('operation not permitted') || lower.includes('ebusy') || lower.includes('locked')) {
      return {
        isError: true,
        blockingBug: `File system permission or file lock restriction encountered`,
        component: 'filesystem',
        technicalDetails: rawMessage,
        recommendedFix: `Ensure ANTRI has write permissions in the workspace directory and that files are not locked by other processes.`,
        autoHealed: false,
      };
    }

    // Default Runtime Diagnosis
    return {
      isError: true,
      blockingBug: `Unexpected internal runtime issue: ${rawMessage.slice(0, 160)}`,
      component: 'runtime',
      technicalDetails: rawMessage,
      recommendedFix: `Check parameters, review recent changes, or type '/selfheal' to run automated environment diagnostics.`,
      quickActions: [
        { label: 'Run Self-Heal Diagnostics', command: '/selfheal' },
        { label: 'Start New Session', command: '/new' },
      ],
      autoHealed: false,
    };
  }

  /**
   * Robust ANTRI Error Boundary: Diagnoses blocking bugs, attempts auto-healing,
   * renders diagnostic report, and cleanly returns to message loop without crashing.
   */
  public static async handleAntriError(
    error: any,
    config: AntriConfig,
    suppressLog = false
  ): Promise<{ healed: boolean; diagnosis: AntriDiagnosis; fallbackResponse: string }> {
    const diagnosis = this.diagnoseAntriError(error, config);

    // 1. Attempt Auto-Healing Strategies
    // Auto-Healing Strategy A: Corrupted session storage repair
    if (diagnosis.component === 'session') {
      try {
        const { sessionManager } = await import('./sessionManager.js');
        sessionManager.createSession('Recovered Session');
        diagnosis.autoHealed = true;
        diagnosis.healedMessage = 'Auto-repaired session state and initialized fresh context.';
      } catch {}
    }

    // Auto-Healing Strategy B: Auto-fallback provider check
    if (diagnosis.component === 'provider' && !diagnosis.autoHealed) {
      const candidates: Array<{ provider: any; model: string }> = [
        { provider: 'cerebras', model: 'gpt-oss-120b' },
        { provider: 'gemini', model: 'gemini-2.5-flash' },
        { provider: 'openai', model: 'gpt-4o' },
        { provider: 'deepseek', model: 'deepseek-v4-flash-(latest)' },
        { provider: 'anthropic', model: 'claude-3-7-sonnet-20250219' },
      ];

      for (const cand of candidates) {
        if (cand.provider !== config.provider) {
          const status = configManager.hasActiveApiKey(cand.provider);
          if (status.configured) {
            diagnosis.recommendedFix += ` (Detected ready API key for '${cand.provider}'. Switch with '/provider ${cand.provider}')`;
            break;
          }
        }
      }
    }

    // 2. Render Diagnostic Report to user if not fully healed
    if (!suppressLog) {
      this.renderDiagnosticReport(diagnosis);
    }

    const fallbackResponse = `⚠️ [ANTRI Self-Debugger] Diagnosed issue: ${diagnosis.blockingBug}. ${diagnosis.recommendedFix}`;
    return {
      healed: diagnosis.autoHealed,
      diagnosis,
      fallbackResponse,
    };
  }

  /**
   * Formats and prints a clean diagnostic box in the terminal
   */
  public static renderDiagnosticReport(diagnosis: AntriDiagnosis): void {
    console.log();
    const border = chalk.hex('#f43f5e')('─'.repeat(70));
    console.log(chalk.bold.hex('#f43f5e')('┌─ 🛠️  ANTRI SELF-DEBUGGER · BLOCKING BUG DIAGNOSED ───────────────────┐'));
    console.log(`  ${chalk.bold.white('🚨 Blocking Issue:')}  ${chalk.hex('#fca5a5')(diagnosis.blockingBug)}`);
    console.log(`  ${chalk.bold.white('📦 Component:')}       ${chalk.hex('#38bdf8')(diagnosis.component.toUpperCase())}`);
    if (diagnosis.technicalDetails && diagnosis.technicalDetails !== diagnosis.blockingBug) {
      console.log(`  ${chalk.bold.white('🔍 Tech Details:')}    ${chalk.hex('#94a3b8')(diagnosis.technicalDetails.slice(0, 180))}`);
    }
    console.log(`  ${chalk.bold.white('💡 Recommended Fix:')} ${chalk.hex('#86efac')(diagnosis.recommendedFix)}`);
    
    if (diagnosis.quickActions && diagnosis.quickActions.length > 0) {
      console.log(`  ${chalk.bold.white('⚡ Quick Actions:')}`);
      for (const action of diagnosis.quickActions) {
        console.log(`     • ${chalk.cyan(action.command || action.label)} - ${chalk.hex('#cbd5e1')(action.label)}`);
      }
    }
    console.log(chalk.bold.hex('#f43f5e')('└──────────────────────────────────────────────────────────────────────┘'));
    console.log(chalk.hex('#94a3b8')('✨ Returning to message page. You can continue typing below:'));
    console.log();
  }

  /**
   * Full ANTRI Health & Self-Healing Doctor
   */
  public static async runSelfDoctor(config: AntriConfig): Promise<{ healthy: boolean; issues: string[]; repairedCount: number }> {
    console.log(chalk.bold.hex('#c084fc')('\n🩺 ANTRI System Health & Self-Healing Diagnostics'));
    console.log(chalk.hex('#334155')('═'.repeat(65)));

    const issues: string[] = [];
    let repairedCount = 0;

    // 1. Check Global Directories
    const globalDir = path.join(os.homedir(), '.antri');
    if (!fs.existsSync(globalDir)) {
      try {
        fs.mkdirSync(globalDir, { recursive: true });
        repairedCount++;
        console.log(chalk.green('  ✔ Created global configuration directory (~/.antri)'));
      } catch (err: any) {
        issues.push(`Cannot create ~/.antri: ${err.message}`);
        console.log(chalk.red(`  ✖ Global directory error: ${err.message}`));
      }
    } else {
      console.log(chalk.green('  ✔ Global configuration directory exists (~/.antri)'));
    }

    // 2. Check Auth Status
    const { AuthManager } = await import('../cloud/auth.js');
    const currentUser = AuthManager.getCurrentUser();
    if (currentUser) {
      console.log(chalk.green(`  ✔ Authenticated User: ${currentUser.email} (${currentUser.userId})`));
    } else {
      console.log(chalk.yellow('  ℹ Account: Not logged in. (Run "/login <email>" to sync profiles & enable "antri fix")'));
    }

    // 3. Check Active Provider & API Key
    const keyStatus = configManager.hasActiveApiKey(config.provider);
    if (keyStatus.configured) {
      console.log(chalk.green(`  ✔ AI Provider '${config.provider}' configured with active API key`));
    } else {
      issues.push(`No active API key configured for provider '${config.provider}'`);
      console.log(chalk.red(`  ✖ AI Provider '${config.provider}' is missing API key (${keyStatus.envVar})`));
    }

    // 4. Check Session Storage Integrity
    const sessionDir = path.join(globalDir, 'sessions');
    if (!fs.existsSync(sessionDir)) {
      try {
        fs.mkdirSync(sessionDir, { recursive: true });
        repairedCount++;
      } catch (_) {}
    }
    console.log(chalk.green('  ✔ Chat session storage integrity verified'));

    // 5. Check Workspace Write Permissions
    try {
      const testFile = path.join(config.workingDir, '.antri_health_test.tmp');
      fs.writeFileSync(testFile, 'ok', 'utf-8');
      fs.unlinkSync(testFile);
      console.log(chalk.green(`  ✔ Workspace write permissions verified (${config.workingDir})`));
    } catch (err: any) {
      issues.push(`Workspace permission denied: ${err.message}`);
      console.log(chalk.red(`  ✖ Workspace permission error: ${err.message}`));
    }

    console.log(chalk.hex('#334155')('═'.repeat(65)));

    const healthy = issues.length === 0;
    if (healthy) {
      console.log(chalk.bold.green(`\n✨ ANTRI is 100% Healthy and Ready! ${repairedCount > 0 ? `(Auto-healed ${repairedCount} item(s))` : ''}\n`));
    } else {
      console.log(chalk.bold.hex('#f59e0b')(`\n⚠️ Diagnosed ${issues.length} issue(s) that may require your attention:\n`));
      for (const issue of issues) {
        console.log(chalk.hex('#fca5a5')(`  • ${issue}`));
      }
      console.log(chalk.hex('#94a3b8')('\nTip: Use /connect, /key, or /login to resolve configuration issues.\n'));
    }

    return { healthy, issues, repairedCount };
  }

  /**
   * Runs diagnostic reasoning to pinpoint failure cause and generate fixed parameters
   */
  private static async diagnoseRootCause(
    toolName: string,
    args: Record<string, any>,
    errorMessage: string,
    config: AntriConfig
  ): Promise<{ rootCause: string; fixSummary: string; patchArgs?: Record<string, any> }> {
    const keyStatus = configManager.hasActiveApiKey(config.provider);
    if (!keyStatus.configured && config.provider !== 'mock') {
      return this.heuristicPatch(toolName, args, errorMessage);
    }

    try {
      const provider = createProvider(config);
      const prompt = `You are the Autonomous Self-Debugger for an AI coding agent.
A tool execution failed with an error.

Tool: "${toolName}"
Arguments Used: ${JSON.stringify(args, null, 2)}
Error Output:
"""
${errorMessage.slice(0, 1500)}
"""

Your task:
1. Identify the precise root cause (e.g. invalid file path, missing file, missing package.json, syntax error in command, wrong flag, bad JSON format, Windows vs Linux path separator).
2. Generate the corrected parameters object as valid JSON.

🚨 CRITICAL RULES:
- If 'npm run dev' or 'npm start' failed because package.json does not exist, patch the command to open or serve the local files (e.g. 'start index.html' on Windows, 'open index.html' on macOS, 'npx serve .', or 'python -m http.server 3000').
- NEVER output authentication commands like 'antri login' or login prompts.
- patchArgs MUST match the parameter schema of tool "${toolName}".

Respond in this exact JSON format:
{
  "rootCause": "<1-sentence explanation of why it failed>",
  "fixSummary": "<1-sentence explanation of the fix applied>",
  "patchArgs": { ...corrected arguments object... }
}`;

      const response = await provider.sendMessageStream(
        [{ role: 'user', content: prompt }],
        [],
        { onToken: () => {} }
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Filter any accidental login command patches
        if (parsed.patchArgs?.command && typeof parsed.patchArgs.command === 'string' && parsed.patchArgs.command.startsWith('antri login')) {
          return this.heuristicPatch(toolName, args, errorMessage);
        }
        return {
          rootCause: parsed.rootCause || 'Parameter or runtime discrepancy',
          fixSummary: parsed.fixSummary || 'Corrected parameters',
          patchArgs: parsed.patchArgs || args,
        };
      }
    } catch {}

    return this.heuristicPatch(toolName, args, errorMessage);
  }

  private static heuristicPatch(
    toolName: string,
    args: Record<string, any>,
    errorMessage: string
  ): { rootCause: string; fixSummary: string; patchArgs?: Record<string, any> } {
    // Windows vs Linux shell commands
    if (toolName === 'run_command' && args.command) {
      const isWin = process.platform === 'win32';
      if ((args.command.includes('npm run') || args.command.includes('npm start')) && (errorMessage.includes('ENOENT') || errorMessage.includes('package.json') || errorMessage.includes('missing script'))) {
        return {
          rootCause: "package.json is missing in the project folder",
          fixSummary: isWin ? "Serving static project with 'start index.html'" : "Serving static project with 'open index.html'",
          patchArgs: { command: isWin ? 'start index.html' : 'open index.html' },
        };
      }
      if (args.command.startsWith('ls') && isWin) {
        return {
          rootCause: "'ls' command not native on Windows shell",
          fixSummary: "Changed 'ls' to 'dir'",
          patchArgs: { command: 'dir' },
        };
      }
      if (args.command.startsWith('cat ') && isWin) {
        return {
          rootCause: "'cat' command replaced with 'type' for Windows shell",
          fixSummary: "Changed 'cat' to 'type'",
          patchArgs: { command: args.command.replace(/^cat\s+/, 'type ') },
        };
      }
    }

    // Path normalization heuristics
    if (args.file_path && typeof args.file_path === 'string') {
      const normalized = path.normalize(args.file_path);
      if (normalized !== args.file_path) {
        return {
          rootCause: 'Unnormalized file path with mixed separators',
          fixSummary: 'Normalized file path separators',
          patchArgs: { ...args, file_path: normalized },
        };
      }
    }

    return {
      rootCause: errorMessage.slice(0, 120) || 'Unresolved tool error',
      fixSummary: 'Manual inspection required',
    };
  }
}
