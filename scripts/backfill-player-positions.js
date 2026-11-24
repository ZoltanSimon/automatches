// Forces a recount of player_position, e.g. after changing how roles are counted.
// Not needed routinely: saving match details marks seasons dirty and the server rebuilds them.
//
//   npm run backfill:player-positions                  mark every season; the server rebuilds them
//   npm run backfill:player-positions -- --season=2023 mark one season
//   npm run backfill:player-positions -- --dry-run     count only, nothing is written
import pool from "../backend/config.js";
import { markAllPlayerPositionSeasonsDirty, markPlayerPositionSeasonsDirty } from "../backend/data-access.js";
import { rebuildPlayerPositions } from "../backend/services/player-position-service.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const seasonArg = readArg("--season");
const season = seasonArg === null ? null : Number(seasonArg);

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
  if (season !== null && !Number.isFinite(season)) {
    throw new Error(`Invalid --season: ${seasonArg}`);
  }
  const seasons = season === null ? null : [season];

  if (dryRun) {
    const result = await rebuildPlayerPositions({ seasons, dryRun: true });
    console.log("Player position dry run complete.", result);
    return;
  }

  if (seasons) {
    await markPlayerPositionSeasonsDirty(seasons);
  } else {
    await markAllPlayerPositionSeasonsDirty();
  }
  console.log(`Marked ${seasons ? `season ${season}` : "every season"} for a player position rebuild; the server picks it up on its next run.`);
}

main()
  .catch((error) => {
    console.error("Player position backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
