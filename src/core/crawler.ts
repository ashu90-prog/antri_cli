import { WebScraper, ScrapedPage } from './scraper.js';

export interface CrawlResult {
  startUrl: string;
  pagesCrawled: number;
  combinedMarkdown: string;
  sources: { title: string; url: string; charCount: number }[];
}

export class DocCrawler {
  /**
   * Recursively crawls documentation pages starting from a root URL
   */
  public static async crawl(
    startUrl: string,
    maxPages = 4,
    maxDepth = 2
  ): Promise<CrawlResult> {
    const visited: Set<string> = new Set();
    const queue: { url: string; depth: number }[] = [{ url: startUrl, depth: 0 }];
    const scrapedPages: ScrapedPage[] = [];

    const root = new URL(startUrl);
    const allowedHost = root.hostname;

    while (queue.length > 0 && scrapedPages.length < maxPages) {
      const current = queue.shift();
      if (!current) break;

      const normalizedUrl = this.normalizeUrl(current.url);
      if (visited.has(normalizedUrl)) continue;
      visited.add(normalizedUrl);

      // Scrape current page
      const page = await WebScraper.scrape(current.url, 6000);
      if (page.charCount > 50) {
        scrapedPages.push(page);
      }

      // If within depth limit, find next doc links
      if (current.depth < maxDepth) {
        for (const link of page.links) {
          try {
            const parsed = new URL(link);
            // Same domain check
            if (parsed.hostname === allowedHost) {
              const normLink = this.normalizeUrl(link);
              if (!visited.has(normLink)) {
                // Prioritize docs, guide, api, tutorial paths
                const isDocLike =
                  parsed.pathname.includes('/doc') ||
                  parsed.pathname.includes('/guide') ||
                  parsed.pathname.includes('/api') ||
                  parsed.pathname.includes('/tutorial') ||
                  parsed.pathname.includes('/manual') ||
                  parsed.pathname.startsWith(root.pathname);

                if (isDocLike) {
                  queue.push({ url: link, depth: current.depth + 1 });
                }
              }
            }
          } catch {}
        }
      }
    }

    // Combine markdown documents into a coherent documentation knowledge base
    let combined = `# 📖 Crawled Documentation (${scrapedPages.length} pages from ${startUrl})\n\n`;
    const sources: { title: string; url: string; charCount: number }[] = [];

    for (let i = 0; i < scrapedPages.length; i++) {
      const p = scrapedPages[i];
      sources.push({ title: p.title, url: p.url, charCount: p.charCount });
      combined += `## [Source ${i + 1}] ${p.title}\n`;
      combined += `**URL:** ${p.url}\n\n`;
      combined += `${p.markdown}\n\n`;
      combined += `---\n\n`;
    }

    return {
      startUrl,
      pagesCrawled: scrapedPages.length,
      combinedMarkdown: combined,
      sources,
    };
  }

  private static normalizeUrl(url: string): string {
    try {
      const u = new URL(url);
      u.hash = '';
      if (u.pathname.endsWith('/') && u.pathname.length > 1) {
        u.pathname = u.pathname.slice(0, -1);
      }
      return u.toString();
    } catch {
      return url;
    }
  }
}
