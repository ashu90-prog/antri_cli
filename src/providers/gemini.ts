import { GoogleGenAI } from '@google/genai';
import { LLMProvider } from './base.js';
import { ChatMessage, ToolDefinition, StreamCallbacks } from '../types.js';

export class GeminiProvider implements LLMProvider {
  public name: string = 'gemini';
  public defaultModel: string = 'gemini-3.7-flash';
  private apiKey: string;
  private model: string;
  private ai?: GoogleGenAI;

  constructor(options: { apiKey?: string; model?: string }) {
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
    this.model = options.model || 'gemini-3.7-flash';
    this.defaultModel = this.model;
    if (this.apiKey) {
      this.ai = new GoogleGenAI({ apiKey: this.apiKey });
    }
  }

  public async sendMessageStream(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    callbacks: StreamCallbacks
  ): Promise<string> {
    if (!this.apiKey) {
      const remoteBackend = process.env.ANTRI_BACKEND_URL || process.env.CLOUD_RUN_URL || process.env.GOOGLE_CLOUD_RUN_URL;
      if (remoteBackend) {
        return this.streamFromCloudBackend(remoteBackend, messages, callbacks);
      }
      throw new Error('GEMINI_API_KEY is not set. Use /key gemini <your-key> or export ANTRI_BACKEND_URL=https://your-cloud-run.run.app');
    }

    if (!this.ai) {
      this.ai = new GoogleGenAI({ apiKey: this.apiKey });
    }

    const sanitizedContents: any[] = [];
    let currentTurn: { role: string; parts: { text: string }[] } | null = null;

    for (const m of messages) {
      if (m.role === 'system') continue;
      const role = m.role === 'assistant' ? 'model' : 'user';
      const text = m.content || '';
      if (!text.trim()) continue;

      if (currentTurn && currentTurn.role === role) {
        currentTurn.parts.push({ text });
      } else {
        currentTurn = { role, parts: [{ text }] };
        sanitizedContents.push(currentTurn);
      }
    }

    if (sanitizedContents.length === 0) {
      sanitizedContents.push({ role: 'user', parts: [{ text: 'Hello' }] });
    }

    const systemMsg = messages.find((m) => m.role === 'system');
    const normalizedModel = this.model.replace(/^models\//, '');

    // Direct Google Generative Language REST SSE Streaming (Zero-Latency Instant Streaming)
    const payload: any = {
      contents: sanitizedContents,
    };

    if (systemMsg) {
      payload.systemInstruction = {
        parts: [{ text: systemMsg.content }],
      };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${normalizedModel}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errText}`);
      }

      if (!response.body) {
        throw new Error('Gemini response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                fullContent += text;
                callbacks.onToken(text);
              }
            } catch {
              // Ignore parse errors on chunks
            }
          }
        }
      }

      if (callbacks.onComplete) {
        callbacks.onComplete(fullContent);
      }

      return fullContent;
    } catch (sseError: any) {
      // Secondary fallback to Google GenAI SDK (@google/genai)
      if (this.ai) {
        const streamResponse = await this.ai.models.generateContentStream({
          model: normalizedModel,
          contents: sanitizedContents,
          config: systemMsg ? { systemInstruction: systemMsg.content } : undefined,
        });

        let fullContent = '';
        for await (const chunk of streamResponse) {
          const text = chunk.text || '';
          if (text) {
            fullContent += text;
            callbacks.onToken(text);
          }
        }

        if (callbacks.onComplete) {
          callbacks.onComplete(fullContent);
        }

        return fullContent;
      }
      throw sseError;
    }
  }

  private async streamFromCloudBackend(
    backendUrl: string,
    messages: ChatMessage[],
    callbacks: StreamCallbacks
  ): Promise<string> {
    const cleanUrl = backendUrl.replace(/\/$/, '');
    const userPrompt = messages[messages.length - 1]?.content || '';
    const response = await fetch(`${cleanUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: userPrompt,
        messages,
        model: this.model,
        provider: 'gemini',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Google Cloud Run backend error (${response.status}): ${err}`);
    }

    if (!response.body) {
      throw new Error('Response body is null from Cloud Run backend');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullContent = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.token) {
              fullContent += data.token;
              callbacks.onToken(data.token);
            }
          } catch {
            // Ignore parse errors on SSE chunks
          }
        }
      }
    }

    if (callbacks.onComplete) {
      callbacks.onComplete(fullContent);
    }
    return fullContent;
  }
}
