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

class _ProfilesViewState extends State<ProfilesView> {
  final FirestoreSyncService _firestoreService = FirestoreSyncService();
  final TextEditingController _editorController = TextEditingController();
  Map<String, ThinkingProfile> _profiles = {};
  String _activeProfile = 'mobile_profile_1';
  bool _isSyncing = false;

  @override
  void initState() {
    super.initState();
    _loadProfiles();
  }

  Future<void> _loadProfiles() async {
    final profs = await widget.storageService.loadProfiles();
    setState(() {
      _profiles = profs;
      _activeProfile = widget.config.activeProfile;
      if (!_profiles.containsKey(_activeProfile)) {
        _activeProfile = _profiles.keys.first;
      }
      _editorController.text = _profiles[_activeProfile]?.content ?? '';
    });
  }

  Future<void> _saveProfile() async {
    if (_profiles.containsKey(_activeProfile)) {
      _profiles[_activeProfile]!.content = _editorController.text;
      _profiles[_activeProfile]!.updatedAt = DateTime.now();
      await widget.storageService.saveProfiles(_profiles);

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
    if (!_profiles.containsKey(_activeProfile)) return;
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
        SnackBar(
          content: Text(ok ? 'Pushed "$_activeProfile" to Google Cloud Firestore!' : 'Failed to push to Firestore. Check connection.'),
          backgroundColor: ok ? const Color(0xFF15803D) : const Color(0xFFDC2626),
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
      _profiles.addAll(cloudProfs);
      await widget.storageService.saveProfiles(_profiles);
      _editorController.text = _profiles[_activeProfile]?.content ?? '';
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Pulled ${cloudProfs.length} profiles from Google Cloud Firestore.'),
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
                    content: '# $name Profile\n\n- Custom coding preferences and rules',
                  );
                  _activeProfile = name;
                  _editorController.text = _profiles[name]!.content;
                });
                widget.storageService.saveProfiles(_profiles);
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
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            // Profile Selector Dropdown
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
            const SizedBox(height: 12),

            // Profile Markdown Editor
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

            // Save Button
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
    );
  }
}
