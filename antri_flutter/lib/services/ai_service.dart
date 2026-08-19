import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/ai_config.dart';
import '../models/chat_message.dart';

class AIService {
  Future<String> executePrompt({
    required AIConfig config,
    required String systemPrompt,
    required String userPrompt,
    List<ChatMessage> conversationHistory = const [],
    List<String> attachmentPaths = const [],
  }) async {
    final prov = config.provider;
    final model = config.model;
    final apiKey = config.apiKey;
    final customUrl = config.baseUrl;

    String promptToSend = userPrompt;
    if (attachmentPaths.isNotEmpty) {
      promptToSend += '\n\n[Attached Files: ${attachmentPaths.join(', ')}]';
    }

    final finalSystem = '$systemPrompt\n\nActive Mode: ${config.mode.toUpperCase()}\nActive Profile: ${config.activeProfile}';

    // 1. OpenAI-compatible providers
    final Map<String, String> baseUrls = {
      'deepseek': 'https://api.deepseek.com/v1',
      'openai': 'https://api.openai.com/v1',
      'cerebras': 'https://api.cerebras.ai/v1',
      'vortex': 'https://api.vortex.ai/v1',
      'opencode': 'https://api.opencode.ai/v1',
      'nvidia-nim': 'https://integrate.api.nvidia.com/v1',
      'ollama': customUrl.isNotEmpty ? customUrl : 'http://10.0.2.2:11434/v1',
      'custom': customUrl.isNotEmpty ? customUrl : 'http://10.0.2.2:8000/v1',
    };

    if (baseUrls.containsKey(prov) || prov == 'custom') {
      final endpoint = '${baseUrls[prov] ?? customUrl}/chat/completions';
      final List<Map<String, dynamic>> messages = [
        {'role': 'system', 'content': finalSystem},
      ];
      for (final msg in conversationHistory) {
        if (msg.content.trim().isNotEmpty) {
          messages.add({
            'role': msg.role == 'assistant' ? 'assistant' : 'user',
            'content': msg.content,
          });
        }
      }
      messages.add({
        'role': 'user',
        'content': promptToSend,
      });

      final response = await http.post(
        Uri.parse(endpoint),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $apiKey',
        },
        body: jsonEncode({
          'model': model,
          'messages': messages,
          'temperature': 0.7,
        }),
      );

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final data = jsonDecode(utf8.decode(response.bodyBytes));
        return data['choices']?[0]?['message']?['content'] ?? 'No output generated.';
      } else {
        throw Exception('API ${response.statusCode}: ${response.body}');
      }
    }

    // 2. Google Gemini
    if (prov == 'gemini') {
      final endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent?key=$apiKey';
      final List<Map<String, dynamic>> contents = [];

      for (int i = 0; i < conversationHistory.length; i++) {
        final msg = conversationHistory[i];
        if (msg.content.trim().isNotEmpty) {
          final role = msg.role == 'assistant' ? 'model' : 'user';
          final text = i == 0 ? '$finalSystem\n\n${msg.content}' : msg.content;
          contents.add({
            'role': role,
            'parts': [
              {'text': text}
            ],
          });
        }
      }

      if (contents.isEmpty) {
        contents.add({
          'role': 'user',
          'parts': [
            {'text': '$finalSystem\n\n$promptToSend'}
          ],
        });
      } else {
        contents.add({
          'role': 'user',
          'parts': [
            {'text': promptToSend}
          ],
        });
      }

      final response = await http.post(
        Uri.parse(endpoint),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'contents': contents}),
      );

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final data = jsonDecode(utf8.decode(response.bodyBytes));
        return data['candidates']?[0]?['content']?['parts']?[0]?['text'] ?? 'No output generated.';
      } else {
        throw Exception('Gemini ${response.statusCode}: ${response.body}');
      }
    }

    // 3. Anthropic Claude
    if (prov == 'anthropic') {
      const endpoint = 'https://api.anthropic.com/v1/messages';
      final List<Map<String, dynamic>> messages = [];
      for (final msg in conversationHistory) {
        if (msg.content.trim().isNotEmpty) {
          messages.add({
            'role': msg.role == 'assistant' ? 'assistant' : 'user',
            'content': msg.content,
          });
        }
      }
      messages.add({
        'role': 'user',
        'content': promptToSend,
      });

      final response = await http.post(
        Uri.parse(endpoint),
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: jsonEncode({
          'model': model,
          'max_tokens': 4096,
          'system': finalSystem,
          'messages': messages,
        }),
      );

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final data = jsonDecode(utf8.decode(response.bodyBytes));
        final contentList = data['content'] as List?;
        if (contentList != null && contentList.isNotEmpty) {
          return contentList[0]['text'] ?? '';
        }
        return 'No output generated.';
      } else {
        throw Exception('Anthropic ${response.statusCode}: ${response.body}');
      }
    }

    // 4. Cohere
    if (prov == 'cohere') {
      const endpoint = 'https://api.cohere.com/v2/chat';
      final List<Map<String, dynamic>> messages = [
        {'role': 'system', 'content': finalSystem},
      ];
      for (final msg in conversationHistory) {
        if (msg.content.trim().isNotEmpty) {
          messages.add({
            'role': msg.role == 'assistant' ? 'assistant' : 'user',
            'content': msg.content,
          });
        }
      }
      messages.add({
        'role': 'user',
        'content': promptToSend,
      });

      final response = await http.post(
        Uri.parse(endpoint),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $apiKey',
        },
        body: jsonEncode({
          'model': model,
          'messages': messages,
        }),
      );

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final data = jsonDecode(utf8.decode(response.bodyBytes));
        return data['message']?['content']?[0]?['text'] ?? 'No output generated.';
      } else {
        throw Exception('Cohere ${response.statusCode}: ${response.body}');
      }
    }

    throw Exception("Provider '$prov' is not supported.");
  }
}
