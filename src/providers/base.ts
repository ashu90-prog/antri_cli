import { ChatMessage, ToolDefinition, StreamCallbacks } from '../types.js';

export interface LLMProvider {
  name: string;
  defaultModel: string;
  sendMessageStream(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    callbacks: StreamCallbacks
  ): Promise<string>;
}
