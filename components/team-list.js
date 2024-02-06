export function teamList(response) {
  console.log(response);
  let addToPage;
  let tds = `<td style="text-align: center; padding:2px;">`;
  let thisTeam, thisTr, thisId;

  addToPage = `<table style='border-collapse: collapse; border: 3px solid #1D3557;' border='1' id="team-list-table">
    <thead>
    <th rowspan=2>Team</th>
    <th style="text-align: center; padding:2px;" colspan=9>Total</th>
    <th style="text-align: center; padding:2px;" colspan=8>Per Game</th>
    <th style="text-align: center; padding:2px;" colspan=8>Last 5</th>
    <th style="text-align: center; padding:2px;" colspan=8>Last 5 Per Game</th>
    </thead>
    <tbody><tr>
    ${tds}</td>
    ${tds}Matches</td>
    ${tds}Goals</td>
    ${tds}GoalsA</td>
    ${tds}xG</td>
    ${tds}xGA</td>
    ${tds}Corners</td>
    ${tds}CornersA</td>
    ${tds}ShotsG</td>
    ${tds}ShotsGA</td>
    ${tds}Goals</td>
    ${tds}GoalsA</td>
    ${tds}xG</td>
    ${tds}xGA</td>
    ${tds}Corners</td>
    ${tds}CornersA</td>
    ${tds}ShotsG</td>
    ${tds}ShotsGA</td>
    ${tds}Goals</td>
    ${tds}GoalsA</td>
    ${tds}xG</td>
    ${tds}xGA</td>
    ${tds}Corners</td>
    ${tds}CornersA</td>
    ${tds}ShotsG</td>
    ${tds}ShotsGA</td>
    ${tds}Goals</td>
    ${tds}GoalsA</td>
    ${tds}xG</td>
    ${tds}xGA</td>
    ${tds}Corners</td>
    ${tds}CornersA</td>
    ${tds}ShotsG</td>
    ${tds}ShotsGA</td>
    </tr>`;

  for (let i = 0; i < response.length; i++) {
    thisTeam = response[i];
    addToPage += `<tr>
    <td>${thisTeam.name}</td>
    ${tds}${thisTeam.matches}</td>
    ${tds}${thisTeam.total.goals}</td>
    ${tds}${thisTeam.total.goalsAgainst}</td>
    ${tds}${thisTeam.total.xG.toFixed(2)}</td>
    ${tds}${thisTeam.total.xGA.toFixed(2)}</td>
    ${tds}${thisTeam.total.corners}</td>
    ${tds}${thisTeam.total.cornersAgainst}</td>
    ${tds}${thisTeam.total.shotsOnGoal}</td>
    ${tds}${thisTeam.total.shotsOnGoalAgainst}</td>
    ${tds}${thisTeam.perGame.goals.toFixed(2)}</td>
    ${tds}${thisTeam.perGame.goalsAgainst.toFixed(2)}</td>
    ${tds}${thisTeam.perGame.xG.toFixed(2)}</td>
    ${tds}${thisTeam.perGame.xGA.toFixed(2)}</td>
    ${tds}${thisTeam.perGame.corners.toFixed(2)}</td>
    ${tds}${thisTeam.perGame.cornersAgainst.toFixed(2)}</td>
    ${tds}${thisTeam.perGame.shotsOnGoal.toFixed(2)}</td>
    ${tds}${thisTeam.perGame.shotsOnGoalAgainst.toFixed(2)}</td>
    ${tds}${thisTeam.last5.goals}</td>
    ${tds}${thisTeam.last5.goalsAgainst}</td>
    ${tds}${thisTeam.last5.xG.toFixed(2)}</td>
    ${tds}${thisTeam.last5.xGA.toFixed(2)}</td>
    ${tds}${thisTeam.last5.corners}</td>
    ${tds}${thisTeam.last5.cornersAgainst}</td>
    ${tds}${thisTeam.last5.shotsOnGoal}</td>
    ${tds}${thisTeam.last5.shotsOnGoalAgainst}</td>
    ${tds}${thisTeam.last5PerGame.goals.toFixed(2)}</td>
    ${tds}${thisTeam.last5PerGame.goalsAgainst.toFixed(2)}</td>
    ${tds}${thisTeam.last5PerGame.xG.toFixed(2)}</td>
    ${tds}${thisTeam.last5PerGame.xGA.toFixed(2)}</td>
    ${tds}${thisTeam.last5PerGame.corners.toFixed(2)}</td>
    ${tds}${thisTeam.last5PerGame.cornersAgainst.toFixed(2)}</td>
    ${tds}${thisTeam.last5PerGame.shotsOnGoal.toFixed(2)}</td>
    ${tds}${thisTeam.last5PerGame.shotsOnGoalAgainst.toFixed(2)}</td>
    </tr>`;
  }
  addToPage += `</tbody></table>`;

  document.getElementById("team-list-betting").innerHTML += addToPage;

  let matchesTable = document.getElementById("match-list");

  for (let i = 0; i < matchesTable.rows.length; i++) {
    thisTr = matchesTable.rows[i];
    /*thisId = thisTr.children[2].id;
    let found = response.find((element) => element.id == thisId);*/

    console.log(findTeamById(response, thisTr.children[2].id));
    console.log(findTeamById(response, thisTr.children[5].id));
  }
}

function findTeamById(response, thisId) {
  return response.find((element) => element.id == thisId);
}
