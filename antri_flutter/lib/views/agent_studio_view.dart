import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../models/ai_config.dart';
import '../models/chat_message.dart';
import '../services/ai_service.dart';
import '../services/storage_service.dart';
import '../services/note_synthesizer.dart';

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
  final List<ChatMessage> _messages = [];
  final List<XFile> _attachedFiles = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    final history = await widget.storageService.loadChatHistory(widget.config.syncKey);
    if (mounted) {
      setState(() {
        _messages.clear();
        _messages.addAll(history);
      });
    }
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
      _promptController.clear();
      _attachedFiles.clear();
      _isLoading = true;
    });

    _scrollToBottom();

    // 1. Autonomous Conversation Note-Taking: Extract preferences/conventions
    final profiles = await widget.storageService.loadProfiles(widget.config.syncKey);
    final recordedNote = await NoteSynthesizer.extractAndRecordNote(
      userPrompt: text,
      activeProfileName: widget.config.activeProfile,
      profiles: profiles,
      storageService: widget.storageService,
      syncKey: widget.config.syncKey,
      projectId: widget.config.firestoreProjectId,
    );

    if (recordedNote != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Note captured to ${widget.config.activeProfile}: "$recordedNote"'),
          duration: const Duration(seconds: 2),
          backgroundColor: const Color(0xFF15803D),
        ),
      );
    }

    try {
      final activeProfContent = profiles[widget.config.activeProfile]?.content ?? '';
      final memories = await widget.storageService.loadMemories(widget.config.syncKey);
      final memoriesText = memories.isNotEmpty ? '\n\n### Captured Lifelong Cognitive Memories:\n${memories.take(15).map((m) => '- $m').join('\n')}' : '';

      final systemPrompt = '''
You are ANTRI Code, an intelligent AI companion and cognitive coding agent.
Active Operating Mode: ${widget.config.mode.toUpperCase()}

================================================================================
[USER IDENTITY, PROFILE & NOTES (RAG ACTIVE CONTEXT)]
The following context contains user preferences, active thinking profile rules, identity facts, and accumulated notes.
Use this active knowledge naturally to inform responses, follow coding preferences, and recall user facts without forced persona changes.
================================================================================
### Active Thinking Profile: ${widget.config.activeProfile}.md
$activeProfContent
$memoriesText
================================================================================
''';

      final responseText = await widget.aiService.executePrompt(
        config: widget.config,
        systemPrompt: systemPrompt,
        userPrompt: userMsg.content,
        attachmentPaths: userMsg.attachmentPaths,
      );

      final assistantMsg = ChatMessage(role: 'assistant', content: responseText);

      setState(() {
        _messages.add(assistantMsg);
        _isLoading = false;
      });

      await widget.storageService.saveChatHistory(_messages, widget.config.syncKey);
      _scrollToBottom();
    } catch (e) {
      setState(() {
        _messages.add(ChatMessage(role: 'assistant', content: 'Error: ${e.toString()}\n\nPlease verify your API key in Settings.'));
        _isLoading = false;
      });
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
      appBar: AppBar(
        backgroundColor: subtleBg,
        elevation: 0,
        title: Row(
          children: [
            const Text(
              'ANTRI',
              style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1.2, color: textPrimary, fontSize: 16),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: BorderRadius.circular(4),
                border: Border.all(color: borderMain),
              ),
              child: Text(
                widget.config.provider.toUpperCase(),
                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF57534E)),
              ),
            ),
          ],
        ),
        actions: [
          // Mode Toggle (Vibe vs Plan)
          Container(
            margin: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
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
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
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
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
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
                              SelectableText(
                                msg.content,
                                style: TextStyle(
                                  fontSize: 13.5,
                                  color: isUser ? Colors.white : textPrimary,
                                  height: 1.6,
                                ),
                              ),
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
