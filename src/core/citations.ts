export interface CitationSource {
  id: number;
  title: string;
  url: string;
  snippet?: string;
  provider?: string;
}

export class CitationEngine {
  private sources: Map<string, CitationSource> = new Map();
  private nextId = 1;

  public addSource(title: string, url: string, snippet?: string, provider?: string): CitationSource {
    if (this.sources.has(url)) {
      return this.sources.get(url)!;
    }
    const source: CitationSource = {
      id: this.nextId++,
      title: title || url,
      url,
      snippet,
      provider,
    };
    this.sources.set(url, source);
    return source;
  }

  public getSources(): CitationSource[] {
    return Array.from(this.sources.values());
  }

  public clear(): void {
    this.sources.clear();
    this.nextId = 1;
  }

  /**
   * Generates a markdown bibliography block
   */
  public generateBibliography(): string {
    const list = this.getSources();
    if (list.length === 0) return '';

    let md = '\n\n### 📚 Sources & Citations\n';
    for (const s of list) {
      const prov = s.provider ? ` *(${s.provider})*` : '';
      md += `- [^${s.id}] [${s.title}](${s.url})${prov}\n`;
    }
    return md;
  }
}
