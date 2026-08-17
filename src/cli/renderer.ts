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
