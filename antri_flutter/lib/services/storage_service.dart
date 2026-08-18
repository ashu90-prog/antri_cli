import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/ai_config.dart';
import '../models/thinking_profile.dart';
import '../models/chat_message.dart';

class StorageService {
  static const String _keyConfig = 'antri_flutter_config';

  static String _getUserProfilesKey(String? syncKey) => 'antri_profiles_${syncKey != null && syncKey.isNotEmpty ? syncKey : "guest"}';
  static String _getUserHistoryKey(String? syncKey) => 'antri_history_${syncKey != null && syncKey.isNotEmpty ? syncKey : "guest"}';
  static String _getUserMemoriesKey(String? syncKey) => 'antri_memories_${syncKey != null && syncKey.isNotEmpty ? syncKey : "guest"}';

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

  Future<Map<String, ThinkingProfile>> loadProfiles([String? syncKey]) async {
    final prefs = await SharedPreferences.getInstance();
    final key = _getUserProfilesKey(syncKey);
    final raw = prefs.getString(key);
    if (raw != null) {
      try {
        final Map<String, dynamic> decoded = jsonDecode(raw);
        if (decoded.isNotEmpty) {
          return decoded.map((k, v) => MapEntry(k, ThinkingProfile.fromJson(v)));
        }
      } catch (_) {}
    }
    final defaultName = syncKey != null && syncKey.isNotEmpty ? '${syncKey.split('_').first}_profile' : 'profile_1';
    return {
      defaultName: ThinkingProfile(
        name: defaultName,
        content: '# $defaultName Thinking Profile\n\n## Style of Thinking & Preferences\n- Communication: Structured, proactive guidance\n- Architecture: Modular & Clean\n\n## Notes & Insights Captured From Conversations\n- Initialized private profile for account.',
      ),
    };
  }

  Future<void> saveProfiles(Map<String, ThinkingProfile> profiles, [String? syncKey]) async {
    final prefs = await SharedPreferences.getInstance();
    final key = _getUserProfilesKey(syncKey);
    final map = profiles.map((k, v) => MapEntry(k, v.toJson()));
    await prefs.setString(key, jsonEncode(map));
  }

  Future<List<ChatMessage>> loadChatHistory([String? syncKey]) async {
    final prefs = await SharedPreferences.getInstance();
    final key = _getUserHistoryKey(syncKey);
    final raw = prefs.getString(key);
    if (raw != null) {
      try {
        final List list = jsonDecode(raw);
        return list.map((item) => ChatMessage.fromJson(item)).toList();
      } catch (_) {}
    }
    return [];
  }

  Future<void> saveChatHistory(List<ChatMessage> history, [String? syncKey]) async {
    final prefs = await SharedPreferences.getInstance();
    final key = _getUserHistoryKey(syncKey);
    final list = history.map((m) => m.toJson()).toList();
    await prefs.setString(key, jsonEncode(list));
  }

  Future<List<String>> loadMemories([String? syncKey]) async {
    final prefs = await SharedPreferences.getInstance();
    final key = _getUserMemoriesKey(syncKey);
    return prefs.getStringList(key) ?? [];
  }

  Future<void> saveMemories(List<String> memories, [String? syncKey]) async {
    final prefs = await SharedPreferences.getInstance();
    final key = _getUserMemoriesKey(syncKey);
    await prefs.setStringList(key, memories);
  }
}
