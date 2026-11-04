import pool from "../backend/config.js";
import { loadLeagues, loadTeams } from "../backend/data-access.js";
import { setCatalog } from "../backend/lib/catalog.js";
import { findMatchIdsMissingFotmob, normalizeBackfillSeason, runFotmobBackfill } from "../backend/services/fotmob-backfill-service.js";
import { CURRENT_SEASON } from "../shared/defaults.js";

const dryRun = process.argv.includes("--dry-run");
// --all-seasons, or --season=2024; defaults to CURRENT_SEASON
const seasonArg = process.argv.find((arg) => arg.startsWith("--season="))?.split("=")[1];
const season = normalizeBackfillSeason(process.argv.includes("--all-seasons") ? "all" : (seasonArg || CURRENT_SEASON));
const seasonLabel = season === "all" ? "all-season" : String(season);

async function main() {
  setCatalog({
    teams: await loadTeams(),
    leagues: await loadLeagues(),
  });

  const matchIds = await findMatchIdsMissingFotmob(season);

  console.log(`Found ${matchIds.length} finished ${seasonLabel} matches missing FotMob data.`);
  if (dryRun || matchIds.length === 0) {
    return;
  }

  const { saved, missed } = await runFotmobBackfill(matchIds, {
    onResult: ({ index, matchId, result }) => {
      const label = `${index + 1}/${matchIds.length} ${matchId}`;
      if (result?.fotmob) {
        console.log(`[saved] ${label} ${result.sourceMatch || ""}`.trim());
      } else {
        console.warn(`[miss] ${label} ${result?.error || "No FotMob data"}`);
      }
    },
  });

  console.log(`FotMob backfill complete. Saved ${saved}, missed ${missed}.`);
}

main()
  .catch((error) => {
    console.error("FotMob backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
