export class VectorStore {
  private static readonly VECTOR_DIM = 128;

  /**
   * Generates a normalized semantic embedding vector for a given text
   */
  public static async generateEmbedding(text: string, geminiApiKey?: string): Promise<number[]> {
    // 1. Try Gemini Embeddings API if key is available
    if (geminiApiKey) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'models/text-embedding-004',
              content: { parts: [{ text }] },
            }),
            signal: AbortSignal.timeout(3000),
          }
        );
        if (res.ok) {
          const data = (await res.json()) as any;
          if (data.embedding?.values && Array.isArray(data.embedding.values)) {
            return this.normalize(data.embedding.values.slice(0, this.VECTOR_DIM));
          }
        }
      } catch {
        // Fallback to local semantic vectorizer
      }
    }

    // 2. High-performance deterministic Semantic Bag-of-Subwords & N-gram Vectorizer
    return this.generateLocalSemanticVector(text);
  }

  /**
   * Generates a 128-dimensional dense semantic feature vector
   */
  private static generateLocalSemanticVector(text: string): number[] {
    const vector = new Array(this.VECTOR_DIM).fill(0);
    const cleaned = text.toLowerCase().replace(/[^a-z0-9_\-\s]/g, ' ');
    const tokens = cleaned.split(/\s+/).filter((t) => t.length > 1);

    if (tokens.length === 0) return vector;

    // Token frequency & semantic hash projection
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const weight = 1 / Math.sqrt(i + 1);

      // Unigram hash
      const h1 = this.hashString(token);
      const idx1 = Math.abs(h1) % this.VECTOR_DIM;
      vector[idx1] += (h1 > 0 ? 1 : -1) * weight * 1.5;

      // Bigram hash if possible
      if (i < tokens.length - 1) {
        const bigram = `${token}_${tokens[i + 1]}`;
        const h2 = this.hashString(bigram);
        const idx2 = Math.abs(h2) % this.VECTOR_DIM;
        vector[idx2] += (h2 > 0 ? 1 : -1) * weight * 2.0;
      }

      // Subword character trigrams
      for (let j = 0; j <= token.length - 3; j++) {
        const tri = token.slice(j, j + 3);
        const h3 = this.hashString(tri);
        const idx3 = Math.abs(h3) % this.VECTOR_DIM;
        vector[idx3] += (h3 > 0 ? 1 : -1) * 0.4;
      }
    }

    return this.normalize(vector);
  }

  /**
   * Calculates cosine similarity between two vectors (-1.0 to 1.0)
   */
  public static cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length === 0 || b.length === 0) return 0;
    const len = Math.min(a.length, b.length);
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private static normalize(vec: number[]): number[] {
    let norm = 0;
    for (const v of vec) norm += v * v;
    norm = Math.sqrt(norm);
    if (norm === 0) return vec;
    return vec.map((v) => v / norm);
  }

  private static hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return hash;
  }
}
