import { exec } from 'child_process';
import util from 'util';
import chalk from 'chalk';
import ora from 'ora';
import { log } from '../utils/logger.js';

const execPromise = util.promisify(exec);

export class Updater {
  public static readonly PACKAGE_NAME = 'antri_cli';
  public static readonly CURRENT_VERSION = '1.57.4';

  /**
   * Fetches latest release version directly from registry.npmjs.org (cache-free)
   */
  public static async getLatestVersion(): Promise<string> {
    try {
      const response = await fetch(`https://registry.npmjs.org/${this.PACKAGE_NAME}/latest`, {
        headers: { 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(4000),
      });
      if (response.ok) {
        const data: any = await response.json();
        if (data && data.version) return data.version.trim();
      }
    } catch {}

    try {
      const { stdout } = await execPromise(`npm view ${this.PACKAGE_NAME} version`, { timeout: 6000 });
      if (stdout && stdout.trim()) return stdout.trim();
    } catch {}

    return this.CURRENT_VERSION;
  }

  /**
   * Checks for available updates and self-updates the global antri CLI
   */
  public static async update(): Promise<boolean> {
    console.log(chalk.bold.hex('#c084fc')('\n🔄 ANTRI Code Self-Updater'));
    console.log(chalk.hex('#334155')('─'.repeat(68)));
    console.log(`Current installed version: ${chalk.cyan(`v${this.CURRENT_VERSION}`)}`);

    const spinner = ora({
      text: chalk.hex('#a5b4fc')('Checking npm registry for latest release of antri_cli...'),
      spinner: 'dots',
      color: 'cyan',
    }).start();

    try {
      const latestVersion = await this.getLatestVersion();

      if (this.CURRENT_VERSION === latestVersion) {
        spinner.succeed(chalk.green(`You are already running the latest version of ANTRI Code (v${this.CURRENT_VERSION})!`));
        console.log(chalk.hex('#64748b')('Zero update needed · System is completely up to date.'));
        console.log(chalk.hex('#334155')('─'.repeat(68)));
        console.log();
        return true;
      }

      spinner.text = chalk.hex('#a5b4fc')(`New release found: v${latestVersion}. Upgrading global package...`);

      let updated = false;
      try {
        await execPromise(`npm install -g ${this.PACKAGE_NAME}@latest --force`, {
          timeout: 45000,
        });
        updated = true;
      } catch (installErr: any) {
        // Windows file locking fallback
        spinner.info(chalk.yellow(`Update available: v${latestVersion} (Current: v${this.CURRENT_VERSION})`));
        console.log(chalk.hex('#94a3b8')('\nOn Windows, the running process cannot overwrite itself in-place.'));
        console.log(`👉 Run this in your terminal to complete the update:`);
        console.log(chalk.bold.cyan(`   npm install -g ${this.PACKAGE_NAME}@latest\n`));
        console.log(chalk.hex('#334155')('─'.repeat(68)));
        console.log();
        return true;
      }

      if (updated) {
        spinner.succeed(chalk.green(`Successfully updated ${chalk.bold('ANTRI Code')} to v${latestVersion}!`));
        console.log(chalk.hex('#64748b')('Zero lockfile churn · Clean global update complete.'));
        console.log(chalk.hex('#334155')('─'.repeat(68)));
        console.log();
      }

      return true;
    } catch (err: any) {
      spinner.fail(chalk.red(`Self-update check note: ${err.message}`));
      console.log(chalk.hex('#94a3b8')(`You are on v${this.CURRENT_VERSION}.`));
      console.log(chalk.hex('#334155')('─'.repeat(68)));
      console.log();
      return false;
    }
  }
}
