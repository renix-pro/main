const { Storage } = require("@google-cloud/storage");
const fs = require("fs");
const path = require("path");

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
const BACKUP_DIR = path.join(__dirname, "storage-backup");

const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

function walkDir(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else if (!entry.name.endsWith(".meta.json")) {
      results.push(fullPath);
    }
  }
  return results;
}

async function main() {
  const privateObjectDir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!privateObjectDir) {
    console.error("PRIVATE_OBJECT_DIR not set. Cannot proceed.");
    process.exit(1);
  }

  const parts = privateObjectDir.replace(/^\//, "").split("/");
  const bucketName = parts[0];
  const newPrefix = parts.slice(1).join("/");

  console.log(`Target bucket: ${bucketName}`);
  console.log(`New prefix: ${newPrefix}`);
  console.log(`Source dir: ${BACKUP_DIR}`);
  console.log("");

  if (!fs.existsSync(BACKUP_DIR)) {
    console.error(`Backup directory not found: ${BACKUP_DIR}`);
    console.error("Run download-files.cjs first to create it.");
    process.exit(1);
  }

  const bucket = storage.bucket(bucketName);
  const files = walkDir(BACKUP_DIR);

  console.log(`Found ${files.length} files to upload\n`);

  let uploaded = 0;
  let failed = 0;
  let skipped = 0;
  let existed = 0;
  const CONCURRENCY = 10;

  const tasks = files.map((localPath) => {
    const relativePath = path.relative(BACKUP_DIR, localPath);
    const normalizedRelPath = relativePath.split(path.sep).join("/");
    const objectName = normalizedRelPath;
    return { localPath, objectName };
  });

  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async ({ localPath, objectName }) => {
      const metaPath = localPath + ".meta.json";
      let contentType = "application/octet-stream";
      let customMetadata = {};
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
          contentType = meta.contentType || contentType;
          customMetadata = meta.customMetadata || {};
        } catch (e) {}
      }

      try {
        const file = bucket.file(objectName);
        const [exists] = await file.exists();
        if (exists) {
          existed++;
          return;
        }

        const contents = fs.readFileSync(localPath);
        await file.save(contents, {
          contentType,
          metadata: { metadata: customMetadata },
        });

        uploaded++;
        console.log(`[${uploaded + existed}/${files.length}] ${objectName} (${contents.length} bytes)`);
      } catch (err) {
        failed++;
        console.error(`FAILED: ${objectName} - ${err.message}`);
      }
    }));
  }

  console.log(`\nDone. Uploaded: ${uploaded}, Already existed: ${existed}, Failed: ${failed}, Skipped: ${skipped}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
