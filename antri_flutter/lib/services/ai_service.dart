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

    // 0. Remote Google Cloud Backend (Cloud Run / Cloud Shell)
    if (customUrl.isNotEmpty && (customUrl.startsWith('http://') || customUrl.startsWith('https://'))) {
      try {
        final cleanUrl = customUrl.replaceAll(RegExp(r'/$'), '');
        final endpoint = '$cleanUrl/api/chat';
        final response = await http.post(
          Uri.parse(endpoint),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'prompt': promptToSend,
            'model': model.isNotEmpty ? model : 'gemini-3.7-flash',
            'history': conversationHistory.map((m) => {'role': m.role, 'content': m.content}).toList(),
          }),
        );
        if (response.statusCode >= 200 && response.statusCode < 300) {
          final data = jsonDecode(utf8.decode(response.bodyBytes));
          return data['response'] ?? data['text'] ?? data['content'] ?? data['choices']?[0]?['message']?['content'] ?? 'No output generated.';
        }
      } catch (_) {
        // Fallback to direct client call if backend unavailable
      }
    }

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
      // Normalize model name for Google Generative Language v1beta API
      String normalizedModel = model.replaceAll(RegExp(r'^models/'), '').trim();
      if (normalizedModel.isEmpty) normalizedModel = 'gemini-3.7-flash';

      // Dynamic alias mapping to verified Google v1beta model IDs
      if (normalizedModel == 'gemini-3.5-pro' || normalizedModel == 'gemini-3.5') {
        normalizedModel = 'gemini-3.1-pro-preview';
      } else if (normalizedModel == 'gemini-3.7-pro') {
        normalizedModel = 'gemini-3.7-flash';
      } else if (normalizedModel == 'gemini-2.0-flash' || normalizedModel == 'gemini-2.0-flash-thinking-exp-01-21' || normalizedModel == 'gemini-2.0') {
        normalizedModel = 'gemini-2.5-flash';
      }

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

      final Map<String, String> headers = {'Content-Type': 'application/json'};
      String endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/$normalizedModel:generateContent';

      if (apiKey.startsWith('AQ.') || apiKey.startsWith('ya29.')) {
        headers['Authorization'] = 'Bearer $apiKey';
      } else {
        endpoint += '?key=$apiKey';
      }

      var response = await http.post(
        Uri.parse(endpoint),
        headers: headers,
        body: jsonEncode({'contents': contents}),
      );

      // If Bearer failed, retry with ?key= or vice-versa
      if (response.statusCode != 200) {
        final altHeaders = {'Content-Type': 'application/json'};
        String altEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/$normalizedModel:generateContent';
        if (headers.containsKey('Authorization')) {
          altEndpoint += '?key=$apiKey';
        } else {
          altHeaders['Authorization'] = 'Bearer $apiKey';
        }
        try {
          final altResp = await http.post(
            Uri.parse(altEndpoint),
            headers: altHeaders,
            body: jsonEncode({'contents': contents}),
          );
          if (altResp.statusCode >= 200 && altResp.statusCode < 300) {
            response = altResp;
          }
        } catch (_) {}
      }

      // Automatic resilient fallback if 404 (model not found), 503 (high demand), or 429
      if (response.statusCode != 200 && normalizedModel != 'gemini-2.5-flash') {
        final fallbackEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$apiKey';
        final fallbackResp = await http.post(
          Uri.parse(fallbackEndpoint),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'contents': contents}),
        );
        if (fallbackResp.statusCode >= 200 && fallbackResp.statusCode < 300) {
          response = fallbackResp;
        }
      }

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final data = jsonDecode(utf8.decode(response.bodyBytes));
        return data['candidates']?[0]?['content']?[0]?['text'] ?? data['candidates']?[0]?['content']?['parts']?[0]?['text'] ?? 'No output generated.';
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

  /// Executes a multi-stage Dialectic consensus debate secretly in the background
  /// and returns only the final battle-tested synthesis with the required header badge.
  Future<String> runSilentDebate({
    required AIConfig config,
    required String query,
  }) async {
    // 1. Proposer (Thesis)
    final thesis = await executePrompt(
      config: config,
      systemPrompt: 'You are The Proposer in a dialectic consensus engine. Formulate a strong, innovative architecture thesis or solution.',
      userPrompt: 'Debate Question: $query',
    );

    // 2. Adversary (Antithesis)
    final antithesis = await executePrompt(
      config: config,
      systemPrompt: 'You are The Adversary in a dialectic consensus engine. Ruthlessly challenge the thesis, find edge cases, bugs, security vulnerabilities, and flaws.',
      userPrompt: 'Thesis to critique:\n$thesis',
    );

    // 3. Researcher (Verification)
    final verification = await executePrompt(
      config: config,
      systemPrompt: 'You are The Researcher in a dialectic consensus engine. Fact-check disputed claims between Thesis and Antithesis.',
      userPrompt: 'Thesis:\n$thesis\n\nAntithesis:\n$antithesis',
    );

    // 4. Judge / Final Consensus
    final synthesis = await executePrompt(
      config: config,
      systemPrompt: 'You are The Judge in a dialectic consensus engine. Reconcile contradictions and deliver the authoritative, battle-tested final solution.\n\n🚨 Emoji Usage Rule: You must use emojis, but keep them minimal and tasteful — MAXIMUM 2 EMOJIS in your entire response.',
      userPrompt: 'Topic: $query\n\nThesis:\n$thesis\n\nAntithesis:\n$antithesis\n\nVerification:\n$verification',
    );

    return '> ⚔️ [Dialectic Debate Synthesized]\n\n${synthesis.trim()}';
  }

  /// Executes a 3-iteration Goal Loop secretly in the background
  /// and returns the hardened, production-ready solution with the required header badge.
  Future<String> runSilentGoal({
    required AIConfig config,
    required String objective,
  }) async {
    // 1. Initial Draft & Plan
    final draft = await executePrompt(
      config: config,
      systemPrompt: 'You are Stage 1 of the Goal Loop. Formulate a comprehensive, complete solution draft and plan.',
      userPrompt: 'Objective: $objective',
    );

    // 2. Adversarial Review & Score
    final critique = await executePrompt(
      config: config,
      systemPrompt: 'You are Stage 2 of the Goal Loop. Critically review the draft for edge cases, performance, security, and assign a quality score (0-100%).',
      userPrompt: 'Draft Solution:\n$draft',
    );

    // 3. Final Hardened Delivery
    final hardened = await executePrompt(
      config: config,
      systemPrompt: 'You are Stage 3 of the Goal Loop. Synthesize the draft and critique into an optimal, production-ready, hardened solution.\n\n🚨 Emoji Usage Rule: You must use emojis, but keep them minimal and tasteful — MAXIMUM 2 EMOJIS in your entire response.',
      userPrompt: 'Draft:\n$draft\n\nCritique:\n$critique',
    );

    return '> 🎯 [Goal Loop Plan Synthesized]\n\n${hardened.trim()}';
  }
}

