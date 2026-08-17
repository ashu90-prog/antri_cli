import { LLMProvider } from './base.js';
import { ChatMessage, ToolDefinition, StreamCallbacks } from '../types.js';

export class MockProvider implements LLMProvider {
  public name: string = 'mock';
  public defaultModel: string = 'deepseek-v4-flash-(latest)';

  public async sendMessageStream(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    callbacks: StreamCallbacks
  ): Promise<string> {
    const lastMsg = messages[messages.length - 1]?.content.toLowerCase() || '';

    let responseText = '';

    if (lastMsg.includes('help') || lastMsg.includes('shortcut')) {
      responseText = `### 🌟 Welcome to ANTRI Code CLI!

Here are quick shortcuts and commands:
- **\`?\`** or **\`/help\`**: Show this help manual
- **\`/model [name]\`**: Switch AI model (e.g., \`deepseek-v4-flash\`, \`gpt-4o\`, \`claude-3-5-sonnet\`)
- **\`/provider [name]\`**: Switch provider (\`deepseek\`, \`openai\`, \`gemini\`, \`anthropic\`, \`ollama\`)
- **\`/key <provider> <key>\`**: Set API key dynamically
- **\`/clear\`**: Clear chat session & screen
- **\`/exit\`**: Exit ANTRI CLI

> 💡 **To connect a real LLM model:**
> Set your API key in \`.env\` (e.g., \`DEEPSEEK_API_KEY=your_key\` or \`OPENAI_API_KEY=your_key\`), or type \`/key deepseek <your_key>\`.`;
    } else if (lastMsg.includes('file') || lastMsg.includes('read') || lastMsg.includes('list')) {
      if (callbacks.onToolCall) {
        callbacks.onToolCall({
          id: `mock_call_${Date.now()}`,
          type: 'function',
          function: {
            name: 'list_dir',
            arguments: JSON.stringify({ dir_path: '.' }),
          },
        });
        return '';
      }
      responseText = `I analyzed your project directory. All files are ready for editing!`;
    } else {
      responseText = `Hello! I am **ANTRI**, your terminal-first AI coding companion. ⚡

You asked:
> *${messages[messages.length - 1]?.content}*

To connect your favorite LLM provider:
1. **DeepSeek**: Set \`DEEPSEEK_API_KEY\` in your \`.env\` or run \`/key deepseek <key>\`
2. **OpenAI**: Set \`OPENAI_API_KEY\` or run \`/key openai <key>\`
3. **Gemini**: Set \`GEMINI_API_KEY\` or run \`/key gemini <key>\`
4. **Ollama (Local)**: Run \`/provider ollama\` and ensure Ollama is running at \`localhost:11434\`

How can I assist you with your project today?`;
    }

    // Stream the tokens with realistic delay
    const words = responseText.split(' ');
    for (let i = 0; i < words.length; i++) {
      const token = (i === 0 ? '' : ' ') + words[i];
      callbacks.onToken(token);
      await new Promise((r) => setTimeout(r, 18));
    }

    if (callbacks.onComplete) {
      callbacks.onComplete(responseText);
    }

    return responseText;
  }
}
