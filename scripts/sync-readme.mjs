#!/usr/bin/env node
/**
 * Automated README Synchronizer
 * Keeps README.md version badge and "What's New" release notes in 100% sync
 * with app.json and dist/releases/latest.json.
 *
 * Usage: node scripts/sync-readme.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const APP_JSON_PATH = path.resolve("app.json");
const MANIFEST_PATH = path.resolve("dist/releases/latest.json");
const README_PATH = path.resolve("README.md");

async function sync() {
  const appJson = JSON.parse(await readFile(APP_JSON_PATH, "utf8"));
  const version = appJson.expo.version;
  const versionCode = appJson.expo.android.versionCode;

  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const notes = Array.isArray(manifest.releaseNotes)
    ? manifest.releaseNotes
    : [];

  let readme = await readFile(README_PATH, "utf8");

  // 1. Update Version Badge
  const badgeRegex = /\[!\[Version\]\(https:\/\/img\.shields\.io\/badge\/version-[^)]+\)\]/g;
  const newBadge = `[![Version](https://img.shields.io/badge/version-${encodeURIComponent(version)}%20(Build%20${versionCode})-E11D48.svg)]`;
  readme = readme.replace(badgeRegex, newBadge);

  // 2. Update Direct APK link text
  const apkLinkRegex = /\[artha-[^\]]+\.apk\]\(https:\/\/artharen\.web\.app\/releases\/artha-latest\.apk\)/g;
  readme = readme.replace(apkLinkRegex, `[artha-${version}.apk](https://artharen.web.app/releases/artha-latest.apk)`);

  // 3. Update "What's New" section
  const notesMarkdown = notes.map((n) => `- ${n}`).join("\n");
  const whatsNewRegex = /## 🌟 What's New in [^\n]+[\s\S]*?(?=---)/;
  const newWhatsNew = `## 🌟 What's New in v${version} (Build ${versionCode})\n\n${notesMarkdown}\n\n`;
  
  if (whatsNewRegex.test(readme)) {
    readme = readme.replace(whatsNewRegex, newWhatsNew);
  }

  await writeFile(README_PATH, readme, "utf8");
  console.log(`✅ [sync-readme] README.md successfully synced to v${version} (Build ${versionCode})!`);
}

sync().catch((err) => {
  console.error("❌ Failed to sync README.md:", err);
  process.exit(1);
});
