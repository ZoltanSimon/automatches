import { Stat } from "../stat.js";
import { buildTableForTableType, imgs } from "./../instapics.js";

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

export function playerStatsToCanvas() {
  let imgToAdd = [];
  let statsTable = document.getElementById("player-stats");
  var tBody = statsTable.getElementsByTagName("tbody")[0];
  let playerIDs = tBody.getAttribute("id").split("|");

  imgToAdd.push({
    img: imgs[playerIDs[0]],
    imgHeight: 200,
    startX: 500,
    startY: 60,
  });
  imgToAdd.push({
    img: imgs[playerIDs[1]],
    imgHeight: 200,
    startX: 1670,
    startY: 60,
  });
  buildTableForTableType(removeNewlines(statsTable.outerHTML), imgToAdd, 260);
}
