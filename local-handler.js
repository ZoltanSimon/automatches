import { Player } from "./classes/player.js";

export let selectedLeagues = [];

export async function getLocalPlayerStats(inputPlayer, leagues) {
  let playerFound;
  let foundIndex = -1;
  let thisComp = "";
  inputPlayer = findPlayerByID(inputPlayer.id);
  let player = new Player(inputPlayer);
  for (let i = 0; i < leagues.length; i++) {
    let response = await fetch(`data/leagues/${leagues[i]}.json`);
    let league = await response.json();

    for (let i = 0; i < league.length; i++) {
      if (
        league[i].fixture.status.short == "FT" &&
        (league[i].teams.home.id == inputPlayer.club ||
          league[i].teams.away.id == inputPlayer.club)
      ) {
        thisComp = league[i].league.name;
        foundIndex = -1;
        let match = await getResultFromLocal(league[i].fixture.id);
        for (let { players } of match) {
          playerFound = players[0].players.find(
            (x) => x.player.id == inputPlayer.id
          );
          if (!playerFound) {
            playerFound = players[1].players.find(
              (x) => x.player.id == inputPlayer.id
            );
          } else {
            foundIndex = 0;
          }
          if (playerFound) {
            if (foundIndex == -1) foundIndex = 1;
            player.getPlayerStats(playerFound);
            if (!player.team) player.team = players[foundIndex].team.name;
            if (player.competitions.indexOf(thisComp) == -1)
              player.competitionList.push(thisComp);
          }
        }
        player.getGAper90();
      }
    }
  }

  return player;
}

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
