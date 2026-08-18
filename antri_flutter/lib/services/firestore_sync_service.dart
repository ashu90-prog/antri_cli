import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/thinking_profile.dart';

class FirestoreSyncService {
  Future<bool> syncProfileToFirestore({
    required String projectId,
    required String syncKey,
    required ThinkingProfile profile,
  }) async {
    final project = projectId.isNotEmpty ? projectId : 'antri-agentic-hackathon';
    final collection = syncKey.isNotEmpty ? syncKey : 'default_user';
    final url = 'https://firestore.googleapis.com/v1/projects/$project/databases/(default)/documents/antri_sync/$collection/profiles/${profile.name}';

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

  Future<Map<String, dynamic>> pullProfilesFromFirestore({
    required String projectId,
    required String syncKey,
  }) async {
    final project = projectId.isNotEmpty ? projectId : 'antri-agentic-hackathon';
    final collection = syncKey.isNotEmpty ? syncKey : 'default_user';
    final url = 'https://firestore.googleapis.com/v1/projects/$project/databases/(default)/documents/antri_sync/$collection/profiles';

    try {
      final res = await http.get(Uri.parse(url));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final documents = data['documents'] as List? ?? [];
        final Map<String, ThinkingProfile> profiles = {};
        String notesContent = '';

        for (final doc in documents) {
          final docName = (doc['name'] as String? ?? '').split('/').last;
          final fields = doc['fields'] as Map<String, dynamic>? ?? {};
          final rawName = fields['name']?['stringValue'] ?? docName;
          final cleanName = rawName.replaceAll(RegExp(r'\.md$'), '').trim();
          final content = fields['content']?['stringValue'] ?? '';
          final updatedAt = DateTime.tryParse(fields['updatedAt']?['stringValue'] ?? '') ?? DateTime.now();

          if (cleanName.isNotEmpty && content.isNotEmpty) {
            if (cleanName == 'notes') {
              notesContent = content;
            } else {
              profiles[cleanName] = ThinkingProfile(name: cleanName, content: content, updatedAt: updatedAt);
            }
          }
        }
        return {'profiles': profiles, 'notes': notesContent};
      }
    } catch (_) {}
    return {'profiles': <String, ThinkingProfile>{}, 'notes': ''};
  }
}
