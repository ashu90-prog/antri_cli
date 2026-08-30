import fs from 'fs';
import path from 'path';
import os from 'os';
import { SemanticVectorItem } from './types.js';
import { VectorStore } from './vectorStore.js';

function getCurrentUserId(): string {
  try {
    const authPath = path.join(os.homedir(), '.antri', 'auth.json');
    if (fs.existsSync(authPath)) {
      const raw = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
      const user = raw.user || raw;
      if (user && user.email && typeof user.email === 'string') {
        const clean = user.email.toLowerCase().trim();
        return user.userId || clean.replace(/[^a-z0-9_]/g, '_');
      }
    }
  } catch (_) {}
  return 'default_user';
}

export class SemanticMemory {
  private customDir?: string;
  private currentUserId: string = 'default_user';
  private items: SemanticVectorItem[] = [];

  constructor(customDir?: string) {
    this.customDir = customDir;
    this.currentUserId = customDir ? 'custom' : getCurrentUserId();
    this.ensureDirectory();
    this.load();
    this.seedInitialKnowledge();
  }

  public switchUser(userId?: string): void {
    this.currentUserId = userId || getCurrentUserId();
    this.ensureDirectory();
    this.load();
    this.seedInitialKnowledge();
  }

  public getMemoryDir(): string {
    if (this.customDir) return this.customDir;
    const uid = this.currentUserId || getCurrentUserId();
    const dir = path.join(os.homedir(), '.antri', 'partitions', uid, 'memory');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  public getSemanticFile(): string {
    return path.join(this.getMemoryDir(), 'semantic_store.json');
  }

  private ensureDirectory(): void {
    const dir = this.getMemoryDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private load(): void {
    try {
      const file = this.getSemanticFile();
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf-8');
        this.items = JSON.parse(raw);
      } else {
        this.items = [];
      }
    } catch {
      this.items = [];
    }
  }

  private save(): void {
    try {
      this.ensureDirectory();
      fs.writeFileSync(this.getSemanticFile(), JSON.stringify(this.items, null, 2), 'utf-8');
    } catch {}
  }

  /**
   * Indexes a new knowledge snippet into the vector store
   */
  public async store(
    text: string,
    category: SemanticVectorItem['category'] = 'lesson_learned',
    metadata: SemanticVectorItem['metadata'] = {},
    geminiApiKey?: string
  ): Promise<SemanticVectorItem> {
    const vector = await VectorStore.generateEmbedding(text, geminiApiKey);
    const item: SemanticVectorItem = {
      id: `sem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      text,
      category,
      vector,
      metadata,
    };

    this.items.push(item);
    this.save();
    return item;
  }

  /**
   * Performs semantic vector cosine similarity search
   */
  public async search(
    query: string,
    topK = 3,
    threshold = 0.25,
    geminiApiKey?: string
  ): Promise<{ item: SemanticVectorItem; similarity: number }[]> {
    if (this.items.length === 0) return [];

    const queryVector = await VectorStore.generateEmbedding(query, geminiApiKey);

    const scored = this.items.map((item) => {
      const similarity = VectorStore.cosineSimilarity(queryVector, item.vector);
      return { item, similarity };
    });

    return scored
      .filter((s) => s.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  public count(): number {
    return this.items.length;
  }

  public getAll(): SemanticVectorItem[] {
    return this.items;
  }

  public clear(): void {
    this.items = [];
    this.save();
  }

  private async seedInitialKnowledge(): Promise<void> {
    if (this.items.length === 0) {
      const initialNuggets: { text: string; category: SemanticVectorItem['category'] }[] = [
        {
          text: 'In TypeScript projects with NodeNext ESM modules, always use .js file extensions in relative imports even when authoring .ts source files.',
          category: 'architecture_insight',
        },
        {
          text: 'When performing raw-mode terminal line erasure, using upward relative movement without extra newlines prevents off-by-one cursor overwrites.',
          category: 'problem_solution',
        },
        {
          text: 'NVIDIA NIM endpoints on standard developer accounts execute ultra-fast inference on meta/llama-3.1-8b-instruct and Step 3.7 Flash models.',
          category: 'api_guide',
        },
      ];

      for (const nug of initialNuggets) {
        await this.store(nug.text, nug.category, { tags: ['best-practices'] });
      }
    }
  }
}
