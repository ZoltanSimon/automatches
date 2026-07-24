import path from "path";
import fs from "fs/promises";
import { networkPath } from "../backend/config.js";

const matchesDir = path.join(networkPath, "matches");
const MATCH_SHARD_BUCKET_COUNT = 1000;
const dryRun = process.argv.includes("--dry-run");
const PREVIEW_LIMIT = 25;

function getMatchShardDirectoryName(fixtureID) {
  const normalizedID = String(fixtureID ?? "").trim();
  const numericID = Number(normalizedID);

  if (!normalizedID) {
    throw new Error("fixtureID is required");
  }

  if (Number.isFinite(numericID)) {
    return String(Math.abs(numericID) % MATCH_SHARD_BUCKET_COUNT).padStart(3, "0");
  }

  let hash = 0;
  for (const character of normalizedID) {
    hash = (hash * 31 + character.charCodeAt(0)) % MATCH_SHARD_BUCKET_COUNT;
  }

  return String(hash).padStart(3, "0");
}

function getTargetPath(fileName) {
  const fixtureID = path.basename(fileName, ".json");
  return path.join(matchesDir, getMatchShardDirectoryName(fixtureID), fileName);
}

async function moveFile(sourcePath, targetPath) {
  try {
    await fs.rename(sourcePath, targetPath);
  } catch (error) {
    if (error?.code !== "EXDEV") {
      throw error;
    }

    await fs.copyFile(sourcePath, targetPath);
    await fs.unlink(sourcePath);
  }
}

async function main() {
  const entries = await fs.readdir(matchesDir, { withFileTypes: true });
  const flatJsonFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

  let movedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let previewCount = 0;

  console.log(`Found ${flatJsonFiles.length} top-level match file(s) in ${matchesDir}.`);
  if (dryRun) {
    console.log("Dry run enabled. No files will be moved.");
  }

  for (const fileName of flatJsonFiles) {
    const sourcePath = path.join(matchesDir, fileName);
    const targetPath = getTargetPath(fileName);

    try {
      await fs.mkdir(path.dirname(targetPath), { recursive: true });

      try {
        await fs.access(targetPath);
        skippedCount += 1;
        console.warn(`Skipping ${fileName}: target already exists at ${targetPath}`);
        continue;
      } catch (error) {
        if (error?.code !== "ENOENT") {
          throw error;
        }
      }

      if (dryRun) {
        movedCount += 1;

        if (previewCount < PREVIEW_LIMIT) {
          console.log(`[dry-run] ${sourcePath} -> ${targetPath}`);
          previewCount += 1;
          if (previewCount === PREVIEW_LIMIT && flatJsonFiles.length > PREVIEW_LIMIT) {
            console.log(`Preview limit reached. Suppressing the remaining ${flatJsonFiles.length - PREVIEW_LIMIT} dry-run entries.`);
          }
        }

        continue;
      }

      await moveFile(sourcePath, targetPath);
      movedCount += 1;
    } catch (error) {
      failedCount += 1;
      console.error(`Failed to move ${fileName}:`, error.message);
    }
  }

  console.log(`Completed. ${dryRun ? "Would move" : "Moved"} ${movedCount} file(s), skipped ${skippedCount}, failed ${failedCount}.`);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exitCode = 1;
});