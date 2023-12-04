import { Stat } from "../stat.js";
import {
  buildTableForTableType,
  imgs,
  loadPlayerFace,
} from "./../instapics.js";

let width = 50;
let values;

export function addPlayerStats(statsAPI, statsAPI2 = null) {
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
  stats.push(new Stat("dribbles", "Dribbles"));
  stats.push(new Stat("duels", "Duels Won / Total"));
  stats.push(new Stat("key_passes", "Key Passes"));
  stats.push(new Stat("fouls_drawn", "Fouls Drawn"));
  stats.push(new Stat("competitions", "Competitions"));

  for (let i in statsAPI) {
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
  loadPlayerFace(statsAPI.id);
  loadPlayerFace(statsAPI2.id);
  let addToPage = `
  <table id='player-stats' style='border-collapse: collapse; border: 3px solid #1D3557;' border='1'><tbody id=${statsAPI.id}|${statsAPI2.id}>`;

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
  console.log(playerIDs);

  statsTable.rows[0].style.backgroundColor = "#457B9D";
  statsTable.rows[0].style.fontWeight = "bold";
  statsTable.rows[statsTable.rows.length - 1].style.backgroundColor = "#457B9D";
  statsTable.rows[0].children[0].style.width = "250px";
  statsTable.rows[0].children[1].style.width = "300px";
  statsTable.rows[0].children[2].style.width = "250px";
  console.log(imgs);
  imgToAdd.push({
    img: imgs.players[playerIDs[0]],
    imgHeight: 180,
    startX: 160,
    startY: 60,
  });
  imgToAdd.push({
    img: imgs.players[playerIDs[1]],
    imgHeight: 180,
    startX: 746,
    startY: 60,
  });
  buildTableForTableType(removeNewlines(statsTable.outerHTML), imgToAdd, 240);
}
