import pool from "../backend/config.js";
import { getFinishedMatchIdsMissingFotmob, loadLeagues, loadTeams, setMatchFotmob } from "../backend/data-access.js";
import { setCatalog } from "../backend/lib/catalog.js";
import { fetchExternalMatchXg } from "../backend/services/xg-lookup-service.js";
import { CURRENT_SEASON } from "../shared/defaults.js";

const DOMESTIC_LEAGUE_IDS = [39, 140, 135, 78, 61, 88, 94, 203];
const EUROPEAN_CUP_IDS = [2, 3, 848];

const dryRun = process.argv.includes("--dry-run");

async function main() {
  setCatalog({
    teams: await loadTeams(),
    leagues: await loadLeagues(),
  });

  const matchIds = await getFinishedMatchIdsMissingFotmob({
    season: CURRENT_SEASON,
    domesticLeagueIds: DOMESTIC_LEAGUE_IDS,
    europeanLeagueIds: EUROPEAN_CUP_IDS,
  });

  console.log(`Found ${matchIds.length} finished ${CURRENT_SEASON} matches missing FotMob data.`);
  if (dryRun || matchIds.length === 0) {
    return;
  }

  let saved = 0;
  let missed = 0;

  for (let index = 0; index < matchIds.length; index += 1) {
    const matchId = matchIds[index];
    const [result] = await fetchExternalMatchXg([matchId]);
    const label = `${index + 1}/${matchIds.length} ${matchId}`;

    if (result?.fotmob) {
      await setMatchFotmob(matchId, result.fotmob);
      saved += 1;
      console.log(`[saved] ${label} ${result.sourceMatch || ""}`.trim());
    } else {
      missed += 1;
      console.warn(`[miss] ${label} ${result?.error || "No FotMob data"}`);
    }
  }

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
