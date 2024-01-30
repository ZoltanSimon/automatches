import { matchList } from "./components/match-list.js";
import { getResultFromApi } from "./webapi-handler.js";
import { selectedLeagues } from "./automatches.js";
import { downloadResult } from "./common-functions.js";
import { Player } from "./player.js";
import { allLeagues } from "./data/leagues.js";

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
  await getPlayerList("club", allLeagues);
  //await getPlayerList("nation", allNationalComps);
  console.log(allPlayers);
}

export async function getAllMatches() {
  let teams = [];
  let t1, t2;
  let it = 0;
  const response = await fetch(`http://localhost:3000/get-league-matches`, {
    method: "GET",
  });
  const data = await response.json();
  console.log(data);
  for (let match of data) {
    /*for (let team of match[0].statistics) {
      //console.log(team);
      const found = teams.find((element) => element.name == team.team.name);
      //console.log(found);
      //if (teams.some((e) => e.name === team.team.name)) {
      if (found) {
        found.xg += parseFloat(team.statistics[16].value);
        found.matches += 1;
      } else {
        teams.push({
          name: team.team.name,
          id: team.team.id,
          matches: 1,
          xg: parseFloat(team.statistics[16].value),
        });
      }
    }*/
    let team1 = match[0].statistics[0].team;
    let team2 = match[0].statistics[1].team;

    let found1 = teams.find((element) => element.name == team1.name);
    let found2 = teams.find((element) => element.name == team2.name);

    console.log(found1);
    console.log(found2);

    if (found1 !== undefined) {
      team1 = found1;
    } else {
      team1.stats = [];
      team1.xg = 0;
      team1.xg_against = 0;
      team1.goals = 0;
      team1.goals_against = 0;
      teams.push(team1);
    }
    if (found2 !== undefined) {
      team2 = found2;
    } else {
      team2.stats = [];
      team2.xg = 0;
      team2.xg_against = 0;
      team2.goals = 0;
      team2.goals_against = 0;
      teams.push(team2);
    }

    console.log(team1);
    console.log(team2);

    t1 = {};
    t2 = {};
    t1.goalsFor = match[0].score.fulltime.home;
    t1.goalsAgainst = match[0].score.fulltime.away;
    t2.goalsFor = match[0].score.fulltime.away;
    t2.goalsAgainst = match[0].score.fulltime.home;
    t1.xg = parseFloat(match[0].statistics[0].statistics[16].value);
    t2.xg = parseFloat(match[0].statistics[1].statistics[16].value);
    t1.xg_against = parseFloat(match[0].statistics[1].statistics[16].value);
    t2.xg_against = parseFloat(match[0].statistics[0].statistics[16].value);
    team1.stats.push(t1);
    team2.stats.push(t2);
    console.log(team1);
    console.log(team2);
  }

  console.log(teams);

  for (let team of teams) {
    for (let stat of team.stats) {
      console.log(stat);
      team.xg += stat.xg;
      team.xg_against += stat.xg_against;
      team.goals += stat.goalsFor;
      team.goals_against += stat.goalsAgainst;
    }
  }

  teams.sort((a, b) => b.xg - a.xg); // b - a for reverse sort

  console.log(teams);

  teams.sort((a, b) => a.xg_against - b.xg_against); // b - a for reverse sort

  console.log(teams);
}

async function getPlayerList(compType, compList) {
  let player, thisClub;
  for (let i = 0; i < compList.length; i++) {
    let response = await fetch(`data/leagues/${compList[i].id}.json`);
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
  console.log(`${leagueID} ${roundNo}`);
  let allGames = [];
  let response = await fetch(`data/leagues/${leagueID}.json`);
  let league = await response.json();
  console.log(league);
  for (let i = 0; i < league.length; i++) {
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
