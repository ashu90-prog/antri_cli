import { LLMProvider } from './base.js';
import { ChatMessage, ToolDefinition, StreamCallbacks } from '../types.js';

export class GeminiProvider implements LLMProvider {
  public name: string = 'gemini';
  public defaultModel: string;
  private apiKey: string;
  private model: string;

  constructor(options: { apiKey?: string; model?: string }) {
    this.apiKey = options.apiKey || '';
    this.model = options.model || 'gemini-2.5-flash';
    this.defaultModel = this.model;
  }

  public async sendMessageStream(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    callbacks: StreamCallbacks
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not set. Use /key gemini <your-key> or set it in .env');
    }

    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const systemMsg = messages.find((m) => m.role === 'system');

    const payload: any = {
      contents,
    };

    if (systemMsg) {
      payload.systemInstruction = {
        parts: [{ text: systemMsg.content }],
      };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

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
  }
}
