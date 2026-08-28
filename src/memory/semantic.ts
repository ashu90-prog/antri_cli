import fs from 'fs';
import path from 'path';
import os from 'os';
import { SemanticVectorItem } from './types.js';
import { VectorStore } from './vectorStore.js';

const MEMORY_DIR = path.join(os.homedir(), '.antri', 'memory');
const SEMANTIC_FILE = path.join(MEMORY_DIR, 'semantic_store.json');

export class SemanticMemory {
  private items: SemanticVectorItem[] = [];

  constructor() {
    this.ensureDirectory();
    this.load();
    this.seedInitialKnowledge();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(MEMORY_DIR)) {
      fs.mkdirSync(MEMORY_DIR, { recursive: true });
    }
  }

  private load(): void {
    try {
      if (fs.existsSync(SEMANTIC_FILE)) {
        const raw = fs.readFileSync(SEMANTIC_FILE, 'utf-8');
        this.items = JSON.parse(raw);
      }
    } catch {
      this.items = [];
    }
  }

  private save(): void {
    try {
      this.ensureDirectory();
      fs.writeFileSync(SEMANTIC_FILE, JSON.stringify(this.items, null, 2), 'utf-8');
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
