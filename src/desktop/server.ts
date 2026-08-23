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
  private pendingPermissions = new Map<string, (allowed: boolean) => void>();
  private currentSseSender: ((event: string, data: any) => void) | null = null;

  constructor() {
    this.activeAgent = new AntriAgent(configManager.get());
    this.setupPermissionHandler();
  }

  private setupPermissionHandler(): void {
    this.activeAgent.getToolExecutor().setPermissionHandler(async (name, args) => {
      const cfg = configManager.get();
      if (cfg.alwaysAllow) return true;
      if (!ToolExecutor.isSensitive(name)) return true;

      const reqId = `perm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      if (this.currentSseSender) {
        this.currentSseSender('permission_request', {
          requestId: reqId,
          name,
          args,
        });
      }

      return new Promise<boolean>((resolve) => {
        this.pendingPermissions.set(reqId, resolve);
        setTimeout(() => {
          if (this.pendingPermissions.has(reqId)) {
            this.pendingPermissions.delete(reqId);
            resolve(false);
          }
        }, 90000);
      });
    });
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
      const globalNotes = profileManager.getGlobalNotesContent();
      const workspaceNotes = profileManager.getWorkspaceNotesContent(config.workingDir);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          profiles,
          activeContent,
          activeName: profileManager.getActiveProfileName(),
          globalNotes,
          workspaceNotes,
        })
      );
      return;
    }

    // GET /api/profile (Inspect any individual profile)
    if (pathname === '/api/profile' && req.method === 'GET') {
      const name = url.searchParams.get('name') || profileManager.getActiveProfileName();
      const content = profileManager.getProfile(name);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          name,
          content,
          isActive: name === profileManager.getActiveProfileName(),
        })
      );
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

    // GET /api/chats (List multi-chat sessions)
    if (pathname === '/api/chats' && req.method === 'GET') {
      const { sessionManager } = await import('../core/sessionManager.js');
      const sessions = sessionManager.listSessions();
      const activeId = sessionManager.getActiveSessionId();
      const activeSession = sessionManager.getActiveSession();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sessions, activeId, activeSession }));
      return;
    }

    // GET /api/artifacts (List all artifacts & grouped by chat session)
    if (pathname === '/api/artifacts' && req.method === 'GET') {
      const { artifactManager } = await import('../core/artifactManager.js');
      const artifacts = artifactManager.getAllArtifacts();
      const grouped = artifactManager.getArtifactsGroupedBySession();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ artifacts, grouped }));
      return;
    }

    // GET /api/artifacts/:id/view (Render standalone HTML / visual graph artifact)
    if (pathname?.startsWith('/api/artifacts/') && pathname.endsWith('/view') && req.method === 'GET') {
      const { artifactManager } = await import('../core/artifactManager.js');
      const id = pathname.replace('/api/artifacts/', '').replace('/view', '').trim();
      const artifact = artifactManager.getArtifact(id);
      if (!artifact) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Artifact not found');
        return;
      }
      if (artifact.type === 'html') {
        let content = artifact.content.trim();
        if (!content.toLowerCase().includes('<!doctype html>') && !content.toLowerCase().includes('<html')) {
          content = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#0f172a;color:#f8fafc;padding:16px;}</style></head><body>${content}</body></html>`;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      } else if (artifact.type === 'mindmap') {
        const htmlMindmap = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${artifact.title}</title>
  <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
  <script src="https://cdn.jsdelivr.net/npm/markmap-view@0.17.2"></script>
  <script src="https://cdn.jsdelivr.net/npm/markmap-lib@0.17.2"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg-page: radial-gradient(circle at 15% 15%, rgba(99, 102, 241, 0.08) 0%, transparent 40%), radial-gradient(circle at 85% 85%, rgba(236, 72, 153, 0.08) 0%, transparent 40%), #f8fafc;
      --bg-viewport: #ffffff;
      --border-viewport: rgba(226, 232, 240, 0.9);
      --text-main: #0f172a;
      --text-muted: #64748b;
      --btn-bg: #ffffff;
      --btn-border: #e2e8f0;
      --btn-text: #1e293b;
      --btn-hover: #f1f5f9;
      --shadow-viewport: 0 20px 45px -15px rgba(0, 0, 0, 0.06), 0 0 1px 1px rgba(0, 0, 0, 0.04);
      --node-bg: #ffffff;
      --node-border: #cbd5e1;
      --node-text: #0f172a;
      --root-bg: #4f46e5;
      --root-border: #4338ca;
      --root-text: #ffffff;
      --link-stroke: #818cf8;
      --badge-bg: rgba(168, 85, 247, 0.12);
      --badge-color: #7e22ce;
      --badge-border: rgba(168, 85, 247, 0.25);
    }
    body.theme-dark {
      --bg-page: radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.25) 0%, transparent 50%), radial-gradient(circle at 90% 80%, rgba(236, 72, 153, 0.22) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.18) 0%, transparent 60%), #0d1322;
      --bg-viewport: rgba(18, 24, 38, 0.9);
      --border-viewport: rgba(255, 255, 255, 0.1);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --btn-bg: rgba(30, 41, 59, 0.85);
      --btn-border: rgba(255, 255, 255, 0.12);
      --btn-text: #f8fafc;
      --btn-hover: rgba(51, 65, 85, 0.95);
      --shadow-viewport: 0 20px 45px -15px rgba(0, 0, 0, 0.5);
      --node-bg: #1e293b;
      --node-border: #334155;
      --node-text: #f8fafc;
      --root-bg: #6366f1;
      --root-border: #818cf8;
      --root-text: #ffffff;
      --link-stroke: #6366f1;
      --badge-bg: rgba(168, 85, 247, 0.2);
      --badge-color: #c084fc;
      --badge-border: rgba(168, 85, 247, 0.35);
    }
    body {
      margin: 0; padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-page);
      color: var(--text-main);
      display: flex; flex-direction: column; align-items: center; min-height: 100vh;
      overflow-x: hidden;
      transition: background 0.3s ease;
    }
    .header { text-align: center; margin-bottom: 14px; }
    h1 { font-size: 19px; color: var(--text-main); margin: 0 0 6px 0; font-weight: 800; letter-spacing: -0.3px; }
    .badge {
      font-size: 11px;
      background: var(--badge-bg);
      color: var(--badge-color);
      padding: 4px 12px; border-radius: 9999px;
      border: 1px solid var(--badge-border);
      text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;
      display: inline-block; margin-bottom: 6px;
    }
    .toolbar {
      display: flex; gap: 8px; margin-bottom: 14px; align-items: center; flex-wrap: wrap; justify-content: center;
    }
    .tool-btn {
      background: var(--btn-bg); border: 1px solid var(--btn-border);
      color: var(--btn-text); padding: 7px 14px; border-radius: 9px; font-size: 12px;
      font-weight: 700; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 6px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.03);
    }
    .tool-btn:hover { background: var(--btn-hover); transform: translateY(-1px); }
    .tool-btn:active { transform: translateY(0); }
    .viewport {
      width: 100%; max-width: 1200px; height: 75vh; min-height: 540px;
      position: relative; overflow: hidden; border-radius: 18px;
      background: var(--bg-viewport); backdrop-filter: blur(20px);
      border: 1px solid var(--border-viewport);
      box-shadow: var(--shadow-viewport);
      touch-action: none;
    }
    #mindmapSvg {
      width: 100%; height: 100%;
      display: block;
      cursor: grab;
    }
    #mindmapSvg:active { cursor: grabbing; }
    .markmap-foreign {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 13.5px !important;
      font-weight: 600 !important;
      line-height: 1.4 !important;
      color: var(--node-text) !important;
      background: var(--node-bg) !important;
      border: 1.5px solid var(--node-border) !important;
      border-radius: 8px !important;
      padding: 6px 14px !important;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04) !important;
      display: inline-flex !important;
      align-items: center !important;
      white-space: nowrap !important;
      transition: all 0.2s ease !important;
    }
    .markmap-node[data-depth="0"] .markmap-foreign {
      background: var(--root-bg) !important;
      color: var(--root-text) !important;
      border-color: var(--root-border) !important;
      font-size: 16px !important;
      font-weight: 800 !important;
      border-radius: 10px !important;
      padding: 8px 18px !important;
      box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35) !important;
    }
    .markmap-node[data-depth="1"] .markmap-foreign {
      font-weight: 700 !important;
      border-width: 1.8px !important;
    }
    .markmap-link {
      fill: none !important;
      stroke: var(--link-stroke) !important;
      stroke-width: 2px !important;
      stroke-linecap: round !important;
    }
    .markmap-node > circle {
      fill: var(--root-bg) !important;
      stroke: var(--root-border) !important;
      stroke-width: 2px !important;
      r: 6 !important;
      cursor: pointer !important;
    }
    .help-hint {
      position: absolute; bottom: 12px; right: 14px;
      font-size: 11px; color: var(--text-muted); pointer-events: none;
      background: rgba(255, 255, 255, 0.75); padding: 3px 8px; border-radius: 6px;
      border: 1px solid rgba(0,0,0,0.05);
    }
    body.theme-dark .help-hint {
      background: rgba(18, 24, 38, 0.7);
      border-color: rgba(255, 255, 255, 0.08);
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="badge">🧠 ANTRI Interactive Mind Map</span>
    <h1>${artifact.title}</h1>
  </div>
  <div class="toolbar">
    <button class="tool-btn" onclick="zoomIn()">🔍 Zoom +</button>
    <button class="tool-btn" onclick="zoomOut()">🔍 Zoom -</button>
    <button class="tool-btn" onclick="fitView()">⛶ Fit / Reset</button>
    <button class="tool-btn" onclick="toggleTheme()" id="themeToggleBtn">🌙 Poster Dark</button>
    <button class="tool-btn" onclick="copySource()">📋 Copy Code</button>
  </div>
  <div class="viewer-card" id="viewerCard">
    <svg id="mindmapSvg"></svg>
    <div class="help-hint">🖱️ Drag to pan · Scroll to zoom · Click nodes with circle handles to collapse/expand</div>
  </div>
  <script>
    const rawContent = ${JSON.stringify(artifact.content.trim())};
    
    function parseToMarkdown(content) {
      if (content.startsWith('#') || content.startsWith('-') || content.includes('\\n#') || content.includes('\\n-')) {
        return content;
      }
      const lines = content.split('\\n');
      const mdLines = [];
      let baseIndent = -1;
      for (let line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'mindmap') continue;
        const indent = line.search(/\\S/);
        if (baseIndent === -1) baseIndent = indent;
        const rel = Math.max(0, indent - baseIndent);
        const depth = Math.floor(rel / 2);
        
        let clean = trimmed
          .replace(/^root\\(\\((.*?)\\)\\)$/, '$1')
          .replace(/^\\(\\((.*?)\\)\\)$/, '$1')
          .replace(/^\\[(.*?)\\]$/, '$1')
          .replace(/^\\((.*?)\\)$/, '$1')
          .replace(/^\\)\\)(.*?)\\(\\($/, '$1')
          .replace(/^\\)(.*?)\\($/, '$1')
          .replace(/^\\{\\{(.*?)\\}\\}/, '$1');
          
        if (depth === 0) {
          mdLines.push('# ' + clean);
        } else if (depth === 1) {
          mdLines.push('## ' + clean);
        } else {
          mdLines.push('  '.repeat(depth - 1) + '- ' + clean);
        }
      }
      return mdLines.join('\\n');
    }

    const markdownText = parseToMarkdown(rawContent);
    let mmInstance = null;

    function renderMarkmap() {
      try {
        if (window.markmap && window.markmap.Transformer) {
          const { Transformer, Markmap } = window.markmap;
          const transformer = new Transformer();
          const { root } = transformer.transform(markdownText);
          const svgEl = document.getElementById('mindmapSvg');
          svgEl.innerHTML = '';
          mmInstance = Markmap.create(svgEl, {
            autoFit: true,
            duration: 250,
            nodeMinHeight: 28,
            spacingVertical: 14,
            spacingHorizontal: 85,
            paddingX: 16
          }, root);
          return;
        }
      } catch (err) {
        console.warn('Markmap load error:', err);
      }
      renderFallbackTree();
    }

    function renderFallbackTree() {
      const svg = document.getElementById('mindmapSvg');
      svg.innerHTML = '';
      const lines = markdownText.split('\\n').filter(l => l.trim().length > 0);
      const rootNode = { name: '${artifact.title}', children: [] };
      const stack = [{ node: rootNode, depth: 0 }];

      lines.forEach((line) => {
        let depth = 1;
        let text = line.trim();
        if (text.startsWith('# ')) {
          rootNode.name = text.replace('# ', '').trim();
          return;
        } else if (text.startsWith('## ')) {
          depth = 1;
          text = text.replace('## ', '').trim();
        } else {
          const leadSpaces = line.search(/\\S/);
          depth = 2 + Math.floor(leadSpaces / 2);
          text = text.replace(/^[-*]\\s*/, '').trim();
        }
        const newNode = { name: text, children: [] };
        while (stack.length > depth) stack.pop();
        stack[stack.length - 1].node.children.push(newNode);
        stack.push({ node: newNode, depth: depth });
      });

      let curY = 40;
      function layout(node, depth = 0) {
        node.depth = depth;
        node.x = 60 + depth * 220;
        if (!node.children || node.children.length === 0) {
          node.y = curY;
          curY += 46;
        } else {
          node.children.forEach(c => layout(c, depth + 1));
          const firstY = node.children[0].y;
          const lastY = node.children[node.children.length - 1].y;
          node.y = (firstY + lastY) / 2;
        }
      }
      layout(rootNode);

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('id', 'treeGroup');
      svg.appendChild(g);

      function draw(node) {
        if (node.children) {
          node.children.forEach(c => {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const x1 = node.x + 130, y1 = node.y;
            const x2 = c.x, y2 = c.y;
            const dx = (x2 - x1) * 0.5;
            path.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' C ' + (x1 + dx) + ' ' + y1 + ', ' + (x2 - dx) + ' ' + y2 + ', ' + x2 + ' ' + y2);
            path.setAttribute('class', 'markmap-link');
            g.appendChild(path);
            draw(c);
          });
        }
        const foreign = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
        foreign.setAttribute('x', node.x - 10);
        foreign.setAttribute('y', node.y - 18);
        foreign.setAttribute('width', '200');
        foreign.setAttribute('height', '40');
        foreign.innerHTML = '<div class="markmap-node" data-depth="' + node.depth + '"><div class="markmap-foreign">' + node.name + '</div></div>';
        g.appendChild(foreign);
      }
      draw(rootNode);
      svg.setAttribute('viewBox', '0 0 ' + Math.max(800, curY * 1.8) + ' ' + Math.max(500, curY + 60));
    }

    function zoomIn() {
      if (mmInstance) mmInstance.rescale(1.25);
    }
    function zoomOut() {
      if (mmInstance) mmInstance.rescale(0.8);
    }
    function fitView() {
      if (mmInstance) mmInstance.fit();
    }
    function toggleTheme() {
      document.body.classList.toggle('theme-dark');
      const isDark = document.body.classList.contains('theme-dark');
      const btn = document.getElementById('themeToggleBtn');
      if (btn) btn.textContent = isDark ? '☀️ Light Mode' : '🌙 Poster Dark';
    }
    function copySource() {
      navigator.clipboard.writeText(rawContent).then(() => {
        alert('Mind map source copied to clipboard!');
      });
    }

    window.addEventListener('load', () => {
      setTimeout(renderMarkmap, 60);
    });
    if (document.readyState === 'complete') renderMarkmap();
  </script>
</body>
</html>`;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(htmlMindmap);
      } else {
        const badgeLabel = '📊 Architecture Graph';

        const htmlGraph = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${artifact.title}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg-page: radial-gradient(circle at 15% 15%, rgba(99, 102, 241, 0.08) 0%, transparent 40%), radial-gradient(circle at 85% 85%, rgba(236, 72, 153, 0.08) 0%, transparent 40%), #f8fafc;
      --bg-viewport: #ffffff;
      --border-viewport: rgba(226, 232, 240, 0.9);
      --text-main: #0f172a;
      --text-muted: #64748b;
      --btn-bg: #ffffff;
      --btn-border: #e2e8f0;
      --btn-text: #1e293b;
      --btn-hover: #f1f5f9;
      --shadow-viewport: 0 20px 45px -15px rgba(0, 0, 0, 0.06), 0 0 1px 1px rgba(0, 0, 0, 0.04);
      --badge-bg: rgba(99, 102, 241, 0.1);
      --badge-color: #4f46e5;
      --badge-border: rgba(99, 102, 241, 0.25);
    }
    body.theme-dark {
      --bg-page: radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.25) 0%, transparent 50%), radial-gradient(circle at 90% 80%, rgba(236, 72, 153, 0.22) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.18) 0%, transparent 60%), #0d1322;
      --bg-viewport: rgba(18, 24, 38, 0.85);
      --border-viewport: rgba(255, 255, 255, 0.1);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --btn-bg: rgba(30, 41, 59, 0.85);
      --btn-border: rgba(255, 255, 255, 0.12);
      --btn-text: #f8fafc;
      --btn-hover: rgba(51, 65, 85, 0.95);
      --shadow-viewport: 0 20px 45px -15px rgba(0, 0, 0, 0.5);
      --badge-bg: rgba(168, 85, 247, 0.2);
      --badge-color: #c084fc;
      --badge-border: rgba(168, 85, 247, 0.35);
    }
    body {
      margin: 0; padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-page);
      color: var(--text-main);
      display: flex; flex-direction: column; align-items: center; min-height: 100vh;
      overflow-x: hidden;
      transition: background 0.3s ease;
    }
    .header { text-align: center; margin-bottom: 14px; }
    h1 { font-size: 19px; color: var(--text-main); margin: 0 0 6px 0; font-weight: 800; letter-spacing: -0.3px; }
    .badge {
      font-size: 11px;
      background: var(--badge-bg);
      color: var(--badge-color);
      padding: 4px 12px; border-radius: 9999px;
      border: 1px solid var(--badge-border);
      text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;
      display: inline-block; margin-bottom: 6px;
    }
    .toolbar {
      display: flex; gap: 8px; margin-bottom: 14px; align-items: center; flex-wrap: wrap; justify-content: center;
    }
    .tool-btn {
      background: var(--btn-bg); border: 1px solid var(--btn-border);
      color: var(--btn-text); padding: 7px 14px; border-radius: 9px; font-size: 12px;
      font-weight: 700; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 6px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.03);
    }
    .tool-btn:hover { background: var(--btn-hover); transform: translateY(-1px); }
    .tool-btn:active { transform: translateY(0); }
    .viewport {
      width: 100%; max-width: 1150px; height: 72vh; min-height: 520px;
      position: relative; overflow: hidden; border-radius: 18px;
      background: var(--bg-viewport); backdrop-filter: blur(20px);
      border: 1px solid var(--border-viewport);
      box-shadow: var(--shadow-viewport);
      cursor: grab; user-select: none; touch-action: none;
    }
    .viewport.grabbing { cursor: grabbing; }
    .canvas {
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      transform-origin: center center;
      will-change: transform;
    }
    .canvas.animating {
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .mermaid { width: 100%; text-align: center; }
    .mermaid svg { max-width: 100%; height: auto; }
    .help-hint {
      position: absolute; bottom: 12px; right: 14px;
      font-size: 11px; color: var(--text-muted); pointer-events: none;
      background: rgba(255, 255, 255, 0.75); padding: 3px 8px; border-radius: 6px;
      border: 1px solid rgba(0,0,0,0.05);
    }
    body.theme-dark .help-hint {
      background: rgba(18, 24, 38, 0.7);
      border-color: rgba(255, 255, 255, 0.08);
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="badge">${badgeLabel}</span>
    <h1>${artifact.title}</h1>
  </div>
  <div class="toolbar">
    <button class="tool-btn" onclick="zoomIn()">🔍 Zoom +</button>
    <button class="tool-btn" onclick="zoomOut()">🔍 Zoom -</button>
    <button class="tool-btn" onclick="resetZoom()">⛶ Reset</button>
    <button class="tool-btn" onclick="toggleTheme()" id="themeToggleBtn">🌙 Poster Dark</button>
    <button class="tool-btn" onclick="copySource()">📋 Copy Code</button>
  </div>
  <div class="viewport" id="viewport">
    <div class="canvas" id="canvas">
      <pre class="mermaid" id="mermaidCode">
${artifact.content.trim()}
      </pre>
    </div>
    <div class="help-hint">🖱️ Drag to pan · Scroll to zoom</div>
  </div>
  <script>
    let scale = 1.0;
    let posX = 0;
    let posY = 0;
    let isDragging = false;
    let startPointerX = 0;
    let startPointerY = 0;
    let startPosX = 0;
    let startPosY = 0;

    const activeTouches = new Map();
    let initialPinchDist = 0;
    let initialPinchScale = 1.0;

    const viewport = document.getElementById('viewport');
    const canvas = document.getElementById('canvas');

    function updateTransform(animate = false) {
      if (animate) {
        canvas.classList.add('animating');
        setTimeout(() => canvas.classList.remove('animating'), 320);
      } else {
        canvas.classList.remove('animating');
      }
      canvas.style.transform = 'translate3d(' + posX + 'px, ' + posY + 'px, 0) scale(' + scale + ')';
    }

    viewport.addEventListener('pointerdown', (e) => {
      activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { viewport.setPointerCapture(e.pointerId); } catch {}

      if (activeTouches.size === 1) {
        isDragging = true;
        viewport.classList.add('grabbing');
        startPointerX = e.clientX;
        startPointerY = e.clientY;
        startPosX = posX;
        startPosY = posY;
      } else if (activeTouches.size === 2) {
        isDragging = false;
        viewport.classList.remove('grabbing');
        const pts = Array.from(activeTouches.values());
        initialPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        initialPinchScale = scale;
      }
    });

    viewport.addEventListener('pointermove', (e) => {
      if (!activeTouches.has(e.pointerId)) return;
      activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activeTouches.size === 1 && isDragging) {
        const dx = e.clientX - startPointerX;
        const dy = e.clientY - startPointerY;
        posX = startPosX + dx;
        posY = startPosY + dy;
        updateTransform(false);
      } else if (activeTouches.size === 2) {
        const pts = Array.from(activeTouches.values());
        const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (initialPinchDist > 0) {
          scale = Math.min(Math.max(initialPinchScale * (currentDist / initialPinchDist), 0.2), 4.0);
          updateTransform(false);
        }
      }
    });

    function endPointer(e) {
      activeTouches.delete(e.pointerId);
      try { viewport.releasePointerCapture(e.pointerId); } catch {}
      if (activeTouches.size === 0) {
        isDragging = false;
        viewport.classList.remove('grabbing');
      } else if (activeTouches.size === 1) {
        isDragging = true;
        viewport.classList.add('grabbing');
        const remaining = Array.from(activeTouches.values())[0];
        startPointerX = remaining.x;
        startPointerY = remaining.y;
        startPosX = posX;
        startPosY = posY;
      }
    }

    viewport.addEventListener('pointerup', endPointer);
    viewport.addEventListener('pointercancel', endPointer);

    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.15 : 0.87;
      const newScale = Math.min(Math.max(scale * delta, 0.2), 4.0);
      
      const rect = viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - rect.width / 2;
      const mouseY = e.clientY - rect.top - rect.height / 2;
      
      posX = mouseX - (mouseX - posX) * (newScale / scale);
      posY = mouseY - (mouseY - posY) * (newScale / scale);
      scale = newScale;
      updateTransform(false);
    }, { passive: false });

    function zoomIn() {
      scale = Math.min(scale * 1.25, 4.0);
      updateTransform(true);
    }
    function zoomOut() {
      scale = Math.max(scale * 0.8, 0.2);
      updateTransform(true);
    }
    function resetZoom() {
      scale = 1.0;
      posX = 0;
      posY = 0;
      updateTransform(true);
    }
    function toggleTheme() {
      document.body.classList.toggle('theme-dark');
      const isDark = document.body.classList.contains('theme-dark');
      const btn = document.getElementById('themeToggleBtn');
      if (btn) btn.textContent = isDark ? '☀️ Light Mode' : '🌙 Poster Dark';
    }
    function copySource() {
      const code = ${JSON.stringify(artifact.content.trim())};
      navigator.clipboard.writeText(code).then(() => {
        alert('Mind map source code copied to clipboard!');
      });
    }

    mermaid.initialize({
      startOnLoad: true,
      theme: 'base',
      securityLevel: 'loose',
      themeVariables: {
        darkMode: false,
        background: '#ffffff',
        primaryColor: '#6366f1',
        primaryTextColor: '#0f172a',
        primaryBorderColor: '#4f46e5',
        lineColor: '#6366f1',
        secondaryColor: '#0ea5e9',
        tertiaryColor: '#10b981',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: '14px'
      }
    });
  </script>
</body>
</html>`;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(htmlGraph);
      }
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

        // POST /api/permission/response (Desktop tool confirmation response)
        if (pathname === '/api/permission/response' && req.method === 'POST') {
          const { requestId, allowed, alwaysAllow } = payload;
          if (alwaysAllow) {
            configManager.setAlwaysAllow(true);
            this.activeAgent.updateConfig(configManager.get());
          }
          const resolver = this.pendingPermissions.get(requestId);
          if (resolver) {
            this.pendingPermissions.delete(requestId);
            resolver(!!allowed);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
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

          this.currentSseSender = sendEvent;
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
          } finally {
            this.currentSseSender = null;
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

        // POST /api/silent-debate
        if (pathname === '/api/silent-debate' && req.method === 'POST') {
          const query = payload.query || '';
          const depth = payload.depth || config.debateDepth || 'deep';
          const engine = new DialecticEngine(configManager.get());
          try {
            const result = await engine.silentDebate(query, depth);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, result }));
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
          return;
        }

        // POST /api/silent-goal
        if (pathname === '/api/silent-goal' && req.method === 'POST') {
          const objective = payload.objective || '';
          const engine = new GoalLoopEngine(configManager.get());
          try {
            const result = await engine.runSilentGoal(objective);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, result }));
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
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
          const targetName = payload.name || profileManager.getActiveProfileName();
          profileManager.saveProfile(targetName, payload.content || '');
          // Auto-sync to Firestore in background if configured
          const { FirestoreSyncManager } = await import('../cloud/firestore.js');
          FirestoreSyncManager.pushToFirestore().catch(() => {});
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        }

        // POST /api/profile/notes/save
        if (pathname === '/api/profile/notes/save' && req.method === 'POST') {
          if (payload.type === 'workspace') {
            profileManager.saveWorkspaceNotes(payload.content || '', config.workingDir);
          } else {
            profileManager.saveGlobalNotes(payload.content || '');
          }
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
          const { FirestoreSyncManager } = await import('../cloud/firestore.js');
          FirestoreSyncManager.deleteFromFirestore(payload.name).catch(() => {});
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

        // POST /api/artifacts/delete
        if (pathname === '/api/artifacts/delete' && req.method === 'POST') {
          const { artifactManager } = await import('../core/artifactManager.js');
          const ok = artifactManager.deleteArtifact(payload.id);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: ok }));
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

        // POST /api/chats/new (Create new chat session)
        if (pathname === '/api/chats/new' && req.method === 'POST') {
          const { sessionManager } = await import('../core/sessionManager.js');
          const session = sessionManager.createSession(payload.title || 'New Chat');
          this.activeAgent.syncHistoryFromActiveSession();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, session }));
          return;
        }

        // POST /api/chats/select (Switch active chat session)
        if (pathname === '/api/chats/select' && req.method === 'POST') {
          const { sessionManager } = await import('../core/sessionManager.js');
          const session = sessionManager.setActiveSessionId(payload.id);
          this.activeAgent.syncHistoryFromActiveSession();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: !!session, session }));
          return;
        }

        // POST /api/chats/delete (Delete chat session)
        if (pathname === '/api/chats/delete' && req.method === 'POST') {
          const { sessionManager } = await import('../core/sessionManager.js');
          const ok = sessionManager.deleteSession(payload.id);
          this.activeAgent.syncHistoryFromActiveSession();
          const activeSession = sessionManager.getActiveSession();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: ok, activeSession }));
          return;
        }

        // POST /api/chats/rename (Rename chat session)
        if (pathname === '/api/chats/rename' && req.method === 'POST') {
          const { sessionManager } = await import('../core/sessionManager.js');
          const ok = sessionManager.renameSession(payload.id, payload.title);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: ok }));
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
