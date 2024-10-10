import { Player } from "./classes/player.js";
import { allLeagues } from "./data/leagues.js";
import { Team } from "./classes/team.js";

let allPlayers = [];
export let selectedLeagues = [];

export async function getLocalPlayerStats(inputPlayer, leagues) {
  let playerFound;
  let foundIndex = -1;
  let thisComp = "";

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
      //let response = downloadResult(
      //  await getResultFromApi(fixtureID),
      //  fixtureID
      //);
    }
    return await response.json();
  } catch (e) {
    //console.error(e);
    return null;
  }

  //return await response.json();
}

async function handleError(id) {
  console.log(id);
  document.getElementById("missing-matches").innerHTML += id + "<br/>";
}

export async function getAllPlayers() {
  await getPlayerList(
    "club",
    allLeagues.filter((el) => el.type == "league"),
    allLeagues.filter((el) => el.type == "nt")
  );
  //await getPlayerList("nation", allNationalComps);
  console.log(allPlayers);
}

export async function buildTeamList(leagues) {
  let teams = [];

  try {
    const response = await fetch(
      `/get-league-matches?leagueID=${leagues.join(",")}`
    );
    const data = await response.json();

    data.forEach((match) => {
      if (match != null) {
        const team1Data = match[0].teams.home;
        const team2Data = match[0].teams.away;

        const team1 = findOrCreateTeam(teams, team1Data);
        const team2 = findOrCreateTeam(teams, team2Data);

        if (match[0].statistics[0]) {
          const stats1 = extractStats(match, 0, 1);
          const stats2 = extractStats(match, 1, 0);

          team1.stats.push(stats1);
          team2.stats.push(stats2);
        }
      }
    });

    teams.forEach((team) => team.calculateStats());
    return teams;
  } catch (error) {
    console.error("Failed to fetch and build team list:", error);
    return [];
  }
}

function findOrCreateTeam(teams, teamData) {
  let team = teams.find((t) => t.name === teamData.name);
  if (!team) {
    team = new Team(teamData);
    teams.push(team);
  }
  return team;
}

function extractStats(match, teamIndex, opponentIndex) {
  return {
    goalsFor: match[0].score.fulltime[teamIndex === 0 ? "home" : "away"],
    goalsAgainst: match[0].score.fulltime[teamIndex === 0 ? "away" : "home"],
    corners: match[0].statistics[teamIndex].statistics[7].value,
    cornersAgainst: match[0].statistics[opponentIndex].statistics[7].value,
    shotsOnGoal: match[0].statistics[teamIndex].statistics[0].value,
    shotsOnGoalAgainst: match[0].statistics[opponentIndex].statistics[0].value,
    xG: parseFloat(match[0].statistics[teamIndex].statistics[16].value),
    xGA: parseFloat(match[0].statistics[opponentIndex].statistics[16].value),
  };
}

async function getPlayerList(compType, compList, nationList) {
  let player, thisClub;
  for (let i = 0; i < compList.length; i++) {
    let response = await fetch(`data/leagues/${compList[i].id}.json`);
    let league = await response.json();

    for (let i = 0; i < league.length; i++) {
      if (league[i].fixture.status.short == "FT") {
        let match = await getResultFromLocal(league[i].fixture.id);
        if (match) {
          for (let j = 0; j < match[0].players.length; j++) {
            thisClub = match[0].players[j].team.id;

            for (let k = 0; k < match[0].players[j].players.length; k++) {
              player = {
                id: match[0].players[j].players[k].player.id,
                name: match[0].players[j].players[k].player.name,
                nation: 0,
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
  for (let i = 0; i < nationList.length; i++) {
    let response = await fetch(`data/leagues/${nationList[i].id}.json`);
    let nt = await response.json();

    for (let i = 0; i < nt.length; i++) {
      let match = await getResultFromLocal(nt[i].fixture.id);
      if (match) {
        for (let j = 0; j < match[0].players.length; j++) {
          let thisNation = match[0].players[j].team.id;
          for (let k = 0; k < match[0].players[j].players.length; k++) {
            let id = match[0].players[j].players[k].player.id;

            let playerFound = allPlayers.find((e) => e.id == id);
            if (!playerFound) {
              console.log(id);
              console.log(match[0].players[j].players[k].player.name);
            } else {
              allPlayers.find((e) => e.id == id).nation = thisNation;
            }
          }
        }
      }
    }
  }
}

export async function getResultsByRoundLocal(leagueID, roundNo) {
  let allGames = [];
  let response = await fetch(`data/leagues/${leagueID}.json`);
  let league = await response.json();
  for (let i = 0; i < league.length; i++) {
    if (league[i].league.round == roundNo) {
      if (league[i].fixture.status.short == "FT") {
        allGames.push((await getResultFromLocal(league[i].fixture.id))[0]);
      } else {
        allGames.push(league[i]);
      }
    }
  }
  return allGames;
  //matchList(allGames);
}

export async function getMatch(fixtureID) {
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

export async function matchExists(fixtureID) {
  const response = await fetch(`/match-exists?matchID=${fixtureID}`, {
    method: "GET",
  });
  const data = await response.json();
  console.log(data);
  return data;
}
