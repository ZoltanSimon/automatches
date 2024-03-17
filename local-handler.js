import { matchList } from "./components/match-list.js";
import { getResultFromApi } from "./webapi-handler.js";
import { selectedLeagues } from "./automatches.js";
import { downloadResult } from "./common-functions.js";
import { Player } from "./classes/player.js";
import { allLeagues } from "./data/leagues.js";
import { Team } from "./classes/team.js";

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
    console.log(match[0]);
    let team1 = match[0].teams.home;
    let team2 = match[0].teams.away;

    let found1 = teams.find((element) => element.name == team1.name);
    let found2 = teams.find((element) => element.name == team2.name);

    if (found1 !== undefined) {
      team1 = found1;
    } else {
      team1 = new Team(team1);
      teams.push(team1);
    }
    if (found2 !== undefined) {
      team2 = found2;
    } else {
      team2 = new Team(team2);
      teams.push(team2);
    }

    if (match[0].statistics[0]) {
      t1 = {};
      t2 = {};
      t1.goalsFor = match[0].score.fulltime.home;
      t1.goalsAgainst = match[0].score.fulltime.away;
      t2.goalsFor = match[0].score.fulltime.away;
      t2.goalsAgainst = match[0].score.fulltime.home;
      t1.corners = match[0].statistics[0].statistics[7].value;
      t2.corners = match[0].statistics[1].statistics[7].value;
      t1.cornersAgainst = match[0].statistics[1].statistics[7].value;
      t2.cornersAgainst = match[0].statistics[0].statistics[7].value;
      t1.shotsOnGoal = match[0].statistics[0].statistics[0].value;
      t2.shotsOnGoal = match[0].statistics[1].statistics[0].value;
      t1.shotsOnGoalAgainst = match[0].statistics[1].statistics[0].value;
      t2.shotsOnGoalAgainst = match[0].statistics[0].statistics[0].value;
      t1.xG = parseFloat(match[0].statistics[0].statistics[16].value);
      t2.xG = parseFloat(match[0].statistics[1].statistics[16].value);
      t1.xGA = parseFloat(match[0].statistics[1].statistics[16].value);
      t2.xGA = parseFloat(match[0].statistics[0].statistics[16].value);
      team1.stats.push(t1);
      team2.stats.push(t2);
    }
  }

  for (let team of teams) {
    team.matches = team.stats.length;
    for (let i = team.stats.length - 1; i >= 0; i--) {
      let stat = team.stats[i];
      team.total.xG += stat.xG;
      team.total.xGA += stat.xGA;
      team.total.corners += stat.corners;
      team.total.cornersAgainst += stat.cornersAgainst;
      team.total.shotsOnGoal += stat.shotsOnGoal;
      team.total.shotsOnGoalAgainst += stat.shotsOnGoalAgainst;
      team.total.goals += stat.goalsFor;
      team.total.goalsAgainst += stat.goalsAgainst;

      if (stat.goalsFor > stat.goalsAgainst) {
        team.wins++;
      } else if (stat.goalsAgainst > stat.goalsFor) {
        team.losses++;
      } else {
        team.draws++;
      }

      if (i > team.stats.length - 6) {
        team.last5.xG += stat.xG;
        team.last5.xGA += stat.xGA;
        team.last5.corners += stat.corners;
        team.last5.cornersAgainst += stat.cornersAgainst;
        team.last5.shotsOnGoal += stat.shotsOnGoal;
        team.last5.shotsOnGoalAgainst += stat.shotsOnGoalAgainst;
        team.last5.goals += stat.goalsFor;
        team.last5.goalsAgainst += stat.goalsAgainst;
        if (stat.goalsFor > stat.goalsAgainst) {
          team.form = "W" + team.form;
        } else if (stat.goalsFor == stat.goalsAgainst) {
          team.form = "D" + team.form;
        } else {
          team.form = "L" + team.form;
        }
      }
    }

    team.perGame.xG = team.total.xG / team.matches;
    team.perGame.xGA = team.total.xGA / team.matches;
    team.perGame.corners = team.total.corners / team.matches;
    team.perGame.cornersAgainst = team.total.cornersAgainst / team.matches;
    team.perGame.shotsOnGoal = team.total.shotsOnGoal / team.matches;
    team.perGame.shotsOnGoalAgainst =
      team.total.shotsOnGoalAgainst / team.matches;
    team.perGame.goals = team.total.goals / team.matches;
    team.perGame.goalsAgainst = team.total.goalsAgainst / team.matches;

    team.last5PerGame.xG = team.last5.xG / 5;
    team.last5PerGame.xGA = team.last5.xGA / 5;
    team.last5PerGame.corners = team.last5.corners / 5;
    team.last5PerGame.cornersAgainst = team.last5.cornersAgainst / 5;
    team.last5PerGame.goals = team.last5.goals / 5;
    team.last5PerGame.goalsAgainst = team.last5.goalsAgainst / 5;
    team.last5PerGame.shotsOnGoal = team.last5.shotsOnGoal / 5;
    team.last5PerGame.shotsOnGoalAgainst = team.last5.shotsOnGoalAgainst / 5;
  }

  console.log(teams);

  return teams;
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
