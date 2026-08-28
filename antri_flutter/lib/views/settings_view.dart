import 'package:flutter/material.dart';
import '../models/ai_config.dart';
import '../services/storage_service.dart';

class SettingsView extends StatefulWidget {
  final AIConfig config;
  final StorageService storageService;
  final VoidCallback onConfigSaved;

  const SettingsView({
    super.key,
    required this.config,
    required this.storageService,
    required this.onConfigSaved,
  });

  @override
  State<SettingsView> createState() => _SettingsViewState();
}

class _SettingsViewState extends State<SettingsView> {
  final TextEditingController _customModelController = TextEditingController();
  final TextEditingController _apiKeyController = TextEditingController();
  final TextEditingController _baseUrlController = TextEditingController();
  final TextEditingController _gcpProjectIdController = TextEditingController();
  final TextEditingController _syncKeyController = TextEditingController();

  final List<Map<String, String>> _geminiModels = const [
    {'id': 'gemini-3.7-flash', 'name': 'Gemini 3.7 Flash (Default Flagship)'},
    {'id': 'gemini-3.7-pro', 'name': 'Gemini 3.7 Pro (Advanced Multimodal)'},
    {'id': 'gemini-3.5-pro', 'name': 'Gemini 3.5 Pro (Deep Reasoning)'},
    {'id': 'gemini-2.5-flash', 'name': 'Gemini 2.5 Flash (High Efficiency)'},
    {'id': 'gemini-2.5-pro', 'name': 'Gemini 2.5 Pro (2M Context)'},
  ];

  @override
  void initState() {
    super.initState();
    widget.config.provider = 'gemini';
    if (widget.config.model.isEmpty || !widget.config.model.startsWith('gemini')) {
      widget.config.model = 'gemini-3.7-flash';
    }
    _customModelController.text = widget.config.model;
    _apiKeyController.text = widget.config.apiKey;
    _baseUrlController.text = widget.config.baseUrl;
    _gcpProjectIdController.text = widget.config.firestoreProjectId;
    _syncKeyController.text = widget.config.syncKey;
  }

  void _onModelChanged(String? newModel) {
    if (newModel != null) {
      setState(() {
        widget.config.model = newModel;
        _customModelController.text = newModel;
      });
    }
  }

  Future<void> _saveSettings() async {
    widget.config.model = _customModelController.text.trim();
    widget.config.apiKey = _apiKeyController.text.trim();
    widget.config.baseUrl = _baseUrlController.text.trim();
    widget.config.firestoreProjectId = _gcpProjectIdController.text.trim();
    widget.config.syncKey = _syncKeyController.text.trim();

    await widget.storageService.saveConfig(widget.config);
    widget.onConfigSaved();

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Saved: ${widget.config.model} · Mode: ${widget.config.mode.toUpperCase()}'),
          backgroundColor: const Color(0xFF1C1917),
        ),
      );
    }
  }

  Widget _buildField(String label, TextEditingController controller, {bool obscure = false, String hint = ''}) {
    const textPrimary = Color(0xFF1C1917);
    const borderMain = Color(0xFFE6E0D4);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF8C827A))),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: const Color(0xFFF7F4EE),
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: borderMain),
          ),
          child: TextField(
            controller: controller,
            obscureText: obscure,
            style: const TextStyle(fontSize: 13, color: textPrimary),
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: const TextStyle(color: Color(0xFF8C827A), fontSize: 12),
              border: InputBorder.none,
            ),
          ),
        ),
        const SizedBox(height: 14),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    const creamBg = Color(0xFFFCFBF9);
    const cardBg = Color(0xFFFFFFFF);
    const textPrimary = Color(0xFF1C1917);
    const borderMain = Color(0xFFE6E0D4);

    return Scaffold(
      backgroundColor: creamBg,
      appBar: AppBar(
        backgroundColor: const Color(0xFFF7F4EE),
        elevation: 0,
        title: const Text('Settings & AI Models', style: TextStyle(fontWeight: FontWeight.w800, color: textPrimary, fontSize: 16)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ACTIVE MODE & MODEL STATUS CARD
          Container(
            padding: const EdgeInsets.all(16),
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF1C1917), Color(0xFF292524)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(12),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x14000000),
                  blurRadius: 10,
                  offset: Offset(0, 4),
                )
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('ACTIVE ENGINE STATUS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFFA8A29E), letterSpacing: 0.5)),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: widget.config.mode == 'vibe' ? const Color(0xFF10B981) : const Color(0xFF6366F1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        widget.config.mode == 'vibe' ? '⚡ VIBE MODE' : '📐 PLAN MODE',
                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.white),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  widget.config.model,
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white),
                ),
                const SizedBox(height: 2),
                Text(
                  'Engine: Google Gemini · Profile: ${widget.config.activeProfile}',
                  style: const TextStyle(fontSize: 12, color: Color(0xFFD6D3D1)),
                ),
              ],
            ),
          ),

          // AGENT WORKSPACE MODE SELECTOR
          Container(
            padding: const EdgeInsets.all(16),
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: borderMain),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('AGENT WORKSPACE MODE', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: textPrimary, letterSpacing: 0.5)),
                const SizedBox(height: 8),
                const Text(
                  'Select how ANTRI interacts: Vibe Mode codes and iterates continuously; Plan Mode plans and debates architecture before coding.',
                  style: TextStyle(fontSize: 12, color: Color(0xFF57534E), height: 1.35),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        onTap: () {
                          setState(() => widget.config.mode = 'vibe');
                        },
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                          decoration: BoxDecoration(
                            color: widget.config.mode == 'vibe' ? const Color(0xFF1C1917) : const Color(0xFFF7F4EE),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: widget.config.mode == 'vibe' ? const Color(0xFF1C1917) : borderMain),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text('⚡', style: TextStyle(fontSize: 14, color: widget.config.mode == 'vibe' ? Colors.white : textPrimary)),
                              const SizedBox(width: 6),
                              Text(
                                'Vibe Mode',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: widget.config.mode == 'vibe' ? Colors.white : textPrimary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: InkWell(
                        onTap: () {
                          setState(() => widget.config.mode = 'plan');
                        },
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                          decoration: BoxDecoration(
                            color: widget.config.mode == 'plan' ? const Color(0xFF1C1917) : const Color(0xFFF7F4EE),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: widget.config.mode == 'plan' ? const Color(0xFF1C1917) : borderMain),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text('📐', style: TextStyle(fontSize: 14, color: widget.config.mode == 'plan' ? Colors.white : textPrimary)),
                              const SizedBox(width: 6),
                              Text(
                                'Plan Mode',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: widget.config.mode == 'plan' ? Colors.white : textPrimary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // GOOGLE GEMINI SUITE & MODEL SELECTOR
          Container(
            padding: const EdgeInsets.all(16),
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: borderMain),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('GOOGLE GEMINI ENGINE & MODELS', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: textPrimary, letterSpacing: 0.5)),
                const SizedBox(height: 14),

                // Engine Badge
                const Text('Active AI Engine', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF8C827A))),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFBFDBFE)),
                  ),
                  child: const Row(
                    children: [
                      Text('♊', style: TextStyle(fontSize: 16)),
                      SizedBox(width: 8),
                      Text(
                        'Google Gemini · GenAI SDK',
                        style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: Color(0xFF1D4ED8)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // Gemini Model Selector Dropdown
                const Text('Gemini Model Selector', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF8C827A))),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF7F4EE),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: borderMain),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _geminiModels.any((m) => m['id'] == widget.config.model) ? widget.config.model : 'gemini-3.7-flash',
                      isExpanded: true,
                      items: _geminiModels.map(
                        (m) => DropdownMenuItem<String>(
                          value: m['id'],
                          child: Text(m['name'] ?? m['id']!, style: const TextStyle(fontSize: 13, color: textPrimary)),
                        ),
                      ).toList(),
                      onChanged: _onModelChanged,
                    ),
                  ),
                ),
                const SizedBox(height: 14),

                _buildField('Gemini API Key', _apiKeyController, obscure: true, hint: 'AIzaSy...'),
                _buildField('Cloud Run Backend URL (Optional)', _baseUrlController, hint: 'https://antri-backend-xxxx.run.app'),
              ],
            ),
          ),

          // Google Cloud Firestore Sync Section
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: borderMain),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('GOOGLE CLOUD FIRESTORE SYNC', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: textPrimary, letterSpacing: 0.5)),
                const SizedBox(height: 6),
                const Text(
                  'Sync your Thinking Profiles and Adaptive Notes across Laptop CLI, Desktop App, and Flutter Mobile in real time.',
                  style: TextStyle(fontSize: 12, color: Color(0xFF57534E), height: 1.4),
                ),
                const SizedBox(height: 14),
                _buildField('Google Cloud Project ID', _gcpProjectIdController, hint: 'e.g. antri-agentic-hackathon'),
                _buildField('Sync Key / User Partition', _syncKeyController, hint: 'e.g. ashu90 or default_user'),
              ],
            ),
          ),
          const SizedBox(height: 20),

          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _saveSettings,
              style: ElevatedButton.styleFrom(
                backgroundColor: textPrimary,
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: const Text('Save Settings', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            ),
          ),
        ],
      ),
    );
  }
}
