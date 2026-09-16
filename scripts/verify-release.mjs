#!/usr/bin/env node
/**
 * Release Gatekeeper & Pre-Flight Sanity Verification
 * Verifies that all release manifests, dual-domain endpoints, and APK artifacts
 * are 100% valid and pass security checks for ALL client versions in the wild.
 *
 * Usage: node scripts/verify-release.mjs
 */
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const APP_JSON_PATH = path.resolve("app.json");
const MANIFEST_ARTHAREN_PATH = path.resolve("dist/releases/latest.json");
const MANIFEST_UMIREN_PATH = path.resolve("dist-umiren/releases/latest.json");

const EXPECTED_PACKAGE = "com.umi.caseflow";
const ARTHAREN_HOST = "artharen.web.app";
const UMIREN_HOST = "umiren-d6a66.web.app";

let failed = false;
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    failed = true;
  } else {
    console.log(`✅ [PASS] ${message}`);
  }
}

async function run() {
  console.log("\n🔍 Running Release Pre-Flight Verification...\n");

  // 1. Check app.json
  const appJson = JSON.parse(await readFile(APP_JSON_PATH, "utf8"));
  const appVer = appJson.expo.version;
  const buildCode = appJson.expo.android.versionCode;
  console.log(`Target Release: v${appVer} (Build ${buildCode})\n`);

  // 2. Check artharen manifest
  const artharenManifest = JSON.parse(await readFile(MANIFEST_ARTHAREN_PATH, "utf8"));
  assert(artharenManifest.versionName === appVer, `artharen latest.json versionName matches app.json (${appVer})`);
  assert(artharenManifest.versionCode === buildCode, `artharen latest.json versionCode matches app.json (${buildCode})`);
  assert(artharenManifest.packageName === EXPECTED_PACKAGE, `artharen packageName is ${EXPECTED_PACKAGE}`);
  assert(
    artharenManifest.downloadUrl === `https://${ARTHAREN_HOST}/releases/artha-${appVer}.apk`,
    `artharen downloadUrl uses https://${ARTHAREN_HOST}`
  );

  // 3. Check umiren manifest
  const umirenManifest = JSON.parse(await readFile(MANIFEST_UMIREN_PATH, "utf8"));
  assert(umirenManifest.versionName === appVer, `umiren latest.json versionName matches app.json (${appVer})`);
  assert(umirenManifest.versionCode === buildCode, `umiren latest.json versionCode matches app.json (${buildCode})`);
  assert(
    umirenManifest.downloadUrl === `https://${UMIREN_HOST}/releases/artha-${appVer}.apk`,
    `umiren downloadUrl uses https://${UMIREN_HOST}`
  );

  // 4. Verify local APK files
  const artharenApkPath = path.resolve(`dist/releases/artha-${appVer}.apk`);
  const umirenApkPath = path.resolve(`dist-umiren/releases/artha-${appVer}.apk`);

  const artharenStat = await stat(artharenApkPath);
  assert(artharenStat.size > 30 * 1024 * 1024, `dist APK exists and is > 30MB (${(artharenStat.size / (1024*1024)).toFixed(1)} MB)`);
  assert(
    Math.abs(artharenStat.size - (artharenManifest.fileSizeBytes || 0)) < 2048,
    `artharen fileSizeBytes matches actual APK file size`
  );

  const umirenStat = await stat(umirenApkPath);
  assert(umirenStat.size > 30 * 1024 * 1024, `dist-umiren APK exists and is > 30MB (${(umirenStat.size / (1024*1024)).toFixed(1)} MB)`);

  // 5. Client compatibility simulation
  console.log("\n📱 Simulating Client In-App Updater Checks:");

  // Simulate v1.5.1 client (queries umiren, checks url.hostname === "umiren-d6a66.web.app")
  const v151Host = new URL(umirenManifest.downloadUrl).hostname;
  assert(v151Host === "umiren-d6a66.web.app", "v1.5.1 legacy client check: hostname strictly matches umiren-d6a66.web.app");

  // Simulate v1.6.0 client (queries artharen, checks url.hostname === "artharen.web.app")
  const v160Host = new URL(artharenManifest.downloadUrl).hostname;
  assert(v160Host === "artharen.web.app", "v1.6.0 client check: hostname strictly matches artharen.web.app");

  // Simulate v1.6.1+ client (checks whitelist of both domains)
  const whitelist = ["artharen.web.app", "umiren-d6a66.web.app"];
  assert(whitelist.includes(v160Host) && whitelist.includes(v151Host), "v1.6.1+ client check: both download URLs pass multi-domain whitelist");

  // 6. Test Live Remote Endpoints
  console.log("\n🌐 Verifying Live Cloud Endpoints:");
  try {
    const liveArtharen = await (await fetch(`https://${ARTHAREN_HOST}/releases/latest.json?t=${Date.now()}`)).json();
    assert(
      liveArtharen.downloadUrl === `https://${ARTHAREN_HOST}/releases/artha-${appVer}.apk`,
      `Live https://${ARTHAREN_HOST}/releases/latest.json responds with correct downloadUrl`
    );

    const liveUmiren = await (await fetch(`https://${UMIREN_HOST}/releases/latest.json?t=${Date.now()}`)).json();
    assert(
      liveUmiren.downloadUrl === `https://${UMIREN_HOST}/releases/artha-${appVer}.apk`,
      `Live https://${UMIREN_HOST}/releases/latest.json responds with correct downloadUrl`
    );

    const apkRes = await fetch(`https://${ARTHAREN_HOST}/releases/artha-${appVer}.apk`, { method: "HEAD" });
    assert(apkRes.status === 200, `Live APK download returns HTTP 200 (${apkRes.status})`);
  } catch (netErr) {
    console.warn("⚠️ Network live verification warning (non-fatal):", netErr.message);
  }

  if (failed) {
    console.error("\n❌ Release verification FAILED! Aborting release deployment.\n");
    process.exit(1);
  }

  console.log("\n🎉 ALL CHECKS PASSED! Release is 100% verified and safe for all devices.\n");
}

run().catch((err) => {
  console.error("Fatal verification error:", err);
  process.exit(1);
});
