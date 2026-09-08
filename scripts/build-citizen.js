#!/usr/bin/env node
/**
 * scripts/build-citizen.js
 * Prepares the clean, dedicated "citizen-dist" directory for Capacitor Android packaging.
 * Ensures the APK entrypoint (index.html) is 100% the SENTINEL Citizen Safety App,
 * stripped of all desktop mockup frames, fake status notches, and Command Center artifacts.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const DIST_DIR = path.join(ROOT_DIR, 'citizen-dist');

console.log('🚀 Building clean Citizen Mobile App bundle in citizen-dist/ ...');

// 1. Ensure fresh citizen-dist directory
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });

// 2. Read citizen.html and transform for Native Android APK
let citizenHtml = fs.readFileSync(path.join(FRONTEND_DIR, 'citizen.html'), 'utf8');

// Ensure native app class on body
citizenHtml = citizenHtml.replace(
  '<body>',
  '<body class="is-native-app">'
);

// Remove the SIH Presentation Switcher banner for native mobile app
citizenHtml = citizenHtml.replace(
  /<!-- Switcher for SIH presentation judges -->[\s\S]*?<\/div>/i,
  '<!-- Switcher hidden in Native Android APK -->'
);

// Remove fake status bar / fake notch (Android handles native status bar)
citizenHtml = citizenHtml.replace(
  /<!-- Phone Status Bar -->[\s\S]*?<\/div>\s*<\/div>/i,
  '<!-- Native Android Status Bar Used -->'
);

// Write to citizen-dist/index.html (Capacitor default launch target)
fs.writeFileSync(path.join(DIST_DIR, 'index.html'), citizenHtml, 'utf8');
console.log('  ✅ Generated citizen-dist/index.html (Citizen App Entry Point)');

// 3. Copy citizen.css
let citizenCss = fs.readFileSync(path.join(FRONTEND_DIR, 'citizen.css'), 'utf8');
fs.writeFileSync(path.join(DIST_DIR, 'citizen.css'), citizenCss, 'utf8');
console.log('  ✅ Copied citizen-dist/citizen.css');

// 4. Copy citizen.js
let citizenJs = fs.readFileSync(path.join(FRONTEND_DIR, 'citizen.js'), 'utf8');
fs.writeFileSync(path.join(DIST_DIR, 'citizen.js'), citizenJs, 'utf8');
console.log('  ✅ Copied citizen-dist/citizen.js');

// 5. Copy manifest.json if exists
if (fs.existsSync(path.join(FRONTEND_DIR, 'manifest.json'))) {
  fs.copyFileSync(
    path.join(FRONTEND_DIR, 'manifest.json'),
    path.join(DIST_DIR, 'manifest.json')
  );
  console.log('  ✅ Copied citizen-dist/manifest.json');
}

console.log('✨ Citizen mobile bundle ready for Capacitor sync! ✨');
