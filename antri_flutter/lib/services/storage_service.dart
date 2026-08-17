import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/ai_config.dart';
import '../models/thinking_profile.dart';
import '../models/chat_message.dart';

class StorageService {
  static const String _keyConfig = 'antri_flutter_config';
  static const String _keyProfiles = 'antri_flutter_profiles';
  static const String _keyHistory = 'antri_flutter_chat_history';
  static const String _keySemanticMemory = 'antri_flutter_semantic_memory';

  Future<AIConfig> loadConfig() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_keyConfig);
    if (raw != null) {
      try {
        return AIConfig.fromJson(jsonDecode(raw));
      } catch (_) {}
    }
    return AIConfig();
  }

  Future<void> saveConfig(AIConfig config) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyConfig, jsonEncode(config.toJson()));
  }

  Future<Map<String, ThinkingProfile>> loadProfiles() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_keyProfiles);
    if (raw != null) {
      try {
        final Map<String, dynamic> decoded = jsonDecode(raw);
        return decoded.map((k, v) => MapEntry(k, ThinkingProfile.fromJson(v)));
      } catch (_) {}
    }
    return {
      'mobile_profile_1': ThinkingProfile(
        name: 'mobile_profile_1',
        content: '# Mobile Thinking Profile\n\n- Preferred Language: TypeScript\n- Architecture: Clean & Modular\n- Formatting: 2 spaces, strict types',
      ),
    };
  }

  Future<void> saveProfiles(Map<String, ThinkingProfile> profiles) async {
    final prefs = await SharedPreferences.getInstance();
    final map = profiles.map((k, v) => MapEntry(k, v.toJson()));
    await prefs.setString(_keyProfiles, jsonEncode(map));
  }

  Future<List<ChatMessage>> loadChatHistory() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_keyHistory);
    if (raw != null) {
      try {
        final List list = jsonDecode(raw);
        return list.map((item) => ChatMessage.fromJson(item)).toList();
      } catch (_) {}
    }
    return [];
  }

  Future<void> saveChatHistory(List<ChatMessage> history) async {
    final prefs = await SharedPreferences.getInstance();
    final list = history.map((m) => m.toJson()).toList();
    await prefs.setString(_keyHistory, jsonEncode(list));
  }
}
