import { allDBLeagues } from "./catalog.js";

export function normalizeSeasonValue(season) {
  if (season === null || season === undefined || season === "") {
    return null;
  }

  const parsedSeason = Number(season);
  return Number.isNaN(parsedSeason) ? null : parsedSeason;
}

function getLeagueSeasonsFromMetadata(leagueID) {
  const league = allDBLeagues?.find((item) => Number(item.id) === Number(leagueID));

  if (Array.isArray(league?.seasons) && league.seasons.length > 0) {
    return league.seasons.map((season) => Number(season)).filter((season) => !Number.isNaN(season));
  }

  const fallbackSeason = normalizeSeasonValue(league?.season);
  return fallbackSeason === null ? [] : [fallbackSeason];
}

export function getLeagueSeasons(leagueID) {
  return getLeagueSeasonsFromMetadata(leagueID);
}

export function getLeagueSeason(leagueID, requestedSeason = null) {
  const normalizedRequestedSeason = normalizeSeasonValue(requestedSeason);
  const availableSeasons = getLeagueSeasonsFromMetadata(leagueID);

  if (
    normalizedRequestedSeason !== null &&
    availableSeasons.includes(normalizedRequestedSeason)
  ) {
    return normalizedRequestedSeason;
  }

  if (availableSeasons.length > 0) {
    return availableSeasons[0];
  }

  return normalizeSeasonValue(requestedSeason) ?? new Date().getFullYear();
}

export function normalizeLeagueConfig(input) {
  if (typeof input === "object" && input !== null) {
    const leagueID = Number(input.leagueID ?? input.id);
    return {
      leagueID,
      season: getLeagueSeason(leagueID, input.season),
    };
  }

  const leagueID = Number(input);
  return {
    leagueID,
    season: getLeagueSeason(leagueID),
  };
}
