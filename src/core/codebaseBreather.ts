import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';

export interface ProjectCacheData {
  projectName: string;
  version: string;
  projectType: string;
  techStack: string[];
  totalFiles: number;
  totalDirectories: number;
  topDirectories: Array<{ name: string; fileCount: number }>;
  entryPoints: string[];
  dependencies: string[];
  devDependencies: string[];
  scripts: Record<string, string>;
  gitInfo?: {
    branch: string;
    modifiedFilesCount: number;
    lastCommit: string;
  };
  architectureSummary: string;
  keyFiles: string[];
  scannedAt: number;
}

export class ProjectContextCache {
  private static cache: Map<string, ProjectCacheData> = new Map();

  public static get(workingDir: string): ProjectCacheData | undefined {
    const normalized = path.resolve(workingDir);
    return this.cache.get(normalized);
  }

  public static set(workingDir: string, data: ProjectCacheData): void {
    const normalized = path.resolve(workingDir);
    this.cache.set(normalized, data);

    // Save lightweight cache to ~/.antri/cache/
    try {
      const cacheDir = path.join(os.homedir(), '.antri', 'cache');
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      const safeName = path.basename(normalized).replace(/[^a-zA-Z0-9_-]/g, '_');
      const cacheFile = path.join(cacheDir, `project_${safeName}.json`);
      fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch {}
  }

  public static getContextSummary(workingDir: string): string {
    const data = this.get(workingDir);
    if (!data) return '';

    const stack = data.techStack.length > 0 ? data.techStack.join(', ') : 'Standard Project';
    const entrypoints = data.entryPoints.length > 0 ? data.entryPoints.join(', ') : 'Root';
    const topDirs = data.topDirectories.map((d) => `${d.name} (${d.fileCount} files)`).join(', ');
    const git = data.gitInfo ? `Git: [Branch: ${data.gitInfo.branch}, ${data.gitInfo.modifiedFilesCount} modified, Last: "${data.gitInfo.lastCommit.slice(0, 40)}"]` : 'Git: Not initialized';

    return `\n\n══════════════════════════════════════════════════════════════════════
🫁 ANTRI CODEBASE INTELLIGENCE CACHE (PRE-ANALYZED CONTEXT)
══════════════════════════════════════════════════════════════════════
• Project: ${data.projectName} v${data.version} (${data.projectType})
• Tech Stack: ${stack}
• Total Source Files: ${data.totalFiles} across ${data.totalDirectories} directories
• Key Entrypoints: ${entrypoints}
• Subsystem Modules: ${topDirs || 'Root-level'}
• Key Files: ${data.keyFiles.slice(0, 12).join(', ')}
• ${git}
• Architecture: ${data.architectureSummary}
══════════════════════════════════════════════════════════════════════`;
  }
}

export class CodebaseBreather {
  private static IGNORED_DIRS = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    'out',
    '.next',
    '.nuxt',
    '.cache',
    '.vscode',
    '.idea',
    'coverage',
    '.antri',
    '.dart_tool',
    'target',
    'vendor',
    '__pycache__',
    '.pytest_cache',
    '.turbo',
    'bin',
    'obj',
  ]);

  /**
   * Let ANTRI breathe for 1-2 seconds, analyze codebase architecture & index important metadata
   */
  public static async breathe(
    workingDir: string = process.cwd(),
    options: {
      silent?: boolean;
      minDurationMs?: number;
      showPulse?: boolean;
    } = {}
  ): Promise<ProjectCacheData> {
    const startTime = Date.now();
    const minDuration = options.minDurationMs ?? 1300;
    const normalized = path.resolve(workingDir);

    let spinner: any = null;
    if (!options.silent) {
      const projectName = path.basename(normalized);
      spinner = ora({
        text: chalk.hex('#c084fc')(`✨ ANTRI is breathing... Analyzing "${projectName}" architecture & indexing context...`),
        spinner: {
          interval: 80,
          frames: ['🫁 ⠋', '🫁 ⠙', '🫁 ⠹', '🫁 ⠸', '🫁 ⠼', '🫁 ⠴', '🫁 ⠦', '🫁 ⠧', '🫁 ⠇', '🫁 ⠏'],
        },
        color: 'magenta',
      }).start();
    }

    // 1. Core Codebase Analysis
    const analysis = this.analyzeCodebase(normalized);

    // 2. Ensure smooth breathing duration (1-2 seconds)
    const elapsed = Date.now() - startTime;
    if (elapsed < minDuration) {
      await new Promise((r) => setTimeout(r, minDuration - elapsed));
    }

    // 3. Cache the analysis
    ProjectContextCache.set(normalized, analysis);

    if (spinner) {
      const stack = analysis.techStack.slice(0, 3).join(', ') || analysis.projectType;
      spinner.succeed(
        chalk.hex('#a855f7')(
          `✨ [ANTRI Breathed]: Indexed ${chalk.bold.white(analysis.projectName)} (${chalk.cyan(stack)}) · ${chalk.green(analysis.totalFiles + ' files')} · ${chalk.gray('Cache Warm')}`
        )
      );
    }

    return analysis;
  }

  /**
   * Fast non-blocking sync analysis for instant retrieval
   */
  public static analyzeCodebase(workingDir: string): ProjectCacheData {
    let projectName = path.basename(workingDir);
    let version = '1.0.0';
    let projectType = 'Generic Workspace';
    const techStack: string[] = [];
    const entryPoints: string[] = [];
    const dependencies: string[] = [];
    const devDependencies: string[] = [];
    const scripts: Record<string, string> = {};
    const keyFiles: string[] = [];

    // 1. Inspect package manifests & configurations
    const pkgPath = path.join(workingDir, 'package.json');
    const tsconfigPath = path.join(workingDir, 'tsconfig.json');
    const pubspecPath = path.join(workingDir, 'pubspec.yaml');
    const cargoPath = path.join(workingDir, 'Cargo.toml');
    const pyprojectPath = path.join(workingDir, 'pyproject.toml');
    const reqPath = path.join(workingDir, 'requirements.txt');
    const goModPath = path.join(workingDir, 'go.mod');
    const indexHtmlPath = path.join(workingDir, 'index.html');

    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.name) projectName = pkg.name;
        if (pkg.version) version = pkg.version;
        if (pkg.scripts) Object.assign(scripts, pkg.scripts);

        const deps = Object.keys(pkg.dependencies || {});
        const devDeps = Object.keys(pkg.devDependencies || {});
        dependencies.push(...deps.slice(0, 15));
        devDependencies.push(...devDeps.slice(0, 15));

        // Tech stack discovery
        if (fs.existsSync(tsconfigPath)) techStack.push('TypeScript');
        else techStack.push('JavaScript');

        if (pkg.type === 'module') techStack.push('ESM');
        if (deps.includes('next') || devDeps.includes('next')) {
          projectType = 'Next.js Web Application';
          techStack.push('Next.js', 'React');
        } else if (deps.includes('react') || devDeps.includes('react')) {
          projectType = 'React Application';
          techStack.push('React');
        } else if (deps.includes('express')) {
          projectType = 'Express.js Backend & API';
          techStack.push('Express');
        } else if (pkg.bin) {
          projectType = 'Node.js CLI & Autonomous Agent';
        } else {
          projectType = 'Node.js Application';
        }

        if (deps.includes('tailwindcss') || devDeps.includes('tailwindcss')) techStack.push('TailwindCSS');
        if (deps.includes('chalk')) techStack.push('Chalk');
        if (deps.includes('commander')) techStack.push('Commander');

        if (pkg.main) entryPoints.push(pkg.main);
        if (pkg.bin) {
          if (typeof pkg.bin === 'string') entryPoints.push(pkg.bin);
          else if (typeof pkg.bin === 'object') entryPoints.push(...Object.values(pkg.bin as Record<string, string>));
        }
      } catch {}
    } else if (fs.existsSync(pubspecPath)) {
      projectType = 'Flutter Cross-Platform Application';
      techStack.push('Flutter', 'Dart');
      entryPoints.push('lib/main.dart');
    } else if (fs.existsSync(cargoPath)) {
      projectType = 'Rust Systems Application';
      techStack.push('Rust', 'Cargo');
      entryPoints.push('src/main.rs');
    } else if (fs.existsSync(pyprojectPath) || fs.existsSync(reqPath)) {
      projectType = 'Python Application / Backend';
      techStack.push('Python');
      entryPoints.push('main.py');
    } else if (fs.existsSync(goModPath)) {
      projectType = 'Go Application';
      techStack.push('Go');
      entryPoints.push('main.go');
    } else if (fs.existsSync(indexHtmlPath)) {
      projectType = 'Vanilla Web Application (HTML/CSS/JS)';
      techStack.push('HTML5', 'CSS3', 'JavaScript');
      entryPoints.push('index.html');
    }

    // 2. Scan file tree & directories
    const dirCountMap: Map<string, number> = new Map();
    let totalFiles = 0;
    let totalDirectories = 0;

    const scanDir = (dir: string, depth = 0) => {
      if (depth > 4) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;
          if (this.IGNORED_DIRS.has(entry.name)) continue;

          const fullPath = path.join(dir, entry.name);
          const relPath = path.relative(workingDir, fullPath).replace(/\\/g, '/');

          if (entry.isDirectory()) {
            totalDirectories++;
            scanDir(fullPath, depth + 1);
          } else {
            totalFiles++;
            const parentDir = path.dirname(relPath);
            if (parentDir && parentDir !== '.') {
              dirCountMap.set(parentDir, (dirCountMap.get(parentDir) || 0) + 1);
            }

            // Key files
            if (
              depth <= 2 &&
              (entry.name.endsWith('.json') ||
                entry.name.endsWith('.ts') ||
                entry.name.endsWith('.js') ||
                entry.name.endsWith('.md') ||
                entry.name.endsWith('.html') ||
                entry.name.endsWith('.yaml') ||
                entry.name.endsWith('.toml'))
            ) {
              if (keyFiles.length < 20) {
                keyFiles.push(relPath);
              }
            }

            // Entrypoint detection
            if (
              (entry.name === 'index.ts' ||
                entry.name === 'index.js' ||
                entry.name === 'main.ts' ||
                entry.name === 'main.py' ||
                entry.name === 'app.ts' ||
                entry.name === 'server.ts' ||
                entry.name === 'index.html') &&
              !entryPoints.includes(relPath)
            ) {
              entryPoints.push(relPath);
            }
          }
        }
      } catch {}
    };

    scanDir(workingDir, 0);

    // Sort top directories by file count
    const topDirectories = Array.from(dirCountMap.entries())
      .map(([name, fileCount]) => ({ name, fileCount }))
      .sort((a, b) => b.fileCount - a.fileCount)
      .slice(0, 8);

    // 3. Inspect Git metadata
    let gitInfo: ProjectCacheData['gitInfo'] | undefined;
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: workingDir, stdio: ['pipe', 'pipe', 'ignore'] })
        .toString()
        .trim();
      const status = execSync('git status --porcelain', { cwd: workingDir, stdio: ['pipe', 'pipe', 'ignore'] })
        .toString()
        .trim();
      const modifiedCount = status ? status.split('\n').filter(Boolean).length : 0;
      const lastCommit = execSync('git log -1 --pretty=format:"%s"', { cwd: workingDir, stdio: ['pipe', 'pipe', 'ignore'] })
        .toString()
        .trim();

      gitInfo = {
        branch: branch || 'unknown',
        modifiedFilesCount: modifiedCount,
        lastCommit: lastCommit || 'No commits yet',
      };
    } catch {}

    const architectureSummary = `${projectType} with ${totalFiles} source files distributed across ${topDirectories.length} main subsystems (${topDirectories.map((d) => d.name).slice(0, 4).join(', ')}).`;

    return {
      projectName,
      version,
      projectType,
      techStack,
      totalFiles,
      totalDirectories,
      topDirectories,
      entryPoints,
      dependencies,
      devDependencies,
      scripts,
      gitInfo,
      architectureSummary,
      keyFiles,
      scannedAt: Date.now(),
    };
  }
}
