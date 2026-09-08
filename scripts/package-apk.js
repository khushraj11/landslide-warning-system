#!/usr/bin/env node
/**
 * scripts/package-apk.js
 * Packages the Citizen Disaster Safety App into sentinel-citizen.apk.
 * Injects the clean, responsive citizen-dist bundle into assets/public/
 * and signs the APK with the Android debug keystore.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'citizen-dist');
const BASE_APK = path.join(ROOT_DIR, 'sentinel-citizen.apk');
const OUT_APK = path.join(ROOT_DIR, 'sentinel-citizen.apk');
const BUILD_OUTPUT_DIR = path.join(ROOT_DIR, 'build_output');
const ANDROID_OUTPUT_DIR = path.join(ROOT_DIR, 'android/app/build/outputs/apk/debug');
const STAGING_DIR = path.join('/tmp', 'sentinel_citizen_apk_staging_' + Date.now());

const JAVA_BIN = '/opt/homebrew/opt/openjdk@17/bin';
const JARSIGNER = path.join(JAVA_BIN, 'jarsigner');
const KEYSTORE = path.join(process.env.HOME, '.android/debug.keystore');

console.log('🚀 Starting Citizen App APK Packaging Pipeline...');

// 1. Ensure citizen-dist is built
console.log('1️⃣ Building fresh citizen-dist bundle...');
execSync('node scripts/build-citizen.js', { cwd: ROOT_DIR, stdio: 'inherit' });

// 2. Sync with Capacitor
console.log('2️⃣ Running Capacitor Sync...');
execSync('npx cap sync android', { cwd: ROOT_DIR, stdio: 'inherit' });

if (!fs.existsSync(BASE_APK)) {
  console.error('❌ Base APK not found at: ' + BASE_APK);
  process.exit(1);
}

// 3. Staging and repackaging
console.log('3️⃣ Unpacking APK into temporary staging area...');
if (fs.existsSync(STAGING_DIR)) fs.rmSync(STAGING_DIR, { recursive: true, force: true });
fs.mkdirSync(STAGING_DIR, { recursive: true });

execSync(`unzip -q "${BASE_APK}" -d "${STAGING_DIR}"`, { stdio: 'inherit' });

console.log('4️⃣ Replacing web assets with ONLY Citizen App...');
const targetAssetsPublic = path.join(STAGING_DIR, 'assets', 'public');
if (fs.existsSync(targetAssetsPublic)) {
  fs.rmSync(targetAssetsPublic, { recursive: true, force: true });
}
fs.mkdirSync(targetAssetsPublic, { recursive: true });

// Copy all files from citizen-dist
const distFiles = fs.readdirSync(DIST_DIR);
for (const file of distFiles) {
  const src = path.join(DIST_DIR, file);
  const dest = path.join(targetAssetsPublic, file);
  fs.copyFileSync(src, dest);
  console.log(`  ➕ Injected ${file} -> assets/public/${file}`);
}

// Ensure capacitor.config.json in assets points to citizen-dist
const capConfigPath = path.join(STAGING_DIR, 'assets', 'capacitor.config.json');
if (fs.existsSync(capConfigPath)) {
  const cfg = JSON.parse(fs.readFileSync(capConfigPath, 'utf8'));
  cfg.webDir = 'citizen-dist';
  fs.writeFileSync(capConfigPath, JSON.stringify(cfg, null, 2), 'utf8');
}

// 5. Remove existing signatures
console.log('5️⃣ Stripping outdated signatures...');
const metaInfDir = path.join(STAGING_DIR, 'META-INF');
if (fs.existsSync(metaInfDir)) {
  const metaFiles = fs.readdirSync(metaInfDir);
  for (const f of metaFiles) {
    if (f.endsWith('.SF') || f.endsWith('.RSA') || f.endsWith('.DSA') || f.endsWith('.MF')) {
      fs.unlinkSync(path.join(metaInfDir, f));
    }
  }
}

// 6. Zip repackaged APK
console.log('6️⃣ Repackaging APK zip...');
const tempApkPath = path.join('/tmp', 'sentinel-citizen-unsigned.apk');
if (fs.existsSync(tempApkPath)) fs.unlinkSync(tempApkPath);

execSync(`cd "${STAGING_DIR}" && zip -q -r "${tempApkPath}" .`, { stdio: 'inherit' });

// 7. Sign APK with debug keystore
console.log('7️⃣ Signing APK with Android debug keystore...');
execSync(
  `"${JARSIGNER}" -keystore "${KEYSTORE}" -storepass android -keypass android -sigalg SHA256withRSA -digestalg SHA-256 "${tempApkPath}" androiddebugkey`,
  { stdio: 'inherit' }
);

// 8. Verify signature
console.log('8️⃣ Verifying APK signature...');
execSync(`"${JARSIGNER}" -verify "${tempApkPath}"`, { stdio: 'inherit' });
console.log('  ✅ APK Signature Verified Successfully!');

// 9. Move into destination locations
console.log('9️⃣ Staging final APK to target paths...');
fs.copyFileSync(tempApkPath, OUT_APK);
console.log(`  ✅ Staged: ${OUT_APK}`);

fs.mkdirSync(BUILD_OUTPUT_DIR, { recursive: true });
fs.copyFileSync(tempApkPath, path.join(BUILD_OUTPUT_DIR, 'sentinel-citizen.apk'));
console.log(`  ✅ Staged: ${path.join(BUILD_OUTPUT_DIR, 'sentinel-citizen.apk')}`);

fs.mkdirSync(ANDROID_OUTPUT_DIR, { recursive: true });
fs.copyFileSync(tempApkPath, path.join(ANDROID_OUTPUT_DIR, 'app-debug.apk'));
console.log(`  ✅ Staged: ${path.join(ANDROID_OUTPUT_DIR, 'app-debug.apk')}`);

// Clean up staging
fs.rmSync(STAGING_DIR, { recursive: true, force: true });
fs.unlinkSync(tempApkPath);

console.log('\n🎉 SUCCESS! SENTINEL Citizen APK is ready for installation!');
console.log(`📦 Size: ${(fs.statSync(OUT_APK).size / (1024 * 1024)).toFixed(2)} MB`);
