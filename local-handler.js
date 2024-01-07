import { matchList } from "./components/match-list.js";
import { getResultFromApi } from "./webapi-handler.js";
import { selectedLeagues } from "./automatches.js";
import { downloadResult } from "./common-functions.js";
import { Player } from "./player.js";

let allNationalComps = [
  "world-cup-2022",
  "world-cup-qualifiers-south-america",
  "euro-quali",
];

let allPlayers = [];

export async function getLocalPlayerStats(inputPlayer) {
  let playerFound;
  let foundIndex = -1;
  let thisComp = "";

  let player = new Player(inputPlayer);
  for (let i = 0; i < selectedLeagues.length; i++) {
    let response = await fetch(`data/leagues/${selectedLeagues[i]}.json`);
    let league = await response.json();

    for (let i = 0; i < league.length; i++) {
      if (
        league[i].fixture.status.short == "FT" &&
        (league[i].teams.home.id == inputPlayer.club ||
          league[i].teams.away.id == inputPlayer.club)
        //(league[i].teams.home.id == inputPlayer.nation ||
        //  league[i].teams.away.id == inputPlayer.nation)
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

  console.log(player);
  return player;
}

export async function getResultFromLocal(fixtureID) {
  if (fixtureID instanceof PointerEvent) {
    fixtureID = fixtureID.target.innerHTML;
  }
  let response = await fetch(`data/matches/${fixtureID}.json`);
  if (!response.ok) {
    handleError(fixtureID);
    //let downloadedResponse = await downloadResultFromApi(fixtureID);
    let response = downloadResult(await getResultFromApi(fixtureID), fixtureID);
    return response;
    //return [];
  }
  return await response.json();
}

async function handleError(id) {
  console.log(id);
  document.getElementById("missing-matches").innerHTML += id + "<br/>";
}

export async function getPlayerGoalList() {
  let scorerList = [];
  let scorer;

  for (let i = 0; i < selectedLeagues.length; i++) {
    let response = await fetch(`data/leagues/${selectedLeagues[i]}.json`);
    let league = await response.json();

    for (let i = 0; i < league.length; i++) {
      if (league[i].fixture.status.short == "FT") {
        let match = await getResultFromLocal(league[i].fixture.id);
        if (match[0]) {
          for (let j = 0; j < match[0].events.length; j++) {
            console.log(match[0].events[j]);
            if (match[0].events[j].type == "Goal") {
              scorer = match[0].events[j].player;
              if (!scorerList.find((e) => e.id == scorer.id)) {
                scorer.goals = 1;
                scorerList.push(scorer);
              } else {
                scorerList.find((e) => e.id == scorer.id).goals++;
              }
            }
          }
        }
      }
    }
  }
  scorerList.sort((a, b) =>
    a.goals < b.goals ? 1 : b.goals < a.goals ? -1 : 0
  );

  console.log(scorerList);
  return scorerList;
}

export async function getAllPlayers() {
  await getPlayerList("club", selectedLeagues);
  await getPlayerList("nation", allNationalComps);
  console.log(allPlayers);
}

async function getPlayerList(compType, compList) {
  let player, thisClub;
  for (let i = 0; i < compList.length; i++) {
    let response = await fetch(`data/leagues/${compList[i]}.json`);
    let league = await response.json();

    for (let i = 0; i < league.length; i++) {
      if (league[i].fixture.status.short == "FT") {
        let match = await getResultFromLocal(league[i].fixture.id);
        if (match[0]) {
          for (let j = 0; j < match[0].players.length; j++) {
            thisClub = match[0].players[j].team.id;

            for (let k = 0; k < match[0].players[j].players.length; k++) {
              player = {
                id: match[0].players[j].players[k].player.id,
                name: match[0].players[j].players[k].player.name,
              };
              player[compType] = thisClub;
              if (!allPlayers.find((e) => e.id == player.id)) {
                allPlayers.push(player);
              } else {
                allPlayers.find((e) => e.id == player.id)[compType] = thisClub;
              }
            }
          }
        }
      }
    }
  }
}

export async function getResultsByRoundLocal(leagueID, roundNo) {
  console.log(leagueID);
  console.log(roundNo);
  let allGames = [];
  let response = await fetch(`data/leagues/${leagueID}.json`);
  let league = await response.json();
  console.log(league);
  for (let i = 0; i < league.length; i++) {
    console.log(league[i].league.round);
    if (league[i].league.round == roundNo) {
      allGames.push(league[i]);
    }
  }
  return allGames;
  //matchList(allGames);
}

export async function getMatch(fixtureID) {
  if (fixtureID instanceof PointerEvent) {
    fixtureID = fixtureID.target.innerHTML;
  }
  const response = await fetch(
    `http://localhost:3000/save-match?matchID=${fixtureID}`,
    {
      method: "GET",
    }
  );
  const data = await response.json();
  console.log(data);
  return data;
}
