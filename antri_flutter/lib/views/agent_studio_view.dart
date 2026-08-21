import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../models/ai_config.dart';
import '../models/chat_message.dart';
import '../models/chat_session.dart';
import '../models/artifact.dart';
import '../services/ai_service.dart';
import '../services/storage_service.dart';
import '../services/note_synthesizer.dart';
import 'artifact_viewer_view.dart';
import 'artifacts_view.dart';

class AgentStudioView extends StatefulWidget {
  final AIConfig config;
  final StorageService storageService;
  final AIService aiService;
  final VoidCallback onConfigChanged;

  const AgentStudioView({
    super.key,
    required this.config,
    required this.storageService,
    required this.aiService,
    required this.onConfigChanged,
  });

  @override
  State<AgentStudioView> createState() => _AgentStudioViewState();
}

class _AgentStudioViewState extends State<AgentStudioView> {
  final TextEditingController _promptController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final List<ChatSession> _sessions = [];
  String _activeSessionId = '';
  final List<ChatMessage> _messages = [];
  final List<XFile> _attachedFiles = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadSessions();
  }

  ChatSession get _currentSession {
    if (_sessions.isEmpty) {
      final fallback = ChatSession(id: 'chat_${DateTime.now().millisecondsSinceEpoch}', title: 'Main Chat');
      _sessions.add(fallback);
      _activeSessionId = fallback.id;
      return fallback;
    }
    return _sessions.firstWhere(
      (s) => s.id == _activeSessionId,
      orElse: () => _sessions.first,
    );
  }

  Future<void> _loadSessions() async {
    final loaded = await widget.storageService.loadChatSessions(widget.config.syncKey);
    final activeId = await widget.storageService.getActiveSessionId(widget.config.syncKey);
    if (mounted) {
      setState(() {
        _sessions.clear();
        _sessions.addAll(loaded);
        if (activeId != null && _sessions.any((s) => s.id == activeId)) {
          _activeSessionId = activeId;
        } else if (_sessions.isNotEmpty) {
          _activeSessionId = _sessions.first.id;
        }
        _messages.clear();
        _messages.addAll(_currentSession.messages);
      });
    }
  }

  Future<void> _createNewSession() async {
    final newSession = ChatSession(
      id: 'chat_${DateTime.now().millisecondsSinceEpoch}',
      title: 'New Chat',
      messages: [],
    );
    setState(() {
      _sessions.insert(0, newSession);
      _activeSessionId = newSession.id;
      _messages.clear();
    });
    await widget.storageService.saveChatSessions(_sessions, widget.config.syncKey);
    await widget.storageService.setActiveSessionId(newSession.id, widget.config.syncKey);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Started new chat session.'), duration: Duration(seconds: 1)),
      );
    }
  }

  Future<void> _switchSession(String id) async {
    setState(() {
      _activeSessionId = id;
      _messages.clear();
      _messages.addAll(_currentSession.messages);
    });
    await widget.storageService.setActiveSessionId(id, widget.config.syncKey);
  }

  Future<void> _deleteSession(String id) async {
    setState(() {
      _sessions.removeWhere((s) => s.id == id);
      if (_sessions.isEmpty) {
        final fresh = ChatSession(id: 'chat_${DateTime.now().millisecondsSinceEpoch}', title: 'Main Chat');
        _sessions.add(fresh);
        _activeSessionId = fresh.id;
      } else if (_activeSessionId == id) {
        _activeSessionId = _sessions.first.id;
      }
      _messages.clear();
      _messages.addAll(_currentSession.messages);
    });
    await widget.storageService.saveChatSessions(_sessions, widget.config.syncKey);
    await widget.storageService.setActiveSessionId(_activeSessionId, widget.config.syncKey);
  }

  Future<void> _clearCurrentSessionMessages() async {
    setState(() {
      _currentSession.messages.clear();
      _messages.clear();
    });
    await widget.storageService.saveChatSessions(_sessions, widget.config.syncKey);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Conversation context cleared.'), duration: Duration(seconds: 1)),
      );
    }
  }

  void _showChatOptionsMenu(ChatSession session) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFFFFFFFF),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (sheetCtx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Text(
                  session.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF1C1917),
                  ),
                ),
              ),
              const Divider(height: 12, color: Color(0xFFE6E0D4)),
              ListTile(
                leading: const Icon(Icons.edit_outlined, color: Color(0xFF1C1917)),
                title: const Text('Rename chat', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                onTap: () {
                  Navigator.pop(sheetCtx);
                  _showRenameDialog(session);
                },
              ),
              ListTile(
                leading: const Icon(Icons.delete_outline, color: Color(0xFFDC2626)),
                title: const Text(
                  'Delete chat',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: Color(0xFFDC2626)),
                ),
                onTap: () {
                  Navigator.pop(sheetCtx);
                  _confirmDeleteSession(session);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _confirmDeleteSession(ChatSession session) {
    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        backgroundColor: const Color(0xFFFFFFFF),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Delete chat?',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF1C1917)),
        ),
        content: Text(
          'Are you sure you want to delete "${session.title}"? This will permanently remove its message history.',
          style: const TextStyle(fontSize: 13.5, color: Color(0xFF57534E)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogCtx),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF78716C), fontWeight: FontWeight.w600)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () async {
              Navigator.pop(dialogCtx);
              await _deleteSession(session.id);
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Chat "${session.title}" deleted.'),
                    duration: const Duration(seconds: 2),
                  ),
                );
              }
            },
            child: const Text('Delete', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }

  void _showRenameDialog(ChatSession session) {
    final renameCtrl = TextEditingController(text: session.title);
    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        backgroundColor: const Color(0xFFFFFFFF),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Rename chat',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF1C1917)),
        ),
        content: TextField(
          controller: renameCtrl,
          autofocus: true,
          style: const TextStyle(fontSize: 14, color: Color(0xFF1C1917)),
          decoration: const InputDecoration(
            hintText: 'Enter chat title',
            filled: true,
            fillColor: Color(0xFFF7F4EE),
            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.all(Radius.circular(8)),
              borderSide: BorderSide(color: Color(0xFFE6E0D4)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.all(Radius.circular(8)),
              borderSide: BorderSide(color: Color(0xFF1C1917), width: 1.5),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogCtx),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF78716C), fontWeight: FontWeight.w600)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1C1917),
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () async {
              final newTitle = renameCtrl.text.trim();
              if (newTitle.isNotEmpty) {
                setState(() {
                  session.title = newTitle;
                });
                await widget.storageService.saveChatSessions(_sessions, widget.config.syncKey);
              }
              if (dialogCtx.mounted) {
                Navigator.pop(dialogCtx);
              }
            },
            child: const Text('Save', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }

  Widget _buildDrawer(BuildContext context) {
    return Drawer(
      backgroundColor: const Color(0xFFFCFBF9),
      elevation: 0,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Drawer Top Bar: Brand & Close Button
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 14, 10, 10),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1C1917),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.bolt, color: Colors.white, size: 18),
                      ),
                      const SizedBox(width: 10),
                      const Text(
                        'ANTRI Studio',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                          color: Color(0xFF1C1917),
                        ),
                      ),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 20, color: Color(0xFF78716C)),
                    onPressed: () => Navigator.pop(context),
                    tooltip: 'Close menu',
                  ),
                ],
              ),
            ),

            // Artifacts Hub Button (Just above New Chat)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 2, 14, 6),
              child: InkWell(
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (ctx) => ArtifactsView(
                        config: widget.config,
                        storageService: widget.storageService,
                      ),
                    ),
                  );
                },
                borderRadius: BorderRadius.circular(24),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF7F4EE),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: const Color(0xFFE6E0D4)),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.palette_outlined, color: Color(0xFF1C1917), size: 18),
                      SizedBox(width: 12),
                      Text(
                        'Artifacts',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF1C1917),
                        ),
                      ),
                      Spacer(),
                      Icon(Icons.arrow_forward_ios, size: 12, color: Color(0xFFA8A29E)),
                    ],
                  ),
                ),
              ),
            ),

            // Gemini-Style "+ New Chat" Action Button
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              child: InkWell(
                onTap: () {
                  Navigator.pop(context);
                  _createNewSession();
                },
                borderRadius: BorderRadius.circular(24),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF2EFE9),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: const Color(0xFFE6E0D4)),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.add, color: Color(0xFF1C1917), size: 20),
                      SizedBox(width: 12),
                      Text(
                        'New chat',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF1C1917),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            const SizedBox(height: 6),

            // Section Header: "Recent"
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 18, vertical: 6),
              child: Text(
                'Recent',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF8C827A),
                  letterSpacing: 0.5,
                ),
              ),
            ),

            // Chat Sessions List with Click & Hold Deletion / Context Menu
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                itemCount: _sessions.length,
                itemBuilder: (context, index) {
                  final session = _sessions[index];
                  final isActive = session.id == _activeSessionId;

                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: InkWell(
                      onTap: () {
                        Navigator.pop(context);
                        _switchSession(session.id);
                      },
                      onLongPress: () {
                        _showChatOptionsMenu(session);
                      },
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: isActive ? const Color(0xFFEBE7DF) : Colors.transparent,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              isActive ? Icons.chat_bubble : Icons.chat_bubble_outline,
                              size: 18,
                              color: isActive ? const Color(0xFF1C1917) : const Color(0xFF78716C),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                session.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 13.5,
                                  fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                                  color: const Color(0xFF1C1917),
                                ),
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.more_horiz, size: 18, color: Color(0xFFA8A29E)),
                              splashRadius: 16,
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                              onPressed: () {
                                _showChatOptionsMenu(session);
                              },
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),

            const Divider(height: 1, color: Color(0xFFE6E0D4)),

            // Drawer Footer: Profile Info
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  const Icon(Icons.psychology_outlined, size: 18, color: Color(0xFF78716C)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Profile: ${widget.config.activeProfile}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF57534E)),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickAttachment(ImageSource source) async {
    final picker = ImagePicker();
    final image = await picker.pickImage(source: source);
    if (image != null) {
      setState(() {
        _attachedFiles.add(image);
      });
    }
  }

  Future<void> _sendMessage() async {
    final text = _promptController.text.trim();
    if (text.isEmpty && _attachedFiles.isEmpty) return;

    final userMsg = ChatMessage(
      role: 'user',
      content: text,
      attachmentNames: _attachedFiles.map((f) => f.name).toList(),
      attachmentPaths: _attachedFiles.map((f) => f.path).toList(),
    );

    setState(() {
      _messages.add(userMsg);
      _currentSession.messages.add(userMsg);
      if (_currentSession.title == 'New Chat' && text.isNotEmpty) {
        _currentSession.title = text.length > 28 ? '${text.substring(0, 25)}...' : text;
      }
      _promptController.clear();
      _attachedFiles.clear();
      _isLoading = true;
    });

    _scrollToBottom();

    // 1. Autonomous Conversation Note-Taking: Extract preferences/conventions
    final profiles = await widget.storageService.loadProfiles(widget.config.syncKey);
    await NoteSynthesizer.extractAndRecordNote(
      userPrompt: text,
      activeProfileName: widget.config.activeProfile,
      profiles: profiles,
      storageService: widget.storageService,
      syncKey: widget.config.syncKey,
      projectId: widget.config.firestoreProjectId,
    );

    try {
      final activeProfContent = profiles[widget.config.activeProfile]?.content ?? '';
      final memories = await widget.storageService.loadMemories(widget.config.syncKey);
      final memoriesText = memories.isNotEmpty ? '\n\n### Captured Lifelong Cognitive Memories:\n${memories.take(15).map((m) => '- $m').join('\n')}' : '';

      final systemPrompt = '''
You are ANTRI Code, an intelligent AI companion, autonomous meta-agent, and cognitive coding partner.
Active Operating Mode: ${widget.config.mode.toUpperCase()}

================================================================================
[USER IDENTITY, PROFILE & NOTES (RAG ACTIVE CONTEXT)]
The following context contains user preferences, active thinking profile rules, identity facts, and accumulated notes.
Use this active knowledge naturally to inform responses, follow coding preferences, and recall user facts without forced persona changes.
🚨 Conversational Recall Rule: When the user asks what you know about them, their thinking style, hobbies, or background, answer conversationally and concisely like a helpful human partner. Synthesize the known facts smoothly without dumping raw markdown files, section headers, or unformatted template boilerplate.
🚨 Emoji Usage Rule: You MUST use emojis, but keep them minimal and tasteful — MAXIMUM 2 EMOJIS in your whole response. Never exceed 2 emojis total.
🚨 Dialectic & Goal Header Directive: For research synthesis, multi-perspective debates, or goal loop plans performed in the background, start your response with a header badge: '> ⚔️ [Dialectic Debate Synthesized]' or '> 🎯 [Goal Loop Plan Synthesized]'.
🎨 Claude-Style Multi-Page Interactive Artifacts & Graphs: When asked to generate a plan, routine, guide, UI dashboard, quiz, workout/stretching routine, or architecture diagram (or when using /view or /imagine):
- For plans/apps (/view): You MUST build an aesthetically stunning, MULTI-PAGE Single-Page Application (SPA) with at least 3 to 10 distinct switchable pages/tabs (e.g. Navigation bar with tabs for Overview, Day 1..Day 7, Tools & Calculators, Live Stopwatch/Timer, and Progress Tracker).
  * Design (CSS): Modern dark glassmorphism (#090d16), frosted glass cards (rgba(30,41,59,0.7) with backdrop-filter: blur(16px)), glowing accent gradients (indigo #6366f1, cyan #38bdf8, emerald #10b981), pill badges, and smooth transitions.
  * Interactivity (JS): Working countdown stopwatch/timer with start/pause/reset, dynamic checkable checklists that update completion percentage and progress bars in real time, and interactive calculators/sliders.
- Wrap the complete multi-page HTML in:
<antri_artifact id="art_UNIQUE_ID" type="html" title="DESCRIPTIVE TITLE">
<!DOCTYPE html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>/* aesthetic css */</style></head><body>...<script>/* interactive js */</script></body></html>
</antri_artifact>
For graphs (/imagine):
<antri_artifact id="graph_UNIQUE_ID" type="graph" title="ARCHITECTURE TITLE">
graph TD
  ...
</antri_artifact>
================================================================================
### Active Thinking Profile: ${widget.config.activeProfile}.md
$activeProfContent
$memoriesText
================================================================================
''';

      String responseText = '';
      final lower = text.toLowerCase();

      // Check if prompt is an explicit silent debate / research request
      if (lower.startsWith('/debate ') || lower.startsWith('/silent-debate ') || lower.startsWith('research on ') || lower.startsWith('debate on ')) {
        final queryClean = text.replaceFirst(RegExp(r'^(/debate|/silent-debate|research on|debate on)\s*', caseSensitive: false), '').trim();
        responseText = await widget.aiService.runSilentDebate(
          config: widget.config,
          query: queryClean.isNotEmpty ? queryClean : text,
        );
      } else if (lower.startsWith('/goal ') || lower.startsWith('/silent-goal ') || lower.startsWith('goal: ') || lower.startsWith('objective: ')) {
        final goalClean = text.replaceFirst(RegExp(r'^(/goal|/silent-goal|goal:|objective:)\s*', caseSensitive: false), '').trim();
        responseText = await widget.aiService.runSilentGoal(
          config: widget.config,
          objective: goalClean.isNotEmpty ? goalClean : text,
        );
      } else if (lower.startsWith('/imagine ') || lower == '/imagine') {
        final queryClean = text.replaceFirst(RegExp(r'^/imagine\s*', caseSensitive: false), '').trim();
        final imaginePrompt = 'Create a comprehensive visual architecture diagram and flowchart graph for: "${queryClean.isNotEmpty ? queryClean : "System Architecture"}". You MUST output the Mermaid graph enclosed in an artifact tag: <antri_artifact id="graph_${DateTime.now().millisecondsSinceEpoch}" type="graph" title="${queryClean.isNotEmpty ? queryClean : "Architecture Graph"}">\ngraph TD\n...\n</antri_artifact>';
        responseText = await widget.aiService.executePrompt(
          config: widget.config,
          systemPrompt: systemPrompt,
          userPrompt: imaginePrompt,
          conversationHistory: _currentSession.messages,
        );
      } else if (lower.startsWith('/view ') || lower == '/view') {
        final queryClean = text.replaceFirst(RegExp(r'^/view\s*', caseSensitive: false), '').trim();
        final viewPrompt = 'Generate a complete, self-contained, highly interactive, and aesthetically stunning MULTI-PAGE Single-Page Application (SPA) for: "${queryClean.isNotEmpty ? queryClean : "Interactive Plan"}". Requirements: 1) Multi-page tab navigation (3 to 10 distinct switchable pages/tabs: Overview, Day 1..Day 7, Tools, Timers, Progress Tracker), 2) Modern dark glassmorphism CSS styling with glowing gradients (#6366f1, #38bdf8, #10b981) and cards, 3) Real JS interactivity including working countdown stopwatch/rest timer, dynamic checkable checklists with real-time percentage progress bars, and calculators. You MUST output the HTML document enclosed in an artifact tag: <antri_artifact id="art_${DateTime.now().millisecondsSinceEpoch}" type="html" title="${queryClean.isNotEmpty ? queryClean : "Interactive Plan"}">\n<!DOCTYPE html>\n<html lang="en">\n<head><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>/* aesthetic css */</style></head>\n<body>...<script>/* interactive js */</script></body>\n</html>\n</antri_artifact>';
        responseText = await widget.aiService.executePrompt(
          config: widget.config,
          systemPrompt: systemPrompt,
          userPrompt: viewPrompt,
          conversationHistory: _currentSession.messages,
        );
      } else {
        // Pass the entire ongoing multi-turn conversation context to preserve chat state
        responseText = await widget.aiService.executePrompt(
          config: widget.config,
          systemPrompt: systemPrompt,
          userPrompt: userMsg.content,
          conversationHistory: _currentSession.messages,
          attachmentPaths: userMsg.attachmentPaths,
        );
      }

      // Parse and persist any generated artifacts from response
      final artRegex = RegExp(r'<antri_artifact\s+id="([^"]+)"\s+type="([^"]+)"\s+title="([^"]+)">([\s\S]*?)<\/antri_artifact>', caseSensitive: false);
      for (final match in artRegex.allMatches(responseText)) {
        final artId = match.group(1)?.trim() ?? 'art_${DateTime.now().millisecondsSinceEpoch}';
        final artType = match.group(2)?.trim().toLowerCase() ?? 'html';
        final artTitle = match.group(3)?.trim() ?? 'Interactive Artifact';
        final artContent = match.group(4)?.trim() ?? '';

        final artifact = Artifact(
          id: artId,
          sessionId: _currentSession.id,
          sessionTitle: _currentSession.title,
          title: artTitle,
          type: artType,
          content: artContent,
          createdAt: DateTime.now(),
        );

        await widget.storageService.saveArtifact(artifact, widget.config.syncKey);
      }

      final assistantMsg = ChatMessage(role: 'assistant', content: responseText);

      setState(() {
        _messages.add(assistantMsg);
        _currentSession.messages.add(assistantMsg);
        _isLoading = false;
      });

      await widget.storageService.saveChatSessions(_sessions, widget.config.syncKey);
      _scrollToBottom();
    } catch (e) {
      setState(() {
        final errorMsg = ChatMessage(role: 'assistant', content: 'Error: ${e.toString()}\n\nPlease verify your API key in Settings.');
        _messages.add(errorMsg);
        _currentSession.messages.add(errorMsg);
        _isLoading = false;
      });
      await widget.storageService.saveChatSessions(_sessions, widget.config.syncKey);
      _scrollToBottom();
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
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
      drawer: _buildDrawer(context),
      appBar: AppBar(
        backgroundColor: subtleBg,
        elevation: 0,
        leading: Builder(
          builder: (ctx) => IconButton(
            icon: const Icon(Icons.menu, color: textPrimary, size: 22),
            tooltip: 'Menu',
            onPressed: () => Scaffold.of(ctx).openDrawer(),
          ),
        ),
        title: Text(
          _currentSession.title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            fontWeight: FontWeight.w800,
            letterSpacing: 0.2,
            color: textPrimary,
            fontSize: 16,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_square, size: 20, color: textPrimary),
            tooltip: 'New Chat',
            onPressed: _createNewSession,
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert, size: 20, color: textPrimary),
            onSelected: (val) {
              if (val == 'clear') {
                _clearCurrentSessionMessages();
              } else if (val == 'rename') {
                _showRenameDialog(_currentSession);
              }
            },
            itemBuilder: (ctx) => [
              const PopupMenuItem(
                value: 'rename',
                child: Row(
                  children: [
                    Icon(Icons.edit_outlined, size: 18, color: textPrimary),
                    SizedBox(width: 8),
                    Text('Rename Chat'),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'clear',
                child: Row(
                  children: [
                    Icon(Icons.cleaning_services_outlined, size: 18, color: textPrimary),
                    SizedBox(width: 8),
                    Text('Clear Conversation'),
                  ],
                ),
              ),
            ],
          ),
          // Mode Toggle (Vibe vs Plan)
          Container(
            margin: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: borderMain),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                GestureDetector(
                  onTap: () {
                    setState(() => widget.config.mode = 'vibe');
                    widget.storageService.saveConfig(widget.config);
                    widget.onConfigChanged();
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: widget.config.mode == 'vibe' ? textPrimary : Colors.transparent,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Text(
                      'Vibe',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: widget.config.mode == 'vibe' ? Colors.white : const Color(0xFF57534E),
                      ),
                    ),
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    setState(() => widget.config.mode = 'plan');
                    widget.storageService.saveConfig(widget.config);
                    widget.onConfigChanged();
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: widget.config.mode == 'plan' ? textPrimary : Colors.transparent,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Text(
                      'Plan',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: widget.config.mode == 'plan' ? Colors.white : const Color(0xFF57534E),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _messages.isEmpty
                ? Center(
                    child: Container(
                      padding: const EdgeInsets.all(24),
                      margin: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: cardBg,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: borderMain),
                      ),
                      child: const Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'ANTRI Mobile Studio',
                            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: textPrimary),
                          ),
                          SizedBox(height: 8),
                          Text(
                            'Minimalist autonomous coding environment. Switch between Vibe Mode and Plan Mode, upload images with the + button, or run dialectic debates.',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 13, color: Color(0xFF57534E), height: 1.5),
                          ),
                        ],
                      ),
                    ),
                  )
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(16),
                    itemCount: _messages.length,
                    itemBuilder: (context, index) {
                      final msg = _messages[index];
                      final isUser = msg.role == 'user';
                      return Align(
                        alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
                        child: Container(
                          margin: const EdgeInsets.symmetric(vertical: 6),
                          padding: const EdgeInsets.all(14),
                          constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.85),
                          decoration: BoxDecoration(
                            color: isUser ? textPrimary : cardBg,
                            borderRadius: BorderRadius.circular(10),
                            border: isUser ? null : Border.all(color: borderMain),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (msg.attachmentNames.isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 8),
                                  child: Wrap(
                                    spacing: 4,
                                    children: msg.attachmentNames
                                        .map((name) => Chip(
                                              label: Text(name, style: const TextStyle(fontSize: 10)),
                                              backgroundColor: isUser ? const Color(0xFF2C2825) : subtleBg,
                                              labelStyle: TextStyle(color: isUser ? Colors.white : textPrimary),
                                              padding: EdgeInsets.zero,
                                              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                            ))
                                        .toList(),
                                  ),
                                ),
                              if (!isUser && msg.content.contains('<antri_artifact')) ...[
                                Builder(
                                  builder: (context) {
                                    final artMatch = RegExp(r'<antri_artifact\s+id="([^"]+)"\s+type="([^"]+)"\s+title="([^"]+)">([\s\S]*?)<\/antri_artifact>', caseSensitive: false).firstMatch(msg.content);
                                    final cleanText = msg.content.replaceAll(RegExp(r'<antri_artifact[\s\S]*?<\/antri_artifact>', caseSensitive: false), '').trim();
                                    
                                    final artId = artMatch?.group(1)?.trim() ?? 'art_${DateTime.now().millisecondsSinceEpoch}';
                                    final artType = artMatch?.group(2)?.trim().toLowerCase() ?? 'html';
                                    final artTitle = artMatch?.group(3)?.trim() ?? 'Interactive Artifact';
                                    final artContent = artMatch?.group(4)?.trim() ?? '';
                                    final isGraph = artType == 'graph';

                                    final artifactObj = Artifact(
                                      id: artId,
                                      sessionId: _currentSession.id,
                                      sessionTitle: _currentSession.title,
                                      title: artTitle,
                                      type: artType,
                                      content: artContent,
                                      createdAt: DateTime.now(),
                                    );

                                    return Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        if (cleanText.isNotEmpty)
                                          SelectableText(
                                            cleanText,
                                            style: const TextStyle(fontSize: 13.5, color: textPrimary, height: 1.6),
                                          ),
                                        Container(
                                          margin: const EdgeInsets.only(top: 8),
                                          padding: const EdgeInsets.all(12),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFF7F4EE),
                                            borderRadius: BorderRadius.circular(10),
                                            border: Border.all(color: borderMain),
                                          ),
                                          child: Row(
                                            children: [
                                              Container(
                                                padding: const EdgeInsets.all(8),
                                                decoration: BoxDecoration(
                                                  color: isGraph ? const Color(0xFFEFF6FF) : const Color(0xFFF0FDF4),
                                                  borderRadius: BorderRadius.circular(8),
                                                ),
                                                child: Icon(
                                                  isGraph ? Icons.account_tree_outlined : Icons.language,
                                                  size: 18,
                                                  color: isGraph ? const Color(0xFF1D4ED8) : const Color(0xFF15803D),
                                                ),
                                              ),
                                              const SizedBox(width: 10),
                                              Expanded(
                                                child: Column(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  children: [
                                                    Text(
                                                      artTitle,
                                                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: textPrimary),
                                                      maxLines: 1,
                                                      overflow: TextOverflow.ellipsis,
                                                    ),
                                                    Text(
                                                      isGraph ? 'Architecture Graph' : 'Interactive HTML Plan',
                                                      style: const TextStyle(fontSize: 11, color: Color(0xFF78716C)),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                              ElevatedButton.icon(
                                                style: ElevatedButton.styleFrom(
                                                  backgroundColor: textPrimary,
                                                  foregroundColor: Colors.white,
                                                  elevation: 0,
                                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                                ),
                                                icon: const Icon(Icons.visibility, size: 14),
                                                label: const Text('View', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                                                onPressed: () {
                                                  Navigator.push(
                                                    context,
                                                    MaterialPageRoute(
                                                      builder: (ctx) => ArtifactViewerView(artifact: artifactObj),
                                                    ),
                                                  );
                                                },
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    );
                                  },
                                ),
                              ] else ...[
                                SelectableText(
                                  msg.content,
                                  style: TextStyle(
                                    fontSize: 13.5,
                                    color: isUser ? Colors.white : textPrimary,
                                    height: 1.6,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),

          if (_isLoading)
            const Padding(
              padding: EdgeInsets.all(8.0),
              child: LinearProgressIndicator(backgroundColor: subtleBg, color: textPrimary),
            ),

          // Attachment Tray
          if (_attachedFiles.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              color: subtleBg,
              child: Row(
                children: [
                  Expanded(
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: _attachedFiles.map((file) {
                          return Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: Chip(
                              label: Text(file.name, style: const TextStyle(fontSize: 11)),
                              onDeleted: () {
                                setState(() => _attachedFiles.remove(file));
                              },
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ),
                ],
              ),
            ),

          // Chat Input Area
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: const BoxDecoration(
              color: cardBg,
              border: Border(top: BorderSide(color: borderMain)),
            ),
            child: SafeArea(
              child: Row(
                children: [
                  // Plus / Attachment Button
                  IconButton(
                    icon: const Icon(Icons.add, color: textPrimary, size: 24),
                    onPressed: () {
                      showModalBottomSheet(
                        context: context,
                        backgroundColor: cardBg,
                        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
                        builder: (ctx) => SafeArea(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              ListTile(
                                leading: const Icon(Icons.camera_alt_outlined, color: textPrimary),
                                title: const Text('Take Photo', style: TextStyle(fontWeight: FontWeight.w600)),
                                onTap: () {
                                  Navigator.pop(ctx);
                                  _pickAttachment(ImageSource.camera);
                                },
                              ),
                              ListTile(
                                leading: const Icon(Icons.photo_library_outlined, color: textPrimary),
                                title: const Text('Upload from Gallery', style: TextStyle(fontWeight: FontWeight.w600)),
                                onTap: () {
                                  Navigator.pop(ctx);
                                  _pickAttachment(ImageSource.gallery);
                                },
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                  Expanded(
                    child: TextField(
                      controller: _promptController,
                      maxLines: null,
                      style: const TextStyle(fontSize: 14, color: textPrimary),
                      decoration: const InputDecoration(
                        hintText: 'Message ANTRI...',
                        hintStyle: TextStyle(color: Color(0xFF8C827A), fontSize: 13.5),
                        border: InputBorder.none,
                        contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      ),
                    ),
                  ),
                  ElevatedButton(
                    onPressed: _sendMessage,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: textPrimary,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    ),
                    child: const Text('Send', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
