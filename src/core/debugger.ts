import chalk from 'chalk';
import { AntriConfig, ToolCall, ToolResult } from '../types.js';
import { createProvider } from '../providers/index.js';
import { log } from '../utils/logger.js';

export interface DebugRepairResult {
  repaired: boolean;
  attempts: number;
  rootCause: string;
  repairedArgs?: Record<string, any>;
  repairedResult?: ToolResult;
  fixSummary: string;
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
    }

    return {
      repaired: false,
      attempts,
      rootCause: 'Unable to automatically heal after ' + attempts + ' attempts',
      fixSummary: 'Manual inspection required',
    };
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
1. Identify the precise root cause (e.g. invalid file path, missing syntax in command, wrong flag, bad JSON format, Windows vs Linux path separator).
2. Generate the corrected parameters object as valid JSON.

Respond in this exact JSON format:
{
  "rootCause": "<1-sentence explanation of why it failed>",
  "fixSummary": "<1-sentence explanation of the fix applied>",
  "patchArgs": { ...corrected arguments object... }
}`;

    try {
      const response = await provider.sendMessageStream(
        [{ role: 'user', content: prompt }],
        [],
        { onToken: () => {} }
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          rootCause: parsed.rootCause || 'Parameter or runtime discrepancy',
          fixSummary: parsed.fixSummary || 'Corrected parameters',
          patchArgs: parsed.patchArgs || args,
        };
      }
    } catch {}

    // Fallback heuristic patches
    if (toolName === 'run_command' && args.command) {
      if (args.command.startsWith('ls') && process.platform === 'win32') {
        return {
          rootCause: "'ls' command not native on Windows shell",
          fixSummary: "Changed 'ls' to 'dir'",
          patchArgs: { command: 'dir' },
        };
      }
    }

    return {
      rootCause: 'Unresolved error',
      fixSummary: 'Retry failed',
    };
  }
}
