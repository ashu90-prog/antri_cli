import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../models/artifact.dart';

class ArtifactViewerView extends StatefulWidget {
  final Artifact artifact;

  const ArtifactViewerView({super.key, required this.artifact});

  @override
  State<ArtifactViewerView> createState() => _ArtifactViewState();
}

class _ArtifactViewState extends State<ArtifactViewerView> {
  late final WebViewController _controller;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF0F172A))
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) {
            if (mounted) setState(() => _isLoading = true);
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _isLoading = false);
          },
        ),
      );

    _loadArtifactContent();
  }

  void _loadArtifactContent() {
    final art = widget.artifact;
    String fullHtml;

    if (art.type == 'mindmap') {
      final safeTitle = art.title.replaceAll("'", "\\'").replaceAll('"', '\\"');
      final safeContent = jsonEncode(art.content.trim());

      fullHtml = '''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>$safeTitle</title>
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
      --shadow-viewport: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
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
      --shadow-viewport: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
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
      margin: 0; padding: 14px 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-page);
      color: var(--text-main);
      display: flex; flex-direction: column; align-items: center; min-height: 100vh;
      overflow-x: hidden;
      transition: background 0.3s ease;
    }
    .header { text-align: center; margin-bottom: 10px; }
    .badge {
      display: inline-block; font-size: 10px; font-weight: 700;
      letter-spacing: 0.5px; text-transform: uppercase;
      background: var(--badge-bg); color: var(--badge-color);
      border: 1px solid var(--badge-border);
      padding: 3px 10px; border-radius: 999px; margin-bottom: 4px;
    }
    h1 { font-size: 15px; font-weight: 800; color: var(--text-main); margin: 0; }
    .toolbar {
      display: flex; gap: 6px; margin-bottom: 10px;
      align-items: center; justify-content: center; width: 100%; flex-wrap: wrap;
    }
    .tool-btn {
      background: var(--btn-bg); border: 1px solid var(--btn-border);
      color: var(--btn-text); padding: 5px 11px; border-radius: 8px; font-size: 11px;
      font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    .viewport {
      width: 100%; height: 74vh; min-height: 440px;
      position: relative; overflow: hidden; border-radius: 14px;
      background: var(--bg-viewport); backdrop-filter: blur(16px);
      border: 1px solid var(--border-viewport);
      box-shadow: var(--shadow-viewport);
      touch-action: none;
    }
    #mindmapSvg {
      width: 100%; height: 100%; display: block; cursor: grab;
    }
    #mindmapSvg:active { cursor: grabbing; }
    .markmap-foreign {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 13px !important; font-weight: 600 !important; line-height: 1.4 !important;
      color: var(--node-text) !important; background: var(--node-bg) !important;
      border: 1.5px solid var(--node-border) !important; border-radius: 8px !important;
      padding: 5px 12px !important; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.04) !important;
      display: inline-flex !important; align-items: center !important; white-space: nowrap !important;
      transition: all 0.2s ease !important;
    }
    .markmap-node[data-depth="0"] .markmap-foreign {
      background: var(--root-bg) !important; color: var(--root-text) !important;
      border-color: var(--root-border) !important; font-size: 15px !important;
      font-weight: 800 !important; border-radius: 9px !important; padding: 7px 16px !important;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35) !important;
    }
    .markmap-node[data-depth="1"] .markmap-foreign {
      font-weight: 700 !important; border-width: 1.8px !important;
    }
    .markmap-link {
      fill: none !important; stroke: var(--link-stroke) !important;
      stroke-width: 2px !important; stroke-linecap: round !important;
    }
    .markmap-node > circle {
      fill: var(--root-bg) !important; stroke: var(--root-border) !important;
      stroke-width: 2px !important; r: 6 !important; cursor: pointer !important;
    }
    .help-hint {
      position: absolute; bottom: 8px; right: 10px; font-size: 10px;
      color: var(--text-muted); pointer-events: none;
      background: rgba(255, 255, 255, 0.75); padding: 2px 6px; border-radius: 4px;
      border: 1px solid rgba(0,0,0,0.05);
    }
    body.theme-dark .help-hint {
      background: rgba(18, 24, 38, 0.7); border-color: rgba(255, 255, 255, 0.08);
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="badge">🧠 ANTRI Interactive Mind Map</span>
    <h1>$safeTitle</h1>
  </div>
  <div class="toolbar">
    <button class="tool-btn" onclick="zoomIn()">🔍 Zoom +</button>
    <button class="tool-btn" onclick="zoomOut()">🔍 Zoom -</button>
    <button class="tool-btn" onclick="fitView()">⛶ Fit / Reset</button>
    <button class="tool-btn" onclick="toggleTheme()" id="themeToggleBtn">🌙 Poster Dark</button>
  </div>
  <div class="viewport" id="viewport">
    <svg id="mindmapSvg"></svg>
    <div class="help-hint">👆 Drag to pan · Pinch to zoom · Tap circles to collapse</div>
  </div>
  <script>
    const rawContent = $safeContent;
    
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
        
        let clean = trimmed;
        if (clean.startsWith('root((') && clean.endsWith('))')) clean = clean.substring(6, clean.length - 2);
        else if (clean.startsWith('((') && clean.endsWith('))')) clean = clean.substring(2, clean.length - 2);
        else if (clean.startsWith('[') && clean.endsWith(']')) clean = clean.substring(1, clean.length - 1);
        else if (clean.startsWith('(') && clean.endsWith(')')) clean = clean.substring(1, clean.length - 1);
        else if (clean.startsWith('))') && clean.endsWith('((')) clean = clean.substring(2, clean.length - 2);
        else if (clean.startsWith(')') && clean.endsWith('(')) clean = clean.substring(1, clean.length - 1);
        else if (clean.startsWith('{{') && clean.endsWith('}}')) clean = clean.substring(2, clean.length - 2);
          
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
            nodeMinHeight: 26,
            spacingVertical: 14,
            spacingHorizontal: 80,
            paddingX: 14
          }, root);
          return;
        }
      } catch (err) {
        console.warn('Markmap mobile load error:', err);
      }
      renderFallbackTree();
    }

    function renderFallbackTree() {
      const svg = document.getElementById('mindmapSvg');
      svg.innerHTML = '';
      const lines = markdownText.split('\\n').filter(l => l.trim().length > 0);
      const rootNode = { name: '$safeTitle', children: [] };
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

      let curY = 30;
      function layout(node, depth = 0) {
        node.depth = depth;
        node.x = 40 + depth * 190;
        if (!node.children || node.children.length === 0) {
          node.y = curY;
          curY += 42;
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
            const x1 = node.x + 110, y1 = node.y;
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
        foreign.setAttribute('y', node.y - 16);
        foreign.setAttribute('width', '180');
        foreign.setAttribute('height', '36');
        foreign.innerHTML = '<div class="markmap-node" data-depth="' + node.depth + '"><div class="markmap-foreign">' + node.name + '</div></div>';
        g.appendChild(foreign);
      }
      draw(rootNode);
      svg.setAttribute('viewBox', '0 0 ' + Math.max(700, curY * 1.8) + ' ' + Math.max(450, curY + 50));
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
      if (btn) btn.textContent = isDark ? '☀️ Light' : '🌙 Poster Dark';
    }

    window.addEventListener('load', () => {
      setTimeout(renderMarkmap, 60);
    });
    if (document.readyState === 'complete') renderMarkmap();
  </script>
</body>
</html>''';
    } else if (art.type == 'graph') {
      const badgeLabel = '📊 Architecture Graph';

      fullHtml = '''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${art.title}</title>
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
      --shadow-viewport: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
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
      --shadow-viewport: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
      --badge-bg: rgba(99, 102, 241, 0.2);
      --badge-color: #818cf8;
      --badge-border: rgba(99, 102, 241, 0.35);
    }
    body {
      margin: 0;
      padding: 16px 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-page);
      color: var(--text-main);
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      overflow-x: hidden;
      transition: background 0.3s ease;
    }
    .header {
      text-align: center;
      margin-bottom: 12px;
    }
    .badge {
      display: inline-block;
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      background: var(--badge-bg);
      color: var(--badge-color);
      border: 1px solid var(--badge-border);
      padding: 4px 10px;
      border-radius: 999px;
      margin-bottom: 6px;
    }
    h1 {
      font-size: 16px;
      font-weight: 800;
      color: var(--text-main);
      margin: 0;
    }
    .toolbar {
      display: flex;
      gap: 6px;
      margin-bottom: 12px;
      align-items: center;
      justify-content: center;
      width: 100%;
      flex-wrap: wrap;
    }
    .tool-btn {
      background: var(--btn-bg);
      border: 1px solid var(--btn-border);
      color: var(--btn-text);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    .viewport {
      width: 100%;
      height: 72vh;
      min-height: 440px;
      position: relative;
      overflow: hidden;
      border-radius: 14px;
      background: var(--bg-viewport);
      backdrop-filter: blur(16px);
      border: 1px solid var(--border-viewport);
      box-shadow: var(--shadow-viewport);
      cursor: grab;
      user-select: none;
      touch-action: none;
    }
    .viewport.grabbing {
      cursor: grabbing;
    }
    .canvas {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      transform-origin: center center;
      will-change: transform;
    }
    .canvas.animating {
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .mermaid {
      font-size: 12px;
      width: 100%;
      text-align: center;
    }
    .mermaid svg {
      max-width: 100%;
      height: auto;
    }
    .help-hint {
      position: absolute;
      bottom: 8px;
      right: 10px;
      font-size: 10px;
      color: var(--text-muted);
      pointer-events: none;
      background: rgba(255, 255, 255, 0.75);
      padding: 2px 6px;
      border-radius: 4px;
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
    <span class="badge">$badgeLabel</span>
    <h1>${art.title}</h1>
  </div>
  <div class="toolbar">
    <button class="tool-btn" onclick="zoomIn()">🔍 Zoom +</button>
    <button class="tool-btn" onclick="zoomOut()">🔍 Zoom -</button>
    <button class="tool-btn" onclick="resetZoom()">⛶ Reset</button>
    <button class="tool-btn" onclick="toggleTheme()" id="themeToggleBtn">🌙 Poster Dark</button>
  </div>
  <div class="viewport" id="viewport">
    <div class="canvas" id="canvas">
      <pre class="mermaid">
${art.content.trim()}
      </pre>
    </div>
    <div class="help-hint">👆 Drag to pan · Pinch to zoom</div>
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
      if (btn) btn.textContent = isDark ? '☀️ Light' : '🌙 Poster Dark';
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
        fontSize: '13px'
      }
    });
  </script>
</body>
</html>''';
    } else {
      // Interactive HTML application / Multi-page plan
      String html = art.content.trim();
      // If code doesn't have standard html boilerplate, wrap it properly
      if (!html.toLowerCase().contains('<!doctype html>') && !html.toLowerCase().contains('<html')) {
        html = '''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${art.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: radial-gradient(circle at 15% 15%, rgba(99, 102, 241, 0.08) 0%, transparent 40%), radial-gradient(circle at 85% 85%, rgba(236, 72, 153, 0.08) 0%, transparent 40%), #f8fafc;
      color: #0f172a;
      padding: 16px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
$html
</body>
</html>''';
      } else if (!html.contains('viewport')) {
        html = html.replaceFirst('<head>', '<head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">');
      }
      fullHtml = html;
    }

    _controller.loadHtmlString(fullHtml);
  }

  @override
  Widget build(BuildContext context) {
    final art = widget.artifact;
    final isMindmap = art.type == 'mindmap';
    final isGraph = art.type == 'graph';

    final Color badgeCol = isMindmap
        ? const Color(0xFFC084FC)
        : isGraph
            ? const Color(0xFF38BDF8)
            : const Color(0xFF4ADE80);

    final Color badgeBg = isMindmap
        ? const Color(0x33A855F7)
        : isGraph
            ? const Color(0x3338BDF8)
            : const Color(0x3322C55E);

    final IconData typeIcon = isMindmap
        ? Icons.psychology_outlined
        : isGraph
            ? Icons.account_tree_outlined
            : Icons.language;

    final String subtitle = isMindmap
        ? '🧠 Interactive Mind Map'
        : isGraph
            ? '📊 Code Architecture Graph'
            : '🌐 Multi-Page Interactive App';

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              art.title,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: Colors.white,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              subtitle,
              style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.w600),
            ),
          ],
        ),
        actions: [
          Container(
            margin: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: badgeBg,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: badgeCol,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  typeIcon,
                  size: 13,
                  color: badgeCol,
                ),
                const SizedBox(width: 4),
                Text(
                  art.type.toUpperCase(),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: badgeCol,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.refresh, size: 20, color: Colors.white70),
            tooltip: 'Reload Artifact',
            onPressed: () {
              _loadArtifactContent();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Artifact view reloaded'), duration: Duration(seconds: 1)),
              );
            },
          ),
        ],
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_isLoading)
            const Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: LinearProgressIndicator(
                backgroundColor: Color(0xFF1E293B),
                color: Color(0xFF6366F1),
                minHeight: 3,
              ),
            ),
        ],
      ),
    );
  }
}
