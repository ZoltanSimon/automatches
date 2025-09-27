import { showToast } from "./common-functions.js";

export let selectedLeagues = [];

export async function getResultFromLocal(fixtureID) {
  if (fixtureID instanceof PointerEvent) {
    fixtureID = fixtureID.target.innerHTML;
  }

  try {
    let response = await fetch(`data/matches/${fixtureID}.json`);
    if (!response.ok) {
      handleError(fixtureID);
    }
    return await response.json();
  } catch (e) {
    console.error(e);
    return null;
  }
}

async function handleError(id) {
  console.log(id);
  document.getElementById("missing-matches").innerHTML += id + "<br/>";
}

export async function downloadMatch(fixtureID) {
  if (fixtureID instanceof PointerEvent) {
    fixtureID = fixtureID.target.innerHTML;
  }

  const response = await fetch(`/save-match?matchID=${fixtureID}`, {
    method: "GET",
  });
  const { match, limits } = await response.json();

  showToast(`${fixtureID} match downloaded ${limits.dailyRemaining} requests left today, ${limits.perMinuteRemaining} left this minute`);

  console.log("Match data:", match);
  console.log("Rate limits:", limits);

  return { match, limits };
}

export async function findPlayerByID(playerID) {
  return await fetch(`/find-player-by-id?playerID=${playerID}`);
}
