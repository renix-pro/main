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

async function main() {
  const privateObjectDir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!privateObjectDir) {
    console.error("PRIVATE_OBJECT_DIR not set. Cannot proceed.");
    process.exit(1);
  }

  const parts = privateObjectDir.replace(/^\//, "").split("/");
  const bucketName = parts[0];
  const prefix = parts.slice(1).join("/");

  console.log(`Bucket: ${bucketName}`);
  console.log(`Prefix: ${prefix}`);
  console.log(`Backup dir: ${BACKUP_DIR}`);
  console.log("");

  const bucket = storage.bucket(bucketName);

  const [files] = await bucket.getFiles({ prefix });
  console.log(`Found ${files.length} files in object storage\n`);

  if (files.length === 0) {
    console.log("No files to download.");
    return;
  }

  let downloaded = 0;
  let failed = 0;

  for (const file of files) {
    const relativePath = file.name;
    const localPath = path.join(BACKUP_DIR, relativePath);
    const localDir = path.dirname(localPath);

    try {
      fs.mkdirSync(localDir, { recursive: true });
      const [contents] = await file.download();
      fs.writeFileSync(localPath, contents);

      const [metadata] = await file.getMetadata();
      const metaPath = localPath + ".meta.json";
      fs.writeFileSync(
        metaPath,
        JSON.stringify(
          {
            contentType: metadata.contentType || "application/octet-stream",
            customMetadata: metadata.metadata || {},
            size: metadata.size,
            originalName: file.name,
          },
          null,
          2
        )
      );

      downloaded++;
      console.log(`[${downloaded}/${files.length}] ${file.name} (${metadata.size} bytes)`);
    } catch (err) {
      failed++;
      console.error(`FAILED: ${file.name} - ${err.message}`);
    }
  }

  console.log(`\nDone. Downloaded: ${downloaded}, Failed: ${failed}`);
  console.log(`Files saved to: ${BACKUP_DIR}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
