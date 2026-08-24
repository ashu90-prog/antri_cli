import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import chalk from 'chalk';
import { AntriConfig } from '../types.js';
import { configManager } from './config.js';
import { AntriAgent } from './agent.js';
import { AuthManager } from '../cloud/auth.js';
import { log } from '../utils/logger.js';

const execPromise = util.promisify(exec);

export interface FixResult {
  success: boolean;
  fixed: boolean;
  verified: boolean;
  reason?: string;
  message?: string;
  diagnosedIssue?: string;
  commandRun?: string;
}

export class ProjectBugFixer {
  /**
   * Main entrypoint for `antri fix`
   */
  public static async runFix(
    userTarget?: string,
    customWorkingDir?: string
  ): Promise<FixResult> {
    const config = configManager.get();
    const workingDir = customWorkingDir || config.workingDir || process.cwd();

    console.log(chalk.bold.hex('#c084fc')('\n🛠️  ANTRI Code · Autonomous Project Bug Fixer'));
    console.log(chalk.hex('#64748b')(`Working Directory: ${workingDir}`));
    console.log(chalk.hex('#334155')('─'.repeat(65)));

    // 1. Authentication Gate
    if (!AuthManager.isAuthenticated()) {
      console.log(chalk.bold.hex('#f43f5e')('\n🔒 AUTHENTICATION REQUIRED'));
      console.log(chalk.hex('#cbd5e1')('To use \'antri fix\' to automatically diagnose and repair bugs in your project, you must be logged in.'));
      console.log(chalk.hex('#38bdf8')('👉 Please log in: antri login <your-email> (or launch \'antri\' and type /login)\n'));
      return {
        success: false,
        fixed: false,
        verified: false,
        reason: 'auth_required',
        message: 'Authentication required. Please run "antri login <email>".',
      };
    }

    const currentUser = AuthManager.getCurrentUser()!;
    console.log(chalk.green(`✔ Authenticated as: ${currentUser.email} (${currentUser.userId})`));

    // 2. API Key Setup Gate
    const keyStatus = configManager.hasActiveApiKey(config.provider);
    if (!keyStatus.configured && config.provider !== 'mock') {
      console.log(chalk.bold.hex('#f43f5e')('\n🔑 API KEY SETUP REQUIRED'));
      console.log(chalk.hex('#cbd5e1')(`No active API key found for configured provider '${config.provider}'.`));
      console.log(chalk.hex('#cbd5e1')('\'antri fix\' requires an active AI provider to analyze your codebase, locate bugs, and apply fixes.'));
      console.log(chalk.hex('#38bdf8')(`👉 Configure your key:\n   1. Launch 'antri' and type /connect or /key ${config.provider} <your-api-key>\n   2. Or export ${keyStatus.envVar}=your_key_here\n`));
      return {
        success: false,
        fixed: false,
        verified: false,
        reason: 'api_key_required',
        message: `API key required for ${config.provider}. Please configure with /key or ${keyStatus.envVar}.`,
      };
    }

    console.log(chalk.green(`✔ AI Provider configured: ${config.provider} (${config.model})\n`));

    // 3. Detect Project Type & Verification Commands
    const diag = await this.detectAndRunDiagnostics(workingDir, userTarget);

    if (diag.passed && !userTarget) {
      console.log(chalk.bold.green('✨ Project Health Check Passed!'));
      console.log(chalk.hex('#86efac')('No broken bugs, compiler errors, or test failures detected in the workspace.'));
      console.log(chalk.hex('#94a3b8')(`Verification command '${diag.command}' passed cleanly.\n`));
      return {
        success: true,
        fixed: false,
        verified: true,
        message: 'No bugs found. All tests and builds passing.',
        commandRun: diag.command,
      };
    }

    // 4. Broken Bug / Issue Detected - Launch Autonomous Fix Loop
    console.log(chalk.bold.hex('#f59e0b')('🔍 Issue Detected in Project:'));
    if (diag.errorOutput) {
      const snippet = diag.errorOutput.slice(0, 400);
      console.log(chalk.hex('#fca5a5')(snippet));
      if (diag.errorOutput.length > 400) console.log(chalk.gray('... [truncated]'));
    } else if (userTarget) {
      console.log(chalk.hex('#fca5a5')(`Target requested: ${userTarget}`));
    }
    console.log();
    console.log(chalk.bold.hex('#38bdf8')('🔧 Launching ANTRI Autonomous Repair Agent...'));

    const fixPrompt = this.buildFixPrompt(diag, userTarget, workingDir);
    const agent = new AntriAgent(config);

    try {
      const agentReply = await agent.chat(fixPrompt);

      // 5. Re-run Verification Command to Empirically Verify Fix
      console.log(chalk.bold.hex('#c084fc')('\n🧪 Verifying Fix Empirically...'));
      const recheck = await this.executeCheckCommand(diag.command, workingDir);

      if (recheck.success) {
        console.log(chalk.bold.green('\n✅ [ANTRI Fix Complete] Successfully repaired project bugs!'));
        console.log(chalk.hex('#86efac')(`• Empirical Verification: Passed ('${diag.command}' exited cleanly with code 0)`));
        console.log(chalk.hex('#94a3b8')('• Your workspace is back in a healthy, passing state.\n'));
        return {
          success: true,
          fixed: true,
          verified: true,
          diagnosedIssue: diag.errorOutput?.slice(0, 150),
          commandRun: diag.command,
        };
      } else {
        console.log(chalk.bold.hex('#f59e0b')('\n⚠️ [ANTRI Fix] Changes applied, but verification still reports issues:'));
        console.log(chalk.hex('#fca5a5')(recheck.output.slice(0, 300)));
        console.log(chalk.hex('#94a3b8')('\nTip: You can launch \'antri\' for an interactive step-by-step debugging session.\n'));
        return {
          success: false,
          fixed: true,
          verified: false,
          reason: 'verification_failed',
          diagnosedIssue: recheck.output.slice(0, 200),
          commandRun: diag.command,
        };
      }
    } catch (err: any) {
      console.log(chalk.red(`\n❌ Error during bug fix execution: ${err.message}\n`));
      return {
        success: false,
        fixed: false,
        verified: false,
        reason: 'agent_execution_error',
        message: err.message,
      };
    }
  }

  /**
   * Scans project manifests to determine best verification command (npm test, tsc, pytest, etc.)
   */
  private static async detectAndRunDiagnostics(
    workingDir: string,
    userTarget?: string
  ): Promise<{ command: string; passed: boolean; errorOutput?: string }> {
    let testCmd = 'npm test';

    // 1. Node / TypeScript / JavaScript
    const pkgPath = path.join(workingDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.scripts && pkg.scripts.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
          testCmd = 'npm test';
        } else if (fs.existsSync(path.join(workingDir, 'tsconfig.json'))) {
          testCmd = 'npx tsc --noEmit';
        } else if (pkg.scripts && pkg.scripts.build) {
          testCmd = 'npm run build';
        } else if (pkg.scripts && pkg.scripts.lint) {
          testCmd = 'npm run lint';
        }
      } catch {}
    } else if (fs.existsSync(path.join(workingDir, 'pubspec.yaml'))) {
      testCmd = 'flutter analyze';
    } else if (fs.existsSync(path.join(workingDir, 'Cargo.toml'))) {
      testCmd = 'cargo check';
    } else if (fs.existsSync(path.join(workingDir, 'go.mod'))) {
      testCmd = 'go test ./...';
    } else if (fs.existsSync(path.join(workingDir, 'pytest.ini')) || fs.existsSync(path.join(workingDir, 'pyproject.toml'))) {
      testCmd = 'pytest';
    } else {
      testCmd = 'git status --porcelain';
    }

    if (userTarget) {
      return { command: testCmd, passed: false, errorOutput: userTarget };
    }

    const check = await this.executeCheckCommand(testCmd, workingDir);
    return {
      command: testCmd,
      passed: check.success,
      errorOutput: check.success ? undefined : check.output,
    };
  }

  private static async executeCheckCommand(
    command: string,
    workingDir: string
  ): Promise<{ success: boolean; output: string }> {
    try {
      const { stdout, stderr } = await execPromise(command, {
        cwd: workingDir,
        timeout: 60000,
        env: { ...process.env, CI: 'true' },
      });
      return { success: true, output: `${stdout}\n${stderr}`.trim() };
    } catch (err: any) {
      const combined = `${err.stdout || ''}\n${err.stderr || ''}\n${err.message || ''}`.trim();
      return { success: false, output: combined };
    }
  }

  private static buildFixPrompt(
    diag: { command: string; errorOutput?: string },
    userTarget: string | undefined,
    workingDir: string
  ): string {
    return `You are the ANTRI Autonomous Bug Fixer.
Your goal is to pinpoint and fix the broken bug or failing test in this workspace.

Workspace: ${workingDir}
Verification Command: "${diag.command}"

${userTarget ? `User Fix Request: "${userTarget}"` : ''}

Detected Failure / Error Output:
"""
${(diag.errorOutput || 'No specific error output provided').slice(0, 2500)}
"""

Instructions:
1. Use workspace tools (read_file, grep_search, find_files) to inspect the relevant source code files where the bug originated.
2. Locate the exact root cause of the error.
3. Use 'edit_file' or 'write_file' to apply a precise, minimal patch fixing the bug.
4. Use 'run_command' with "${diag.command}" to test and verify that your fix completely resolves the issue.
5. Provide a concise summary of the bug diagnosed, files edited, and verification outcome.`;
  }
}
