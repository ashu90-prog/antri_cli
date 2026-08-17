import { LLMProvider } from './base.js';
import { ChatMessage, ToolDefinition, StreamCallbacks } from '../types.js';

export class AnthropicProvider implements LLMProvider {
  public name: string = 'anthropic';
  public defaultModel: string;
  private apiKey: string;
  private model: string;

  constructor(options: { apiKey?: string; model?: string }) {
    this.apiKey = options.apiKey || '';
    this.model = options.model || 'claude-3-5-sonnet-20241022';
    this.defaultModel = this.model;
  }

  public async sendMessageStream(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    callbacks: StreamCallbacks
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set. Use /key anthropic <your-key> or set it in .env');
    }

    const systemMsg = messages.find((m) => m.role === 'system')?.content || '';
    const conversationMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

    const payload: any = {
      model: this.model,
      max_tokens: 4096,
      messages: conversationMessages,
      stream: true,
    };

    if (systemMsg) {
      payload.system = systemMsg;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errText}`);
    }

    if (!response.body) {
      throw new Error('Anthropic response body is null');
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
            if (data.type === 'content_block_delta' && data.delta?.text) {
              fullContent += data.delta.text;
              callbacks.onToken(data.delta.text);
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
