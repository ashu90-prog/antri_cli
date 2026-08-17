import fs from 'fs';
import path from 'path';
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
import { configManager } from './config.js';

const execPromise = util.promisify(exec);

export const SENSITIVE_TOOLS = new Set([
  'web_search',
  'scrape_url',
  'crawl_docs',
  'run_command',
  'execute_python',
  'synthesize_skill',
]);

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
    description: 'Read the contents of a file from the workspace.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The relative or absolute path of the file to read.',
        },
        max_lines: {
          type: 'number',
          description: 'Optional maximum number of lines to return (default: 300).',
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
    name: 'run_command',
    description: 'Execute a shell command in the workspace.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The terminal command to execute.',
        },
      },
      required: ['command'],
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

export class ToolExecutor {
  private workingDir: string;

  constructor(workingDir: string = process.cwd()) {
    this.workingDir = workingDir;
  }

  public static isSensitive(name: string): boolean {
    return SENSITIVE_TOOLS.has(name);
  }

  public static async promptForPermission(name: string, args: Record<string, any>): Promise<boolean> {
    const config = configManager.get();
    if (config.alwaysAllow) {
      return true;
    }

    if (!ToolExecutor.isSensitive(name)) {
      return true;
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
          output: '✕ AUTHENTICATION REQUIRED: You must be logged into an ANTRI account to execute tools or code. Run "/login <email>".',
          error: true,
        };
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
      const allowed = await ToolExecutor.promptForPermission(name, args);
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
          const targetPath = path.resolve(this.workingDir, args.file_path);
          if (!fs.existsSync(targetPath)) {
            return {
              tool_call_id: toolCallId,
              name,
              output: `Error: File not found: ${args.file_path}`,
              error: true,
            };
          }
          const content = fs.readFileSync(targetPath, 'utf-8');
          const lines = content.split('\n');
          const maxLines = args.max_lines || 300;
          const output = lines.slice(0, maxLines).join('\n');
          const truncatedNotice = lines.length > maxLines ? `\n... [truncated ${lines.length - maxLines} lines]` : '';
          return {
            tool_call_id: toolCallId,
            name,
            output: output + truncatedNotice,
          };
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

        case 'run_command': {
          const { stdout, stderr } = await execPromise(args.command, {
            cwd: this.workingDir,
            timeout: 30000,
            maxBuffer: 1024 * 1024,
          });
          const output = (stdout || '') + (stderr ? `\n[STDERR]: ${stderr}` : '');
          return {
            tool_call_id: toolCallId,
            name,
            output: output.trim() || '(command finished with no output)',
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
