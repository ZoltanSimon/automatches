// Cache-busting for static assets. Cloudflare tells browsers to keep CSS for
// hours, so a deploy that changes HTML and CSS together would otherwise pair
// new markup with old styles. assetUrl("/css/style.css") returns
// "/css/style.css?v=<hash of the file>", so the URL changes whenever the file
// does. The hash is recomputed only when the file's modification time changes.
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cache = new Map();

export function assetUrl(urlPath) {
  if (typeof urlPath !== "string" || !urlPath.startsWith("/")) return urlPath;
  const filePath = path.join(repoRoot, urlPath);
  try {
    const { mtimeMs } = fs.statSync(filePath);
    let entry = cache.get(filePath);
    if (!entry || entry.mtimeMs !== mtimeMs) {
      const hash = crypto.createHash("md5").update(fs.readFileSync(filePath)).digest("hex").slice(0, 10);
      entry = { mtimeMs, hash };
      cache.set(filePath, entry);
    }
    return `${urlPath}?v=${entry.hash}`;
  } catch {
    return urlPath;
  }
}
