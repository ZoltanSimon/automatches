// Canonical, slug-based URL builders. Pure functions with no catalog lookups,
// so they can be imported by both the backend and browser code.
//
//   /team/42/arsenal
//   /player/1460/bukayo-saka
//   /league/39/premier-league            (default season)
//   /league/39/premier-league/2024-25    (any other season)
//   /match/1208021/arsenal-vs-chelsea-2026-11-20
//   /wiki/elo-ratings

export const SITE_URL = "https://generationfootball.net";

// Characters that NFD normalisation does not decompose into base + accent.
const SPECIAL_CHARS = {
  ø: "o", Ø: "o", ß: "ss", ł: "l", Ł: "l", đ: "d", Đ: "d", ð: "d", Ð: "d",
  æ: "ae", Æ: "ae", œ: "oe", Œ: "oe", ı: "i", þ: "th", Þ: "th",
};

export function slugify(value) {
  const slug = String(value ?? "")
    .replace(/[øØßłŁđĐðÐæÆœŒıþÞ]/g, (char) => SPECIAL_CHARS[char])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "n-a";
}

// 2024 -> "2024-25". Calendar-year competitions are labelled by the same rule,
// which keeps the mapping reversible without knowing the competition type.
export function seasonLabel(season) {
  const year = Number(season);
  if (!Number.isInteger(year)) return "";
  return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
}

// "2024-25" -> 2024, "2024" -> 2024, anything else -> null.
export function parseSeasonLabel(label) {
  const match = /^(\d{4})(?:-(\d{2}))?$/.exec(String(label ?? ""));
  return match ? Number(match[1]) : null;
}

// Appends a query string, skipping empty values. Accepts an object or URLSearchParams.
export function withQuery(path, query) {
  if (!query) return path;
  const params = new URLSearchParams();
  const entries = query instanceof URLSearchParams ? query.entries() : Object.entries(query);
  for (const [key, value] of entries) {
    if (value === undefined || value === null || value === "") continue;
    params.append(key, String(value));
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

export function teamPath(id, name, query) {
  return withQuery(`/team/${encodeURIComponent(id)}/${slugify(name)}`, query);
}

export function playerPath(id, name, query) {
  return withQuery(`/player/${encodeURIComponent(id)}/${slugify(name)}`, query);
}

// Pass season = null (or the competition's default season) for the bare URL.
export function leaguePath(id, name, season, query) {
  const base = `/league/${encodeURIComponent(id)}/${slugify(name)}`;
  const label = season == null ? "" : seasonLabel(season);
  return withQuery(label ? `${base}/${label}` : base, query);
}

// YYYY-MM-DD from an ISO string, timestamp or Date; "" when unusable.
export function isoDay(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = value instanceof Date ? value : new Date(typeof value === "number" && value < 1e12 ? value * 1000 : value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function matchSlug(homeName, awayName, date) {
  const day = isoDay(date);
  return slugify(`${homeName} vs ${awayName}${day ? ` ${day}` : ""}`);
}

export function matchPath(id, homeName, awayName, date) {
  return `/match/${encodeURIComponent(id)}/${matchSlug(homeName, awayName, date)}`;
}

export function wikiPath(slug) {
  return slug ? `/wiki/${slug}` : "/wiki";
}

export function absoluteUrl(path) {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
