import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { configManager } from '../core/config.js';
import { AntriAgent } from '../core/agent.js';
import { DialecticEngine } from '../core/dialectic.js';
import { GoalLoopEngine } from '../core/goalLoop.js';
import { profileManager } from '../profiles/profileManager.js';
import { memoryManager } from '../memory/manager.js';
import { SkillSynthesizer } from '../core/skillSynthesizer.js';
import { getAllActiveTools, ToolExecutor } from '../core/tools.js';
import { PROVIDER_CATALOGS, getAvailableModels } from '../providers/models.js';
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
          await this.handleApi(pathname, req, res);
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

  private async handleApi(pathname: string, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const config = configManager.get();

    // GET /api/status
    if (pathname === '/api/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          config,
          activeProfile: profileManager.getActiveProfileName(),
          toolsCount: getAllActiveTools().length,
        })
      );
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
      const dynamicSkills = SkillSynthesizer.loadSynthesizedSkills();
      const allTools = getAllActiveTools();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ dynamicSkills, allTools }));
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

        // POST /api/chat (SSE Streaming)
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
            const fullText = await this.activeAgent.chat(userPrompt);
            sendEvent('token', { token: fullText });
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
          const filePath = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.antri', 'profiles', `${active}.md`);
          fs.writeFileSync(filePath, payload.content, 'utf-8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        }

        // POST /api/skill/test
        if (pathname === '/api/skill/test' && req.method === 'POST') {
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
    console.log(chalk.bgHex('#7c3aed').bold.white(' ⚡ ANTRI DESKTOP APP LAUNCHED '));
    console.log(chalk.hex('#a5b4fc')(`Local Desktop Control Plane running at: ${chalk.bold.cyan(url)}`));
    console.log(chalk.hex('#64748b')('Shared Memory, Thinking Profiles, Skills & Providers actively synced with CLI.'));
    console.log();

    // Open desktop window in app mode (Chrome/Edge app window or default browser)
    const platform = process.platform;
    try {
      if (platform === 'win32') {
        // Try launching Microsoft Edge or Chrome in standalone App Mode window
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
