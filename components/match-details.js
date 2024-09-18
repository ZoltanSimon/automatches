import { imagePath } from "../common-functions.js";
export function oneFixture(response) {
  let fixture = response[0];
  let players = [];
  let homeTeam = fixture.teams.home;
  let awayTeam = fixture.teams.away;

  homeTeam.goals = [];
  awayTeam.goals = [];
  homeTeam.players = [];
  awayTeam.players = [];
  homeTeam.subs = [];
  awayTeam.subs = [];

  fixture.events.forEach((element) => {
    if (element.type == "Goal") {
      if (element.team.name == homeTeam.name) {
        homeTeam.goals.push(element);
      } else {
        awayTeam.goals.push(element);
      }
    }
    if (element.type == "subst") {
      if (element.team.name == homeTeam.name) {
        homeTeam.subs.push(element);
      } else {
        awayTeam.subs.push(element);
      }
    }
  });

  fixture.lineups.forEach((team, index) => {
    players = [];
    for (let i = 0; i < team.startXI.length; i++) {
      players.push(team.startXI[i].player.name);
    }
    if (index == 0) {
      homeTeam.players = players.slice();
    } else {
      awayTeam.players = players.slice();
    }
  });

  document.getElementById("standings").innerHTML = ``;

  let addToPage = `
    <table>
      <tr>
        <td><img src=${imagePath(homeTeam.id)} width="30px"></td>
        <td><a href="${homeTeam.name}/">${homeTeam.name}</a></td>
        <td width="30px">${fixture.goals.home || 0}</td>
        <td><img src=${imagePath(awayTeam.id)} width="30px"</td>
        <td><a href="${awayTeam.name}/">${awayTeam.name}</a></td>
        <td width="30px">${fixture.goals.away || 0}</td>
      </tr>
    </table>
    <table>
      <tr>
        <td width=50%>${addGoals(homeTeam.goals)}</td>
        <td>${addGoals(awayTeam.goals)}</td>
      </tr>
    </table>
    Location: ${fixture.fixture.venue.name}, 
    ${fixture.fixture.venue.city}<br/>
    Referee: ${fixture.fixture.referee}<br/>
    <br/>
    <b>${homeTeam.name}</b></br>
    Manager: ${fixture.lineups[0].coach.name}<br/>
    Starting 11: ${homeTeam.players.join(", ")}<br/>
    Subs: ${subs(homeTeam.subs)}<br/><br/>
    <b>${awayTeam.name}</b><br/>
    Manager: ${fixture.lineups[1].coach.name}<br/>
    Starting 11: ${awayTeam.players.join(", ")}<br/>
    Subs: ${subs(awayTeam.subs)}`;

  document.getElementById("one-fixture").innerHTML += addToPage;
}

function addGoals(goals) {
  let retString = ``;
  goals.forEach((a) => {
    retString += `${a.player.name} ${a.time.elapsed}'<br/>`;
  });
  return retString;
}

const subs = (subs) => {
  let retString = ``;
  subs.forEach((a) => {
    retString += `${a.assist.name} ${a.time.elapsed}', `;
  });
  return retString;
};
