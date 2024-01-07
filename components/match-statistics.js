import {
  buildTableForTableType,
  imgs,
  ctx,
  loadClubLogo,
  writeStrokedText,
} from "./../instapics.js";
import { Stat } from "../stat.js";
import { clubs } from "./../data/clubs.js";
import { removeNewlines } from "../common-functions.js";

const tds = `<td width='33%' style='text-align: center; border-color: #1D3557; padding: 10px;'>`;

export function addMatchStats(apiResponse) {
  let statsAPI = apiResponse.statistics;
  let homeTeamName = statsAPI[0].team.name;
  let awayTeamName = statsAPI[1].team.name;
  let addToPage = ``;
  let values;

  loadClubLogo(statsAPI[0].team.id);
  loadClubLogo(statsAPI[1].team.id);

  let stats = [];
  stats.push(new Stat("goals", "Score"));
  stats.push(new Stat("expected_goals", "Expected Goals"));
  stats.push(new Stat("Ball Possession", "Possession"));
  stats.push(new Stat("Total Shots", "Total Shots"));
  stats.push(new Stat("Shots on Goal", "Shots on Goal"));
  stats.push(new Stat("Total passes", "Passes"));
  stats.push(new Stat("Passes accurate", "Accurate passes"));
  stats.push(new Stat("Corner Kicks", "Corners"));
  stats.push(new Stat("Offsides", "Offsides"));
  stats.push(new Stat("Fouls", "Fouls"));
  stats.push(new Stat("Yellow Cards", "Yellow Cards"));
  stats.push(new Stat("Red Cards", "Red Cards"));

  stats[0].homeTeam = apiResponse.goals.home;
  stats[0].awayTeam = apiResponse.goals.away;

  for (let i = 0; i < statsAPI[0].statistics.length; i++) {
    let thatStat = stats.find((x) => x.tag === statsAPI[0].statistics[i].type);
    if (thatStat) {
      if (!statsAPI[0].statistics[i].value) {
        thatStat.homeTeam = 0;
      } else {
        thatStat.homeTeam = statsAPI[0].statistics[i].value;
      }
      if (!statsAPI[1].statistics[i].value) {
        thatStat.awayTeam = 0;
      } else {
        thatStat.awayTeam = statsAPI[1].statistics[i].value;
      }
    }
  }

  addToPage = `
  <table id='match-stats' style='border-collapse: collapse; border: 3px solid #1D3557;' border='1'><thead>
  <tr>
  <td style='width: 250px; text-align: center; border-color: #1D3557; padding: 10px;'>${homeTeamName}</td>
  <td style='width: 300px; text-align: center; border-color: #1D3557; padding: 10px;'>*${homeTeamName}* - *${awayTeamName}*</td>
  <td style='width: 250px; text-align: center; border-color: #1D3557; padding: 10px;'>${awayTeamName}</td>
  </tr></thead><tbody>`;

  for (let i = 0; i < stats.length; i++) {
    values = stats[i].getValues();
    addToPage += `<tr>${tds}${values[0]}</td>${tds}${stats[i].title}</td>${tds}${values[1]}</td></tr>`;
  }
  addToPage += `</tbody></table>`;
  document.getElementById("one-fixture").innerHTML += addToPage;
  document.getElementById(
    "one-fixture"
  ).innerHTML += `<div id='league-match-stats'>${apiResponse.league.round.replace(
    "Regular Season - ",
    "Round "
  )} - ${apiResponse.league.name}</div>`;
  //1035067
  //1035093
  //1038016
  //1048908
}

export function matchStatsToCanvas() {
  let imgToAdd = [];
  let statisticsTable = document.getElementById("match-stats");
  let teamLogos = statisticsTable.rows[0].children[1].innerHTML.split(" - ");
  let leagueName = document.getElementById("league-match-stats").innerHTML;

  statisticsTable.rows[0].style.backgroundColor = "#457B9D";
  statisticsTable.rows[0].style.fontWeight = "bold";

  for (let i = 0; i < teamLogos.length; i++) {
    for (let j = 0; j < clubs.length; j++) {
      if (teamLogos[i].indexOf(`*${clubs[j].name}*`) > -1) {
        imgToAdd.push({
          img: imgs.clubs[clubs[j].id],
          imgHeight: 50,
          startX: 430 + i * 172,
          startY: 184,
        });
      }
    }
  }

  statisticsTable.rows[0].children[1].innerHTML = "-";

  buildTableForTableType(
    removeNewlines(statisticsTable.outerHTML),
    imgToAdd,
    180
  );

  let rounNo = leagueName.split(" - ")[0];
  let league = leagueName.split(" - ")[leagueName.split(" - ").length - 1];
  ctx.fillText(rounNo, 540, 922);
  writeStrokedText({
    text: [league],
    strokeStyle: "#1d3557",
    fillStyle: "#e63946",
    y: 130,
  });
}
