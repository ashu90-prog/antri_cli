import fs from 'fs';
import path from 'path';
import { ChatMessage } from '../types.js';

export class ConversationHistory {
  private messages: ChatMessage[] = [];
  private maxHistoryTokens: number = 40000;

  constructor() {
    this.messages = [];
  }

  public addMessage(message: ChatMessage): void {
    this.messages.push({
      ...message,
      timestamp: Date.now(),
    });
  }

  public getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  public setMessages(messages: ChatMessage[]): void {
    this.messages = [...messages];
  }

  public getLastUserMessage(): ChatMessage | undefined {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === 'user') {
        return this.messages[i];
      }
    }
    return undefined;
  }

  public clear(): void {
    this.messages = [];
  }

  public length(): number {
    return this.messages.length;
  }

  public exportMarkdown(filePath?: string): string {
    const lines: string[] = [
      `# ANTRI Code Chat Transcript`,
      `*Generated on ${new Date().toLocaleString()}*`,
      `---`,
      '',
    ];

    for (const msg of this.messages) {
      if (msg.role === 'system') continue;
      const roleName = msg.role.toUpperCase();
      lines.push(`### 👤 ${roleName}`);
      lines.push(msg.content);
      lines.push('');
    }

    const content = lines.join('\n');
    if (filePath) {
      fs.writeFileSync(filePath, content, 'utf-8');
    }
    return content;
  }
}
