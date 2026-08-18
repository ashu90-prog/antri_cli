import '../models/thinking_profile.dart';
import '../services/storage_service.dart';
import '../services/firestore_sync_service.dart';

class NoteSynthesizer {
  static final RegExp _prefRegex = RegExp(
    r'(?:i prefer|i want|always use|never use|make sure to|remember that|my preference|in flutter|in typescript|in python|format with|clean architecture|keep it concise|don\x27t use|please use|style:|pattern:)\s+([^\.\n]+)',
    caseSensitive: false,
  );

  /// Analyzes a chat turn and extracts preferences, constraints, or decisions
  static Future<String?> extractAndRecordNote({
    required String userPrompt,
    required String activeProfileName,
    required Map<String, ThinkingProfile> profiles,
    required StorageService storageService,
    required String? syncKey,
    required String? projectId,
    FirestoreSyncService? firestoreService,
  }) async {
    final match = _prefRegex.firstMatch(userPrompt);
    String? extractedNote;

    if (match != null && match.group(1) != null) {
      extractedNote = match.group(1)!.trim();
    } else if (userPrompt.toLowerCase().contains('prefer') ||
        userPrompt.toLowerCase().contains('always') ||
        userPrompt.toLowerCase().contains('remember') ||
        userPrompt.toLowerCase().contains('architecture')) {
      extractedNote = userPrompt.trim();
      if (extractedNote.length > 80) {
        extractedNote = '${extractedNote.substring(0, 77)}...';
      }
    }

    if (extractedNote != null && extractedNote.isNotEmpty) {
      final dateStr = DateTime.now().toLocal().toString().split(' ')[0];
      final noteEntry = '[$dateStr]: $extractedNote';

      // 1. Append to active profile markdown
      if (profiles.containsKey(activeProfileName)) {
        final prof = profiles[activeProfileName]!;
        if (!prof.content.contains('## Notes & Insights Captured From Conversations')) {
          prof.content += '\n\n## Notes & Insights Captured From Conversations\n- $noteEntry';
        } else if (!prof.content.contains(extractedNote)) {
          prof.content += '\n- $noteEntry';
        }
        prof.updatedAt = DateTime.now();
        await storageService.saveProfiles(profiles, syncKey);

        // Auto-sync updated profile to Firestore
        if (firestoreService != null && projectId != null && projectId.isNotEmpty) {
          try {
            await firestoreService.syncProfileToFirestore(
              projectId: projectId,
              syncKey: syncKey ?? '',
              profile: prof,
            );
          } catch (_) {}
        }
      }

      // 2. Append to Cognitive Memory list
      final memories = await storageService.loadMemories(syncKey);
      if (!memories.contains(noteEntry)) {
        memories.insert(0, noteEntry);
        await storageService.saveMemories(memories, syncKey);
      }

      return extractedNote;
    }

    return null;
  }
}
