import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/thinking_profile.dart';

class FirestoreSyncService {
  Future<bool> syncProfileToFirestore({
    required String projectId,
    required String syncKey,
    required ThinkingProfile profile,
  }) async {
    if (projectId.isEmpty) return false;
    final collection = syncKey.isNotEmpty ? syncKey : 'default_user';
    final url = 'https://firestore.googleapis.com/v1/projects/$projectId/databases/(default)/documents/antri_sync/$collection/profiles/${profile.name}';

    try {
      final res = await http.patch(
        Uri.parse(url),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'fields': {
            'name': {'stringValue': profile.name},
            'content': {'stringValue': profile.content},
            'updatedAt': {'stringValue': profile.updatedAt.toIso8601String()},
          }
        }),
      );
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<Map<String, ThinkingProfile>> pullProfilesFromFirestore({
    required String projectId,
    required String syncKey,
  }) async {
    if (projectId.isEmpty) return {};
    final collection = syncKey.isNotEmpty ? syncKey : 'default_user';
    final url = 'https://firestore.googleapis.com/v1/projects/$projectId/databases/(default)/documents/antri_sync/$collection/profiles';

    try {
      final res = await http.get(Uri.parse(url));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final documents = data['documents'] as List? ?? [];
        final Map<String, ThinkingProfile> result = {};

        for (final doc in documents) {
          final fields = doc['fields'] as Map<String, dynamic>? ?? {};
          final name = fields['name']?['stringValue'] ?? 'profile';
          final content = fields['content']?['stringValue'] ?? '';
          final updatedAt = DateTime.tryParse(fields['updatedAt']?['stringValue'] ?? '') ?? DateTime.now();

          result[name] = ThinkingProfile(name: name, content: content, updatedAt: updatedAt);
        }
        return result;
      }
    } catch (_) {}
    return {};
  }
}
