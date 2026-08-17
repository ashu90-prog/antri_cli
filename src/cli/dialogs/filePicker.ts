import fs from 'fs';
import path from 'path';

export interface FilePickerItem {
  name: string;
  relativePath: string;
  fullPath: string;
  isDirectory: boolean;
}

export class FilePickerService {
  /**
   * Scans a directory and returns sorted directories and files
   */
  public static listDirectory(
    baseDir: string,
    query: string = ''
  ): { currentDir: string; items: FilePickerItem[] } {
    let targetDir = baseDir;
    let filter = query;

    // Handle relative paths inside query (e.g. @src/cli or @../)
    if (query.includes('/') || query.includes('\\')) {
      const parts = query.split(/[/\\]/);
      filter = parts.pop() || '';
      const subPath = parts.join(path.sep);
      targetDir = path.resolve(baseDir, subPath);
    }

    if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
      targetDir = baseDir;
    }

    const items: FilePickerItem[] = [];

    // Add parent directory navigation if not root
    const parentDir = path.dirname(targetDir);
    if (parentDir !== targetDir) {
      items.push({
        name: '../',
        relativePath: '../',
        fullPath: parentDir,
        isDirectory: true,
      });
    }

    try {
      const entries = fs.readdirSync(targetDir, { withFileTypes: true });

      // Sort directories first, then files
      const dirs: FilePickerItem[] = [];
      const files: FilePickerItem[] = [];

      for (const entry of entries) {
        // Skip common large/binary/hidden folders from top-level clutter if not explicitly matching
        if (entry.name === '.git' || entry.name === 'node_modules') {
          if (!filter.toLowerCase().startsWith(entry.name.toLowerCase())) {
            continue;
          }
        }

        const fullPath = path.join(targetDir, entry.name);
        const relFromBase = path.relative(baseDir, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          dirs.push({
            name: entry.name + '/',
            relativePath: relFromBase + '/',
            fullPath,
            isDirectory: true,
          });
        } else {
          files.push({
            name: entry.name,
            relativePath: relFromBase,
            fullPath,
            isDirectory: false,
          });
        }
      }

      dirs.sort((a, b) => a.name.localeCompare(b.name));
      files.sort((a, b) => a.name.localeCompare(b.name));

      const combined = [...dirs, ...files];

      if (filter.trim()) {
        const q = filter.toLowerCase().trim();
        const filtered = combined.filter((i) =>
          i.name === '../' || i.name.toLowerCase().includes(q)
        );
        return { currentDir: targetDir, items: [items[0], ...filtered.filter(i => i.name !== '../')].filter(Boolean) };
      }

      return { currentDir: targetDir, items: [...items, ...combined] };
    } catch {
      return { currentDir: targetDir, items };
    }
  }

  /**
   * Resolves and reads attached files in user prompt
   */
  public static extractAndReadAttachments(
    prompt: string,
    baseDir: string
  ): { enhancedPrompt: string; attachedFiles: string[] } {
    // Regex matching @<path> tokens (e.g. @package.json, @src/core/agent.ts)
    const attachmentRegex = /(?:^|\s)@([a-zA-Z0-9_.\-\/\\]+)/g;
    const attachedFiles: string[] = [];
    const attachmentsContent: string[] = [];

    let match: RegExpExecArray | null;
    while ((match = attachmentRegex.exec(prompt)) !== null) {
      const relativePath = match[1];
      const fullPath = path.resolve(baseDir, relativePath);

      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          attachedFiles.push(relativePath);
          attachmentsContent.push(`[Attached File: ${relativePath}]\n\`\`\`\n${content}\n\`\`\``);
        } catch {
          // Ignore unreadable files
        }
      }
    }

    if (attachmentsContent.length === 0) {
      return { enhancedPrompt: prompt, attachedFiles: [] };
    }

    const enhancedPrompt = `${attachmentsContent.join('\n\n')}\n\nUser Question:\n${prompt}`;
    return { enhancedPrompt, attachedFiles };
  }
}
