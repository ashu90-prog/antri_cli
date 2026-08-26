import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import chalk from 'chalk';
import highlightPkg from 'cli-highlight';
const { highlight, supportsLanguage } = highlightPkg;
import { ToolCall, ToolResult } from '../types.js';

// Configure marked with terminal styling
marked.use(
  markedTerminal({
    code: (code: string, lang?: string) => {
      try {
        if (lang && supportsLanguage(lang)) {
          return highlight(code, { language: lang, ignoreIllegals: true });
        }
        return highlight(code, { ignoreIllegals: true });
      } catch {
        return chalk.hex('#e2e8f0')(code);
      }
    },
    blockquote: chalk.hex('#818cf8'),
    heading: chalk.bold.hex('#a5b4fc'),
    firstHeading: chalk.bold.hex('#c084fc'),
    strong: chalk.bold.white,
    em: chalk.italic.hex('#e2e8f0'),
    codespan: chalk.hex('#38bdf8'),
    listitem: chalk.hex('#94a3b8'),
    hr: chalk.hex('#334155'),
  }) as any
);

export interface ToolLogEntry {
  toolCall: ToolCall;
  result?: ToolResult;
  timestamp: number;
}

export class ToolInspector {
  private static recentTools: ToolLogEntry[] = [];

  public static record(toolCall: ToolCall, result?: ToolResult): void {
    this.recentTools.push({
      toolCall,
      result,
      timestamp: Date.now(),
    });
    if (this.recentTools.length > 50) {
      this.recentTools.shift();
    }
  }

  public static getRecent(): ToolLogEntry[] {
    return [...this.recentTools];
  }

  public static showDetailedLogs(): void {
    if (this.recentTools.length === 0) {
      console.log(chalk.hex('#64748b')('\nNo tools have been executed in this session.\n'));
      return;
    }

    console.log(chalk.bold.hex('#a5b4fc')(`\n🛠️ Recent Tool Executions (${this.recentTools.length}):`));
    console.log(chalk.hex('#334155')('─'.repeat(70)));

    for (const entry of this.recentTools.slice(-10)) {
      const tc = entry.toolCall;
      const res = entry.result;
      console.log(chalk.cyan(`• Tool: ${tc.function.name}`) + chalk.hex('#64748b')(` (${tc.function.arguments})`));
      if (res) {
        const preview = res.output.split('\n').slice(0, 10).join('\n');
        console.log(chalk.hex('#475569')('  ' + preview.replace(/\n/g, '\n  ')));
      }
      console.log(chalk.hex('#334155')('─'.repeat(40)));
    }
    console.log();
  }
}

export class TerminalRenderer {
  public static renderMarkdown(markdown: string): string {
    try {
      return (marked.parse(markdown) as string).trim();
    } catch {
      return markdown;
    }
  }

  public static printToken(token: string): void {
    process.stdout.write(token);
  }

  /**
   * Displays start of tool execution with active parameters
   */
  public static printToolStart(toolCall: ToolCall, index?: number, total?: number): void {
    let parsed: any = {};
    try {
      parsed = JSON.parse(toolCall.function.arguments || '{}');
    } catch {
      parsed = {};
    }

    const stepBadge = index && total && total > 1 ? chalk.hex('#a5b4fc')(` [${index}/${total}]`) : '';
    const toolName = toolCall.function.name;

    if (toolName === 'run_command' && (parsed.command || parsed.cmd)) {
      const cmd = (parsed.command || parsed.cmd).trim();
      const shortCmd = cmd.length > 80 ? cmd.slice(0, 77) + '...' : cmd;
      console.log(chalk.hex('#06b6d4')(`⚡ [ANTRI Run${stepBadge}]: `) + chalk.bold.white(`Running: `) + chalk.hex('#38bdf8')(`"${shortCmd}"`));
    } else if (toolName === 'read_file' && parsed.file_path) {
      console.log(chalk.hex('#818cf8')(`📖 [ANTRI Tool${stepBadge}]: `) + chalk.hex('#cbd5e1')(`Reading file `) + chalk.cyan(`"${parsed.file_path}"`));
    } else if (toolName === 'write_file' && parsed.file_path) {
      console.log(chalk.hex('#10b981')(`✍️  [ANTRI Tool${stepBadge}]: `) + chalk.hex('#cbd5e1')(`Writing file `) + chalk.cyan(`"${parsed.file_path}"`));
    } else if (toolName === 'edit_file' && parsed.file_path) {
      console.log(chalk.hex('#f59e0b')(`🔧 [ANTRI Tool${stepBadge}]: `) + chalk.hex('#cbd5e1')(`Editing file `) + chalk.cyan(`"${parsed.file_path}"`));
    } else if (toolName === 'create_directory' && (parsed.dir_path || parsed.path)) {
      console.log(chalk.hex('#10b981')(`📁 [ANTRI Tool${stepBadge}]: `) + chalk.hex('#cbd5e1')(`Creating folder `) + chalk.cyan(`"${parsed.dir_path || parsed.path}"`));
    } else if (toolName === 'delete_file' && (parsed.file_path || parsed.path)) {
      console.log(chalk.hex('#f43f5e')(`🗑️  [ANTRI Tool${stepBadge}]: `) + chalk.hex('#cbd5e1')(`Deleting `) + chalk.cyan(`"${parsed.file_path || parsed.path}"`));
    } else if (toolName === 'grep_search' && parsed.query) {
      console.log(chalk.hex('#818cf8')(`🔍 [ANTRI Tool${stepBadge}]: `) + chalk.hex('#cbd5e1')(`Grep searching `) + chalk.cyan(`"${parsed.query}"`));
    } else if (toolName === 'find_files' && (parsed.pattern || parsed.name)) {
      console.log(chalk.hex('#818cf8')(`🔎 [ANTRI Tool${stepBadge}]: `) + chalk.hex('#cbd5e1')(`Finding files `) + chalk.cyan(`"${parsed.pattern || parsed.name}"`));
    } else if (toolName === 'web_search' && parsed.query) {
      console.log(chalk.hex('#38bdf8')(`🌐 [ANTRI Tool${stepBadge}]: `) + chalk.hex('#cbd5e1')(`Searching web for `) + chalk.cyan(`"${parsed.query}"`));
    } else {
      let argsSummary = '';
      try {
        argsSummary = Object.entries(parsed).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ');
      } catch {
        argsSummary = toolCall.function.arguments || '';
      }
      const shortArgs = argsSummary.length > 70 ? argsSummary.slice(0, 67) + '...' : argsSummary;
      console.log(chalk.hex('#818cf8')(`⚙️  [ANTRI Tool${stepBadge}]: `) + chalk.cyan(toolName) + (shortArgs ? chalk.hex('#64748b')(` (${shortArgs})`) : ''));
    }
  }

  /**
   * Displays completion of tool execution with duration and status
   */
  public static printToolFinish(toolCall: ToolCall, result: ToolResult, durationMs: number, index?: number, total?: number): void {
    ToolInspector.record(toolCall, result);

    const stepBadge = index && total && total > 1 ? chalk.hex('#64748b')(`[${index}/${total}] `) : '';
    const duration = (durationMs / 1000).toFixed(1) + 's';

    if (result.error) {
      const firstLine = (result.output || 'Execution failed').split('\n')[0].slice(0, 80);
      console.log(chalk.hex('#f43f5e')(`  ✖ ${stepBadge}${toolCall.function.name} failed (${duration}): `) + chalk.hex('#fca5a5')(firstLine));
    } else {
      let extra = '';
      if (toolCall.function.name === 'run_command') {
        const outLines = result.output.split('\n').filter(l => l.trim().length > 0);
        if (outLines.length > 0) {
          const sample = outLines[0].slice(0, 60);
          extra = chalk.hex('#475569')(` ↳ "${sample}${outLines.length > 1 ? '...' : ''}"`);
        }
      }
      console.log(chalk.hex('#10b981')(`  ✔ ${stepBadge}${toolCall.function.name} finished (${duration})`) + extra);
    }
  }

  /**
   * Displays compact, single-line greyed tool notification
   */
  public static printToolCompact(toolCall: ToolCall, result?: ToolResult): void {
    ToolInspector.record(toolCall, result);

    let argsSummary = '';
    try {
      const parsed = JSON.parse(toolCall.function.arguments);
      argsSummary = Object.entries(parsed)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(', ');
    } catch {
      argsSummary = toolCall.function.arguments || '';
    }

    const tag = chalk.hex('#64748b')('• Tool used: ');
    const toolName = chalk.hex('#94a3b8')(toolCall.function.name);
    const args = argsSummary ? chalk.hex('#475569')(` (${argsSummary})`) : '';
    const hint = chalk.hex('#334155')('  [Ctrl+O / /tools for details]');

    console.log(`${tag}${toolName}${args}${hint}`);
  }
}
