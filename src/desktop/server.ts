import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { configManager } from '../core/config.js';
import { AntriAgent } from '../core/agent.js';
import { DialecticEngine } from '../core/dialectic.js';
import { GoalLoopEngine } from '../core/goalLoop.js';
import { profileManager } from '../profiles/profileManager.js';
import { memoryManager } from '../memory/manager.js';
import { skillManager } from '../skills/skillManager.js';
import { SkillSynthesizer } from '../core/skillSynthesizer.js';
import { getAllActiveTools, ToolExecutor } from '../core/tools.js';
import { PROVIDER_CATALOGS, getAvailableModels } from '../providers/models.js';
import { PROMPT_TOOLKIT_COMMANDS } from '../cli/promptToolkit.js';
import { FilePickerService } from '../cli/dialogs/filePicker.js';
import { log, colors } from '../utils/logger.js';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getPublicDir(): string {
  const possiblePaths = [
    path.join(__dirname, 'public'),
    path.join(__dirname, '../../src/desktop/public'),
    path.join(process.cwd(), 'src/desktop/public'),
    path.join(process.cwd(), 'dist/desktop/public'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return path.join(__dirname, 'public');
}

export class DesktopServer {
  private server: http.Server | null = null;
  private port = 3456;
  private activeAgent: AntriAgent;

  constructor() {
    this.activeAgent = new AntriAgent(configManager.get());
  }

  public async start(): Promise<number> {
    const publicDir = getPublicDir();

    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        const url = new URL(req.url || '/', `http://localhost:${this.port}`);
        const pathname = url.pathname;

        // 1. API Endpoints
        if (pathname.startsWith('/api/')) {
          await this.handleApi(pathname, url, req, res);
          return;
        }

        // 2. Static File Serving
        let filePath = path.join(publicDir, pathname === '/' ? 'index.html' : pathname);
        if (!fs.existsSync(filePath)) {
          filePath = path.join(publicDir, 'index.html');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentTypes: Record<string, string> = {
          '.html': 'text/html; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.js': 'application/javascript; charset=utf-8',
          '.json': 'application/json',
          '.png': 'image/png',
          '.svg': 'image/svg+xml',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.webp': 'image/webp',
        };

        try {
          const data = fs.readFileSync(filePath);
          res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
          res.end(data);
        } catch {
          res.writeHead(404);
          res.end('Not Found');
        }
      });

      this.server.listen(this.port, () => {
        resolve(this.port);
      });

      this.server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          this.port += 1;
          this.server?.listen(this.port);
        } else {
          reject(err);
        }
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  private async handleApi(pathname: string, url: URL, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const config = configManager.get();

    // GET /api/status
    if (pathname === '/api/status' && req.method === 'GET') {
      const { AuthManager } = await import('../cloud/auth.js');
      const currentUser = AuthManager.getCurrentUser();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          config,
          activeProfile: profileManager.getActiveProfileName(),
          toolsCount: getAllActiveTools().length,
          user: currentUser,
        })
      );
      return;
    }

    // GET /api/auth/user
    if (pathname === '/api/auth/user' && req.method === 'GET') {
      const { AuthManager } = await import('../cloud/auth.js');
      const user = AuthManager.getCurrentUser();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ user }));
      return;
    }

    // GET /api/commands (Prompt Toolkit Slash Commands)
    if (pathname === '/api/commands' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ commands: PROMPT_TOOLKIT_COMMANDS }));
      return;
    }

    // GET /api/files (Prompt Toolkit File Browser for @)
    if (pathname === '/api/files' && req.method === 'GET') {
      const query = url.searchParams.get('query') || '';
      const { currentDir, items } = FilePickerService.listDirectory(config.workingDir, query);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ currentDir, items }));
      return;
    }

    // GET /api/models
    if (pathname === '/api/models' && req.method === 'GET') {
      const models = await getAvailableModels(config);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ models }));
      return;
    }

    // GET /api/profiles
    if (pathname === '/api/profiles' && req.method === 'GET') {
      const profiles = profileManager.listProfiles();
      const activeContent = profileManager.getActiveProfileContent();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ profiles, activeContent, activeName: profileManager.getActiveProfileName() }));
      return;
    }

    // GET /api/skills
    if (pathname === '/api/skills' && req.method === 'GET') {
      const markdownSkills = skillManager.listSkills();
      const dynamicSkills = SkillSynthesizer.loadSynthesizedSkills();
      const allTools = getAllActiveTools();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ markdownSkills, dynamicSkills, allTools }));
      return;
    }

    // GET /api/memory
    if (pathname === '/api/memory' && req.method === 'GET') {
      const memoryStatus = memoryManager.getMemoryDetails(config.workingDir);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(memoryStatus));
      return;
    }

    // Read Body for POST requests
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const payload = body ? JSON.parse(body) : {};

        // POST /api/upload (File and Image Uploader)
        if (pathname === '/api/upload' && req.method === 'POST') {
          const fileName = payload.fileName || `upload_${Date.now()}.bin`;
          const fileData = payload.data || ''; // Base64 or text data
          const fileType = payload.fileType || 'text/plain';

          const uploadDir = path.join(os.homedir(), '.antri', 'attachments');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          const savedPath = path.join(uploadDir, fileName);
          if (fileData.startsWith('data:')) {
            const base64Data = fileData.split(',')[1];
            fs.writeFileSync(savedPath, Buffer.from(base64Data, 'base64'));
          } else {
            fs.writeFileSync(savedPath, fileData, 'utf-8');
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              filePath: savedPath,
              fileName,
              fileType,
              isImage: fileType.startsWith('image/'),
            })
          );
          return;
        }

        // POST /api/chat (Real-Time SSE Token Streaming)
        if (pathname === '/api/chat' && req.method === 'POST') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          });

          const sendEvent = (event: string, data: any) => {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
          };

          const userPrompt = payload.prompt || '';
          this.activeAgent.updateConfig(configManager.get());

          try {
            const fullText = await this.activeAgent.chat(
              userPrompt,
              (token) => {
                sendEvent('token', { token });
              },
              (toolCall) => {
                sendEvent('tool_call', {
                  name: toolCall.function.name,
                  arguments: toolCall.function.arguments,
                });
              }
            );
            sendEvent('complete', { fullText });
            res.end();
          } catch (err: any) {
            sendEvent('error', { message: err.message });
            res.end();
          }
          return;
        }

        // POST /api/debate (SSE Streaming)
        if (pathname === '/api/debate' && req.method === 'POST') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          });

          const sendEvent = (event: string, data: any) => {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
          };

          const query = payload.query || '';
          const depth = payload.depth || config.debateDepth || 'deep';
          const engine = new DialecticEngine(configManager.get());

          try {
            sendEvent('start', { query, depth });
            const result = await engine.debate(query, depth);
            sendEvent('complete', result);
            res.end();
          } catch (err: any) {
            sendEvent('error', { message: err.message });
            res.end();
          }
          return;
        }

        // POST /api/goal (SSE Streaming)
        if (pathname === '/api/goal' && req.method === 'POST') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          });

          const sendEvent = (event: string, data: any) => {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
          };

          const objective = payload.objective || '';
          const engine = new GoalLoopEngine(configManager.get());

          try {
            sendEvent('start', { objective });
            const result = await engine.runGoal(objective);
            sendEvent('complete', result);
            res.end();
          } catch (err: any) {
            sendEvent('error', { message: err.message });
            res.end();
          }
          return;
        }

        // POST /api/config
        if (pathname === '/api/config' && req.method === 'POST') {
          if (payload.mode) configManager.setMode(payload.mode);
          if (typeof payload.alwaysAllow === 'boolean') configManager.setAlwaysAllow(payload.alwaysAllow);
          if (payload.provider) configManager.setProvider(payload.provider, payload.model);
          if (payload.model) configManager.set('model', payload.model);
          if (payload.debateDepth) configManager.set('debateDepth', payload.debateDepth);
          if (payload.workingDir) configManager.set('workingDir', payload.workingDir);

          this.activeAgent.updateConfig(configManager.get());

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, config: configManager.get() }));
          return;
        }

        // POST /api/profile/create
        if (pathname === '/api/profile/create' && req.method === 'POST') {
          const profile = profileManager.createProfile(payload.name, payload.description);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, profile }));
          return;
        }

        // POST /api/profile/select
        if (pathname === '/api/profile/select' && req.method === 'POST') {
          profileManager.setActiveProfile(payload.name);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, activeProfile: payload.name }));
          return;
        }

        // POST /api/profile/save
        if (pathname === '/api/profile/save' && req.method === 'POST') {
          const active = profileManager.getActiveProfileName();
          const filePath = path.join(os.homedir(), '.antri', 'profiles', `${active}.md`);
          fs.writeFileSync(filePath, payload.content, 'utf-8');
          // Auto-sync to Firestore in background if configured
          const { FirestoreSyncManager } = await import('../cloud/firestore.js');
          FirestoreSyncManager.pushToFirestore().catch(() => {});
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        }

        // GET/POST /api/auth/status
        if (pathname === '/api/auth/status') {
          const { AuthManager } = await import('../cloud/auth.js');
          const user = AuthManager.getCurrentUser();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ isAuthenticated: !!user, user }));
          return;
        }

        // POST /api/auth/login
        if (pathname === '/api/auth/login' && req.method === 'POST') {
          const { AuthManager } = await import('../cloud/auth.js');
          const result = await AuthManager.login(payload.email, payload.password);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
          return;
        }

        // POST /api/auth/google (Google Sign-In)
        if (pathname === '/api/auth/google' && req.method === 'POST') {
          const { AuthManager } = await import('../cloud/auth.js');
          const result = await AuthManager.loginWithGoogle(payload.email, payload.googleToken);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
          return;
        }

        // POST /api/auth/logout
        if (pathname === '/api/auth/logout' && req.method === 'POST') {
          const { AuthManager } = await import('../cloud/auth.js');
          AuthManager.logout();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        }

        // POST /api/sync/push (Google Cloud Firestore Push)
        if (pathname === '/api/sync/push' && req.method === 'POST') {
          const { FirestoreSyncManager } = await import('../cloud/firestore.js');
          const result = await FirestoreSyncManager.pushToFirestore();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
          return;
        }

        // POST /api/sync/pull (Google Cloud Firestore Pull)
        if (pathname === '/api/sync/pull' && req.method === 'POST') {
          const { FirestoreSyncManager } = await import('../cloud/firestore.js');
          const result = await FirestoreSyncManager.pullFromFirestore();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
          return;
        }

        // POST /api/profile/import
        if (pathname === '/api/profile/import' && req.method === 'POST') {
          const profile = profileManager.importProfile(payload.name, payload.content);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, profile }));
          return;
        }

        // POST /api/profile/delete
        if (pathname === '/api/profile/delete' && req.method === 'POST') {
          const ok = profileManager.deleteProfile(payload.name);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: ok }));
          return;
        }

        // POST /api/profile/push
        if (pathname === '/api/profile/push' && req.method === 'POST') {
          const { FirestoreSyncManager } = await import('../cloud/firestore.js');
          const result = await FirestoreSyncManager.pushToFirestore();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
          return;
        }

        // POST /api/profile/pull
        if (pathname === '/api/profile/pull' && req.method === 'POST') {
          const { FirestoreSyncManager } = await import('../cloud/firestore.js');
          const result = await FirestoreSyncManager.pullFromFirestore();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
          return;
        }

        // POST /api/skill/create
        if (pathname === '/api/skill/create' && req.method === 'POST') {
          const skill = skillManager.createSkill(
            payload.name,
            payload.description || '',
            payload.category || 'Custom',
            payload.triggers || [],
            payload.content
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, skill }));
          return;
        }

        // POST /api/skill/save
        if (pathname === '/api/skill/save' && req.method === 'POST') {
          const ok = skillManager.saveSkill(payload.id, payload.content);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: ok }));
          return;
        }

        // POST /api/skill/import
        if (pathname === '/api/skill/import' && req.method === 'POST') {
          const skill = skillManager.importSkill(payload.name, payload.content);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, skill }));
          return;
        }

        // POST /api/skill/delete
        if (pathname === '/api/skill/delete' && req.method === 'POST') {
          const ok = skillManager.deleteSkill(payload.id);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: ok }));
          return;
        }

        // POST /api/skill/test
        if (pathname === '/api/skill/test' && req.method === 'POST') {
          const skill = skillManager.getSkill(payload.skillName);
          if (skill) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ output: `Skill '${skill.name}' is active and verified.\nCategory: ${skill.category}\nInstructions Length: ${skill.instructions.length} chars.` }));
            return;
          }
          const result = await SkillSynthesizer.executeCustomSkill(payload.skillName, payload.args || {});
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ output: result }));
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Endpoint not found' }));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }

  public static async launchDesktop(): Promise<void> {
    const desktop = new DesktopServer();
    const port = await desktop.start();
    const url = `http://localhost:${port}`;

    console.log();
    console.log(chalk.bgHex('#7c3aed').bold.white(' ANTRI DESKTOP APP LAUNCHED '));
    console.log(chalk.hex('#a5b4fc')(`Local Desktop Control Plane running at: ${chalk.bold.cyan(url)}`));
    console.log(chalk.hex('#64748b')('Shared Memory, Thinking Profiles, Skills & Providers actively synced with CLI.'));
    console.log();

    // Open desktop window in app mode (Chrome/Edge app window or default browser)
    const platform = process.platform;
    try {
      if (platform === 'win32') {
        spawn('cmd.exe', ['/c', 'start', 'msedge', `--app=${url}`], { detached: true, stdio: 'ignore' });
      } else if (platform === 'darwin') {
        spawn('open', ['-a', 'Google Chrome', `--args`, `--app=${url}`], { detached: true, stdio: 'ignore' });
      } else {
        spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });
      }
    } catch {
      // Fallback
    }
  }
}
