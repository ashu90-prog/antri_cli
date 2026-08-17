export interface ScrapedPage {
  url: string;
  title: string;
  markdown: string;
  links: string[];
  charCount: number;
}

export class WebScraper {
  private static userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  /**
   * Scrapes a URL, extracts primary article/documentation content, and converts to clean Markdown
   */
  public static async scrape(url: string, maxChars = 10000): Promise<ScrapedPage> {
    try {
      const parsedUrl = new URL(url);
      const res = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text') && !contentType.includes('html') && !contentType.includes('json')) {
        return {
          url,
          title: 'Binary Content',
          markdown: `[Content is binary/non-text: ${contentType}]`,
          links: [],
          charCount: 0,
        };
      }

      const rawHtml = await res.text();

      // Extract page title
      const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(rawHtml);
      const title = titleMatch ? this.cleanText(titleMatch[1]) : parsedUrl.hostname;

      // Extract all internal and external links
      const links = this.extractLinks(rawHtml, url);

      // Extract and convert main content to markdown
      let cleanMarkdown = this.htmlToMarkdown(rawHtml, parsedUrl);

      if (cleanMarkdown.length > maxChars) {
        cleanMarkdown = cleanMarkdown.slice(0, maxChars) + '\n\n... [Content Truncated]';
      }

      return {
        url,
        title,
        markdown: cleanMarkdown,
        links,
        charCount: cleanMarkdown.length,
      };
    } catch (err: any) {
      return {
        url,
        title: 'Error Scraping URL',
        markdown: `Failed to scrape ${url}: ${err.message}`,
        links: [],
        charCount: 0,
      };
    }
  }

  /**
   * Trafilatura / Readability-style HTML cleaner and Markdown converter
   */
  private static htmlToMarkdown(html: string, baseUrl: URL): string {
    let content = html;

    // 1. Remove non-content elements
    content = content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
      .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '')
      .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    // 2. Locate main content container if available
    const mainMatch = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(content) ||
                      /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(content) ||
                      /<div\b[^>]*(?:class|id)=["'][^"']*(?:content|docs|documentation|markdown|post|article|body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(content);

    if (mainMatch && mainMatch[1].length > 400) {
      content = mainMatch[1];
    }

    // 3. Preserve code blocks
    const codeBlocks: string[] = [];
    content = content.replace(/<pre[^>]*><code(?: class=["'](?:language-)?([a-zA-Z0-9_-]+)["'])?[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (match, lang, code) => {
      const cleanCode = this.cleanEntities(code);
      const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
      codeBlocks.push(`\`\`\`${lang || ''}\n${cleanCode}\n\`\`\``);
      return placeholder;
    });

    content = content.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (match, code) => {
      const cleanCode = this.cleanEntities(code);
      return ` \`${cleanCode.trim()}\` `;
    });

    // 4. Convert headings
    content = content
      .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n')
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n')
      .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n')
      .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n\n#### $1\n\n')
      .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n\n##### $1\n\n')
      .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n\n###### $1\n\n');

    // 5. Convert lists
    content = content
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n• $1')
      .replace(/<\/(ul|ol)>/gi, '\n\n');

    // 6. Convert links
    content = content.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (match, href, text) => {
      const cleanText = this.cleanText(text);
      if (!cleanText || cleanText.length < 2 || href.startsWith('#') || href.startsWith('javascript:')) {
        return cleanText;
      }
      try {
        const fullUrl = new URL(href, baseUrl).toString();
        return `[${cleanText}](${fullUrl})`;
      } catch {
        return cleanText;
      }
    });

    // 7. Convert text styles
    content = content
      .replace(/<(b|strong)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
      .replace(/<(i|em)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
      .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n> $1\n')
      .replace(/<hr[^>]*>/gi, '\n---\n')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<p[^>]*>/gi, '\n\n')
      .replace(/<\/p>/gi, '\n\n');

    // 8. Strip remaining HTML tags
    content = content.replace(/<[^>]+>/g, ' ');

    // 9. Restore code blocks
    codeBlocks.forEach((code, idx) => {
      content = content.replace(`__CODE_BLOCK_${idx}__`, `\n\n${code}\n\n`);
    });

    // 10. Normalize whitespace and clean entities
    content = this.cleanEntities(content);
    content = content
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .trim();

    return content;
  }

  private static extractLinks(html: string, currentUrl: string): string[] {
    const links: Set<string> = new Set();
    const linkRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
    let match: RegExpExecArray | null;

    const base = new URL(currentUrl);

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
        continue;
      }
      try {
        const resolved = new URL(href, base);
        // Only keep http/https links
        if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
          links.add(resolved.toString());
        }
      } catch {}
    }

    return Array.from(links);
  }

  private static cleanText(text: string): string {
    return this.cleanEntities(text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
  }

  private static cleanEntities(text: string): string {
    return text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–');
  }
}
