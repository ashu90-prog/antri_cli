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

    if (art.type == 'graph') {
      fullHtml = '''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${art.title}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0f172a;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      padding: 16px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
    }
    .header {
      width: 100%;
      text-align: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #1e293b;
    }
    .badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      background: #1e1b4b;
      color: #a5b4fc;
      border: 1px solid #3730a3;
      padding: 4px 10px;
      border-radius: 999px;
      margin-bottom: 8px;
    }
    h1 {
      font-size: 18px;
      font-weight: 800;
      color: #ffffff;
    }
    .graph-wrapper {
      width: 100%;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 20px 12px;
      overflow-x: auto;
      display: flex;
      justify-content: center;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    }
    .mermaid {
      font-size: 14px;
      width: 100%;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="badge">Architecture Graph</span>
    <h1>${art.title}</h1>
  </div>
  <div class="graph-wrapper">
    <pre class="mermaid">
${art.content.trim()}
    </pre>
  </div>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      securityLevel: 'loose',
      themeVariables: {
        darkMode: true,
        background: '#1e293b',
        primaryColor: '#6366f1',
        primaryTextColor: '#ffffff',
        primaryBorderColor: '#4338ca',
        lineColor: '#38bdf8',
        secondaryColor: '#0ea5e9',
        tertiaryColor: '#10b981'
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
      background: #0f172a;
      color: #f8fafc;
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
              art.type == 'graph' ? '📊 Code Architecture Graph' : '🌐 Multi-Page Interactive App',
              style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.w600),
            ),
          ],
        ),
        actions: [
          Container(
            margin: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: art.type == 'graph' ? const Color(0x3338BDF8) : const Color(0x3322C55E),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: art.type == 'graph' ? const Color(0xFF38BDF8) : const Color(0xFF22C55E),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  art.type == 'graph' ? Icons.account_tree_outlined : Icons.language,
                  size: 13,
                  color: art.type == 'graph' ? const Color(0xFF38BDF8) : const Color(0xFF4ADE80),
                ),
                const SizedBox(width: 4),
                Text(
                  art.type.toUpperCase(),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: art.type == 'graph' ? const Color(0xFF38BDF8) : const Color(0xFF4ADE80),
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
