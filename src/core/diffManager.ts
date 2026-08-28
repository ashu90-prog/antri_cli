import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export interface FileSnapshot {
  filePath: string;
  previousContent: string | null; // null if file was newly created
  newContent: string | null;      // null if file was deleted
  timestamp: number;
  type: 'create' | 'edit' | 'delete';
}

export class DiffManager {
  private static snapshots: FileSnapshot[] = [];

  /**
   * Records a snapshot before and after file modification
   */
  public static recordChange(
    filePath: string,
    previousContent: string | null,
    newContent: string | null,
    type: 'create' | 'edit' | 'delete'
  ): void {
    this.snapshots.push({
      filePath,
      previousContent,
      newContent,
      timestamp: Date.now(),
      type,
    });
  }

  /**
   * Returns all recorded snapshots in current session
   */
  public static getSnapshots(): FileSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Computes a colored git-style diff text between two string contents
   */
  public static formatColoredDiff(filePath: string, oldStr: string | null, newStr: string | null): string {
    const lines: string[] = [];
    const rel = path.basename(filePath);

    lines.push(chalk.bold.hex('#94a3b8')(`diff --antri a/${rel} b/${rel}`));
    lines.push(chalk.hex('#64748b')(`--- a/${rel}`));
    lines.push(chalk.hex('#64748b')(`+++ b/${rel}`));

    const oldLines = oldStr !== null ? oldStr.split('\n') : [];
    const newLines = newStr !== null ? newStr.split('\n') : [];

    if (oldStr === null) {
      // Newly created file
      lines.push(chalk.cyan(`@@ -0,0 +1,${newLines.length} @@ [Newly Created File]`));
      for (const l of newLines) {
        lines.push(chalk.green(`+ ${l}`));
      }
    } else if (newStr === null) {
      // Deleted file
      lines.push(chalk.cyan(`@@ -1,${oldLines.length} +0,0 @@ [Deleted File]`));
      for (const l of oldLines) {
        lines.push(chalk.red(`- ${l}`));
      }
    } else {
      // Modified file - simple line-by-line diff
      let oldIdx = 0;
      let newIdx = 0;
      const max = Math.max(oldLines.length, newLines.length);

      lines.push(chalk.cyan(`@@ -1,${oldLines.length} +1,${newLines.length} @@`));

      for (let i = 0; i < max; i++) {
        const o = oldLines[i];
        const n = newLines[i];

        if (o === n) {
          if (o !== undefined) lines.push(chalk.hex('#64748b')(`  ${o}`));
        } else {
          if (o !== undefined) lines.push(chalk.red(`- ${o}`));
          if (n !== undefined) lines.push(chalk.green(`+ ${n}`));
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Displays the session or git diff in the console
   */
  public static async showDiff(targetFile?: string): Promise<void> {
    console.log(chalk.bold.hex('#a5b4fc')(`\n📋 ANTRI Code Changes & Diff Inspector:`));
    console.log(chalk.hex('#334155')('─'.repeat(70)));

    if (this.snapshots.length === 0) {
      // Check if git diff exists in working dir
      try {
        const { stdout } = await execPromise('git diff HEAD', { timeout: 3000 });
        if (stdout && stdout.trim().length > 0) {
          console.log(this.colorizeGitDiff(stdout.trim()));
          console.log(chalk.hex('#334155')('─'.repeat(70)));
          console.log(chalk.hex('#94a3b8')('Tip: Revert changes anytime with: /revert or /diff revert\n'));
          return;
        }
      } catch (_) {}

      console.log(chalk.hex('#64748b')('No recent file modifications in this session or clean git tree.\n'));
      return;
    }

    const filtered = targetFile
      ? this.snapshots.filter((s) => s.filePath.toLowerCase().includes(targetFile.toLowerCase()))
      : this.snapshots;

    if (filtered.length === 0) {
      console.log(chalk.hex('#f59e0b')(`No recorded changes found for "${targetFile}".\n`));
      return;
    }

    for (const snap of filtered) {
      const diffText = this.formatColoredDiff(snap.filePath, snap.previousContent, snap.newContent);
      console.log(diffText);
      console.log(chalk.hex('#334155')('─'.repeat(70)));
    }

    console.log(chalk.hex('#94a3b8')(`Total files modified in session: ${chalk.bold.white(filtered.length)}`));
    console.log(chalk.hex('#94a3b8')(`Revert changes anytime with: ${chalk.cyan('/revert')} or ${chalk.cyan('/diff revert')}\n`));
  }

  /**
   * Reverts changes made to files in this session
   */
  public static async revert(targetFile?: string): Promise<{ success: boolean; revertedFiles: string[] }> {
    const revertedFiles: string[] = [];

    if (this.snapshots.length === 0) {
      // Attempt git checkout / restore if in git repository
      try {
        const cmd = targetFile ? `git checkout -- "${targetFile}"` : 'git checkout -- .';
        await execPromise(cmd, { timeout: 4000 });
        console.log(chalk.green(`✔ Successfully reverted working tree via git checkout.`));
        return { success: true, revertedFiles: [targetFile || 'All git tracked files'] };
      } catch (err: any) {
        console.log(chalk.hex('#f43f5e')(`No snapshots to revert and git checkout failed: ${err.message}`));
        return { success: false, revertedFiles: [] };
      }
    }

    const toRevert = targetFile
      ? this.snapshots.filter((s) => s.filePath.toLowerCase().includes(targetFile.toLowerCase()))
      : [...this.snapshots].reverse();

    for (const snap of toRevert) {
      try {
        if (snap.type === 'create') {
          // File was created by ANTRI: remove it
          if (fs.existsSync(snap.filePath)) {
            fs.unlinkSync(snap.filePath);
            revertedFiles.push(`${path.basename(snap.filePath)} (Deleted new file)`);
          }
        } else if (snap.previousContent !== null) {
          // File was edited or deleted: restore previous content
          const dir = path.dirname(snap.filePath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(snap.filePath, snap.previousContent, 'utf-8');
          revertedFiles.push(`${path.basename(snap.filePath)} (Restored previous version)`);
        }
      } catch (err: any) {
        console.log(chalk.hex('#f43f5e')(`Failed to revert ${snap.filePath}: ${err.message}`));
      }
    }

    // Clear snapshot history for reverted files
    this.snapshots = targetFile
      ? this.snapshots.filter((s) => !s.filePath.toLowerCase().includes(targetFile.toLowerCase()))
      : [];

    console.log(chalk.bold.hex('#10b981')(`\n✔ Revert Completed Successfully:`));
    for (const f of revertedFiles) {
      console.log(chalk.cyan(`  • ${f}`));
    }
    console.log();

    return { success: true, revertedFiles };
  }

  private static colorizeGitDiff(diffStr: string): string {
    return diffStr
      .split('\n')
      .map((line) => {
        if (line.startsWith('+') && !line.startsWith('+++')) return chalk.green(line);
        if (line.startsWith('-') && !line.startsWith('---')) return chalk.red(line);
        if (line.startsWith('@@')) return chalk.cyan(line);
        if (line.startsWith('diff --git')) return chalk.bold.hex('#94a3b8')(line);
        return chalk.hex('#64748b')(line);
      })
      .join('\n');
  }
}
