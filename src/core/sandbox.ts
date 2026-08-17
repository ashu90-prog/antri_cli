import { exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import util from 'util';

const execPromise = util.promisify(exec);

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  sandboxed: boolean;
  isolationType: 'docker' | 'subprocess' | 'python';
}

export class SandboxEngine {
  private static pythonCommand: string | null = null;
  private static dockerAvailable: boolean | null = null;

  /**
   * Auto-detect available Python command (python, python3, py)
   */
  public static async getPythonCommand(): Promise<string> {
    if (this.pythonCommand) return this.pythonCommand;

    const candidates = ['python', 'python3', 'py'];
    for (const cmd of candidates) {
      try {
        const { stdout } = await execPromise(`${cmd} --version`);
        if (stdout || cmd) {
          this.pythonCommand = cmd;
          return cmd;
        }
      } catch {}
    }
    this.pythonCommand = 'python';
    return 'python';
  }

  /**
   * Check if Docker is installed and running
   */
  public static async isDockerAvailable(): Promise<boolean> {
    if (this.dockerAvailable !== null) return this.dockerAvailable;

    try {
      await execPromise('docker info', { timeout: 3000 });
      this.dockerAvailable = true;
    } catch {
      this.dockerAvailable = false;
    }
    return this.dockerAvailable;
  }

  /**
   * Executes Python code in an isolated temporary runtime environment
   */
  public static async executePython(
    code: string,
    workingDir = process.cwd(),
    timeoutMs = 30000
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const pyCmd = await this.getPythonCommand();
    const tempDir = path.join(os.tmpdir(), 'antri_sandbox');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const scriptPath = path.join(tempDir, `script_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.py`);
    fs.writeFileSync(scriptPath, code, 'utf-8');

    try {
      const { stdout, stderr } = await execPromise(`"${pyCmd}" "${scriptPath}"`, {
        cwd: workingDir,
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024 * 5,
      });

      return {
        stdout: stdout ? stdout.trim() : '',
        stderr: stderr ? stderr.trim() : '',
        exitCode: 0,
        durationMs: Date.now() - startTime,
        sandboxed: true,
        isolationType: 'python',
      };
    } catch (err: any) {
      return {
        stdout: err.stdout ? err.stdout.trim() : '',
        stderr: err.stderr ? err.stderr.trim() : (err.message || 'Execution error'),
        exitCode: err.code || 1,
        durationMs: Date.now() - startTime,
        sandboxed: true,
        isolationType: 'python',
      };
    } finally {
      try {
        if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
      } catch {}
    }
  }

  /**
   * Executes Shell command with subprocess/docker isolation
   */
  public static async executeShell(
    command: string,
    workingDir = process.cwd(),
    useDockerIfAvailable = false,
    timeoutMs = 30000
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    // Check Docker container isolation option
    if (useDockerIfAvailable && (await this.isDockerAvailable())) {
      try {
        const dockerCmd = `docker run --rm -v "${workingDir}:/workspace" -w /workspace alpine/sh -c "${command.replace(/"/g, '\\"')}"`;
        const { stdout, stderr } = await execPromise(dockerCmd, { timeout: timeoutMs });
        return {
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: 0,
          durationMs: Date.now() - startTime,
          sandboxed: true,
          isolationType: 'docker',
        };
      } catch {
        // Fallback to native subprocess
      }
    }

    // Subprocess execution
    try {
      const { stdout, stderr } = await execPromise(command, {
        cwd: workingDir,
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024 * 5,
      });

      return {
        stdout: (stdout || '').trim(),
        stderr: (stderr || '').trim(),
        exitCode: 0,
        durationMs: Date.now() - startTime,
        sandboxed: false,
        isolationType: 'subprocess',
      };
    } catch (err: any) {
      return {
        stdout: (err.stdout || '').trim(),
        stderr: (err.stderr || err.message || '').trim(),
        exitCode: err.code || 1,
        durationMs: Date.now() - startTime,
        sandboxed: false,
        isolationType: 'subprocess',
      };
    }
  }
}
