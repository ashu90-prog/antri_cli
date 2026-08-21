import '../models/thinking_profile.dart';
import '../services/storage_service.dart';
import '../services/firestore_sync_service.dart';

class NoteSynthesizer {
  static final List<RegExp> _extractPatterns = [
    // 1. Name & Identity
    RegExp(r'(?:my name is|call me|i am|i\x27m)\s+([a-zA-Z0-9_\s]{2,30})', caseSensitive: false),
    // 2. Relational Motivations & Family Inspiration (e.g. father passed away, liked workout so user likes it too)
    RegExp(r'(?:(?:my )?(?:father|farher|mother|mom|dad|parent|family|brother|sister) (?:liked|loved|enjoyed|was into|did|taught me) [^\.\n]+ (?:so|and so|that\x27s why|which is why) [^\.\n]+)', caseSensitive: false),
    RegExp(r'(?:i (?:like|love|workout|exercise|code|study|enjoy) (?:because|since) (?:my )?(?:father|mother|dad|mom|parent)[^\.\n]*)', caseSensitive: false),
    // 3. Personal Life Events, Family & Bereavement
    RegExp(r'(?:i lost (?:my )?(?:father|farher|mother|mom|dad|brother|sister|parent|family|friend)[^\.\n]*)', caseSensitive: false),
    RegExp(r'(?:my (?:father|farher|mother|mom|dad|brother|sister|parent) (?:passed away|died|left us)[^\.\n]*)', caseSensitive: false),
    RegExp(r'(?:in (?:19\d{2}|20\d{2}) (?:i lost|my father|my mother|i graduated|i started)[^\.\n]*)', caseSensitive: false),
    // 4. Hobbies, Music & Interests
    RegExp(r'(?:i like|i love|i enjoy|i listen|my hobby|in my free time)\s+(?:to |listening to |listning ot )?([^\.\n]+)', caseSensitive: false),
    // 5. Preferences & Coding Rules
    RegExp(r'(?:i prefer|i want|always use|never use|make sure to|remember that|my preference|in flutter|in typescript|in python|format with|clean architecture|keep it concise|don\x27t use|please use|style:|pattern:)\s+([^\.\n]+)', caseSensitive: false),
    // 6. Philosophical Views, Ethics, Mental Models & Worldview
    RegExp(r'(?:i believe in|my philosophy is|philosophically|in life|i think that life|the way i see it|fundamentally|existentially|epistemically|my core belief|i live by|my worldview|i value|what matters most to me is|when it comes to life|my perspective is|human nature is|the purpose of)\s+([^\.\n]+)', caseSensitive: false),
    RegExp(r'(?:stoic|stoicism|nihilism|pragmatism|existentialism|utilitarianism|determinism|moral|ethics|first principles)\s+([^\.\n]+)', caseSensitive: false),
    // 7. Minute Nuances, Habits, Quirks & Mindset
    RegExp(r'(?:i tend to|my habit is|i get frustrated when|i feel best when|i usually think|my mindset is|i care deeply about)\s+([^\.\n]+)', caseSensitive: false),
  ];

  /// Analyzes a chat turn and extracts preferences, constraints, or personal notes
  static Future<String?> extractAndRecordNote({
    required String userPrompt,
    required String activeProfileName,
    required Map<String, ThinkingProfile> profiles,
    required StorageService storageService,
    required String? syncKey,
    required String? projectId,
    FirestoreSyncService? firestoreService,
  }) async {
    final cleanPrompt = userPrompt.trim();
    if (cleanPrompt.length < 4) return null;

    String? extractedNote;

    for (final regex in _extractPatterns) {
      final match = regex.firstMatch(cleanPrompt);
      if (match != null) {
        final captured = match.group(0)?.trim();
        if (captured != null && captured.length > 4 && captured.length < 250) {
          extractedNote = captured;
          break;
        }
      }
    }

    if (extractedNote == null && (cleanPrompt.toLowerCase().contains('prefer') ||
        cleanPrompt.toLowerCase().contains('always') ||
        cleanPrompt.toLowerCase().contains('remember') ||
        cleanPrompt.toLowerCase().contains('architecture') ||
        cleanPrompt.toLowerCase().contains('music') ||
        cleanPrompt.toLowerCase().contains('father'))) {
      extractedNote = cleanPrompt;
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
