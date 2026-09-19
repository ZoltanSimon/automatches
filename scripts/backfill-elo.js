import {
  applyPendingElo,
  replayElo,
} from "../backend/services/elo-service.js";
import { loadLeagues, loadTeams } from "../backend/data-access.js";
import { setCatalog } from "../backend/lib/catalog.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const applyPending = args.includes("--apply-pending");
const scopeArg = readArg("--scope");
const scope = scopeArg === "nt" || scopeArg === "club" ? scopeArg : null;

function readArg(flag) {
  const prefixed = args.find((arg) => arg.startsWith(`${flag}=`));
  if (prefixed) {
    return prefixed.slice(flag.length + 1);
  }
  const index = args.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return args[index + 1] ?? null;
}

async function main() {
  setCatalog({
    teams: await loadTeams(),
    leagues: await loadLeagues(),
  });

  if (applyPending) {
    const result = await applyPendingElo({ scope, dryRun });
    console.log("Elo pending apply complete.", result);
    return;
  }

  const result = await replayElo({ scope, dryRun });
  console.log("Elo backfill complete.", result);
}

main().catch((error) => {
  console.error("Elo backfill failed:", error);
  process.exitCode = 1;
});
