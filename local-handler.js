import { Player } from "./classes/player.js";

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
  const data = await response.json();
  console.log(data);
  return data;
}

export async function findPlayerByID(playerID) {
  return await fetch(`/find-player-by-id?playerID=${playerID}`);
}
