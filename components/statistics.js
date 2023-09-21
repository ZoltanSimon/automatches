const tds = `<td width='33%' style='text-align: center; border-color: #1D3557; padding: 9px;'>`;
class Stat {
  constructor(tag, title) {
    this.tag = tag;
    this.title = title;
    this.homeTeam = 0;
    this.awayTeam = 0;
  }
}
export function addStats(statsAPI) {
  let homeTeamName = statsAPI[0].team.name;
  let awayTeamName = statsAPI[1].team.name;
  let addToPage = ``;

  let stats = [];
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

  addToPage = `<div id="match-stats"><table style='border-collapse: collapse;' border='1'><thead><tr>${tds}${homeTeamName}</td>${tds} </td>${tds}${awayTeamName}</td></tr></thead><tbody>`;

  for (let i = 0; i < stats.length; i++) {
    addToPage += `<tr>${tds}${stats[i].homeTeam}</td>${tds}${stats[i].title}</td>${tds}${stats[i].awayTeam}</td></tr>`;
  }
  addToPage += `</tbody></table></div>`;
  console.log(addToPage);
  document.getElementById("one-fixture").innerHTML += addToPage;
  //1035067
}
