import { LLMProvider } from './base.js';
import { ChatMessage, ToolDefinition, StreamCallbacks } from '../types.js';
import { log } from '../utils/logger.js';

export class OpenAICompatibleProvider implements LLMProvider {
  public name: string;
  public defaultModel: string;
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(options: {
    name?: string;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  }) {
    this.name = options.name || 'openai';
    this.apiKey = options.apiKey || '';
    this.baseUrl = options.baseUrl || 'https://api.openai.com/v1';
    this.model = options.model || 'gpt-4o';
    this.defaultModel = this.model;
  }

  public async sendMessageStream(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    callbacks: StreamCallbacks
  ): Promise<string> {
    try {
      return await this.executeStream(messages, tools, callbacks);
    } catch (err: any) {
      // 1. If error is 400 related to tools payload, retry once without tools
      if (
        tools &&
        tools.length > 0 &&
        (err.message.includes('400') ||
          err.message.includes('tools') ||
          err.message.includes('schema'))
      ) {
        return await this.executeStream(messages, [], callbacks);
      }

      // 2. If model is inactive, 404, or 410 on NVIDIA NIM, auto-fallback to verified active model
      if (
        this.name === 'nvidia-nim' &&
        this.model !== 'meta/llama-3.1-8b-instruct' &&
        (err.message.includes('404') ||
          err.message.includes('410') ||
          err.message.includes('Not found for account') ||
          err.message.includes('Gone'))
      ) {
        const prevModel = this.model;
        this.model = 'meta/llama-3.1-8b-instruct';
        log.warn(`Model '${prevModel}' is not deployed or inactive on this NVIDIA NIM account.`);
        log.info(`Automatically falling back to active model 'meta/llama-3.1-8b-instruct'...\n`);
        return await this.executeStream(messages, tools, callbacks);
      }

      throw err;
    }
  }

  private async executeStream(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    callbacks: StreamCallbacks
  ): Promise<string> {
    const formattedMessages = messages.map((m) => {
      const msgObj: any = {
        role: m.role,
        content: m.content || '',
      };
      if (m.tool_calls) msgObj.tool_calls = m.tool_calls;
      if (m.tool_call_id) msgObj.tool_call_id = m.tool_call_id;
      if (m.name) msgObj.name = m.name;
      return msgObj;
    });

    const payload: any = {
      model: this.model,
      messages: formattedMessages,
      stream: true,
      temperature: 0.2,
    };

    if (tools && tools.length > 0) {
      payload.tools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API request failed (${response.status} ${response.statusText}): ${errText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null or undefined.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullContent = '';
    let buffer = '';
    const toolCallsMap: Record<number, { id: string; name: string; arguments: string }> = {};

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const jsonStr = trimmed.slice(6);
            const data = JSON.parse(jsonStr);
            const delta = data.choices?.[0]?.delta;

            if (delta?.content) {
              fullContent += delta.content;
              callbacks.onToken(delta.content);
            } else if (delta?.reasoning_content) {
              fullContent += delta.reasoning_content;
              callbacks.onToken(delta.reasoning_content);
            } else if (delta?.reasoning) {
              fullContent += delta.reasoning;
              callbacks.onToken(delta.reasoning);
            } else if (delta?.text) {
              fullContent += delta.text;
              callbacks.onToken(delta.text);
            } else if (data.choices?.[0]?.text) {
              fullContent += data.choices[0].text;
              callbacks.onToken(data.choices[0].text);
            }

            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!toolCallsMap[idx]) {
                  toolCallsMap[idx] = {
                    id: tc.id || `call_${Date.now()}_${idx}`,
                    name: tc.function?.name || '',
                    arguments: tc.function?.arguments || '',
                  };
                } else {
                  if (tc.function?.name) toolCallsMap[idx].name += tc.function.name;
                  if (tc.function?.arguments) toolCallsMap[idx].arguments += tc.function.arguments;
                }
              }
            }
          } catch {
            // Ignore partial parse chunks
          }
        }
      }
    }

    // Process collected tool calls
    for (const key in toolCallsMap) {
      const tc = toolCallsMap[key];
      if (callbacks.onToolCall) {
        callbacks.onToolCall({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: tc.arguments,
          },
        });
      }
    }

    // If stream ended empty and no tool calls occurred, fallback to non-streaming POST
    if (!fullContent && Object.keys(toolCallsMap).length === 0) {
      try {
        const nonStreamPayload = { ...payload, stream: false };
        const nonStreamRes = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(nonStreamPayload),
        });
        if (nonStreamRes.ok) {
          const nonStreamData: any = await nonStreamRes.json();
          const fallbackText = nonStreamData.choices?.[0]?.message?.content || nonStreamData.choices?.[0]?.text || '';
          if (fallbackText) {
            fullContent = fallbackText;
            callbacks.onToken(fallbackText);
          }
        }
      } catch (_) {}
    }

    if (callbacks.onComplete) {
      callbacks.onComplete(fullContent);
    }

    return fullContent;
  }
}
