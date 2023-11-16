import { downloadResultFromApi } from "./webapi-handler.js";

export async function getLocalPlayerStats(inputPlayer) {
  let playerFound;
  let stats;
  let goals = 0,
    apps = 0,
    minutes = 0,
    assists = 0,
    gaper90 = 0,
    shotsTotal = 0,
    shotsOn = 0,
    dribblesSucc = 0,
    dribblesAttempts = 0,
    keyPasses = 0,
    foulsDrawn = 0,
    duelsWon = 0,
    duelsTotal = 0,
    playerName = "",
    foundIndex = -1,
    teamName = "",
    competitions = [],
    thisComp = "";
  for (let i = 0; i < allLeagues.length; i++) {
    let response = await fetch(`leagues/${allLeagues[i]}.json`);
    let league = await response.json();

    for (let i = 0; i < league.length; i++) {
      if (
        league[i].fixture.status.short == "FT" &&
        //league[i].teams.home.id == inputPlayer.club ||
        //league[i].teams.away.id == inputPlayer.club ||
        (league[i].teams.home.id == inputPlayer.nation ||
          league[i].teams.away.id == inputPlayer.nation)
      ) {
        thisComp = league[i].league.name;
        console.log(thisComp);
        console.log(league[i].fixture.id);
        let response2 = await fetch(`Matches/${league[i].fixture.id}.json`);

        if (!response2.ok) {
          await handleError(league[i].fixture.id);
        } else {
          foundIndex = -1;
          let match = await response2.json();
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
              console.log(playerFound);
              stats = playerFound.statistics[0];
              if (stats.goals.total) goals += stats.goals.total;
              if (stats.goals.assists) assists += stats.goals.assists;
              if (stats.shots.on) shotsOn += stats.shots.on;
              if (stats.shots.total) shotsTotal += stats.shots.total;
              if (stats.dribbles.attempts)
                dribblesAttempts += stats.dribbles.attempts;
              if (stats.dribbles.success)
                dribblesSucc += stats.dribbles.success;
              if (stats.duels.won) duelsWon += stats.duels.won;
              if (stats.duels.total) duelsTotal += stats.duels.total;
              if (stats.passes.key) keyPasses += stats.passes.key;
              if (stats.fouls.drawn) foulsDrawn += stats.fouls.drawn;
              apps++;
              minutes += stats.games.minutes;
              if (!playerName) playerName = playerFound.player.name;
              if (!teamName) teamName = players[foundIndex].team.name;
              if (competitions.indexOf(thisComp) == -1)
                competitions.push(thisComp);
            }
          }
          gaper90 = (((goals + assists) * 90) / minutes).toFixed(2);
        }
      }
    }
  }

  console.log(apps);
  return {
    name: playerName,
    id: inputPlayer.id,
    team: teamName,
    apps: apps,
    goals: goals,
    assists: assists,
    minutes: minutes,
    gap90: gaper90,
    shots: `${shotsOn} / ${shotsTotal}`,
    dribbles: `${dribblesSucc} / ${dribblesAttempts}`,
    duels: `${duelsWon} / ${duelsTotal}`,
    key_passes: keyPasses,
    fouls_drawn: foulsDrawn,
    competitions: competitions.join(", "),
  };
}

export async function getResultFromLocal(fixtureID) {
  let response = await fetch(`Matches/${fixtureID}.json`);
  if (!response.ok) {
    let downloadedResponse = await downloadResultFromApi(fixtureID);
    console.log(downloadedResponse.response);
    return downloadedResponse.response;
  }
  return await response.json();
}

async function handleError(id) {
  console.log(id);
  document.getElementById("missing-matches").innerHTML += id + "<br/>";

  //downloadResultFromApi(id);
}
