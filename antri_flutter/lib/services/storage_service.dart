import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/ai_config.dart';
import '../models/thinking_profile.dart';
import '../models/chat_message.dart';
import '../models/chat_session.dart';
import '../models/artifact.dart';

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
    const defaultName = 'profile_1';
    return {
      defaultName: ThinkingProfile(
        name: defaultName,
        content: '''# 👤 Profile: profile_1

## 📋 Profile Info
- Profile Name: profile_1
- Description: Default user profile
- Role / Specialty: [e.g. Software Engineer, Full-Stack Developer]

## 🧠 User Thinking Style & Preferences
- Communication Style: [e.g. Concise, direct, step-by-step guidance]
- Problem Solving Approach: [e.g. First-principles, test-driven, proactive]
- Code Style & Architecture: [e.g. Modular, clean, typed, minimal dependencies]

## 🎯 User Hobbies & Interests
- Hobbies: [Add hobbies, music, gaming, or personal interests here]
- Technical Interests: [Add technical interests here]

## 📝 Personal Notes & Project Directives
- [Personal notes, rules, and facts captured during conversations will be recorded here]
''',
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

  static String _getUserSessionsKey(String? syncKey) => 'antri_sessions_${syncKey != null && syncKey.isNotEmpty ? syncKey : "guest"}';
  static String _getUserActiveSessionKey(String? syncKey) => 'antri_active_session_${syncKey != null && syncKey.isNotEmpty ? syncKey : "guest"}';

  Future<List<ChatSession>> loadChatSessions([String? syncKey]) async {
    final prefs = await SharedPreferences.getInstance();
    final key = _getUserSessionsKey(syncKey);
    final raw = prefs.getString(key);
    if (raw != null) {
      try {
        final List list = jsonDecode(raw);
        final sessions = list.map((item) => ChatSession.fromJson(item)).toList();
        if (sessions.isNotEmpty) return sessions;
      } catch (_) {}
    }

    // Migrate from legacy single chat history if present
    final legacyHistory = await loadChatHistory(syncKey);
    final defaultSession = ChatSession(
      id: 'chat_${DateTime.now().millisecondsSinceEpoch}',
      title: 'Main Chat',
      messages: legacyHistory,
    );
    await saveChatSessions([defaultSession], syncKey);
    return [defaultSession];
  }

  Future<void> saveChatSessions(List<ChatSession> sessions, [String? syncKey]) async {
    final prefs = await SharedPreferences.getInstance();
    final key = _getUserSessionsKey(syncKey);
    final list = sessions.map((s) => s.toJson()).toList();
    await prefs.setString(key, jsonEncode(list));
  }

  Future<String?> getActiveSessionId([String? syncKey]) async {
    final prefs = await SharedPreferences.getInstance();
    final key = _getUserActiveSessionKey(syncKey);
    return prefs.getString(key);
  }

  Future<void> setActiveSessionId(String id, [String? syncKey]) async {
    final prefs = await SharedPreferences.getInstance();
    final key = _getUserActiveSessionKey(syncKey);
    await prefs.setString(key, id);
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

  static String _getUserArtifactsKey(String? syncKey) => 'antri_artifacts_${syncKey != null && syncKey.isNotEmpty ? syncKey : "guest"}';

  Future<List<Artifact>> loadArtifacts([String? syncKey]) async {
    final prefs = await SharedPreferences.getInstance();
    final key = _getUserArtifactsKey(syncKey);
    final raw = prefs.getString(key);
    if (raw != null) {
      try {
        final List list = jsonDecode(raw);
        return list.map((item) => Artifact.fromJson(item)).toList();
      } catch (_) {}
    }
    return [];
  }

  Future<void> saveArtifacts(List<Artifact> artifacts, [String? syncKey]) async {
    final prefs = await SharedPreferences.getInstance();
    final key = _getUserArtifactsKey(syncKey);
    final list = artifacts.map((a) => a.toJson()).toList();
    await prefs.setString(key, jsonEncode(list));
  }

  Future<void> saveArtifact(Artifact artifact, [String? syncKey]) async {
    final list = await loadArtifacts(syncKey);
    final index = list.indexWhere((a) => a.id == artifact.id);
    if (index >= 0) {
      list[index] = artifact;
    } else {
      list.insert(0, artifact);
    }
    await saveArtifacts(list, syncKey);
  }

  Future<void> deleteArtifact(String id, [String? syncKey]) async {
    final list = await loadArtifacts(syncKey);
    list.removeWhere((a) => a.id == id);
    await saveArtifacts(list, syncKey);
  }
}

