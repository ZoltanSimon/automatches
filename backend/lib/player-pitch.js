import { abbreviatePlayerPosition } from "./backend-helper.js";

// Spots for the player page's position pitch. Same horizontal pitch as the match
// page, with the player attacking right (like the home side), so right-sided roles
// sit at the bottom. Coordinates are percentages of the playing area.
const ROLE_SPOTS = {
  goalkeeper: { x: 5, y: 50 },
  "center back": { x: 20, y: 50 },
  "centre back": { x: 20, y: 50 },
  "right back": { x: 24, y: 84 },
  "left back": { x: 24, y: 16 },
  "right wing back": { x: 36, y: 87 },
  "left wing back": { x: 36, y: 13 },
  "defensive midfielder": { x: 36, y: 50 },
  "central midfielder": { x: 50, y: 50 },
  "attacking midfielder": { x: 65, y: 50 },
  "right midfielder": { x: 56, y: 84 },
  "left midfielder": { x: 56, y: 16 },
  "right winger": { x: 77, y: 82 },
  "left winger": { x: 77, y: 18 },
  striker: { x: 86, y: 50 },
  // Generic positions (API-Football's G/D/M/F) when there is no lineup data.
  defender: { x: 22, y: 50 },
  midfielder: { x: 50, y: 50 },
  forward: { x: 84, y: 50 },
  attacker: { x: 84, y: 50 },
};

function spotTitle(name, starts, share) {
  if (!starts) return name;
  const startsText = `${starts} ${starts === 1 ? "start" : "starts"}`;
  return Number.isFinite(share) ? `${name} · ${startsText} (${Math.round(share * 100)}%)` : `${name} · ${startsText}`;
}

/**
 * @param {{ role: string, starts: number|null, share: number|null, isMain: boolean }[]} pitchPositions from playerPitchPositions
 * @returns {{ spots: object[], rows: object[], hasStarts: boolean, ariaLabel: string, mainName: string, secondaryNames: string[] } | null} null when no position has a spot
 */
export function buildPlayerPitch(pitchPositions) {
  const spots = (Array.isArray(pitchPositions) ? pitchPositions : [])
    .map(({ role, starts, share, isMain }) => {
      const name = String(role ?? "").trim();
      const spot = ROLE_SPOTS[name.toLowerCase()];
      if (!spot) return null;
      return {
        label: abbreviatePlayerPosition(name),
        name,
        title: spotTitle(name, starts, share),
        starts: Number.isFinite(starts) && starts > 0 ? starts : null,
        sharePct: Number.isFinite(share) ? Math.round(share * 100) : null,
        x: spot.x,
        y: spot.y,
        isMain: Boolean(isMain),
        // Secondary dots fade with how rarely the role is played (0.55 to 1).
        opacity: isMain || !Number.isFinite(share) ? 1 : Math.min(1, 0.55 + share).toFixed(2),
      };
    })
    .filter(Boolean);

  if (spots.length === 0) {
    return null;
  }

  const main = spots.find((spot) => spot.isMain);
  const others = spots.filter((spot) => !spot.isMain).map((spot) => spot.name);
  const ariaLabel = [
    main ? `Main position: ${main.name}.` : "",
    others.length ? `Also plays: ${others.join(", ")}.` : "",
  ].filter(Boolean).join(" ");

  // Table rows next to the pitch: main position first, then the secondary ones.
  const rows = [...spots.filter((spot) => spot.isMain), ...spots.filter((spot) => !spot.isMain)];
  const hasStarts = rows.some((row) => row.starts !== null);

  return { spots, rows, hasStarts, ariaLabel, mainName: main?.name ?? "", secondaryNames: others };
}
