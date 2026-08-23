import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { exec } from 'child_process';
import util from 'util';
import chalk from 'chalk';
import { ToolDefinition, ToolResult } from '../types.js';
import { WebSearchEngine } from './search.js';
import { WebScraper } from './scraper.js';
import { DocCrawler } from './crawler.js';
import { SandboxEngine } from './sandbox.js';
import { SkillSynthesizer } from './skillSynthesizer.js';
import { skillManager } from '../skills/skillManager.js';
import { configManager } from './config.js';

const execPromise = util.promisify(exec);

export const SENSITIVE_TOOLS = new Set([
  'web_search',
  'scrape_url',
  'crawl_docs',
  'run_command',
  'execute_python',
  'synthesize_skill',
  'edit_file',
  'delete_file',
]);

/**
 * Extracts pure conversational messages from shell echo/printf commands.
 */
export function extractEchoMessage(command: string): string | null {
  if (!command || typeof command !== 'string') return null;
  const trimmed = command.trim();

  // If command redirects to a file or pipes to another command, it's a real shell command
  if (/[><|;&`]/.test(trimmed)) {
    const hasRedirection = /(?:>>|>|<|\||&&|;|\$\()/.test(trimmed);
    if (hasRedirection) {
      const match = trimmed.match(/^echo\s+(['"])([\s\S]*)\1$/i);
      if (!match) return null;
    }
  }

  // 1. Match echo '...' or echo "..."
  const quoteMatch = trimmed.match(/^echo\s+(['"])([\s\S]*)\1$/i);
  if (quoteMatch) {
    return quoteMatch[2].replace(/\\(['"])/g, '$1').trim();
  }

  // 2. Match echo -e '...' / echo -n '...'
  const echoOptMatch = trimmed.match(/^echo\s+-[enE]+\s+(['"])([\s\S]*)\1$/i);
  if (echoOptMatch) {
    return echoOptMatch[2].replace(/\\(['"])/g, '$1').trim();
  }

  // 3. Match printf '...' / printf "..." / printf '%s\n' "..."
  const printfMatch = trimmed.match(/^printf\s+(?:['"][^'"]*['"]\s+)?(['"])([\s\S]*)\1$/i);
  if (printfMatch) {
    return printfMatch[2].replace(/\\(['"])/g, '$1').trim();
  }

  // 4. Match plain echo Hello world (without quotes)
  if (/^echo\s+[^><|&;$`]+$/i.test(trimmed)) {
    const raw = trimmed.replace(/^echo\s+/i, '').trim();
    return raw.replace(/^['"]|['"]$/g, '').replace(/\\(['"])/g, '$1').trim();
  }

  return null;
}

export const AVAILABLE_TOOLS: ToolDefinition[] = [
  {
    name: 'web_search',
    description: 'Search the live web for up-to-date information, documentation, libraries, or answers using multi-provider search (DuckDuckGo, SearXNG) without requiring an API key.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query or keywords to look up.',
        },
        num_results: {
          type: 'number',
          description: 'Optional maximum number of search results to return (default: 5).',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'scrape_url',
    description: 'Scrape a web page or article, extract its primary readable text (filtering ads, nav, headers, and footers), and convert it to structured clean Markdown.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The absolute HTTP or HTTPS URL to scrape.',
        },
        max_chars: {
          type: 'number',
          description: 'Optional maximum number of characters to return (default: 8000).',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'crawl_docs',
    description: 'Recursively crawl and extract documentation hierarchy and child pages from a documentation site, converting pages to a combined Markdown knowledge base.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The root documentation URL to start crawling from.',
        },
        max_pages: {
          type: 'number',
          description: 'Optional maximum number of documentation pages to crawl (default: 4).',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'execute_python',
    description: 'Execute Python code safely in an isolated sandbox runtime environment, capturing stdout and stderr.',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The Python code script to execute.',
        },
      },
      required: ['code'],
    },
  },
  {
    name: 'synthesize_skill',
    description: 'Synthesize, verify, and permanently register a new custom Python skill/tool to ~/.agent-cli/skills/ for future autonomous use.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Unique name of the new tool/skill (e.g. "calculate_checksum", "fetch_api_schema").',
        },
        description: {
          type: 'string',
          description: 'What the synthesized skill does and when to use it.',
        },
        language: {
          type: 'string',
          enum: ['python', 'javascript'],
          description: 'Language of the skill (default: python).',
        },
        code: {
          type: 'string',
          description: 'The executable script code implementing the skill.',
        },
        parametersSchema: {
          type: 'object',
          description: 'JSON schema defining parameters accepted by the skill.',
        },
        testArgs: {
          type: 'object',
          description: 'Sample arguments to verify the skill in a dry-run test.',
        },
      },
      required: ['name', 'description', 'code', 'parametersSchema'],
    },
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file from the workspace with line range support and full text inspection.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The relative or absolute path of the file to read.',
        },
        start_line: {
          type: 'number',
          description: 'Optional 1-based start line number to begin reading from (default: 1).',
        },
        max_lines: {
          type: 'number',
          description: 'Optional maximum number of lines to return (default: up to 2000 lines).',
        },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'write_file',
    description: 'Create or overwrite a file in the workspace.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The relative or absolute path of the file to write.',
        },
        content: {
          type: 'string',
          description: 'The full text content to write to the file.',
        },
      },
      required: ['file_path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description: 'Perform targeted, precise surgical edits on an existing file by replacing an exact string or code block with new code, preserving indentation, comments, and structure.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The relative or absolute path of the file to edit.',
        },
        target_content: {
          type: 'string',
          description: 'The exact lines or block of code to be replaced. Must match existing file content exactly.',
        },
        replacement_content: {
          type: 'string',
          description: 'The new code or lines to replace target_content with.',
        },
        allow_multiple: {
          type: 'boolean',
          description: 'Optional. If true, replaces all occurrences of target_content; otherwise errors if multiple are found (default: false).',
        },
      },
      required: ['file_path', 'target_content', 'replacement_content'],
    },
  },
  {
    name: 'create_directory',
    description: 'Recursively create a new directory or folder structure in the workspace.',
    parameters: {
      type: 'object',
      properties: {
        dir_path: {
          type: 'string',
          description: 'The path of the directory to create.',
        },
      },
      required: ['dir_path'],
    },
  },
  {
    name: 'delete_file',
    description: 'Delete a file or directory from the workspace.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The relative or absolute path of the file or directory to delete.',
        },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'find_files',
    description: 'Search for project files matching a glob pattern (e.g. "*.ts", "src/**/*.tsx", "**/*.py") or extension, filtering out node_modules, .git, and build artifacts.',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'The glob pattern or filename search query (e.g. "*.ts", "package.json", "**/*.css").',
        },
        dir_path: {
          type: 'string',
          description: 'Optional root directory to search within (default: workspace root).',
        },
        max_results: {
          type: 'number',
          description: 'Optional maximum number of matching file paths to return (default: 50).',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'grep_search',
    description: 'Search for exact text or regular expression patterns across workspace files with line numbers and matched line snippets.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search term or regular expression pattern to look for.',
        },
        dir_path: {
          type: 'string',
          description: 'Optional directory to search within (default: workspace root).',
        },
        is_regex: {
          type: 'boolean',
          description: 'Optional. If true, treats query as a regular expression (default: false).',
        },
        case_sensitive: {
          type: 'boolean',
          description: 'Optional. If true, performs case-sensitive search (default: false).',
        },
        max_results: {
          type: 'number',
          description: 'Optional maximum number of matching lines to return (default: 50).',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'file_info',
    description: 'Inspect metadata of a file in the workspace (size, line count, modified time, extension, permissions).',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The path of the file to inspect.',
        },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'git_diff',
    description: 'Inspect git status and uncommitted/staged code diffs in the workspace repository.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Optional specific file path to inspect diff for.',
        },
        staged: {
          type: 'boolean',
          description: 'Optional. If true, shows staged changes (--staged); otherwise shows working tree diff (default: false).',
        },
      },
    },
  },
  {
    name: 'list_dir',
    description: 'List the contents of a directory in the workspace.',
    parameters: {
      type: 'object',
      properties: {
        dir_path: {
          type: 'string',
          description: 'The directory path to list (default: current directory).',
        },
      },
    },
  },
  {
    name: 'search_files',
    description: 'Search for text or patterns in files within the workspace.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The string or pattern to search for.',
        },
        dir_path: {
          type: 'string',
          description: 'Optional directory to limit the search in.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'activate_skill',
    description: 'Load and activate specialized expert instructions from a Markdown (.md) skill (e.g. "code_reviewer", "system_architect", "root_cause_debugger", "security_auditor", "api_designer", "database_designer", "performance_optimizer", "test_automator", "ui_ux_architect", "git_devops_specialist", "documentation_writer", "refactoring_specialist", or any custom user skill).',
    parameters: {
      type: 'object',
      properties: {
        skill_name: {
          type: 'string',
          description: 'The name or ID of the skill to load and activate (e.g. "code_reviewer", "system_architect", "security_auditor").',
        },
      },
      required: ['skill_name'],
    },
  },
  {
    name: 'run_command',
    description: 'Execute a terminal/shell command in the workspace (e.g. npm, git, tsc, build scripts, tests). STRICTLY FORBIDDEN FOR CONVERSATION: NEVER use this tool to communicate with the user, greet the user, or print messages (e.g. do NOT run "echo ...", "printf ...", etc. to reply to the user). Always reply directly with text.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The terminal command to execute in the workspace (e.g. "git status", "npm test", "cargo build"). Never use echo or printf for conversational messages.',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'run_silent_debate',
    description: 'Perform a silent, multi-perspective adversarial debate (Thesis -> Antithesis -> Researcher Verification -> Judge Synthesis) secretly behind the scenes on a research topic, architectural decision, or contested claim, returning the battle-tested final consensus with the debate header.',
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'The research topic, design choice, or question to debate and synthesize.',
        },
        depth: {
          type: 'string',
          enum: ['quick', 'deep', 'rigorous'],
          description: 'Optional depth of debate (default: deep).',
        },
      },
      required: ['topic'],
    },
  },
  {
    name: 'run_silent_goal',
    description: 'Execute an autonomous silent 3-iteration goal loop (Plan & Draft -> Adversarial Quality Review -> Hardened Optimal Solution) secretly behind the scenes, returning the finalized production-ready result with the goal plan header.',
    parameters: {
      type: 'object',
      properties: {
        goal: {
          type: 'string',
          description: 'The complex goal, feature specification, or plan to accomplish and refine.',
        },
      },
      required: ['goal'],
    },
  },
  {
    name: 'create_artifact',
    description: 'Create and save an interactive HTML application/plan, visual code architecture graph, or hierarchical visual mind map artifact (Claude-style Artifact).',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Descriptive title of the artifact (e.g., "2-Day Football Stretching Plan", "Payment Microservice Flowchart", "System Design Mind Map").',
        },
        type: {
          type: 'string',
          enum: ['html', 'graph', 'mindmap'],
          description: 'Type of artifact: "html" for interactive HTML/CSS/JS applications and plans, "graph" for Mermaid/architecture flowcharts, or "mindmap" for visual hierarchical mind maps.',
        },
        content: {
          type: 'string',
          description: 'The complete self-contained HTML/CSS/JS code or Mermaid diagram / mindmap syntax.',
        },
      },
      required: ['title', 'type', 'content'],
    },
  },
];

export function getAllActiveTools(): ToolDefinition[] {
  const dynamicTools = SkillSynthesizer.getDynamicToolDefinitions();
  const existingNames = new Set(AVAILABLE_TOOLS.map((t) => t.name));
  const combined = [...AVAILABLE_TOOLS];

  for (const dt of dynamicTools) {
    if (!existingNames.has(dt.name)) {
      combined.push(dt);
    }
  }

  return combined;
}

export type PermissionHandler = (name: string, args: Record<string, any>) => Promise<boolean>;

export class ToolExecutor {
  private workingDir: string;
  private customPermissionHandler?: PermissionHandler;

  constructor(workingDir: string = process.cwd()) {
    this.workingDir = workingDir;
  }

  public setPermissionHandler(handler?: PermissionHandler): void {
    this.customPermissionHandler = handler;
  }

  public static isSensitive(name: string): boolean {
    return SENSITIVE_TOOLS.has(name);
  }

  public async promptForPermission(name: string, args: Record<string, any>): Promise<boolean> {
    const config = configManager.get();
    if (config.alwaysAllow) {
      return true;
    }

    if (!ToolExecutor.isSensitive(name)) {
      return true;
    }

    // Harmless echo/conversational commands do not require user confirmation
    if (name === 'run_command' && args?.command && extractEchoMessage(args.command) !== null) {
      return true;
    }

    if (this.customPermissionHandler) {
      return await this.customPermissionHandler(name, args);
    }

    const argsSummary = Object.entries(args)
      .map(([k, v]) => `${k}: ${typeof v === 'string' ? `"${v.slice(0, 40)}"` : JSON.stringify(v)}`)
      .join(', ');

    console.log();
    console.log(
      chalk.bgYellow.black(' ⚠️  PRIVACY & SECURITY PERMISSION ') +
      chalk.yellow(` Agent requested tool execution: `) +
      chalk.bold.cyan(name) +
      chalk.hex('#94a3b8')(` (${argsSummary})`)
    );

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>((resolve) => {
      rl.question(
        chalk.hex('#e2e8f0')('Allow execution? [y: Yes / n: Deny / a: Always Allow]: '),
        (res) => {
          rl.close();
          resolve(res.trim().toLowerCase());
        }
      );
    });

    if (answer === 'a' || answer === 'always') {
      configManager.setAlwaysAllow(true);
      console.log(chalk.green('✓ Permissions set to Always-Allow for this session and future tool calls.'));
      return true;
    }

    if (answer === 'y' || answer === 'yes' || answer === '') {
      return true;
    }

    console.log(chalk.red(`✕ Tool execution for '${name}' denied by user.`));
    return false;
  }

  public async execute(name: string, args: Record<string, any>, toolCallId: string): Promise<ToolResult> {
    try {
      const { AuthManager } = await import('../cloud/auth.js');
      const { RateLimiter } = await import('../security/rateLimiter.js');

      const user = AuthManager.getCurrentUser();
      if (!user) {
        return {
          tool_call_id: toolCallId,
          name,
          output: '✕ AUTHENTICATION REQUIRED: You must be logged into an ANTRI account to execute tools or code. Type "/login" in CLI or run "antri login".',
          error: true,
        };
      }

      // Empathy & Personal statement guard: Never web search personal emotions, grief, or personal background
      if (name === 'web_search' && args.query) {
        const personalKeywords = /(?:father|mother|dad|mom|parent|grandpa|grandma|died|passed away|lost my|loss of|grief|sad|depressed|bereavement|funeral|my name is|lost father|lost mother)/i;
        if (personalKeywords.test(args.query)) {
          return {
            tool_call_id: toolCallId,
            name,
            output: '[SYSTEM NOTICE]: Web search is disabled for personal and emotional statements. Respond directly and compassionately to the user with genuine empathy, active listening, and heartfelt support.',
            error: false,
          };
        }
      }

      const limitCheck = RateLimiter.checkLimit(user.userId, name === 'execute_python' ? 'sandbox' : 'tools');
      if (!limitCheck.allowed) {
        return {
          tool_call_id: toolCallId,
          name,
          output: `✕ RATE LIMIT EXCEEDED: Tool execution throttled for security. Please retry in ${limitCheck.retryAfterSeconds}s.`,
          error: true,
        };
      }

      // Check permission for sensitive tools
      const allowed = await this.promptForPermission(name, args);
      if (!allowed) {
        return {
          tool_call_id: toolCallId,
          name,
          output: `Tool execution cancelled: User denied permission to execute sensitive tool '${name}'.`,
          error: true,
        };
      }

      switch (name) {
        case 'execute_python': {
          const res = await SandboxEngine.executePython(args.code, this.workingDir);
          const output = (res.stdout || '') + (res.stderr ? `\n[STDERR]: ${res.stderr}` : '');
          return {
            tool_call_id: toolCallId,
            name,
            output: output.trim() || '(Python executed successfully with no output)',
            error: res.exitCode !== 0,
          };
        }

        case 'synthesize_skill': {
          const res = await SkillSynthesizer.synthesizeSkill(
            args.name,
            args.description,
            args.language || 'python',
            args.code,
            args.parametersSchema || {},
            args.testArgs || {}
          );
          return {
            tool_call_id: toolCallId,
            name,
            output: res.message,
            error: !res.success,
          };
        }

        case 'web_search': {
          const results = await WebSearchEngine.search(args.query, args.num_results || 5);
          if (results.length === 0) {
            return {
              tool_call_id: toolCallId,
              name,
              output: `No search results found for query: "${args.query}"`,
            };
          }

          let formatted = `Found ${results.length} search results for "${args.query}":\n\n`;
          results.forEach((r, idx) => {
            formatted += `[${idx + 1}] ${r.title}\n`;
            formatted += `URL: ${r.url}\n`;
            formatted += `Snippet: ${r.snippet}\n`;
            formatted += `Source: ${r.source}\n\n`;
          });

          return {
            tool_call_id: toolCallId,
            name,
            output: formatted.trim(),
          };
        }

        case 'scrape_url': {
          const scraped = await WebScraper.scrape(args.url, args.max_chars || 8000);
          let formatted = `Title: ${scraped.title}\n`;
          formatted += `URL: ${scraped.url}\n`;
          formatted += `Length: ${scraped.charCount} characters\n\n`;
          formatted += `Content (Markdown):\n${scraped.markdown}`;

          return {
            tool_call_id: toolCallId,
            name,
            output: formatted,
          };
        }

        case 'crawl_docs': {
          const crawled = await DocCrawler.crawl(args.url, args.max_pages || 4);
          let formatted = `Crawled ${crawled.pagesCrawled} documentation pages from ${crawled.startUrl}\n\n`;
          formatted += crawled.combinedMarkdown;

          return {
            tool_call_id: toolCallId,
            name,
            output: formatted,
          };
        }

        case 'read_file': {
          let resolvedPath = args.file_path;
          if (resolvedPath.startsWith('~')) {
            resolvedPath = path.join(os.homedir(), resolvedPath.slice(1));
          } else {
            resolvedPath = path.resolve(this.workingDir, resolvedPath);
          }

          if (!fs.existsSync(resolvedPath)) {
            // Check if file exists relative to cwd or home
            const cwdAlt = path.resolve(process.cwd(), args.file_path);
            const homeAlt = path.resolve(os.homedir(), args.file_path);
            if (fs.existsSync(cwdAlt)) {
              resolvedPath = cwdAlt;
            } else if (fs.existsSync(homeAlt)) {
              resolvedPath = homeAlt;
            } else {
              return {
                tool_call_id: toolCallId,
                name,
                output: `Error: File not found: ${args.file_path} (resolved as: ${resolvedPath})`,
                error: true,
              };
            }
          }

          try {
            const content = fs.readFileSync(resolvedPath, 'utf-8');
            const lines = content.split('\n');
            const totalLines = lines.length;
            const startLine = Math.max(1, args.start_line || 1);
            const maxLines = args.max_lines || 2000;
            const startIndex = startLine - 1;
            const endIndex = Math.min(totalLines, startIndex + maxLines);

            const slice = lines.slice(startIndex, endIndex);
            const truncatedNotice = endIndex < totalLines ? `\n... [${totalLines - endIndex} more lines in file]` : '';

            return {
              tool_call_id: toolCallId,
              name,
              output: `[File: ${args.file_path} (${totalLines} lines total, showing lines ${startLine}-${endIndex})]\n` + slice.join('\n') + truncatedNotice,
            };
          } catch (readErr: any) {
            return {
              tool_call_id: toolCallId,
              name,
              output: `Error reading file ${args.file_path}: ${readErr.message}`,
              error: true,
            };
          }
        }

        case 'write_file': {
          const targetPath = path.resolve(this.workingDir, args.file_path);
          const dir = path.dirname(targetPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(targetPath, args.content, 'utf-8');
          return {
            tool_call_id: toolCallId,
            name,
            output: `Successfully wrote ${args.content.length} characters to ${args.file_path}`,
          };
        }

        case 'edit_file': {
          let resolvedPath = args.file_path;
          if (resolvedPath.startsWith('~')) {
            resolvedPath = path.join(os.homedir(), resolvedPath.slice(1));
          } else {
            resolvedPath = path.resolve(this.workingDir, resolvedPath);
          }

          if (!fs.existsSync(resolvedPath)) {
            return {
              tool_call_id: toolCallId,
              name,
              output: `Error: File not found for editing: ${args.file_path}`,
              error: true,
            };
          }

          const targetContent = args.target_content;
          const replacementContent = args.replacement_content;
          const allowMultiple = !!args.allow_multiple;

          const fileContent = fs.readFileSync(resolvedPath, 'utf-8');
          if (!fileContent.includes(targetContent)) {
            return {
              tool_call_id: toolCallId,
              name,
              output: `Error: target_content not found in ${args.file_path}. Please inspect the file with read_file first to ensure exact character and whitespace match.`,
              error: true,
            };
          }

          const count = fileContent.split(targetContent).length - 1;
          if (count > 1 && !allowMultiple) {
            return {
              tool_call_id: toolCallId,
              name,
              output: `Error: target_content appears ${count} times in ${args.file_path}. Provide more surrounding context to match a unique block or set allow_multiple: true.`,
              error: true,
            };
          }

          const newContent = allowMultiple
            ? fileContent.replaceAll(targetContent, replacementContent)
            : fileContent.replace(targetContent, replacementContent);

          fs.writeFileSync(resolvedPath, newContent, 'utf-8');
          return {
            tool_call_id: toolCallId,
            name,
            output: `Successfully edited ${args.file_path} (replaced ${count} occurrence${count > 1 ? 's' : ''}).`,
          };
        }

        case 'create_directory': {
          const targetPath = path.resolve(this.workingDir, args.dir_path);
          fs.mkdirSync(targetPath, { recursive: true });
          return {
            tool_call_id: toolCallId,
            name,
            output: `Successfully created directory: ${args.dir_path}`,
          };
        }

        case 'delete_file': {
          const targetPath = path.resolve(this.workingDir, args.file_path);
          if (!fs.existsSync(targetPath)) {
            return {
              tool_call_id: toolCallId,
              name,
              output: `Error: File or directory not found to delete: ${args.file_path}`,
              error: true,
            };
          }
          const stat = fs.statSync(targetPath);
          if (stat.isDirectory()) {
            fs.rmSync(targetPath, { recursive: true, force: true });
            return {
              tool_call_id: toolCallId,
              name,
              output: `Successfully deleted directory: ${args.file_path}`,
            };
          } else {
            fs.unlinkSync(targetPath);
            return {
              tool_call_id: toolCallId,
              name,
              output: `Successfully deleted file: ${args.file_path}`,
            };
          }
        }

        case 'find_files': {
          const rootDir = path.resolve(this.workingDir, args.dir_path || '.');
          if (!fs.existsSync(rootDir)) {
            return {
              tool_call_id: toolCallId,
              name,
              output: `Error: Directory not found: ${args.dir_path}`,
              error: true,
            };
          }

          const pattern = args.pattern.toLowerCase();
          const maxResults = args.max_results || 50;
          const matches: string[] = [];

          function scanDir(dir: string) {
            if (matches.length >= maxResults) return;
            let entries: fs.Dirent[] = [];
            try {
              entries = fs.readdirSync(dir, { withFileTypes: true });
            } catch {
              return;
            }
            for (const entry of entries) {
              if (matches.length >= maxResults) return;
              if (
                entry.name.startsWith('.') ||
                entry.name === 'node_modules' ||
                entry.name === 'dist' ||
                entry.name === 'build'
              ) {
                continue;
              }
              const full = path.join(dir, entry.name);
              const rel = path.relative(rootDir, full).replace(/\\/g, '/');

              if (entry.isDirectory()) {
                scanDir(full);
              } else {
                if (
                  rel.toLowerCase().includes(pattern) ||
                  entry.name.toLowerCase().includes(pattern) ||
                  (pattern.startsWith('*.') && entry.name.toLowerCase().endsWith(pattern.slice(1)))
                ) {
                  matches.push(rel);
                }
              }
            }
          }

          scanDir(rootDir);
          return {
            tool_call_id: toolCallId,
            name,
            output:
              matches.length > 0
                ? `Found ${matches.length} matching file(s):\n${matches.join('\n')}`
                : `No files found matching '${args.pattern}'`,
          };
        }

        case 'grep_search': {
          const rootDir = path.resolve(this.workingDir, args.dir_path || '.');
          if (!fs.existsSync(rootDir)) {
            return {
              tool_call_id: toolCallId,
              name,
              output: `Error: Directory not found: ${args.dir_path}`,
              error: true,
            };
          }

          const isRegex = !!args.is_regex;
          const caseSensitive = !!args.case_sensitive;
          const maxResults = args.max_results || 50;
          const matches: string[] = [];

          let regex: RegExp;
          try {
            regex = isRegex
              ? new RegExp(args.query, caseSensitive ? 'g' : 'gi')
              : new RegExp(args.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi');
          } catch (reErr: any) {
            return {
              tool_call_id: toolCallId,
              name,
              output: `Invalid regular expression: ${reErr.message}`,
              error: true,
            };
          }

          function searchFiles(dir: string) {
            if (matches.length >= maxResults) return;
            let entries: fs.Dirent[] = [];
            try {
              entries = fs.readdirSync(dir, { withFileTypes: true });
            } catch {
              return;
            }
            for (const entry of entries) {
              if (matches.length >= maxResults) return;
              if (
                entry.name.startsWith('.') ||
                entry.name === 'node_modules' ||
                entry.name === 'dist' ||
                entry.name === 'build'
              ) {
                continue;
              }
              const full = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                searchFiles(full);
              } else {
                try {
                  const content = fs.readFileSync(full, 'utf-8');
                  const lines = content.split('\n');
                  const rel = path.relative(process.cwd(), full).replace(/\\/g, '/');
                  for (let i = 0; i < lines.length; i++) {
                    if (matches.length >= maxResults) return;
                    if (regex.test(lines[i])) {
                      matches.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
                    }
                    regex.lastIndex = 0;
                  }
                } catch {}
              }
            }
          }

          searchFiles(rootDir);
          return {
            tool_call_id: toolCallId,
            name,
            output:
              matches.length > 0
                ? `Found ${matches.length} match(es):\n${matches.join('\n')}`
                : `No matches found for '${args.query}'`,
          };
        }

        case 'file_info': {
          let resolvedPath = args.file_path;
          if (resolvedPath.startsWith('~')) {
            resolvedPath = path.join(os.homedir(), resolvedPath.slice(1));
          } else {
            resolvedPath = path.resolve(this.workingDir, resolvedPath);
          }

          if (!fs.existsSync(resolvedPath)) {
            return {
              tool_call_id: toolCallId,
              name,
              output: `Error: File not found: ${args.file_path}`,
              error: true,
            };
          }
          const stat = fs.statSync(resolvedPath);
          const isDir = stat.isDirectory();
          let lineCount = 0;
          if (!isDir) {
            try {
              const content = fs.readFileSync(resolvedPath, 'utf-8');
              lineCount = content.split('\n').length;
            } catch {}
          }
          const info = [
            `Path: ${args.file_path}`,
            `Type: ${isDir ? 'Directory' : 'File'}`,
            `Size: ${(stat.size / 1024).toFixed(2)} KB (${stat.size} bytes)`,
            `Lines: ${isDir ? 'N/A' : lineCount}`,
            `Created: ${stat.birthtime.toLocaleString()}`,
            `Modified: ${stat.mtime.toLocaleString()}`,
          ];
          return {
            tool_call_id: toolCallId,
            name,
            output: info.join('\n'),
          };
        }

        case 'git_diff': {
          const stagedFlag = args.staged ? '--staged' : '';
          const fileTarget = args.file_path ? ` -- "${args.file_path}"` : '';
          const cmd = `git diff ${stagedFlag}${fileTarget}`;
          try {
            const { stdout, stderr } = await execPromise(cmd, {
              cwd: this.workingDir,
              timeout: 15000,
            });
            const output = (stdout || '') + (stderr ? `\n[STDERR]: ${stderr}` : '');
            return {
              tool_call_id: toolCallId,
              name,
              output: output.trim() || '(no git diff output - working tree clean)',
            };
          } catch (gitErr: any) {
            return {
              tool_call_id: toolCallId,
              name,
              output: `Error running git diff: ${gitErr.message}`,
              error: true,
            };
          }
        }

        case 'list_dir': {
          const targetPath = path.resolve(this.workingDir, args.dir_path || '.');
          if (!fs.existsSync(targetPath)) {
            return {
              tool_call_id: toolCallId,
              name,
              output: `Error: Directory not found: ${args.dir_path}`,
              error: true,
            };
          }
          const entries = fs.readdirSync(targetPath, { withFileTypes: true });
          const formatted = entries
            .filter((e) => !e.name.startsWith('.git') && e.name !== 'node_modules')
            .map((e) => `${e.isDirectory() ? '📁 ' : '📄 '} ${e.name}`)
            .join('\n');
          return {
            tool_call_id: toolCallId,
            name,
            output: formatted || '(empty directory)',
          };
        }

        case 'search_files': {
          const targetPath = path.resolve(this.workingDir, args.dir_path || '.');
          const query = args.query.toLowerCase();
          const results: string[] = [];

          function searchRecursive(dir: string) {
            const list = fs.readdirSync(dir, { withFileTypes: true });
            for (const item of list) {
              if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === 'dist') continue;
              const fullPath = path.join(dir, item.name);
              if (item.isDirectory()) {
                searchRecursive(fullPath);
              } else {
                try {
                  const content = fs.readFileSync(fullPath, 'utf-8');
                  if (content.toLowerCase().includes(query)) {
                    results.push(path.relative(process.cwd(), fullPath));
                  }
                } catch {}
              }
            }
          }

          searchRecursive(targetPath);
          return {
            tool_call_id: toolCallId,
            name,
            output: results.length > 0 ? results.join('\n') : `No files found matching '${args.query}'`,
          };
        }

        case 'activate_skill': {
          const skill = skillManager.getSkill(args.skill_name);
          if (!skill) {
            const all = skillManager.listSkills().map((s) => s.id).join(', ');
            return {
              tool_call_id: toolCallId,
              name,
              output: `Skill '${args.skill_name}' not found. Available skills: ${all}`,
              error: true,
            };
          }
          return {
            tool_call_id: toolCallId,
            name,
            output: `[ACTIVE SKILL: ${skill.name} (${skill.category})]\nAuthor: ${skill.author} · Version: ${skill.version}\n\n${skill.instructions}`,
          };
        }

        case 'run_command': {
          const cmd = (args.command || '').trim();
          const echoMessage = extractEchoMessage(cmd);
          if (echoMessage !== null) {
            return {
              tool_call_id: toolCallId,
              name,
              output: echoMessage,
            };
          }
          const { stdout, stderr } = await execPromise(args.command, {
            cwd: this.workingDir,
            timeout: 30000,
            maxBuffer: 1024 * 1024,
          });
          const output = (stdout || '') + (stderr ? `\n[STDERR]: ${stderr}` : '');
          const cleanOutput = output.trim() || '(command finished with no output)';
          return {
            tool_call_id: toolCallId,
            name,
            output: cleanOutput,
          };
        }

        case 'run_silent_debate': {
          const { DialecticEngine } = await import('./dialectic.js');
          const engine = new DialecticEngine(configManager.get());
          const output = await engine.silentDebate(args.topic, args.depth || 'deep');
          return {
            tool_call_id: toolCallId,
            name,
            output,
          };
        }

        case 'run_silent_goal': {
          const { GoalLoopEngine } = await import('./goalLoop.js');
          const engine = new GoalLoopEngine(configManager.get());
          const output = await engine.runSilentGoal(args.goal);
          return {
            tool_call_id: toolCallId,
            name,
            output,
          };
        }

        case 'create_artifact': {
          const { artifactManager } = await import('./artifactManager.js');
          const id = 'art_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          const artifact = artifactManager.saveArtifact({
            id,
            sessionId: 'cli_session',
            sessionTitle: 'Workspace Chat',
            title: args.title || 'Interactive Artifact',
            type: args.type || 'html',
            content: args.content,
            createdAt: Date.now(),
          });
          const pathMsg = artifactManager.getArtifactFilePath(id);
          return {
            tool_call_id: toolCallId,
            name,
            output: `Successfully created artifact "${artifact.title}" (ID: ${artifact.id}, Type: ${artifact.type})${pathMsg ? `\nSaved file: ${pathMsg}` : ''}`,
          };
        }

        default: {
          // Check for custom dynamic synthesized skill
          const dynamicSkills = SkillSynthesizer.loadSynthesizedSkills();
          const isCustom = dynamicSkills.some((s) => s.manifest.name === name);
          if (isCustom) {
            const output = await SkillSynthesizer.executeCustomSkill(name, args);
            return {
              tool_call_id: toolCallId,
              name,
              output,
            };
          }

          return {
            tool_call_id: toolCallId,
            name,
            output: `Unknown tool: ${name}`,
            error: true,
          };
        }
      }
    } catch (err: any) {
      return {
        tool_call_id: toolCallId,
        name,
        output: `Tool execution failed: ${err.message}`,
        error: true,
      };
    }
  }
}
