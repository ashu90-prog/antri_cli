import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

const META_FILE = path.join(os.homedir(), '.antri', 'memory', 'meta_optimization.json');

export interface MetaMetrics {
  totalQueries: number;
  successfulQueries: number;
  toolCallStats: Record<string, { calls: number; errors: number; totalDurationMs: number }>;
  selfHealingRepairs: number;
  synthesizedSkillsCount: number;
  learnedPromptHeuristics: string[];
  averageLatencyMs: number;
}

const DEFAULT_METRICS: MetaMetrics = {
  totalQueries: 0,
  successfulQueries: 0,
  toolCallStats: {},
  selfHealingRepairs: 0,
  synthesizedSkillsCount: 0,
  learnedPromptHeuristics: [
    'For high-ambiguity questions, prefer dialectic debate synthesis over single-pass answers.',
    'For local workspace operations, verify path existence before executing write_file.',
    'When searching libraries, prioritize official documentation and version-specific release tags.',
  ],
  averageLatencyMs: 1200,
};

export class MetaOptimizer {
  private metrics: MetaMetrics;

  constructor() {
    this.metrics = this.load();
  }

  private load(): MetaMetrics {
    try {
      if (fs.existsSync(META_FILE)) {
        const raw = fs.readFileSync(META_FILE, 'utf-8');
        return { ...DEFAULT_METRICS, ...JSON.parse(raw) };
      }
    } catch {}
    return { ...DEFAULT_METRICS };
  }

  private save(): void {
    try {
      const dir = path.dirname(META_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(META_FILE, JSON.stringify(this.metrics, null, 2), 'utf-8');
    } catch {}
  }

  public recordToolExecution(toolName: string, durationMs: number, isError: boolean): void {
    if (!this.metrics.toolCallStats[toolName]) {
      this.metrics.toolCallStats[toolName] = { calls: 0, errors: 0, totalDurationMs: 0 };
    }
    const stat = this.metrics.toolCallStats[toolName];
    stat.calls += 1;
    if (isError) stat.errors += 1;
    stat.totalDurationMs += durationMs;
    this.save();
  }

  public recordSelfHealing(): void {
    this.metrics.selfHealingRepairs += 1;
    this.save();
  }

  public recordQuerySuccess(durationMs: number): void {
    this.metrics.totalQueries += 1;
    this.metrics.successfulQueries += 1;
    this.metrics.averageLatencyMs = Math.round((this.metrics.averageLatencyMs + durationMs) / 2);
    this.save();
  }

  public addHeuristic(heuristic: string): void {
    if (!this.metrics.learnedPromptHeuristics.includes(heuristic)) {
      this.metrics.learnedPromptHeuristics.push(heuristic);
      this.save();
    }
  }

  public getMetrics(): MetaMetrics {
    return this.metrics;
  }

  public renderMetaStatus(): void {
    const totalCalls = Object.values(this.metrics.toolCallStats).reduce((acc, curr) => acc + curr.calls, 0);
    const totalErrors = Object.values(this.metrics.toolCallStats).reduce((acc, curr) => acc + curr.errors, 0);
    const successRate = totalCalls > 0 ? Math.round(((totalCalls - totalErrors) / totalCalls) * 100) : 100;

    console.log(chalk.bold.hex('#c084fc')('\n🧬 Meta-Optimization & Self-Evolution Metrics'));
    console.log(chalk.hex('#334155')('─'.repeat(72)));
    console.log(`• ${chalk.bold('Overall Tool Success Rate:')}   ${chalk.green(`${successRate}%`)} (${totalCalls - totalErrors}/${totalCalls} calls)`);
    console.log(`• ${chalk.bold('Autonomous Self-Healings:')}    ${chalk.cyan(this.metrics.selfHealingRepairs)} automatic repairs`);
    console.log(`• ${chalk.bold('Average Latency:')}             ${chalk.cyan(`${this.metrics.averageLatencyMs}ms`)}`);
    console.log(`• ${chalk.bold('Learned Strategy Heuristics:')} ${chalk.cyan(this.metrics.learnedPromptHeuristics.length)} heuristics`);

    if (Object.keys(this.metrics.toolCallStats).length > 0) {
      console.log(chalk.bold.hex('#a5b4fc')('\n📊 Tool Performance Breakdown:'));
      for (const [tool, stat] of Object.entries(this.metrics.toolCallStats)) {
        const rate = stat.calls > 0 ? Math.round(((stat.calls - stat.errors) / stat.calls) * 100) : 100;
        const avg = Math.round(stat.totalDurationMs / (stat.calls || 1));
        console.log(`  - ${chalk.cyan(tool.padEnd(16))} Rate: ${rate >= 90 ? chalk.green(`${rate}%`) : chalk.yellow(`${rate}%`)} · Avg: ${avg}ms · Total: ${stat.calls}`);
      }
    }

    console.log(chalk.bold.hex('#a5b4fc')('\n🧠 Meta-Prompt Heuristics:'));
    this.metrics.learnedPromptHeuristics.forEach((h) => console.log(`  - ${chalk.hex('#94a3b8')(h)}`));

    console.log(chalk.hex('#334155')('─'.repeat(72)));
    console.log();
  }
}

export const metaOptimizer = new MetaOptimizer();
