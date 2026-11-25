// Generates the explanatory SVG diagrams used by the wiki (images/wiki/*.svg).
// Numbers come from the site's own model code, so the pictures always agree
// with what the site calculates. Run: npm run build:wiki-diagrams
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { calculateXPts, poissonProbability } from "../backend/services/poisson-model.js";
import {
  HOME_ADVANTAGE,
  IMPORTANCE_K,
  expectedHomeScore,
  goalDifferenceIndex,
} from "../backend/lib/elo.js";
import { MIN_RATED_MINUTES } from "../backend/lib/match-rating.js";
import { MIN_ROLE_SHARE, MIN_ROLE_STARTS, SEASON_DECAY } from "../backend/lib/player-position-profile.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "../images/wiki");

// Site palette (css/_tokens.scss).
const C = {
  red: "#E63946",
  blue: "#457B9D",
  darkBlue: "#1D3557",
  lightBlue: "#A8DADC",
  lightest: "#F1FAEE",
  green: "#279B65",
  darkGreen: "#1B6A45",
  text: "#101D30",
  muted: "#4A5A70",
  grid: "#D5E3EA",
  white: "#FFFFFF",
  yellow: "#FFEB3B",
  orange: "#FF9800",
  ratingRed: "#F44336",
  pitch: "#2E8B57",
  pitchStripe: "#33975F",
};
const FONT = "'Source Sans 3', 'Segoe UI', Arial, sans-serif";

const esc = (value) => String(value).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);
const fmt = (value, digits = 1) => Number(value).toFixed(digits);
const pct = (value, digits = 1) => `${(value * 100).toFixed(digits)}%`;

function svg({ width, height, title, desc, body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="t d" font-family="${FONT}">
  <title id="t">${esc(title)}</title>
  <desc id="d">${esc(desc)}</desc>
  <rect width="${width}" height="${height}" fill="${C.white}"/>
${body}
</svg>
`;
}

function text(x, y, content, { size = 16, weight = 400, fill = C.text, anchor = "start", extra = "" } = {}) {
  return `  <text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${extra ? ` ${extra}` : ""}>${esc(content)}</text>`;
}

function heading(content, sub) {
  return [text(32, 40, content, { size: 24, weight: 700, fill: C.darkBlue }), sub ? text(32, 64, sub, { size: 16, fill: C.muted }) : ""].join("\n");
}

// ---------------------------------------------------------------------------
// Expected points: Poisson scoreline grid
// ---------------------------------------------------------------------------
function expectedPointsGrid() {
  const homeXg = 1.8;
  const awayXg = 0.9;
  const max = 6;
  const result = calculateXPts(homeXg, awayXg, max);
  const away = calculateXPts(awayXg, homeXg, max);
  const cell = 42;
  const x0 = 92;
  const y0 = 128;
  const probabilities = [];
  for (let h = 0; h <= max; h += 1) {
    for (let a = 0; a <= max; a += 1) probabilities.push({ h, a, p: poissonProbability(h, homeXg) * poissonProbability(a, awayXg) });
  }
  const pMax = Math.max(...probabilities.map((item) => item.p));
  const cells = probabilities.map(({ h, a, p }) => {
    const colour = h > a ? C.green : h === a ? C.blue : C.red;
    const opacity = 0.1 + 0.9 * (p / pMax);
    const x = x0 + a * cell;
    const y = y0 + h * cell;
    const label = p >= 0.0005 ? fmt(p * 100) : "0";
    return [
      `  <rect x="${x}" y="${y}" width="${cell - 2}" height="${cell - 2}" rx="4" fill="${colour}" fill-opacity="${fmt(opacity, 2)}"/>`,
      text(x + (cell - 2) / 2, y + cell / 2 + 4, label, { size: 13, weight: 600, anchor: "middle", fill: opacity > 0.55 ? C.white : C.text }),
    ].join("\n");
  });
  const axis = [];
  for (let i = 0; i <= max; i += 1) {
    axis.push(text(x0 + i * cell + (cell - 2) / 2, y0 - 10, i, { size: 14, weight: 700, anchor: "middle", fill: C.darkBlue }));
    axis.push(text(x0 - 12, y0 + i * cell + cell / 2 + 4, i, { size: 14, weight: 700, anchor: "end", fill: C.darkBlue }));
  }
  axis.push(text(x0 + (7 * cell) / 2, y0 - 32, `Away goals (xG ${awayXg})`, { size: 15, weight: 600, anchor: "middle", fill: C.muted }));
  axis.push(text(36, y0 + (7 * cell) / 2, `Home goals (xG ${homeXg})`, { size: 15, weight: 600, anchor: "middle", fill: C.muted, extra: `transform="rotate(-90 36 ${y0 + (7 * cell) / 2})"` }));

  const px = 440;
  const barMax = 300;
  const rows = [
    ["Home win", result.winProb, C.green],
    ["Draw", result.drawProb, C.blue],
    ["Away win", result.lossProb, C.red],
  ];
  const bars = rows.map(([label, p, colour], index) => {
    const y = 128 + index * 52;
    return [
      text(px, y, label, { size: 16, weight: 600 }),
      `  <rect x="${px}" y="${y + 8}" width="${barMax}" height="18" rx="4" fill="${C.lightest}"/>`,
      `  <rect x="${px}" y="${y + 8}" width="${fmt(barMax * p, 1)}" height="18" rx="4" fill="${colour}"/>`,
      text(px + barMax + 10, y + 23, pct(p), { size: 16, weight: 700 }),
    ].join("\n");
  });
  const formula = [
    `  <rect x="${px - 12}" y="296" width="356" height="112" rx="8" fill="${C.lightest}" stroke="${C.lightBlue}"/>`,
    text(px, 324, "Home xPts", { size: 15, weight: 700, fill: C.muted }),
    text(px, 348, `3 × ${fmt(result.winProb, 3)} + 1 × ${fmt(result.drawProb, 3)} = ${fmt(result.xPts, 2)}`, { size: 18, weight: 700, fill: C.darkBlue }),
    text(px, 376, "Away xPts", { size: 15, weight: 700, fill: C.muted }),
    text(px, 398, `3 × ${fmt(away.winProb, 3)} + 1 × ${fmt(away.drawProb, 3)} = ${fmt(away.xPts, 2)}`, { size: 18, weight: 700, fill: C.darkBlue }),
  ];

  return svg({
    width: 800,
    height: 450,
    title: "Expected points from a scoreline grid",
    desc: `Probability of every scoreline from 0-0 to 6-6 when the home side has ${homeXg} xG and the away side ${awayXg} xG. Green cells are home wins (${pct(result.winProb)} in total), blue cells draws (${pct(result.drawProb)}) and red cells away wins (${pct(result.lossProb)}). Home expected points are ${fmt(result.xPts, 2)}, away expected points ${fmt(away.xPts, 2)}.`,
    body: [
      heading("Every scoreline, weighted by chance quality", `Probability of each result (%) for a match with xG ${homeXg} vs ${awayXg}`),
      ...axis,
      ...cells,
      ...bars,
      ...formula,
    ].join("\n"),
  });
}

// ---------------------------------------------------------------------------
// Elo: expected score curve
// ---------------------------------------------------------------------------
function eloExpectedCurve() {
  const left = 90;
  const right = 760;
  const top = 96;
  const bottom = 380;
  const xFor = (diff) => left + ((diff + 400) / 800) * (right - left);
  const yFor = (score) => bottom - score * (bottom - top);
  const points = [];
  for (let diff = -400; diff <= 400; diff += 10) points.push(`${fmt(xFor(diff))},${fmt(yFor(expectedHomeScore(diff, 0, 0)))}`);

  const grid = [];
  for (let diff = -400; diff <= 400; diff += 100) {
    grid.push(`  <line x1="${xFor(diff)}" y1="${top}" x2="${xFor(diff)}" y2="${bottom}" stroke="${C.grid}"/>`);
    grid.push(text(xFor(diff), bottom + 22, diff > 0 ? `+${diff}` : diff, { size: 14, anchor: "middle", fill: C.muted }));
  }
  for (const score of [0, 0.25, 0.5, 0.75, 1]) {
    grid.push(`  <line x1="${left}" y1="${yFor(score)}" x2="${right}" y2="${yFor(score)}" stroke="${C.grid}"/>`);
    grid.push(text(left - 10, yFor(score) + 5, fmt(score, 2), { size: 14, anchor: "end", fill: C.muted }));
  }

  const evenScore = expectedHomeScore(1500, 1500, HOME_ADVANTAGE);
  const markers = [
    { diff: 0, score: 0.5, label: "Equal ratings, neutral venue: 0.50", dx: 12, dy: 36, colour: C.blue },
    { diff: HOME_ADVANTAGE, score: evenScore, label: `Equal ratings, at home (+${HOME_ADVANTAGE}): ${fmt(evenScore, 2)}`, dx: 14, dy: 34, colour: C.green },
    { diff: 200, score: expectedHomeScore(1700, 1500, 0), label: `200 points stronger: ${fmt(expectedHomeScore(1700, 1500, 0), 2)}`, dx: 14, dy: 30, colour: C.darkBlue },
  ].map(({ diff, score, label, dx, dy, colour }) => [
    `  <circle cx="${fmt(xFor(diff))}" cy="${fmt(yFor(score))}" r="7" fill="${colour}" stroke="${C.white}" stroke-width="2"/>`,
    text(fmt(xFor(diff) + dx), fmt(yFor(score) + dy), label, { size: 15, weight: 700, fill: colour }),
  ].join("\n"));

  return svg({
    width: 800,
    height: 440,
    title: "Elo expected score by rating difference",
    desc: `An S-shaped curve. With equal ratings at a neutral venue a team's expected score is 0.50. The ${HOME_ADVANTAGE}-point home advantage lifts it to ${fmt(evenScore, 2)}, and a 200-point edge gives about ${fmt(expectedHomeScore(1700, 1500, 0), 2)}.`,
    body: [
      heading("Expected score before kick-off", "1 = win, 0.5 = draw, 0 = loss. The gap includes home advantage."),
      ...grid,
      `  <polyline points="${points.join(" ")}" fill="none" stroke="${C.darkBlue}" stroke-width="4" stroke-linejoin="round"/>`,
      ...markers,
      text((left + right) / 2, 430, "Rating difference (team − opponent, after home advantage)", { size: 15, weight: 600, anchor: "middle", fill: C.muted }),
    ].join("\n"),
  });
}

// ---------------------------------------------------------------------------
// Elo: K-factor and margin multiplier
// ---------------------------------------------------------------------------
function eloKFactor() {
  const rows = [
    ["Friendlies", IMPORTANCE_K.friendly],
    ["League and domestic cup matches", IMPORTANCE_K.domestic],
    ["Qualifiers, Champions League, Europa League…", IMPORTANCE_K.qualifier_or_major_club],
    ["World Cup, Euros, Copa América, AFCON, Asian Cup", IMPORTANCE_K.major_nt],
    ["World Cup final", IMPORTANCE_K.wc_final],
  ];
  const labelX = 32;
  const barX = 420;
  const barMax = 300;
  const body = rows.map(([label, k], index) => {
    const y = 104 + index * 50;
    const width = (k / 60) * barMax;
    return [
      text(labelX, y + 19, label, { size: 16, weight: 600 }),
      `  <rect x="${barX}" y="${y}" width="${barMax}" height="28" rx="5" fill="${C.lightest}"/>`,
      `  <rect x="${barX}" y="${y}" width="${fmt(width)}" height="28" rx="5" fill="${index === rows.length - 1 ? C.green : C.blue}"/>`,
      text(barX + width - 10, y + 20, `K = ${k}`, { size: 15, weight: 700, anchor: "end", fill: C.white }),
    ].join("\n");
  });
  return svg({
    width: 800,
    height: 370,
    title: "Elo K-factor by match importance",
    desc: `How far one result can move a rating: K ${IMPORTANCE_K.friendly} for friendlies, ${IMPORTANCE_K.domestic} for domestic matches, ${IMPORTANCE_K.qualifier_or_major_club} for qualifiers and major club competitions, ${IMPORTANCE_K.major_nt} for major national-team tournaments and ${IMPORTANCE_K.wc_final} for the World Cup final.`,
    body: [heading("Bigger matches move ratings further", "K-factor: the most a single result can shift a rating, before the margin bonus"), ...body].join("\n"),
  });
}

function eloMargin() {
  const margins = [1, 2, 3, 4, 5, 6];
  const left = 110;
  const baseY = 300;
  const scale = 100;
  const barWidth = 70;
  const gap = 34;
  const body = margins.map((margin, index) => {
    const value = goalDifferenceIndex(margin, 0);
    const x = left + index * (barWidth + gap);
    const height = value * scale;
    return [
      `  <rect x="${x}" y="${baseY - height}" width="${barWidth}" height="${height}" rx="5" fill="${margin <= 1 ? C.lightBlue : C.blue}"/>`,
      text(x + barWidth / 2, baseY - height - 10, `×${value % 1 === 0 ? value.toFixed(0) : value.toString()}`, { size: 17, weight: 700, anchor: "middle", fill: C.darkBlue }),
      text(x + barWidth / 2, baseY + 24, margin === 1 ? "Draw or 1" : `${margin}`, { size: 15, weight: 600, anchor: "middle", fill: C.muted }),
    ].join("\n");
  });
  return svg({
    width: 800,
    height: 360,
    title: "Elo margin-of-victory multiplier",
    desc: "A draw or one-goal win multiplies the rating change by 1, a two-goal win by 1.5, and wider margins by (11 + goal difference) / 8: 1.75 for three goals, 1.875 for four, 2 for five.",
    body: [
      heading("Wider wins count a little more", "Multiplier applied to the rating change, by goal difference"),
      `  <line x1="${left - 20}" y1="${baseY}" x2="${left + margins.length * (barWidth + gap)}" y2="${baseY}" stroke="${C.darkBlue}" stroke-width="2"/>`,
      ...body,
      text(400, 350, "Goal difference", { size: 15, weight: 600, anchor: "middle", fill: C.muted }),
    ].join("\n"),
  });
}

// ---------------------------------------------------------------------------
// Average team rating: who counts
// ---------------------------------------------------------------------------
function teamRatingMinutes() {
  const players = [
    { label: "Goalkeeper", minutes: 90, rating: 7.0 },
    { label: "Centre-back", minutes: 90, rating: 7.4 },
    { label: "Midfielder (subbed off)", minutes: 64, rating: 6.6 },
    { label: "Substitute on 64'", minutes: 26, rating: 6.8 },
    { label: "Substitute on 81'", minutes: 9, rating: 8.6 },
    { label: "Substitute on 88'", minutes: 2, rating: 6.0 },
  ];
  const left = 260;
  const right = 650;
  const top = 108;
  const rowHeight = 40;
  const xFor = (minutes) => left + (minutes / 90) * (right - left);
  const counted = players.filter((player) => player.minutes >= MIN_RATED_MINUTES);
  const average = counted.reduce((sum, player) => sum + player.rating, 0) / counted.length;
  const rows = players.map((player, index) => {
    const y = top + index * rowHeight;
    const counts = player.minutes >= MIN_RATED_MINUTES;
    return [
      text(32, y + 20, player.label, { size: 16, weight: 600, fill: counts ? C.text : C.muted }),
      `  <rect x="${left}" y="${y + 4}" width="${fmt(xFor(player.minutes) - left)}" height="24" rx="4" fill="${counts ? C.blue : C.grid}"/>`,
      text(fmt(xFor(player.minutes) + 8), y + 22, `${player.minutes}'`, { size: 14, weight: 600, fill: C.muted }),
      `  <rect x="720" y="${y + 2}" width="48" height="28" rx="5" fill="${counts ? C.darkBlue : C.white}" stroke="${counts ? C.darkBlue : C.grid}"/>`,
      text(744, y + 22, fmt(player.rating), { size: 16, weight: 700, anchor: "middle", fill: counts ? C.white : C.muted, extra: counts ? "" : 'text-decoration="line-through"' }),
    ].join("\n");
  });
  const cutX = xFor(MIN_RATED_MINUTES);
  const bottom = top + players.length * rowHeight;
  return svg({
    width: 800,
    height: 440,
    title: "Which player ratings count towards the team rating",
    desc: `Only players with at least ${MIN_RATED_MINUTES} minutes count. In this example four players qualify and their ratings average ${fmt(average, 2)}. Two late substitutes with 9 and 2 minutes are left out, including one rated 8.6.`,
    body: [
      heading(`Only players with ${MIN_RATED_MINUTES}+ minutes count`, "Minutes played and match rating for six of a team's players"),
      `  <line x1="${cutX}" y1="${top - 10}" x2="${cutX}" y2="${bottom + 4}" stroke="${C.red}" stroke-width="2" stroke-dasharray="6 5"/>`,
      text(cutX, top - 16, `${MIN_RATED_MINUTES} minutes`, { size: 14, weight: 700, anchor: "middle", fill: C.red }),
      ...rows,
      `  <rect x="32" y="${bottom + 22}" width="736" height="52" rx="8" fill="${C.lightest}" stroke="${C.lightBlue}"/>`,
      text(48, bottom + 54, `Team rating for this match: (${counted.map((player) => fmt(player.rating)).join(" + ")}) ÷ ${counted.length} = ${fmt(average, 2)}`, { size: 18, weight: 700, fill: C.darkBlue }),
    ].join("\n"),
  });
}

function ratingScale() {
  const bands = [
    { label: "Below 5", colour: C.ratingRed, ink: C.white },
    { label: "5.0 – 5.9", colour: C.orange, ink: C.white },
    { label: "6.0 – 6.9", colour: C.yellow, ink: C.text },
    { label: "7.0 – 7.9", colour: C.green, ink: C.white },
    { label: "8.0 and up", colour: C.darkGreen, ink: C.white },
  ];
  const width = 148;
  const body = bands.map((band, index) => {
    const x = 32 + index * width;
    return [
      `  <rect x="${x}" y="84" width="${width - 6}" height="48" rx="6" fill="${band.colour}"/>`,
      text(x + (width - 6) / 2, 114, band.label, { size: 17, weight: 700, anchor: "middle", fill: band.ink }),
    ].join("\n");
  });
  return svg({
    width: 800,
    height: 160,
    title: "Rating colour scale",
    desc: "Ratings are coloured red below 5, orange from 5, yellow from 6, green from 7 and dark green from 8.",
    body: [heading("How ratings are coloured", "The same scale is used for players and teams"), ...body].join("\n"),
  });
}

// ---------------------------------------------------------------------------
// Player positions: roles on the pitch, season weighting
// ---------------------------------------------------------------------------
function pitchBase(width, height, x0, y0, pw, ph) {
  const stripes = [];
  for (let i = 0; i < 10; i += 1) {
    if (i % 2 === 0) stripes.push(`  <rect x="${x0 + (i * pw) / 10}" y="${y0}" width="${pw / 10}" height="${ph}" fill="${C.pitchStripe}"/>`);
  }
  const line = `stroke="${C.white}" stroke-opacity="0.85" stroke-width="2" fill="none"`;
  const boxDepth = pw * 0.157;
  const boxHeight = ph * 0.593;
  const sixDepth = pw * 0.052;
  const sixHeight = ph * 0.27;
  return [
    `  <rect x="${x0}" y="${y0}" width="${pw}" height="${ph}" rx="6" fill="${C.pitch}"/>`,
    ...stripes,
    `  <rect x="${x0}" y="${y0}" width="${pw}" height="${ph}" rx="6" ${line}/>`,
    `  <line x1="${x0 + pw / 2}" y1="${y0}" x2="${x0 + pw / 2}" y2="${y0 + ph}" ${line}/>`,
    `  <circle cx="${x0 + pw / 2}" cy="${y0 + ph / 2}" r="${ph * 0.135}" ${line}/>`,
    `  <rect x="${x0}" y="${y0 + (ph - boxHeight) / 2}" width="${boxDepth}" height="${boxHeight}" ${line}/>`,
    `  <rect x="${x0 + pw - boxDepth}" y="${y0 + (ph - boxHeight) / 2}" width="${boxDepth}" height="${boxHeight}" ${line}/>`,
    `  <rect x="${x0}" y="${y0 + (ph - sixHeight) / 2}" width="${sixDepth}" height="${sixHeight}" ${line}/>`,
    `  <rect x="${x0 + pw - sixDepth}" y="${y0 + (ph - sixHeight) / 2}" width="${sixDepth}" height="${sixHeight}" ${line}/>`,
  ].join("\n");
}

function positionsPitch() {
  const x0 = 32;
  const y0 = 84;
  const pw = 736;
  const ph = 340;
  // Attacking to the right, so a player's right-hand side is the bottom edge.
  const roles = [
    ["GK", "Goalkeeper", 0.05, 0.5],
    ["CB", "Centre back", 0.2, 0.5],
    ["LB", "Left back", 0.23, 0.17],
    ["RB", "Right back", 0.23, 0.82],
    ["LWB", "Left wing back", 0.36, 0.12],
    ["RWB", "Right wing back", 0.36, 0.84],
    ["DM", "Defensive mid", 0.36, 0.5],
    ["CM", "Central mid", 0.5, 0.5],
    ["LM", "Left mid", 0.53, 0.2],
    ["RM", "Right mid", 0.53, 0.8],
    ["AM", "Attacking mid", 0.65, 0.5],
    ["LW", "Left winger", 0.75, 0.17],
    ["RW", "Right winger", 0.75, 0.83],
    ["ST", "Striker", 0.86, 0.5],
  ];
  const chips = roles.map(([code, name, fx, fy]) => {
    const cx = x0 + fx * pw;
    const cy = y0 + fy * ph;
    return [
      `  <circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="21" fill="${C.darkBlue}" stroke="${C.white}" stroke-width="2"/>`,
      text(fmt(cx), fmt(cy + 5), code, { size: code.length > 2 ? 13 : 15, weight: 700, anchor: "middle", fill: C.white }),
      text(fmt(cx), fmt(cy + 38), name, { size: 12, weight: 700, anchor: "middle", fill: C.white, extra: `stroke="${C.darkBlue}" stroke-width="3" stroke-opacity="0.55" paint-order="stroke"` }),
    ].join("\n");
  });
  return svg({
    width: 800,
    height: 450,
    title: "The fourteen player roles on the pitch",
    desc: "A pitch with the team attacking to the right. From the goal outwards: GK, then CB with LB and RB either side, LWB and RWB wider and further up, DM, CM with LM and RM, AM, LW and RW on the wings, and ST up front.",
    body: [
      heading("Fourteen roles, from goalkeeper to striker", "Team attacking left to right, so the right-sided roles sit at the bottom"),
      pitchBase(800, 450, x0, y0, pw, ph),
      `  <path d="M ${x0 + pw - 70} ${y0 - 14} l 50 0 m -10 -6 l 10 6 l -10 6" stroke="${C.green}" stroke-width="3" fill="none"/>`,
      text(x0 + pw - 80, y0 - 9, "Attack", { size: 14, weight: 700, anchor: "end", fill: C.green }),
      ...chips,
    ].join("\n"),
  });
}

function seasonWeights() {
  const seasons = ["This season", "Last season", "2 seasons ago", "3 seasons ago", "4 seasons ago"];
  const left = 200;
  const barMax = 360;
  const body = seasons.map((label, index) => {
    const weight = SEASON_DECAY ** index;
    const y = 100 + index * 46;
    const fraction = ["1", "½", "¼", "⅛", "1/16"][index];
    return [
      text(32, y + 20, label, { size: 16, weight: 600 }),
      `  <rect x="${left}" y="${y}" width="${barMax}" height="28" rx="5" fill="${C.lightest}"/>`,
      `  <rect x="${left}" y="${y}" width="${fmt(barMax * weight)}" height="28" rx="5" fill="${index === 0 ? C.green : C.blue}"/>`,
      text(left + barMax + 14, y + 20, `× ${fraction}`, { size: 17, weight: 700, fill: C.darkBlue }),
      text(768, y + 20, `10 starts = ${fmt(10 * weight, weight < 0.1 ? 2 : weight < 1 ? 1 : 0)}`, { size: 15, anchor: "end", fill: C.muted }),
    ].join("\n");
  });
  return svg({
    width: 800,
    height: 350,
    title: "How much a start counts, by season",
    desc: "A start this season counts in full, last season half, two seasons ago a quarter, three seasons ago an eighth and four seasons ago a sixteenth. Ten starts in each season are worth 10, 5, 2.5, 1.25 and 0.63 weighted starts.",
    body: [heading("Recent seasons count more", "Each season back halves the weight of a start (seasons run July to June)"), ...body].join("\n"),
  });
}

// ---------------------------------------------------------------------------
// Card images for the icon and abbreviation articles
// ---------------------------------------------------------------------------
function statIconsHeader() {
  const ball = (fill, ink) => `<circle cx="12" cy="12" r="9.4" fill="${fill}"/><g fill="${ink}"><polygon points="12,8.4 15.424,10.888 14.116,14.912 9.884,14.912 8.576,10.888"/><polygon points="14.351,8.764 13.043,4.739 16.467,2.251 19.891,4.739 18.583,8.764" clip-path="url(#ball)"/><polygon points="15.804,13.236 19.228,10.749 22.652,13.236 21.344,17.261 17.112,17.261" clip-path="url(#ball)"/><polygon points="12,16 15.424,18.488 14.116,22.512 9.884,22.512 8.576,18.488" clip-path="url(#ball)"/><polygon points="8.196,13.236 6.888,17.261 2.656,17.261 1.348,13.236 4.772,10.749" clip-path="url(#ball)"/><polygon points="9.649,8.764 5.417,8.764 4.109,4.739 7.533,2.251 10.957,4.739" clip-path="url(#ball)"/></g>`;
  const boot = (fill) => `<path fill="${fill}" d="m15.9 19.05 2.3 2.05-3.7.8-.75-.8zM11.49 2v1.5l2.9 1.35h2.9l1.5 8.6-.01.01 2.2 6.5-1.5 1.45L5.0 6.9 8.7 2zm.75 13.5 2.2 2.05-3.6.75-.75-.75zM8.6 11.85l2.2 2.2-3.7.65-.7-.7zm7.9.32h-3.4l2.1 2.1h1.7zM5.05 8.3l2.2 2.2-3.6.6-.75-.7zm10.7 0H9.3l2.1 2.1h4.75z"/>`;
  const star = (fill) => `<path fill="${fill}" d="M12 2.5 14.7 9.3 22 9.9 16.4 14.6 18.2 21.8 12 17.9 5.8 21.8 7.6 14.6 2 9.9 9.3 9.3z"/>`;
  const shirt = (stroke) => `<g fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round" transform="translate(-6.8 -9) scale(1.6)"><rect x="5.925" y="7.748" width="12.15" height="8.505" rx="0.911"/><line x1="12" y1="7.748" x2="12" y2="16.253"/><circle cx="12" cy="12" r="1.58"/></g>`;
  const clock = (fill) => `<path fill="${fill}" d="M11.5 5.108c2.25 0 4.3.82 5.83 2.18l1.36-1.36 1.41 1.41-1.42 1.42.01.01A8.55 8.55 0 0 1 20.1 13.604C20.1 18.292 16.19 22 11.5 22S2.9 18.292 2.9 13.604c0-4.687 3.9-8.496 8.6-8.496m-.11 1.79c-3.68 0-6.7 3.018-6.7 6.696s3.02 6.697 6.7 6.697 6.7-3.019 6.7-6.697-3.02-6.696-6.7-6.696m1.1 3.298v4.598h-2.2V10.196zM14.99 2v2.199h-7V2z"/>`;
  const icons = [
    ["Apps", shirt(C.lightest)],
    ["Goals", ball(C.lightest, C.darkBlue)],
    ["Assists", boot(C.lightest)],
    ["Rating", star(C.lightest)],
    ["Minutes", clock(C.lightest)],
  ];
  const rows = [
    ["Player A", "31", "18", "7", "7.6", "2,541"],
    ["Player B", "29", "11", "12", "7.4", "2,388"],
    ["Player C", "33", "9", "4", "7.1", "2,790"],
    ["Player D", "27", "6", "9", "7.0", "2,105"],
  ];
  const colX = [300, 390, 480, 570, 670];
  const header = icons.map(([label, icon], index) => [
    `  <g transform="translate(${colX[index] - 18} 104) scale(1.5)">${icon}</g>`,
    text(colX[index], 168, label, { size: 13, weight: 600, anchor: "middle", fill: C.lightBlue }),
  ].join("\n"));
  const body = rows.map((row, rowIndex) => {
    const y = 184 + rowIndex * 56;
    return [
      `  <rect x="32" y="${y}" width="736" height="56" fill="${rowIndex % 2 ? C.lightest : C.white}"/>`,
      text(56, y + 35, row[0], { size: 18, weight: 700, fill: C.darkBlue }),
      ...row.slice(1).map((value, index) => text(colX[index], y + 35, value, { size: 18, weight: 600, anchor: "middle" })),
    ].join("\n");
  });
  return svg({
    width: 800,
    height: 450,
    title: "Player table header icons",
    desc: "A player table whose column headers are icons: a shirt for appearances, a ball for goals, a boot for assists, a star for average rating and a stopwatch for minutes.",
    body: [
      `  <defs><clipPath id="ball"><circle cx="12" cy="12" r="9.4"/></clipPath></defs>`,
      heading("Icons in place of column names", "Hover a header on the site to see its full name"),
      `  <rect x="32" y="88" width="736" height="96" rx="6" fill="${C.darkBlue}"/>`,
      text(56, 144, "Player", { size: 18, weight: 700, fill: C.lightest }),
      ...header,
      ...body,
      `  <rect x="32" y="88" width="736" height="320" rx="6" fill="none" stroke="${C.grid}"/>`,
    ].join("\n"),
  });
}

function abbreviationsCard() {
  const chips = [
    ["xG", "Expected goals"], ["xGA", "Expected goals against"], ["xPts", "Expected points"], ["GD", "Goal difference"],
    ["Rtg", "Rating"], ["NPG", "Non-penalty goals"], ["GA/90", "Goals + assists per 90"], ["SecPos", "Secondary position"],
  ];
  const body = chips.map(([code, name], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 32 + column * 372;
    const y = 96 + row * 84;
    return [
      `  <rect x="${x}" y="${y}" width="356" height="68" rx="8" fill="${C.lightest}" stroke="${C.lightBlue}"/>`,
      `  <rect x="${x + 12}" y="${y + 14}" width="96" height="40" rx="6" fill="${C.darkBlue}"/>`,
      text(x + 60, y + 41, code, { size: 19, weight: 700, anchor: "middle", fill: C.white }),
      text(x + 124, y + 41, name, { size: 18, weight: 600, fill: C.darkBlue }),
    ].join("\n");
  });
  return svg({
    width: 800,
    height: 450,
    title: "Common table abbreviations",
    desc: "Eight abbreviations from Generation Football tables: xG, xGA, xPts, GD, Rtg, NPG, GA/90 and SecPos, each with its full name.",
    body: [heading("Short labels, full meanings", "Every abbreviation used in our tables, explained"), ...body].join("\n"),
  });
}

const diagrams = {
  "expected-points-grid.svg": expectedPointsGrid,
  "elo-expected-score.svg": eloExpectedCurve,
  "elo-k-factor.svg": eloKFactor,
  "elo-margin.svg": eloMargin,
  "team-rating-minutes.svg": teamRatingMinutes,
  "rating-scale.svg": ratingScale,
  "positions-pitch.svg": positionsPitch,
  "season-weights.svg": seasonWeights,
  "stat-icons-header.svg": statIconsHeader,
  "abbreviations.svg": abbreviationsCard,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [file, build] of Object.entries(diagrams)) {
  fs.writeFileSync(path.join(OUT_DIR, file), build());
  console.log(`wrote images/wiki/${file}`);
}
console.log(`Rules used: ${MIN_RATED_MINUTES}-minute rating cutoff, ${MIN_ROLE_SHARE * 100}% / ${MIN_ROLE_STARTS} starts for secondary roles.`);
