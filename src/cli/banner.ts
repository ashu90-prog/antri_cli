import fs from 'fs';
import chalk from 'chalk';
import path from 'path';
import os from 'os';
import { AntriConfig } from '../types.js';

// Custom Chunky Block Font for ANTRI matching the aesthetic of Home.png
const BLOCK_LETTERS: Record<string, string[]> = {
  A: [
    '██████',
    '██  ██',
    '██████',
    '██  ██',
    '██  ██',
  ],
  N: [
    '███   ██',
    '████  ██',
    '██ ██ ██',
    '██  ████',
    '██   ███',
  ],
  T: [
    '████████',
    '   ██   ',
    '   ██   ',
    '   ██   ',
    '   ██   ',
  ],
  R: [
    '███████',
    '██   ██',
    '██████ ',
    '██  ██ ',
    '██   ██',
  ],
  I: [
    '██████',
    '  ██  ',
    '  ██  ',
    '  ██  ',
    '██████',
  ],
  ' ': [
    '   ',
    '   ',
    '   ',
    '   ',
    '   ',
  ],
};

/**
 * Formats working directory path as ~ if home or relative
 */
export function formatWorkingDir(dirPath: string): string {
  const home = os.homedir();
  if (dirPath.startsWith(home)) {
    const rel = dirPath.slice(home.length).replace(/\\/g, '/');
    return rel ? '~' + rel : '~';
  }
  return path.basename(dirPath) || '~';
}

/**
 * Renders the full ANTRI banner matching Home.png
 */
export function renderBanner(config: AntriConfig): void {
  const bg = chalk.bgRgb(37, 33, 73); // Purple background matching Home.png
  const fg = chalk.rgb(158, 170, 251); // Light lavender block font matching Home.png
  
  const word = 'ANTRI';
  const rows: string[] = ['', '', '', '', ''];

  for (let col = 0; col < word.length; col++) {
    const char = word[col];
    const letterMatrix = BLOCK_LETTERS[char] || BLOCK_LETTERS[' '];
    for (let r = 0; r < 5; r++) {
      rows[r] += letterMatrix[r] + (col < word.length - 1 ? '  ' : '');
    }
  }

  const contentWidth = rows[0].length;
  const paddingX = 3;
  const totalBoxWidth = contentWidth + (paddingX * 2);

  // Top padding row
  const emptyRow = ' '.repeat(totalBoxWidth);
  console.log(bg(emptyRow));

  // Letter rows with background
  for (let r = 0; r < 5; r++) {
    const line = ' '.repeat(paddingX) + rows[r] + ' '.repeat(paddingX);
    let coloredLine = '';
    for (const ch of line) {
      if (ch === '█') {
        coloredLine += fg(bg('█'));
      } else {
        coloredLine += bg(' ');
      }
    }
    console.log(coloredLine);
  }

  // Bottom padding row
  console.log(bg(emptyRow));
  console.log(); // Blank line

  // Metadata lines
  const commentHash = chalk.hex('#64748b')('#');
  const codeTitle = chalk.bold.white('ANTRI Code');
  const versionStr = chalk.hex('#94a3b8')(`v${config.version}`);
  const modeBadge = config.mode === 'plan' ? chalk.bgHex('#0284c7').bold.white(' PLAN MODE ') : chalk.bgHex('#7c3aed').bold.white(' VIBE MODE ');
  const permsBadge = config.alwaysAllow ? chalk.hex('#10b981')('· perms: always-allow') : chalk.hex('#f59e0b')('· perms: ask-first');

  let authBadge = '';
  try {
    const authFile = path.join(os.homedir(), '.antri', 'auth.json');
    if (fs.existsSync(authFile)) {
      const authData = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
      if (authData && authData.email) {
        authBadge = chalk.hex('#10b981')(`· ● logged in: ${authData.email}`);
      }
    }
  } catch {}

  if (!authBadge) {
    authBadge = chalk.hex('#f43f5e').bold('· ○ NOT LOGGED IN (Type /login to chat)');
  }

  console.log(`${commentHash} ${codeTitle} ${versionStr}  ${modeBadge} ${permsBadge}  ${authBadge}`);

  // Models line
  const modelsLabel = chalk.hex('#64748b')('models:');
  const activeModel = chalk.hex('#cbd5e1')(config.model);
  console.log(`${commentHash} ${modelsLabel} ${activeModel}`);

  // Working directory line
  const dirDisplay = formatWorkingDir(config.workingDir);
  console.log(`${commentHash} ${chalk.hex('#94a3b8')(dirDisplay)}`);
  console.log();
}

/**
 * Returns a styled horizontal divider string
 */
export function getDividerString(width = Math.max(40, Math.min(process.stdout.columns || 80, 95))): string {
  return chalk.hex('#334155')('─'.repeat(width));
}

/**
 * Renders the horizontal divider line
 */
export function renderDivider(): void {
  console.log(getDividerString());
}

/**
 * Renders the status bar footer (e.g. "? for shortcuts")
 */
export function renderFooter(): void {
  const shortcutHint = chalk.hex('#64748b')('? for shortcuts');
  console.log(shortcutHint);
}
