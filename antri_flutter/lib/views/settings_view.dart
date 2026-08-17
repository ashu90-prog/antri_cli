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
  final TextEditingController _modelController = TextEditingController();
  final TextEditingController _apiKeyController = TextEditingController();
  final TextEditingController _baseUrlController = TextEditingController();
  final TextEditingController _gcpProjectIdController = TextEditingController();
  final TextEditingController _syncKeyController = TextEditingController();

  final Map<String, String> _defaultModels = {
    'deepseek': 'deepseek-chat',
    'openai': 'gpt-4o',
    'anthropic': 'claude-3-7-sonnet-20250219',
    'gemini': 'gemini-2.5-flash',
    'cerebras': 'llama-3.3-70b',
    'cohere': 'command-r-plus-08-2024',
    'vortex': 'vortex-llama-3.3-70b-instruct',
    'opencode': 'opencode/deepseek-coder-v2.5',
    'nvidia-nim': 'meta/llama-3.1-8b-instruct',
    'ollama': 'llama3.3:70b',
    'custom': 'custom-model',
  };

  @override
  void initState() {
    super.initState();
    _modelController.text = widget.config.model;
    _apiKeyController.text = widget.config.apiKey;
    _baseUrlController.text = widget.config.baseUrl;
    _gcpProjectIdController.text = widget.config.firestoreProjectId;
    _syncKeyController.text = widget.config.syncKey;
  }

  void _onProviderChanged(String? newProv) {
    if (newProv != null) {
      setState(() {
        widget.config.provider = newProv;
        widget.config.model = _defaultModels[newProv] ?? 'default-model';
        _modelController.text = widget.config.model;
      });
    }
  }

  Future<void> _saveSettings() async {
    widget.config.model = _modelController.text.trim();
    widget.config.apiKey = _apiKeyController.text.trim();
    widget.config.baseUrl = _baseUrlController.text.trim();
    widget.config.firestoreProjectId = _gcpProjectIdController.text.trim();
    widget.config.syncKey = _syncKeyController.text.trim();

    await widget.storageService.saveConfig(widget.config);
    widget.onConfigSaved();

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Settings saved successfully.')),
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
        title: const Text('Settings & Cloud Sync', style: TextStyle(fontWeight: FontWeight.w800, color: textPrimary, fontSize: 16)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
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
                const Text('AI PROVIDER SETTINGS', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: textPrimary, letterSpacing: 0.5)),
                const SizedBox(height: 14),

                // Provider Dropdown
                const Text('Active Provider', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF8C827A))),
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
                      value: widget.config.provider,
                      isExpanded: true,
                      items: const [
                        DropdownMenuItem(value: 'deepseek', child: Text('DeepSeek (V3/R1)')),
                        DropdownMenuItem(value: 'openai', child: Text('OpenAI (GPT-4o/o1)')),
                        DropdownMenuItem(value: 'anthropic', child: Text('Anthropic (Claude 3.7)')),
                        DropdownMenuItem(value: 'gemini', child: Text('Google Gemini (Flash/Pro)')),
                        DropdownMenuItem(value: 'cerebras', child: Text('Cerebras (CS-3 2000 tok/s)')),
                        DropdownMenuItem(value: 'cohere', child: Text('Cohere (Command R+)')),
                        DropdownMenuItem(value: 'vortex', child: Text('Vortex API')),
                        DropdownMenuItem(value: 'opencode', child: Text('OpenCode')),
                        DropdownMenuItem(value: 'nvidia-nim', child: Text('NVIDIA NIM')),
                        DropdownMenuItem(value: 'ollama', child: Text('Ollama (Local / Tailscale)')),
                        DropdownMenuItem(value: 'custom', child: Text('Custom Endpoint')),
                      ],
                      onChanged: _onProviderChanged,
                    ),
                  ),
                ),
                const SizedBox(height: 14),

                _buildField('Model Identifier', _modelController, hint: 'e.g. deepseek-chat, gpt-4o'),
                _buildField('API Key', _apiKeyController, obscure: true, hint: 'sk-...'),
                _buildField('Custom Base URL (Optional)', _baseUrlController, hint: 'https://api...'),
              ],
            ),
          ),
          const SizedBox(height: 16),

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
                _buildField('Google Cloud Project ID', _gcpProjectIdController, hint: 'e.g. my-agentic-hackathon-proj'),
                _buildField('Sync Key / User ID', _syncKeyController, hint: 'e.g. ashu90 or default_user'),
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
