export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export class WebSearchEngine {
  private static userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  /**
   * Autonomous Multi-Provider Web Search (Zero API Key required)
   */
  public static async search(query: string, maxResults = 5): Promise<SearchResult[]> {
    // 1. Try DuckDuckGo HTML Search
    try {
      const ddgResults = await this.searchDuckDuckGo(query, maxResults);
      if (ddgResults.length > 0) {
        return ddgResults;
      }
    } catch {
      // Fallback
    }

    // 2. Try SearXNG Public Instances
    try {
      const searxResults = await this.searchSearXNG(query, maxResults);
      if (searxResults.length > 0) {
        return searxResults;
      }
    } catch {
      // Fallback
    }

    // 3. Try DuckDuckGo Lite Search
    try {
      const liteResults = await this.searchDuckDuckGoLite(query, maxResults);
      if (liteResults.length > 0) {
        return liteResults;
      }
    } catch {
      // Fallback
    }

    return [];
  }

  /**
   * DuckDuckGo HTML Search Scraper (Free, No API Key)
   */
  private static async searchDuckDuckGo(query: string, maxResults: number): Promise<SearchResult[]> {
    const url = 'https://html.duckduckgo.com/html/';
    const body = new URLSearchParams({ q: query, b: '' }).toString();

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': this.userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      body,
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return [];

    const html = await res.text();
    const results: SearchResult[] = [];

    // Parse DuckDuckGo result blocks
    // Pattern: class="result__snippet"... and class="result__url"
    const resultBlockRegex = /<div[^>]*class="[^"]*result__body[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
    let match: RegExpExecArray | null;

    while ((match = resultBlockRegex.exec(html)) !== null && results.length < maxResults) {
      const block = match[1];

      // Extract title and link
      const titleMatch = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i.exec(block) ||
                         /<a[^>]*class="[^"]*result__url[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block) ||
                         /<a[^>]*href="([^"]*uddg=([^"&]+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/i.exec(block);

      const linkMatch = /href="([^"]*uddg=([^"&]+)[^"]*)"/i.exec(block) ||
                        /href="([^"]+)"/i.exec(block);

      const snippetMatch = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i.exec(block) ||
                           /<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(block);

      let rawUrl = linkMatch ? linkMatch[1] : '';
      if (rawUrl.includes('uddg=')) {
        const uddgPart = rawUrl.split('uddg=')[1]?.split('&')[0];
        if (uddgPart) {
          try {
            rawUrl = decodeURIComponent(uddgPart);
          } catch {}
        }
      }

      if (rawUrl.startsWith('//')) rawUrl = 'https:' + rawUrl;

      // Extract text
      const rawTitle = titleMatch ? titleMatch[3] || titleMatch[2] || titleMatch[1] || '' : '';
      const rawSnippet = snippetMatch ? snippetMatch[1] : '';

      const title = this.stripHtml(rawTitle);
      const snippet = this.stripHtml(rawSnippet);

      if (rawUrl && rawUrl.startsWith('http') && (title || snippet)) {
        results.push({
          title: title || rawUrl,
          url: rawUrl,
          snippet: snippet || title,
          source: 'DuckDuckGo',
        });
      }
    }

    // Secondary parsing regex if specific class was slightly altered
    if (results.length === 0) {
      const simpleLinkRegex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
      let sMatch: RegExpExecArray | null;
      while ((sMatch = simpleLinkRegex.exec(html)) !== null && results.length < maxResults) {
        let rawUrl = sMatch[1];
        if (rawUrl.includes('uddg=')) {
          const uddgPart = rawUrl.split('uddg=')[1]?.split('&')[0];
          if (uddgPart) {
            try { rawUrl = decodeURIComponent(uddgPart); } catch {}
          }
        }
        const title = this.stripHtml(sMatch[2]);
        const snippet = this.stripHtml(sMatch[3]);
        if (rawUrl.startsWith('http')) {
          results.push({ title, url: rawUrl, snippet, source: 'DuckDuckGo' });
        }
      }
    }

    return results;
  }

  /**
   * DuckDuckGo Lite Search (Fast fallback, No API Key)
   */
  private static async searchDuckDuckGoLite(query: string, maxResults: number): Promise<SearchResult[]> {
    const url = `https://lite.duckduckgo.com/lite/`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': this.userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ q: query }).toString(),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return [];
    const html = await res.text();
    const results: SearchResult[] = [];

    const linkRegex = /<a[^>]*class="result-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;

    const links: { url: string; title: string }[] = [];
    let lMatch: RegExpExecArray | null;
    while ((lMatch = linkRegex.exec(html)) !== null) {
      let rawUrl = lMatch[1];
      if (rawUrl.includes('uddg=')) {
        const u = rawUrl.split('uddg=')[1]?.split('&')[0];
        if (u) {
          try { rawUrl = decodeURIComponent(u); } catch {}
        }
      }
      links.push({ url: rawUrl, title: this.stripHtml(lMatch[2]) });
    }

    const snippets: string[] = [];
    let sMatch: RegExpExecArray | null;
    while ((sMatch = snippetRegex.exec(html)) !== null) {
      snippets.push(this.stripHtml(sMatch[1]));
    }

    for (let i = 0; i < Math.min(links.length, maxResults); i++) {
      if (links[i].url.startsWith('http')) {
        results.push({
          title: links[i].title,
          url: links[i].url,
          snippet: snippets[i] || links[i].title,
          source: 'DuckDuckGo Lite',
        });
      }
    }

    return results;
  }

  /**
   * Public SearXNG Instances (JSON API, No Key)
   */
  private static async searchSearXNG(query: string, maxResults: number): Promise<SearchResult[]> {
    const instances = [
      'https://search.ononoki.org',
      'https://searx.be',
      'https://search.sapti.me',
    ];

    for (const inst of instances) {
      try {
        const res = await fetch(`${inst}/search?q=${encodeURIComponent(query)}&format=json`, {
          headers: { 'User-Agent': this.userAgent },
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          if (data.results && Array.isArray(data.results) && data.results.length > 0) {
            return data.results.slice(0, maxResults).map((r: any) => ({
              title: r.title || 'No Title',
              url: r.url || '',
              snippet: r.content || r.title || '',
              source: 'SearXNG',
            }));
          }
        }
      } catch {
        // Try next instance
      }
    }
    return [];
  }

  private static stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }
}
