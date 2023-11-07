import { Stat } from "../stat.js";

//129718, 1100
//sfsdfdsfwefwefwefwefew<table style='border-collapse: collapse;' border='1'> <thead> <tr> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>J. Bellingham</td> </tr> </thead> <tbody> <tr> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>Games</td> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>undefined</td> </tr> <tr> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>Goals</td> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>5</td> </tr> <tr> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>Assists</td> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>1</td> </tr> <tr> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>Shots</td> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>7/8</td> </tr> <tr> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>Dribbles</td> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>6/11</td> </tr> <tr> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>Fouls drawn</td> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>14</td> </tr> <tr> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>Yellow cards</td> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>0</td> </tr> </tbody> </table>

let width = 50;
let values;

export function addPlayerStats(statsAPI, statsAPI2 = null) {
  console.log(statsAPI);
  console.log(statsAPI2);
  if (statsAPI) width = 33;
  let tds = `<td width='${width}%' style='text-align: center; border-color: #1D3557; padding: 12px;'>`;

  let stats = [];
  stats.push(new Stat("name", "Player Name"));
  stats.push(new Stat("team", "Team"));
  stats.push(new Stat("apps", "Appearences"));
  stats.push(new Stat("minutes", "Minutes"));
  stats.push(new Stat("goals", "Goals"));
  stats.push(new Stat("assists", "Assists"));
  stats.push(new Stat("gap90", "GA per 90"));
  stats.push(new Stat("shots", "Shots on Target / Total"));
  stats.push(new Stat("dribbles", "Dribbles Succeeded / Attempted"));
  stats.push(new Stat("duels", "Duels Won / Total"));
  stats.push(new Stat("key_passes", "Key Passes"));
  stats.push(new Stat("fouls_drawn", "Fouls Drawn"));

  for (let i in statsAPI) {
    //console.log(i);
    let thatStat = stats.find((x) => x.tag === i);

    if (thatStat) {
      if (!statsAPI[i]) {
        thatStat.homeTeam = 0;
      } else {
        thatStat.homeTeam = statsAPI[i];
      }
      if (!statsAPI2[i]) {
        thatStat.awayTeam = 0;
      } else {
        thatStat.awayTeam = statsAPI2[i];
      }
    }
  }
  console.log(stats);
  let addToPage = `
  <table id='player-stats' style='border-collapse: collapse;' border='1'><tbody id=${statsAPI.id}|${statsAPI2.id}>`;

  for (let i = 0; i < stats.length; i++) {
    values = stats[i].getValues();
    addToPage += `<tr>${tds}${values[0]}</td>${tds}${stats[i].title}</td>${tds}${values[1]}</td></tr>`;
  }
  addToPage += `</tbody></table>`;
  document.getElementById("one-fixture").innerHTML += addToPage;
  console.log(removeNewlines(addToPage));
}
