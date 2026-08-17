#!/usr/bin/env node

/**
 * ANTRI Mobile APK Build & Packaging Utility
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('\n========================================');
console.log('⚡ ANTRI MOBILE APK BUILD PIPELINE ⚡');
console.log('========================================\n');

// 1. Sync WWW Assets to Android Project
console.log('📦 Step 1: Syncing web bundle to Android APK assets...');
const wwwDir = path.join(rootDir, 'www');
const androidAssetsDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'public');

fs.mkdirSync(androidAssetsDir, { recursive: true });
fs.cpSync(wwwDir, androidAssetsDir, { recursive: true, force: true });
console.log('✅ Web bundle synchronized successfully.\n');

// 2. Check Gradle / Android SDK
console.log('🔨 Step 2: Checking Android build tools (Gradle / Android Studio)...');
const isWindows = process.platform === 'win32';
const gradlewCmd = isWindows ? path.join(rootDir, 'android', 'gradlew.bat') : path.join(rootDir, 'android', 'gradlew');

if (fs.existsSync(gradlewCmd)) {
  console.log('Found Gradle wrapper at:', gradlewCmd);
  console.log('To assemble the debug APK, run:');
  console.log(`cd ${path.join(rootDir, 'android')} && ./gradlew assembleDebug\n`);
} else {
  console.log('Android Project configured in:', path.join(rootDir, 'android'));
}

console.log('========================================');
console.log('📱 HOW TO GENERATE & RUN THE APK:');
console.log('========================================');
console.log('Option 1 (Android Studio - Recommended):');
console.log('  1. Open Android Studio -> "Open an Existing Project"');
console.log(`  2. Select directory: ${path.join(rootDir, 'android')}`);
console.log('  3. Click "Build" -> "Build Bundle(s) / APK(s)" -> "Build APK(s)"');
console.log('  4. Your APK will be generated at:');
console.log('     android/app/build/outputs/apk/debug/app-debug.apk\n');

console.log('Option 2 (Command Line with Android SDK & Java):');
console.log(`  cd ${path.join(rootDir, 'android')}`);
console.log('  ./gradlew assembleDebug');
console.log('========================================\n');
