import 'package:flutter/material.dart';
import '../models/ai_config.dart';
import '../models/thinking_profile.dart';
import '../services/storage_service.dart';
import '../services/firestore_sync_service.dart';

class ProfilesView extends StatefulWidget {
  final AIConfig config;
  final StorageService storageService;
  final VoidCallback onProfileChanged;

  const ProfilesView({
    super.key,
    required this.config,
    required this.storageService,
    required this.onProfileChanged,
  });

  @override
  State<ProfilesView> createState() => _ProfilesViewState();
}

class _ProfilesViewState extends State<ProfilesView> with SingleTickerProviderStateMixin {
  final FirestoreSyncService _firestoreService = FirestoreSyncService();
  final TextEditingController _editorController = TextEditingController();
  late TabController _tabController;
  Map<String, ThinkingProfile> _profiles = {};
  List<String> _memories = [];
  String _activeProfile = 'profile_1';
  bool _isSyncing = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadProfiles();
    _loadMemories();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _editorController.dispose();
    super.dispose();
  }

  Future<void> _loadProfiles() async {
    final profs = await widget.storageService.loadProfiles(widget.config.syncKey);
    if (mounted) {
      setState(() {
        _profiles = profs;
        _activeProfile = widget.config.activeProfile;
        if (!_profiles.containsKey(_activeProfile)) {
          _activeProfile = _profiles.keys.first;
        }
        _editorController.text = _profiles[_activeProfile]?.content ?? '';
      });
    }
  }

  Future<void> _loadMemories() async {
    final mems = await widget.storageService.loadMemories(widget.config.syncKey);
    if (mounted) {
      setState(() {
        _memories = mems;
      });
    }
  }

  Future<void> _saveProfile() async {
    if (_profiles.containsKey(_activeProfile)) {
      _profiles[_activeProfile]!.content = _editorController.text;
      _profiles[_activeProfile]!.updatedAt = DateTime.now();
      await widget.storageService.saveProfiles(_profiles, widget.config.syncKey);

      // Also sync to Google Cloud Firestore if project ID configured
      final projectId = widget.config.firestoreProjectId.isNotEmpty ? widget.config.firestoreProjectId : 'antri-agentic-hackathon';
      setState(() => _isSyncing = true);
      final ok = await _firestoreService.syncProfileToFirestore(
        projectId: projectId,
        syncKey: widget.config.syncKey,
        profile: _profiles[_activeProfile]!,
      );
      setState(() => _isSyncing = false);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ok ? 'Profile saved & pushed to Google Cloud Firestore.' : 'Profile saved locally.')),
        );
      }
    }
  }

  Future<void> _pushToCloud() async {
    final projectId = widget.config.firestoreProjectId.isNotEmpty ? widget.config.firestoreProjectId : 'antri-agentic-hackathon';

    setState(() => _isSyncing = true);
    int count = 0;
    for (final prof in _profiles.values) {
      if (prof.content.trim().isNotEmpty) {
        final ok = await _firestoreService.syncProfileToFirestore(
          projectId: projectId,
          syncKey: widget.config.syncKey,
          profile: prof,
        );
        if (ok) count++;
      }
    }
    setState(() => _isSyncing = false);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(count > 0 ? 'Pushed $count profiles to Google Cloud Firestore!' : 'Failed to push to Firestore. Check connection.'),
          backgroundColor: count > 0 ? const Color(0xFF15803D) : const Color(0xFFDC2626),
        ),
      );
    }
  }

  Future<void> _syncFromCloud() async {
    final projectId = widget.config.firestoreProjectId.isNotEmpty ? widget.config.firestoreProjectId : 'antri-agentic-hackathon';

    setState(() => _isSyncing = true);
    final cloudProfs = await _firestoreService.pullProfilesFromFirestore(
      projectId: projectId,
      syncKey: widget.config.syncKey,
    );

    if (cloudProfs.isNotEmpty) {
      setState(() {
        _profiles.addAll(cloudProfs);
        if (cloudProfs.containsKey(_activeProfile)) {
          _editorController.text = cloudProfs[_activeProfile]!.content;
        } else {
          _activeProfile = cloudProfs.keys.first;
          _editorController.text = cloudProfs[_activeProfile]!.content;
          widget.config.activeProfile = _activeProfile;
          widget.storageService.saveConfig(widget.config);
        }
      });
      await widget.storageService.saveProfiles(_profiles, widget.config.syncKey);
      widget.onProfileChanged();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Pulled ${cloudProfs.length} profile(s) from Google Cloud Firestore.'),
            backgroundColor: const Color(0xFF15803D),
          ),
        );
      }
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No cloud profiles found or Firestore offline.')),
        );
      }
    }
    if (mounted) {
      setState(() => _isSyncing = false);
    }
  }

  void _createNewProfile() {
    final nameCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New Thinking Profile', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        content: TextField(
          controller: nameCtrl,
          decoration: const InputDecoration(hintText: 'e.g. backend_architect'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              final name = nameCtrl.text.trim().toLowerCase().replaceAll(RegExp(r'[^a-z0-9_-]'), '_');
              if (name.isNotEmpty) {
                setState(() {
                  _profiles[name] = ThinkingProfile(
                    name: name,
                    content: '# $name Profile\n\n- Custom coding preferences and rules\n\n## Notes & Insights Captured From Conversations\n- Created profile $name',
                  );
                  _activeProfile = name;
                  _editorController.text = _profiles[name]!.content;
                });
                widget.storageService.saveProfiles(_profiles, widget.config.syncKey);
                widget.config.activeProfile = name;
                widget.storageService.saveConfig(widget.config);
                widget.onProfileChanged();
              }
              Navigator.pop(ctx);
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    const creamBg = Color(0xFFFCFBF9);
    const cardBg = Color(0xFFFFFFFF);
    const subtleBg = Color(0xFFF7F4EE);
    const textPrimary = Color(0xFF1C1917);
    const borderMain = Color(0xFFE6E0D4);

    return Scaffold(
      backgroundColor: creamBg,
      appBar: AppBar(
        backgroundColor: subtleBg,
        elevation: 0,
        title: const Text('Thinking Profiles', style: TextStyle(fontWeight: FontWeight.w800, color: textPrimary, fontSize: 16)),
        bottom: TabBar(
          controller: _tabController,
          labelColor: textPrimary,
          unselectedLabelColor: const Color(0xFF8C827A),
          indicatorColor: textPrimary,
          indicatorWeight: 2,
          tabs: const [
            Tab(text: 'Profile Rules'),
            Tab(text: 'Captured Notes'),
          ],
        ),
        actions: [
          IconButton(
            icon: Icon(_isSyncing ? Icons.cloud_sync : Icons.cloud_upload_outlined, color: textPrimary),
            tooltip: 'Push Profile to Google Cloud Firestore',
            onPressed: _isSyncing ? null : _pushToCloud,
          ),
          IconButton(
            icon: const Icon(Icons.cloud_download_outlined, color: textPrimary),
            tooltip: 'Pull Profiles from Google Cloud Firestore',
            onPressed: _isSyncing ? null : _syncFromCloud,
          ),
          IconButton(
            icon: const Icon(Icons.add, color: textPrimary),
            tooltip: 'New Profile',
            onPressed: _createNewProfile,
          ),
        ],
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // 1. Profile Editor Tab
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                  decoration: BoxDecoration(
                    color: cardBg,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: borderMain),
                  ),
                  child: Row(
                    children: [
                      const Text('Active:', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: Color(0xFF8C827A))),
                      const SizedBox(width: 8),
                      Expanded(
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: _activeProfile,
                            isExpanded: true,
                            items: _profiles.keys.map((name) {
                              return DropdownMenuItem(
                                value: name,
                                child: Text('$name.md', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                              );
                            }).toList(),
                            onChanged: (val) {
                              if (val != null) {
                                setState(() {
                                  _activeProfile = val;
                                  _editorController.text = _profiles[val]?.content ?? '';
                                });
                                widget.config.activeProfile = val;
                                widget.storageService.saveConfig(widget.config);
                                widget.onProfileChanged();
                              }
                            },
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                // Visual Profile Selector Chips
                SizedBox(
                  height: 36,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: _profiles.keys.map((name) {
                      final isSelected = name == _activeProfile;
                      return Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: ChoiceChip(
                          label: Text(
                            '$name.md',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                              color: isSelected ? Colors.white : textPrimary,
                            ),
                          ),
                          selected: isSelected,
                          selectedColor: textPrimary,
                          backgroundColor: cardBg,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(6),
                            side: BorderSide(color: isSelected ? textPrimary : borderMain),
                          ),
                          onSelected: (selected) {
                            if (selected) {
                              setState(() {
                                _activeProfile = name;
                                _editorController.text = _profiles[name]?.content ?? '';
                              });
                              widget.config.activeProfile = name;
                              widget.storageService.saveConfig(widget.config);
                              widget.onProfileChanged();
                            }
                          },
                        ),
                      );
                    }).toList(),
                  ),
                ),
                const SizedBox(height: 8),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: cardBg,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: borderMain),
                    ),
                    child: TextField(
                      controller: _editorController,
                      maxLines: null,
                      expands: true,
                      style: const TextStyle(fontFamily: 'monospace', fontSize: 13, color: textPrimary, height: 1.5),
                      decoration: const InputDecoration(
                        border: InputBorder.none,
                        hintText: 'Enter profile markdown instructions...',
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _saveProfile,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: textPrimary,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    child: const Text('Save Profile & Sync', style: TextStyle(fontWeight: FontWeight.w600)),
                  ),
                ),
              ],
            ),
          ),

          // 2. Captured Notes & Memory Stream Tab
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Conversation Notes Stream', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: textPrimary)),
                    Text('${_memories.length} notes recorded', style: const TextStyle(fontSize: 12, color: Color(0xFF8C827A), fontWeight: FontWeight.w600)),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'ANTRI automatically analyzes your conversations and extracts coding preferences, architectural choices, and rules into your active profile.',
                  style: TextStyle(fontSize: 12, color: Color(0xFF57534E), height: 1.4),
                ),
                const SizedBox(height: 12),
                Expanded(
                  child: _memories.isEmpty
                      ? Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: cardBg,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: borderMain),
                          ),
                          child: const Center(
                            child: Text(
                              'No notes recorded yet.\nChat with ANTRI in Agent Studio (e.g. "I prefer TypeScript and strict typing") and notes will appear here automatically!',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: Color(0xFF8C827A), fontSize: 13, height: 1.5),
                            ),
                          ),
                        )
                      : ListView.separated(
                          itemCount: _memories.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (ctx, idx) {
                            final mem = _memories[idx];
                            return Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: cardBg,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: borderMain),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Icon(Icons.note_alt_outlined, size: 16, color: textPrimary),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      mem,
                                      style: const TextStyle(fontSize: 13, color: textPrimary, height: 1.4),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
