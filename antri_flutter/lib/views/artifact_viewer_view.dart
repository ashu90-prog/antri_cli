import 'package:flutter/material.dart';
import '../models/artifact.dart';

class ArtifactViewerView extends StatefulWidget {
  final Artifact artifact;

  const ArtifactViewerView({super.key, required this.artifact});

  @override
  State<ArtifactViewerView> createState() => _ArtifactViewState();
}

class _ArtifactViewState extends State<ArtifactViewerView> {
  final Set<String> _checkedItems = {};
  int _activeTabIndex = 0;

  @override
  Widget build(BuildContext context) {
    final art = widget.artifact;
    const creamBg = Color(0xFFFCFBF9);
    const darkSlate = Color(0xFF1C1917);
    const borderCol = Color(0xFFE6E0D4);

    return Scaffold(
      backgroundColor: creamBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: darkSlate),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              art.title,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: darkSlate,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              art.type == 'graph' ? '📊 Code Architecture Graph' : '🌐 Interactive HTML Artifact',
              style: const TextStyle(fontSize: 11, color: Color(0xFF78716C), fontWeight: FontWeight.w600),
            ),
          ],
        ),
        actions: [
          Container(
            margin: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: art.type == 'graph' ? const Color(0xFFEFF6FF) : const Color(0xFFF0FDF4),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: art.type == 'graph' ? const Color(0xFFBFDBFE) : const Color(0xFFBBF7D0),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  art.type == 'graph' ? Icons.account_tree_outlined : Icons.language,
                  size: 14,
                  color: art.type == 'graph' ? const Color(0xFF1D4ED8) : const Color(0xFF15803D),
                ),
                const SizedBox(width: 4),
                Text(
                  art.type.toUpperCase(),
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: art.type == 'graph' ? const Color(0xFF1D4ED8) : const Color(0xFF15803D),
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.refresh, size: 20, color: Color(0xFF78716C)),
            onPressed: () {
              setState(() {
                _checkedItems.clear();
              });
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Artifact view reloaded'), duration: Duration(seconds: 1)),
              );
            },
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Session origin badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: borderCol),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.chat_bubble_outline, size: 15, color: Color(0xFF78716C)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Created in: ${art.sessionTitle}',
                        style: const TextStyle(fontSize: 12, color: Color(0xFF44403C), fontWeight: FontWeight.w600),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Text(
                      '${art.createdAt.hour.toString().padLeft(2, '0')}:${art.createdAt.minute.toString().padLeft(2, '0')}',
                      style: const TextStyle(fontSize: 11, color: Color(0xFFA8A29E)),
                    ),
                  ],
                ),
              ),

              // Rendered Interactive Content (No raw code)
              if (art.type == 'graph')
                _buildGraphRenderer(context, art)
              else
                _buildHtmlRenderer(context, art),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildGraphRenderer(BuildContext context, Artifact art) {
    final cleanLines = art.content
        .split('\n')
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty && !l.startsWith('```') && !l.startsWith('graph '))
        .toList();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(color: Color(0x20000000), blurRadius: 16, offset: Offset(0, 4)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.hub_outlined, color: Color(0xFF818CF8), size: 18),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  art.title,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          // Interactive Nodes flow
          ...cleanLines.map((line) {
            final isConnection = line.contains('-->') || line.contains('---') || line.contains('-.->');
            if (isConnection) {
              final parts = line.split(RegExp(r'-->|---|-.->'));
              final source = parts.isNotEmpty ? parts[0].replaceAll(RegExp(r'[\[\]\(\)\{\}]'), '').trim() : '';
              final target = parts.length > 1 ? parts[1].replaceAll(RegExp(r'[\[\]\(\)\{\}]'), '').trim() : '';

              return Container(
                margin: const EdgeInsets.symmetric(vertical: 6),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFF334155)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFF312E81),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          source,
                          style: const TextStyle(color: Color(0xFFC7D2FE), fontSize: 12, fontWeight: FontWeight.w700),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 8),
                      child: Icon(Icons.arrow_forward, color: Color(0xFF818CF8), size: 16),
                    ),
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFF065F46),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          target,
                          style: const TextStyle(color: Color(0xFFA7F3D0), fontSize: 12, fontWeight: FontWeight.w700),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }

            return Container(
              margin: const EdgeInsets.symmetric(vertical: 4),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFF334155)),
              ),
              child: Text(
                line.replaceAll(RegExp(r'[\[\]\(\)\{\}]'), ''),
                style: const TextStyle(color: Color(0xFFE2E8F0), fontSize: 12, fontWeight: FontWeight.w600),
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildHtmlRenderer(BuildContext context, Artifact art) {
    const darkSlate = Color(0xFF1C1917);
    const borderCol = Color(0xFFE6E0D4);

    // Extract text sections, headers, and bullet points from HTML
    final raw = art.content;
    final titleMatch = RegExp(r'<h[12][^>]*>(.*?)<\/h[12]>', caseSensitive: false).firstMatch(raw);
    final headerTitle = titleMatch != null ? _cleanHtml(titleMatch.group(1) ?? '') : art.title;

    final paragraphs = RegExp(r'<p[^>]*>(.*?)<\/p>', caseSensitive: false)
        .allMatches(raw)
        .map((m) => _cleanHtml(m.group(1) ?? ''))
        .where((t) => t.isNotEmpty)
        .toList();

    final listItems = RegExp(r'<li[^>]*>(.*?)<\/li>', caseSensitive: false)
        .allMatches(raw)
        .map((m) => _cleanHtml(m.group(1) ?? ''))
        .where((t) => t.isNotEmpty)
        .toList();

    final dayMatches = RegExp(r'(Day \d+|Phase \d+|Part \d+|Section \d+)', caseSensitive: false)
        .allMatches(raw)
        .map((m) => m.group(0) ?? '')
        .toSet()
        .toList();

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderCol),
        boxShadow: const [
          BoxShadow(color: Color(0x0D000000), blurRadius: 10, offset: Offset(0, 3)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Artifact Header Banner
          Container(
            padding: const EdgeInsets.all(18),
            decoration: const BoxDecoration(
              color: Color(0xFF1C1917),
              borderRadius: BorderRadius.vertical(top: Radius.circular(15)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0x3338BDF8),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text(
                        'INTERACTIVE ARTIFACT',
                        style: TextStyle(color: Color(0xFF38BDF8), fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 0.5),
                      ),
                    ),
                    const Row(
                      children: [
                        Icon(Icons.touch_app_outlined, color: Colors.white70, size: 14),
                        SizedBox(width: 4),
                        Text('Interactive Plan', style: TextStyle(color: Colors.white70, fontSize: 11)),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  headerTitle,
                  style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800),
                ),
              ],
            ),
          ),

          // Day / Phase Switcher Tabs (if multi-day plan)
          if (dayMatches.length > 1)
            Container(
              height: 48,
              decoration: const BoxDecoration(
                color: Color(0xFFF7F4EE),
                border: Border(bottom: BorderSide(color: borderCol)),
              ),
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                itemCount: dayMatches.length,
                itemBuilder: (context, idx) {
                  final active = _activeTabIndex == idx;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: InkWell(
                      onTap: () => setState(() => _activeTabIndex = idx),
                      borderRadius: BorderRadius.circular(20),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                        decoration: BoxDecoration(
                          color: active ? darkSlate : Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: active ? darkSlate : borderCol),
                        ),
                        child: Text(
                          dayMatches[idx],
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: active ? Colors.white : darkSlate,
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),

          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Paragraph overview
                ...paragraphs.take(2).map(
                      (p) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Text(
                          p,
                          style: const TextStyle(fontSize: 14, color: Color(0xFF44403C), height: 1.45),
                        ),
                      ),
                    ),

                // Interactive Checklist Section
                const SizedBox(height: 8),
                const Text(
                  'Interactive Routine & Steps',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: darkSlate),
                ),
                const SizedBox(height: 10),

                if (listItems.isNotEmpty)
                  ...listItems.map((item) {
                    final isChecked = _checkedItems.contains(item);
                    return InkWell(
                      onTap: () {
                        setState(() {
                          if (isChecked) {
                            _checkedItems.remove(item);
                          } else {
                            _checkedItems.add(item);
                          }
                        });
                      },
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: isChecked ? const Color(0xFFF0FDF4) : const Color(0xFFFDFBF7),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: isChecked ? const Color(0xFF86EFAC) : borderCol,
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              isChecked ? Icons.check_circle : Icons.radio_button_unchecked,
                              size: 18,
                              color: isChecked ? const Color(0xFF16A34A) : const Color(0xFFA8A29E),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                item,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: isChecked ? FontWeight.w600 : FontWeight.w500,
                                  color: isChecked ? const Color(0xFF15803D) : const Color(0xFF292524),
                                  decoration: isChecked ? TextDecoration.lineThrough : null,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  })
                else
                  Text(
                    _cleanHtml(raw),
                    style: const TextStyle(fontSize: 13, color: Color(0xFF44403C), height: 1.4),
                  ),

                // Progress Bar
                if (listItems.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Progress: ${_checkedItems.length}/${listItems.length} Completed',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF78716C)),
                      ),
                      Text(
                        '${((_checkedItems.length / listItems.length) * 100).toInt()}%',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF15803D)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: _checkedItems.isEmpty ? 0 : _checkedItems.length / listItems.length,
                      minHeight: 6,
                      backgroundColor: const Color(0xFFE6E0D4),
                      valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF16A34A)),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _cleanHtml(String html) {
    return html
        .replaceAll(RegExp(r'<[^>]*>'), '')
        .replaceAll('&nbsp;', ' ')
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .trim();
  }
}
