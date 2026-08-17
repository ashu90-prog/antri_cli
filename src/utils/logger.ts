import chalk from 'chalk';

export const colors = {
  primary: chalk.hex('#a5b4fc'),      // Lavender/periwinkle from banner
  primaryDark: chalk.hex('#6366f1'),  // Deep indigo
  bannerBg: chalk.bgHex('#242048'),   // Purple background for banner
  secondary: chalk.hex('#38bdf8'),    // Bright cyan/teal for "taste on"
  text: chalk.hex('#f8fafc'),         // Off-white
  dim: chalk.hex('#64748b'),          // Slate gray for meta / shortcuts
  accent: chalk.hex('#c084fc'),       // Purple accent
  success: chalk.hex('#4ade80'),      // Green
  warning: chalk.hex('#fbbf24'),      // Amber
  error: chalk.hex('#f87171'),        // Red
  border: chalk.hex('#334155'),       // Dark slate divider
  code: chalk.hex('#e2e8f0'),         // Code snippet color
};

export const log = {
  info: (msg: string) => console.log(colors.dim('ℹ ') + msg),
  success: (msg: string) => console.log(colors.success('✔ ') + msg),
  warn: (msg: string) => console.log(colors.warning('▲ ') + msg),
  error: (msg: string) => console.error(colors.error('✖ ') + msg),
  plain: (msg: string) => console.log(msg),
  divider: (width = Math.min(process.stdout.columns || 80, 80)) => {
    console.log(colors.border('─'.repeat(width)));
  },
};
