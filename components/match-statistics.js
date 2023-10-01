import { Stat } from "../stat.js";

const tds = `<td width='33%' style='text-align: center; border-color: #1D3557; padding: 10px;'>`;

export function addMatchStats(apiResponse) {
  let statsAPI = apiResponse.statistics;
  let homeTeamName = statsAPI[0].team.name;
  let awayTeamName = statsAPI[1].team.name;
  let addToPage = ``;
  let values;

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
  console.log(stats);

  addToPage = `<div id="match-stats"><table style='border-collapse: collapse;' border='1'><thead><tr>${tds}${homeTeamName}</td>${tds}*${homeTeamName}* - *${awayTeamName}*</td>${tds}${awayTeamName}</td></tr></thead><tbody>`;

  for (let i = 0; i < stats.length; i++) {
    values = stats[i].getValues();
    console.log(values);
    addToPage += `<tr>${tds}${values[0]}</td>${tds}${stats[i].title}</td>${tds}${values[1]}</td></tr>`;
  }
  addToPage += `</tbody></table></div>`;
  console.log(addToPage);
  document.getElementById("one-fixture").innerHTML += addToPage;
  //1035067
  //1035093
  //1038016
}
