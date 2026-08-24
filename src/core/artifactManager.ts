import fs from 'fs';
import path from 'path';
import os from 'os';
import { Artifact, ArtifactType } from '../types.js';

const ARTIFACTS_DIR = path.join(os.homedir(), '.antri', 'artifacts');

export class ArtifactManager {
  private baseDir: string;
  private artifacts: Map<string, Artifact> = new Map();

  constructor(customDir?: string) {
    this.baseDir = customDir || ARTIFACTS_DIR;
    this.ensureDirectory();
    this.loadIndex();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private getIndexPath(): string {
    return path.join(this.baseDir, 'artifacts.json');
  }

  private loadIndex(): void {
    try {
      const indexPath = this.getIndexPath();
      if (fs.existsSync(indexPath)) {
        const raw = fs.readFileSync(indexPath, 'utf-8');
        const list: Artifact[] = JSON.parse(raw);
        this.artifacts.clear();
        for (const item of list) {
          this.artifacts.set(item.id, item);
        }
      }
    } catch {
      this.artifacts.clear();
    }
  }

  private persistIndex(): void {
    try {
      this.ensureDirectory();
      const list = Array.from(this.artifacts.values());
      fs.writeFileSync(this.getIndexPath(), JSON.stringify(list, null, 2), 'utf-8');
    } catch {}
  }

  public saveArtifact(artifact: Artifact): Artifact {
    this.ensureDirectory();
    this.artifacts.set(artifact.id, artifact);

    // Also write a standalone file for easy browser viewing
    try {
      const ext = artifact.type === 'html' ? 'html' : 'txt';
      const filePath = path.join(this.baseDir, `${artifact.id}.${ext}`);
      if (artifact.type === 'html') {
        fs.writeFileSync(filePath, artifact.content, 'utf-8');
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
    .controls {
      display: flex; gap: 8px; margin-bottom: 14px; align-items: center; flex-wrap: wrap; justify-content: center;
    }
    .btn {
      background: var(--btn-bg); border: 1px solid var(--btn-border);
      color: var(--btn-text); padding: 7px 14px; border-radius: 9px; font-size: 12px;
      font-weight: 700; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 6px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.03);
    }
    .btn:hover { background: var(--btn-hover); transform: translateY(-1px); }
    .btn:active { transform: translateY(0); }
    .viewer-card {
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
  <div class="controls">
    <button class="btn" onclick="zoomIn()">🔍 Zoom +</button>
    <button class="btn" onclick="zoomOut()">🔍 Zoom -</button>
    <button class="btn" onclick="fitView()">⛶ Fit / Reset</button>
    <button class="btn" onclick="toggleTheme()" id="themeToggleBtn">🌙 Poster Dark</button>
    <button class="btn" onclick="copySource()">📋 Copy Code</button>
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
        fs.writeFileSync(path.join(this.baseDir, `${artifact.id}.html`), htmlMindmap, 'utf-8');
      } else if (artifact.type === 'graph') {
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
      --badge-bg: rgba(99, 102, 241, 0.2);
      --badge-color: #818cf8;
      --badge-border: rgba(99, 102, 241, 0.35);
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
    h1 { font-size: 19px; color: var(--text-main); margin: 0 0 6px 0; font-weight: 800; }
    .badge {
      font-size: 11px;
      background: var(--badge-bg);
      color: var(--badge-color);
      padding: 4px 12px; border-radius: 9999px;
      border: 1px solid var(--badge-border);
      text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;
      display: inline-block; margin-bottom: 6px;
    }
    .controls {
      display: flex; gap: 8px; margin-bottom: 14px; align-items: center; flex-wrap: wrap; justify-content: center;
    }
    .btn {
      background: var(--btn-bg); border: 1px solid var(--btn-border);
      color: var(--btn-text); padding: 7px 14px; border-radius: 9px; font-size: 12px;
      font-weight: 700; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 6px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.03);
    }
    .btn:hover { background: var(--btn-hover); transform: translateY(-1px); }
    .btn:active { transform: translateY(0); }
    .viewer-card {
      width: 100%; max-width: 1150px; height: 72vh; min-height: 520px;
      position: relative; overflow: hidden; border-radius: 18px;
      background: var(--bg-viewport); backdrop-filter: blur(20px);
      border: 1px solid var(--border-viewport);
      box-shadow: var(--shadow-viewport);
      cursor: grab; user-select: none; touch-action: none;
    }
    .viewer-card.grabbing { cursor: grabbing; }
    .canvas-wrap {
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      transform-origin: center center;
      will-change: transform;
    }
    .canvas-wrap.animating {
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
  <div class="controls">
    <button class="btn" onclick="zoomIn()">🔍 Zoom +</button>
    <button class="btn" onclick="zoomOut()">🔍 Zoom -</button>
    <button class="btn" onclick="resetZoom()">⛶ Reset</button>
    <button class="btn" onclick="toggleTheme()" id="themeToggleBtn">🌙 Poster Dark</button>
  </div>
  <div class="viewer-card" id="viewerCard">
    <div class="canvas-wrap" id="canvasWrap">
      <pre class="mermaid" id="mermaidDiagram">
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

    const viewerCard = document.getElementById('viewerCard');
    const canvasWrap = document.getElementById('canvasWrap');

    function updateTransform(animate = false) {
      if (animate) {
        canvasWrap.classList.add('animating');
        setTimeout(() => canvasWrap.classList.remove('animating'), 320);
      } else {
        canvasWrap.classList.remove('animating');
      }
      canvasWrap.style.transform = 'translate3d(' + posX + 'px, ' + posY + 'px, 0) scale(' + scale + ')';
    }

    viewerCard.addEventListener('pointerdown', (e) => {
      activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { viewerCard.setPointerCapture(e.pointerId); } catch {}

      if (activeTouches.size === 1) {
        isDragging = true;
        viewerCard.classList.add('grabbing');
        startPointerX = e.clientX;
        startPointerY = e.clientY;
        startPosX = posX;
        startPosY = posY;
      } else if (activeTouches.size === 2) {
        isDragging = false;
        viewerCard.classList.remove('grabbing');
        const pts = Array.from(activeTouches.values());
        initialPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        initialPinchScale = scale;
      }
    });

    viewerCard.addEventListener('pointermove', (e) => {
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
      try { viewerCard.releasePointerCapture(e.pointerId); } catch {}
      if (activeTouches.size === 0) {
        isDragging = false;
        viewerCard.classList.remove('grabbing');
      } else if (activeTouches.size === 1) {
        isDragging = true;
        viewerCard.classList.add('grabbing');
        const remaining = Array.from(activeTouches.values())[0];
        startPointerX = remaining.x;
        startPointerY = remaining.y;
        startPosX = posX;
        startPosY = posY;
      }
    }

    viewerCard.addEventListener('pointerup', endPointer);
    viewerCard.addEventListener('pointercancel', endPointer);

    viewerCard.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.15 : 0.87;
      const newScale = Math.min(Math.max(scale * delta, 0.2), 4.0);
      
      const rect = viewerCard.getBoundingClientRect();
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
        fs.writeFileSync(path.join(this.baseDir, `${artifact.id}.html`), htmlGraph, 'utf-8');
      }
    } catch {}

    this.persistIndex();
    return artifact;
  }

  public getArtifact(id: string): Artifact | null {
    return this.artifacts.get(id) || null;
  }

  public getAllArtifacts(): Artifact[] {
    return Array.from(this.artifacts.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public getArtifactsBySession(sessionId: string): Artifact[] {
    return this.getAllArtifacts().filter((a) => a.sessionId === sessionId);
  }

  public getArtifactsGroupedBySession(): Array<{ sessionId: string; sessionTitle: string; artifacts: Artifact[] }> {
    const all = this.getAllArtifacts();
    const groups = new Map<string, { sessionId: string; sessionTitle: string; artifacts: Artifact[] }>();

    for (const art of all) {
      const sId = art.sessionId || 'default';
      const sTitle = art.sessionTitle || 'General Chat';
      if (!groups.has(sId)) {
        groups.set(sId, { sessionId: sId, sessionTitle: sTitle, artifacts: [] });
      }
      groups.get(sId)!.artifacts.push(art);
    }

    return Array.from(groups.values());
  }

  public deleteArtifact(id: string): boolean {
    const existed = this.artifacts.delete(id);
    if (existed) {
      try {
        const htmlPath = path.join(this.baseDir, `${id}.html`);
        const txtPath = path.join(this.baseDir, `${id}.txt`);
        if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);
        if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath);
      } catch {}
      this.persistIndex();
    }
    return existed;
  }

  public getArtifactFilePath(id: string): string | null {
    const htmlPath = path.join(this.baseDir, `${id}.html`);
    if (fs.existsSync(htmlPath)) return htmlPath;
    const txtPath = path.join(this.baseDir, `${id}.txt`);
    if (fs.existsSync(txtPath)) return txtPath;
    return null;
  }

  /**
   * Parses `<antri_artifact ...>`, JSON create_artifact, and raw Mermaid mindmaps
   * blocks from text, saves them to store, and replaces them with clean Markdown badges.
   */
  public parseAndStoreArtifacts(
    rawText: string,
    sessionId: string = 'session_' + Date.now(),
    sessionTitle: string = 'Chat Session'
  ): { cleanText: string; artifacts: Artifact[] } {
    const artifacts: Artifact[] = [];
    let cleanText = rawText;

    // 1. Match <antri_artifact id="..." type="..." title="...">...</antri_artifact>
    const xmlRegex = /<antri_artifact\s+id="([^"]+)"\s+type="([^"]+)"\s+title="([^"]+)">([\s\S]*?)<\/antri_artifact>/gi;
    let match: RegExpExecArray | null;
    while ((match = xmlRegex.exec(rawText)) !== null) {
      const id = match[1].trim();
      const type = (match[2].trim().toLowerCase() as ArtifactType) || 'html';
      const title = match[3].trim();
      const content = match[4].trim();

      const artifact: Artifact = {
        id,
        sessionId,
        sessionTitle,
        title,
        type,
        content,
        createdAt: Date.now(),
      };

      this.saveArtifact(artifact);
      artifacts.push(artifact);

      const typeLabel = type === 'mindmap' ? '🧠 Interactive Mind Map' : type === 'graph' ? '📊 Code Architecture Graph' : '🌐 Interactive HTML Artifact';
      const badge = `\n\n> 🎨 **[Artifact Created: ${title}]**\n> Type: \`${typeLabel}\` · ID: \`${id}\`\n> Click **"View Artifact"** in the interface to launch.\n\n`;
      cleanText = cleanText.replace(match[0], badge);
    }

    // 2. Match JSON format: {"name": "create_artifact", "parameters": { ... }}
    if (artifacts.length === 0 && rawText.includes('"create_artifact"')) {
      try {
        const jsonMatch = rawText.match(/\{[\s\S]*"name"\s*:\s*"create_artifact"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const params = parsed.parameters || parsed.args || parsed;
          const type = (params.type || 'mindmap').toLowerCase() as ArtifactType;
          const title = params.title || 'Generated Artifact';
          const content = params.content || '';
          const id = `art_${Date.now().toString(36)}`;

          if (content.trim()) {
            const artifact: Artifact = {
              id,
              sessionId,
              sessionTitle,
              title,
              type,
              content,
              createdAt: Date.now(),
            };
            this.saveArtifact(artifact);
            artifacts.push(artifact);

            const typeLabel = type === 'mindmap' ? '🧠 Interactive Mind Map' : type === 'graph' ? '📊 Code Architecture Graph' : '🌐 Interactive HTML Artifact';
            const badge = `\n\n> 🎨 **[Artifact Created: ${title}]**\n> Type: \`${typeLabel}\` · ID: \`${id}\`\n> Click **"View Artifact"** in the interface to launch.\n\n`;
            cleanText = cleanText.replace(jsonMatch[0], badge);
          }
        }
      } catch (_) {}
    }

    // 3. Match raw Mermaid mindmap blocks: ```mermaid\nmindmap...``` or mindmap\n  root((...))
    if (artifacts.length === 0 && (rawText.includes('mindmap\n') || rawText.includes('mindmap\r\n'))) {
      const mindmapMatch = rawText.match(/(?:```(?:mermaid)?\s*)?(mindmap\s+[\s\S]*?)(?:```|$)/i);
      if (mindmapMatch && mindmapMatch[1].trim().length > 20) {
        const content = mindmapMatch[1].trim();
        const rootMatch = content.match(/root\(\(?([^)]+)\)?\)/i);
        const title = rootMatch ? `${rootMatch[1].trim()} Mind Map` : 'Interactive Mind Map';
        const id = `mindmap_${Date.now().toString(36)}`;

        const artifact: Artifact = {
          id,
          sessionId,
          sessionTitle,
          title,
          type: 'mindmap',
          content,
          createdAt: Date.now(),
        };

        this.saveArtifact(artifact);
        artifacts.push(artifact);

        const badge = `\n\n> 🎨 **[Artifact Created: ${title}]**\n> Type: \`🧠 Interactive Mind Map\` · ID: \`${id}\`\n> Click **"View Artifact"** in the interface to launch.\n\n`;
        cleanText = cleanText.replace(mindmapMatch[0], badge);
      }
    }

    return { cleanText, artifacts };
  }
}

export const artifactManager = new ArtifactManager();
