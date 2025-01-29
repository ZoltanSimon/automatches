import {
  buildTableForTableType,
  imgs,
  loadClubLogo,
  leagueBannerBig,
} from "../instapics.js";
import { Stat } from "../classes/stat.js";
import { removeNewlines } from "../common-functions.js";

const tds = `<td width='33%' style='text-align: center; border-color: #1D3557; padding: 10px;'>`;

export function addMatchStats(apiResponse) {
  let statsAPI = apiResponse.statistics;
  let homeTeam = statsAPI[0].team;
  let awayTeam = statsAPI[1].team;
  let addToPage = ``;
  let values;

  loadClubLogo(homeTeam.id);
  loadClubLogo(awayTeam.id);

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
  <tr class="main-table-header" style='font-size:30;'>
  <th style='width: 250px; text-align: center; border-color: #1D3557; padding: 10px;' id="${homeTeam.id}">${homeTeam.name}</th>
  <th style='width: 300px; text-align: center; border-color: #1D3557; padding: 10px;'>-</th>
  <th style='width: 250px; text-align: center; border-color: #1D3557; padding: 10px;' id="${awayTeam.id}">${awayTeam.name}</th>
  </tr></thead><tbody>`;

  for (let i = 0; i < stats.length; i++) {
    values = stats[i].getValues();
    addToPage += `<tr>${tds}${values[0]}</td>${tds}${stats[i].title}</td>${tds}${values[1]}</td></tr>`;
  }
  addToPage += `</tbody></table>`;

  document.getElementById("league-name").innerHTML = apiResponse.league.name;
  document.getElementById("league-id").innerHTML = apiResponse.league.id;
  document.getElementById("round-no").innerHTML = apiResponse.league.round;

  document.getElementById("one-fixture").innerHTML += addToPage;
  document.getElementById(
    "one-fixture"
  ).innerHTML += `<div id='league-match-stats'>${apiResponse.league.round.replace(
    "Regular Season - ",
    "Round "
  )} - ${apiResponse.league.name}</div>`;
}

export function matchStatsToCanvas() {
  let imgToAdd = [];
  let statisticsTable = document.getElementById("match-stats");
  let yPos = 190;

  statisticsTable.rows[0].style.backgroundColor = "#1D3557";
  statisticsTable.rows[0].style.fontWeight = "bold";
  statisticsTable.rows[0].style.color = "#F1FAEE";

  imgToAdd.push({
    img: imgs.clubs[statisticsTable.rows[0].children[0].id],
    imgHeight: 56,
    startX: 490,
    startY: yPos,
  });

  imgToAdd.push({
    img: imgs.clubs[statisticsTable.rows[0].children[2].id],
    imgHeight: 56,
    startX: 490 + 106,
    startY: yPos,
  });

  statisticsTable.rows[0].children[1].innerHTML = "-";

  buildTableForTableType(
    removeNewlines(statisticsTable.outerHTML),
    imgToAdd,
    yPos
  );

  leagueBannerBig(yPos);
}
