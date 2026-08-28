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
import { log, colors } from '../utils/logger.js';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getMobilePublicDir(): string {
  const possiblePaths = [
    path.join(__dirname, 'public'),
    path.join(__dirname, '../../src/mobile/public'),
    path.join(process.cwd(), 'src/mobile/public'),
    path.join(process.cwd(), 'dist/mobile/public'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return path.join(__dirname, 'public');
}

function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

export class MobileServer {
  private server: http.Server | null = null;
  private port = parseInt(process.env.PORT || '3457', 10);
  private activeAgent: AntriAgent;

  constructor() {
    this.activeAgent = new AntriAgent(configManager.get());
  }

  public async start(): Promise<{ port: number; localIp: string }> {
    const publicDir = getMobilePublicDir();
    const localIp = getLocalIp();

    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        const url = new URL(req.url || '/', `http://${localIp}:${this.port}`);
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
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
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

      this.server.listen(this.port, '0.0.0.0', () => {
        resolve({ port: this.port, localIp });
      });

      this.server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          this.port += 1;
          this.server?.listen(this.port, '0.0.0.0');
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
            const { artifactManager } = await import('../core/artifactManager.js');
            const parsed = artifactManager.parseAndStoreArtifacts(
              fullText,
              'mobile_session',
              'Mobile Session'
            );
            sendEvent('complete', {
              fullText,
              cleanText: parsed.cleanText,
              artifacts: parsed.artifacts,
            });
            res.end();
          } catch (err: any) {
            sendEvent('error', { message: err.message });
            res.end();
          }
          return;
        }

        // GET /api/artifacts
        if (pathname === '/api/artifacts' && req.method === 'GET') {
          const { artifactManager } = await import('../core/artifactManager.js');
          const artifacts = artifactManager.getAllArtifacts();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ artifacts }));
          return;
        }

        // GET /api/artifact-file/:id
        if (pathname.startsWith('/api/artifact-file/') && req.method === 'GET') {
          const id = pathname.replace('/api/artifact-file/', '').trim();
          const { artifactManager } = await import('../core/artifactManager.js');
          const art = artifactManager.getArtifact(id);
          const htmlContent = art ? artifactManager.getArtifactHtml(art) : null;
          if (htmlContent) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(htmlContent);
          } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Artifact Not Found');
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
          const depth = payload.depth || 'deep';
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

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Endpoint not found' }));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }

  public static async launchMobile(): Promise<void> {
    const mobile = new MobileServer();
    const { port, localIp } = await mobile.start();
    const localUrl = `http://localhost:${port}`;
    const networkUrl = `http://${localIp}:${port}`;

    console.log();
    console.log(chalk.bgHex('#7c3aed').bold.white(' ANTRI MOBILE APP SERVER RUNNING '));
    console.log(chalk.hex('#a5b4fc')(`Local URL:   ${chalk.bold.cyan(localUrl)}`));
    console.log(chalk.hex('#4ade80')(`Network URL: ${chalk.bold.green(networkUrl)}`));
    console.log(chalk.hex('#64748b')('Open Network URL on your phone or mobile browser (supports PWA install).'));
    console.log();

    // Open local browser
    const platform = process.platform;
    try {
      if (platform === 'win32') {
        spawn('cmd.exe', ['/c', 'start', localUrl], { detached: true, stdio: 'ignore' });
      } else if (platform === 'darwin') {
        spawn('open', [localUrl], { detached: true, stdio: 'ignore' });
      } else {
        spawn('xdg-open', [localUrl], { detached: true, stdio: 'ignore' });
      }
    } catch {}
  }
}
