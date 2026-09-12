import pool from "../backend/config.js";
import { getMatchFromServer } from "../backend/services/json-reader.js";
import {
  getMatchIdsWithoutDetails,
  insertMatchDetailsRows,
} from "../backend/data-access.js";
import {
  matchObjectToDetailsRow,
  unwrapMatchPayload,
} from "../backend/lib/match-details-mapper.js";

const args = process.argv.slice(2);
const dryRun = argsHasFlag("--dry-run");
const finishedOnly = argsHasFlag("--finished-only");
const overwrite = argsHasFlag("--overwrite");
const limit = readNumericArg("--limit");
const batchSize = readNumericArg("--batch-size") || 25;

function argsHasFlag(flag) {
  return args.includes(flag);
}

function readNumericArg(flag) {
  const prefixed = args.find((arg) => arg.startsWith(`${flag}=`));
  if (prefixed) {
    const parsed = Number(prefixed.slice(flag.length + 1));
    return Number.isFinite(parsed) ? parsed : null;
  }

  const index = args.indexOf(flag);
  if (index === -1) {
    return null;
  }

  const parsed = Number(args[index + 1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function hasTeamIds(match) {
  const homeId = Number(match?.teams?.home?.id);
  const awayId = Number(match?.teams?.away?.id);
  return Number.isFinite(homeId) && Number.isFinite(awayId);
}

function hasStats(match) {
  return Array.isArray(match?.statistics)
    && match.statistics.some((entry) => Array.isArray(entry?.statistics) && entry.statistics.length > 0);
}

async function main() {
  const matchIds = await getMatchIdsWithoutDetails({ finishedOnly, overwrite, limit });

  console.log(
    `Backfilling match_details from JSON (${matchIds.length} candidate${matchIds.length === 1 ? "" : "s"}; finishedOnly=${finishedOnly}; overwrite=${overwrite}; batchSize=${batchSize}${dryRun ? "; dry-run" : ""}).`,
  );

  const counts = {
    inserted: 0,
    skippedExisting: 0,
    noFile: 0,
    parseError: 0,
    noTeams: 0,
    noStats: 0,
    insertError: 0,
  };

  for (const idBatch of chunk(matchIds, batchSize)) {
    const rows = [];

    const payloads = await Promise.all(
      idBatch.map(async (matchId) => {
        try {
          return { matchId, payload: await getMatchFromServer(matchId) };
        } catch (error) {
          console.error(`Parse/read error for match ${matchId}:`, error.message);
          return { matchId, error };
        }
      }),
    );

    for (const { matchId, payload, error } of payloads) {
      if (error) {
        counts.parseError += 1;
        continue;
      }

      if (!payload) {
        counts.noFile += 1;
        continue;
      }

      const match = unwrapMatchPayload(payload);
      if (!match?.fixture?.id) {
        counts.parseError += 1;
        continue;
      }

      if (!hasTeamIds(match)) {
        counts.noTeams += 1;
        continue;
      }

      const row = matchObjectToDetailsRow(match);
      if (!row) {
        counts.parseError += 1;
        continue;
      }

      if (!hasStats(match)) {
        counts.noStats += 1;
      }

      rows.push(row);
    }

    if (dryRun || rows.length === 0) {
      if (dryRun) {
        counts.inserted += rows.length;
      }
      continue;
    }

    try {
      const result = await insertMatchDetailsRows(rows, { overwrite });
      counts.inserted += Number(result.inserted || 0);
      counts.skippedExisting += Number(result.skipped || 0);
    } catch (error) {
      counts.insertError += rows.length;
      console.error(`Insert failed for batch [${idBatch.join(",")}]:`, error.message);
    }

    console.log(
      `Progress: inserted=${counts.inserted} skipped-existing=${counts.skippedExisting} no-file=${counts.noFile} parse-error=${counts.parseError} no-teams=${counts.noTeams} no-stats(still inserted)=${counts.noStats} insert-error=${counts.insertError}`,
    );
  }

  console.log("Backfill complete:", {
    candidates: matchIds.length,
    ...counts,
    dryRun,
  });
}

main()
  .catch((error) => {
    console.error("match_details backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await pool.end();
    } catch (error) {
      console.error("Failed to close MySQL pool:", error.message);
    }
  });
