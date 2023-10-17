export async function getLocalPlayerStats(playerId) {
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
    duelsTotal = 0;
  for (let i = 0; i < allLeagues.length; i++) {
    let response = await fetch(`Allmatches/${allLeagues[i]}.json`);
    let league = await response.json();
    console.log(league);
    for (let i = 0; i < league.length; i++) {
      if (league[i].fixture.status.short == "FT") {
        let response2 = await fetch(
          `Matches/${league[i].fixture.id}.json`
        ).catch((err) => {
          console.log("a");
          handleError(err, league[i].fixture.id);
        });
        let match = await response2.json();
        console.log(match);
        /*.then((response2) => {
            if (response2.ok) {
                return response2.json();
            }
            throw new Error("Something went wrong");
            })*/
        //.then((matchJson) => {
        //console.log(matchJson);
        for (let { players } of match) {
          playerFound = players[0].players.find((x) => x.player.id == playerId);
          if (!playerFound)
            playerFound = players[1].players.find(
              (x) => x.player.id == playerId
            );
          if (playerFound) {
            stats = playerFound.statistics[0];
            if (stats.goals.total) goals += stats.goals.total;
            if (stats.goals.assists) assists += stats.goals.assists;
            if (stats.shots.on) shotsOn += stats.shots.on;
            if (stats.shots.total) shotsTotal += stats.shots.total;
            if (stats.dribbles.attempts)
              dribblesAttempts += stats.dribbles.attempts;
            if (stats.dribbles.success) dribblesSucc += stats.dribbles.success;
            if (stats.duels.won) duelsWon += stats.duels.won;
            if (stats.duels.total) duelsTotal += stats.duels.total;
            if (stats.passes.key) keyPasses += stats.passes.key;
            if (stats.fouls.drawn) foulsDrawn += stats.fouls.drawn;
            apps++;
            minutes += stats.games.minutes;
          }
        }
        gaper90 = (((goals + assists) * 90) / minutes).toFixed(2);
      }
    }
  }

  console.log(apps);
  return {
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
  };
}

function handleError(err) {
  console.log(err);
  console.log(json[i].fixture.id);
  downloadResultFromApi(json[i].fixture.id);
}
