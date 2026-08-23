import 'package:flutter/material.dart';
import '../models/artifact.dart';
import '../models/ai_config.dart';
import '../services/storage_service.dart';
import 'artifact_viewer_view.dart';

class ArtifactsView extends StatefulWidget {
  final AIConfig config;
  final StorageService storageService;

  const ArtifactsView({
    super.key,
    required this.config,
    required this.storageService,
  });

  @override
  State<ArtifactsView> createState() => _ArtifactsViewState();
}

class _ArtifactsViewState extends State<ArtifactsView> {
  List<Artifact> _artifacts = [];
  bool _isLoading = true;
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _loadArtifacts();
  }

  Future<void> _loadArtifacts() async {
    setState(() => _isLoading = true);
    final list = await widget.storageService.loadArtifacts(widget.config.syncKey);
    setState(() {
      _artifacts = list;
      _isLoading = false;
    });
  }

  Future<void> _deleteArtifact(Artifact art) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: const Text('Delete Artifact', style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF1C1917))),
        content: Text('Are you sure you want to delete "${art.title}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF78716C))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
              elevation: 0,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await widget.storageService.deleteArtifact(art.id, widget.config.syncKey);
      await _loadArtifacts();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Deleted "${art.title}"'), duration: const Duration(seconds: 2)),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    const creamBg = Color(0xFFFCFBF9);
    const darkSlate = Color(0xFF1C1917);
    const borderCol = Color(0xFFE6E0D4);

    final filtered = _artifacts.where((a) {
      if (_searchQuery.isEmpty) return true;
      return a.title.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          a.sessionTitle.toLowerCase().contains(_searchQuery.toLowerCase());
    }).toList();

    // Group artifacts by sessionTitle
    final Map<String, List<Artifact>> grouped = {};
    for (final art in filtered) {
      final key = art.sessionTitle.isNotEmpty ? art.sessionTitle : 'General Chat';
      grouped.putIfAbsent(key, () => []).add(art);
    }

    return Scaffold(
      backgroundColor: creamBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: darkSlate),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Artifacts Gallery',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: darkSlate),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, size: 20, color: Color(0xFF78716C)),
            onPressed: _loadArtifacts,
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Search Bar
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: TextField(
                onChanged: (val) => setState(() => _searchQuery = val.trim()),
                style: const TextStyle(fontSize: 14, color: darkSlate),
                decoration: InputDecoration(
                  hintText: 'Search artifacts by title or chat...',
                  prefixIcon: const Icon(Icons.search, size: 18, color: Color(0xFF78716C)),
                  filled: true,
                  fillColor: Colors.white,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: borderCol),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: borderCol),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: darkSlate, width: 1.5),
                  ),
                ),
              ),
            ),

            // Content List
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(color: darkSlate))
                  : grouped.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF0EBE1),
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: const Icon(Icons.auto_awesome, size: 36, color: Color(0xFF78716C)),
                              ),
                              const SizedBox(height: 16),
                              const Text(
                                'No Artifacts Yet',
                                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: darkSlate),
                              ),
                              const SizedBox(height: 6),
                              const Padding(
                                padding: EdgeInsets.symmetric(horizontal: 32),
                                child: Text(
                                  'Ask the AI to generate a plan, dashboard, mind map, or graph using /view, /mindmap, or /imagine in chat.',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(fontSize: 13, color: Color(0xFF78716C), height: 1.4),
                                ),
                              ),
                            ],
                          ),
                        )
                      : ListView(
                          padding: const EdgeInsets.all(16),
                          children: grouped.entries.map((entry) {
                            final sessionName = entry.key;
                            final items = entry.value;

                            return Container(
                              margin: const EdgeInsets.only(bottom: 20),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  // Chat Title Group Header
                                  Padding(
                                    padding: const EdgeInsets.only(left: 4, bottom: 8),
                                    child: Row(
                                      children: [
                                        const Icon(Icons.forum_outlined, size: 16, color: Color(0xFF78716C)),
                                        const SizedBox(width: 8),
                                        Expanded(
                                          child: Text(
                                            sessionName,
                                            style: const TextStyle(
                                              fontSize: 14,
                                              fontWeight: FontWeight.w800,
                                              color: darkSlate,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFF0EBE1),
                                            borderRadius: BorderRadius.circular(12),
                                          ),
                                          child: Text(
                                            '${items.length} ${items.length == 1 ? "artifact" : "artifacts"}',
                                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF78716C)),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),

                                  // Artifact Cards
                                  ...items.map((art) {
                                    final isMindmap = art.type == 'mindmap';
                                    final isGraph = art.type == 'graph';

                                    final Color leadBg = isMindmap
                                        ? const Color(0xFFFAF5FF)
                                        : isGraph
                                            ? const Color(0xFFEFF6FF)
                                            : const Color(0xFFF0FDF4);

                                    final Color leadBorder = isMindmap
                                        ? const Color(0xFFE9D5FF)
                                        : isGraph
                                            ? const Color(0xFFBFDBFE)
                                            : const Color(0xFFBBF7D0);

                                    final Color iconCol = isMindmap
                                        ? const Color(0xFF7E22CE)
                                        : isGraph
                                            ? const Color(0xFF1D4ED8)
                                            : const Color(0xFF15803D);

                                    final IconData leadIcon = isMindmap
                                        ? Icons.psychology_outlined
                                        : isGraph
                                            ? Icons.account_tree_outlined
                                            : Icons.language;

                                    final String typeSubtitle = isMindmap
                                        ? 'Interactive Mind Map'
                                        : isGraph
                                            ? 'Code Architecture Graph'
                                            : 'Interactive HTML Plan';

                                    return Container(
                                      margin: const EdgeInsets.only(bottom: 10),
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(color: borderCol),
                                        boxShadow: const [
                                          BoxShadow(color: Color(0x06000000), blurRadius: 6, offset: Offset(0, 2)),
                                        ],
                                      ),
                                      child: ListTile(
                                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                        leading: Container(
                                          padding: const EdgeInsets.all(10),
                                          decoration: BoxDecoration(
                                            color: leadBg,
                                            borderRadius: BorderRadius.circular(10),
                                            border: Border.all(
                                              color: leadBorder,
                                            ),
                                          ),
                                          child: Icon(
                                            leadIcon,
                                            color: iconCol,
                                            size: 20,
                                          ),
                                        ),
                                        title: Text(
                                          art.title,
                                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: darkSlate),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        subtitle: Padding(
                                          padding: const EdgeInsets.only(top: 4),
                                          child: Text(
                                            '$typeSubtitle · ${art.createdAt.day}/${art.createdAt.month}/${art.createdAt.year}',
                                            style: const TextStyle(fontSize: 12, color: Color(0xFF78716C)),
                                          ),
                                        ),
                                        trailing: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            ElevatedButton.icon(
                                              style: ElevatedButton.styleFrom(
                                                backgroundColor: darkSlate,
                                                foregroundColor: Colors.white,
                                                elevation: 0,
                                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                              ),
                                              icon: const Icon(Icons.visibility, size: 14),
                                              label: const Text('View', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                                              onPressed: () {
                                                Navigator.push(
                                                  context,
                                                  MaterialPageRoute(
                                                    builder: (ctx) => ArtifactViewerView(artifact: art),
                                                  ),
                                                );
                                              },
                                            ),
                                            IconButton(
                                              icon: const Icon(Icons.delete_outline, size: 18, color: Color(0xFFA8A29E)),
                                              onPressed: () => _deleteArtifact(art),
                                            ),
                                          ],
                                        ),
                                      ),
                                    );
                                  }),
                                ],
                              ),
                            );
                          }).toList(),
                        ),
            ),
          ],
        ),
      ),
    );
  }
}
