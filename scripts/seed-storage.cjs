/**
 * Seed the local object storage emulator with the files exported from Replit
 * (scripts/storage-backup). Run once after `docker compose up -d`:
 *
 *   npm run storage:seed
 *
 * Reads GCS_EMULATOR_URL and PRIVATE_OBJECT_DIR from .env.
 * Idempotent: files that already exist in the bucket are skipped.
 */
require("dotenv/config");
const { Storage } = require("@google-cloud/storage");
const fs = require("fs");
const path = require("path");

const BACKUP_DIR = path.join(__dirname, "storage-backup");

function walkDir(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(fullPath));
    else if (!entry.name.endsWith(".meta.json") && entry.name !== ".DS_Store") results.push(fullPath);
  }
  return results;
}

async function main() {
  const emulatorHost = process.env.GCS_EMULATOR_URL || "";
  const privateObjectDir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!emulatorHost) {
    console.error("GCS_EMULATOR_URL not set (expected e.g. http://localhost:4443). Refusing to run against real GCS.");
    process.exit(1);
  }
  if (!privateObjectDir) {
    console.error("PRIVATE_OBJECT_DIR not set (expected e.g. /renix-local/.private).");
    process.exit(1);
  }

  const parts = privateObjectDir.replace(/^\//, "").split("/");
  const bucketName = parts[0];
  const prefix = parts.slice(1).join("/"); // e.g. ".private"

  const storage = new Storage({
    apiEndpoint: emulatorHost.startsWith("http") ? emulatorHost : `http://${emulatorHost}`,
    projectId: "local-dev",
  });
  const bucket = storage.bucket(bucketName);
  const [exists] = await bucket.exists();
  if (!exists) {
    await bucket.create();
    console.log(`Created bucket ${bucketName}`);
  }

  // The backup was taken from a PRIVATE_OBJECT_DIR ending in ".private", so the
  // backup tree is "<.private>/projects/..." and maps 1:1 onto object names.
  const backupRoot = fs.existsSync(path.join(BACKUP_DIR, prefix)) ? BACKUP_DIR : path.join(BACKUP_DIR, "..");
  const files = walkDir(BACKUP_DIR);
  console.log(`Bucket: ${bucketName}  prefix: ${prefix}  files: ${files.length}`);

  let uploaded = 0, existed = 0, failed = 0;
  const CONCURRENCY = 10;
  for (let i = 0; i < files.length; i += CONCURRENCY) {
    await Promise.all(files.slice(i, i + CONCURRENCY).map(async (localPath) => {
      const objectName = path.relative(backupRoot, localPath).split(path.sep).join("/");
      const metaPath = localPath + ".meta.json";
      let contentType = "application/octet-stream";
      let customMetadata = {};
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
          contentType = meta.contentType || contentType;
          customMetadata = meta.customMetadata || {};
        } catch {}
      }
      try {
        const file = bucket.file(objectName);
        const [fileExists] = await file.exists();
        if (fileExists) { existed++; return; }
        await file.save(fs.readFileSync(localPath), {
          contentType,
          resumable: false,
          metadata: { metadata: customMetadata },
        });
        uploaded++;
      } catch (err) {
        failed++;
        console.error(`FAILED ${objectName}: ${err.message}`);
      }
    }));
  }
  console.log(`Done. Uploaded: ${uploaded}, already existed: ${existed}, failed: ${failed}`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
