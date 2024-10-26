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
        console.log("ide");
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

export async function getAllPlayers() {
  try {
    const response = await fetch(`/get-all-players`);
    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error("Failed to fetch and build player list:", error);
    return [];
  }
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
        const team1Data = match.teams.home;
        const team2Data = match.teams.away;

        const team1 = findOrCreateTeam(teams, team1Data);
        const team2 = findOrCreateTeam(teams, team2Data);

        if (match.statistics[0]) {
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
    goalsFor: match.score.fulltime[teamIndex === 0 ? "home" : "away"],
    goalsAgainst: match.score.fulltime[teamIndex === 0 ? "away" : "home"],
    corners: match.statistics[teamIndex].statistics[7].value,
    cornersAgainst: match.statistics[opponentIndex].statistics[7].value,
    shotsOnGoal: match.statistics[teamIndex].statistics[0].value,
    shotsOnGoalAgainst: match.statistics[opponentIndex].statistics[0].value,
    xG: parseFloat(match.statistics[teamIndex].statistics[16].value),
    xGA: parseFloat(match.statistics[opponentIndex].statistics[16].value),
  };
}

export async function getResultsByRoundLocal(leagueID, roundNo) {
  let allGames = [];
  const response = await fetch(`/get-league-matches?leagueID=${leagueID}`);
  const league = await response.json();
  console.log(league);
  for (let i = 0; i < league.length; i++) {
    if (league[i].league.round == roundNo) {
      allGames.push(league[i]);
    }
  }
  return allGames;
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
