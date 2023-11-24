import { buildTableForTableType, imgs, ctx } from "./../instapics.js";

export function playerGoalList(response) {
  console.log(response);
  let addToPage;
  let tds = `<td style="text-align: center;">`;
  let thisPlayer;

  addToPage = `<table style='border-collapse: collapse; border-color: #1D3557;' border='1' id="player-list-table">
  <thead><tr><td colspan=2>Player</td><td>Team</td>${tds}Apps</td>${tds}Goals</td>${tds}Assists</td></tr></thead>
  <tbody>`;

  for (let i = 0; i < response.length; i++) {
    thisPlayer = response[i];
    addToPage += `<tr><td>${thisPlayer.id}</td><td>${thisPlayer.name}</td><td>${thisPlayer.team}</td>${tds}${thisPlayer.apps}</td>${tds}${thisPlayer.goals}</td>${tds}${thisPlayer.assists}</td></tr>`;
  }
  addToPage += `</tbody></table>`;

  document.getElementById("player-list").innerHTML += addToPage;
}

export function playerListToCanvas() {
  let imgToAdd = [];
  let playerFace, thisTr;
  let playerListTable = document.getElementById("player-list-table");

  playerListTable.cellPadding = 10;

  playerListTable.rows[0].style.backgroundColor = "#457B9D";
  playerListTable.rows[0].style.fontWeight = "bold";

  for (let i = 1; i < playerListTable.rows.length; i++) {
    thisTr = playerListTable.rows[i];
    playerFace = imgs[thisTr.children[0].innerHTML];

    imgToAdd.push({
      img: playerFace,
      imgHeight: 80,
      startX: 102,
      startY: 82 + i * 80,
    });

    thisTr.style.height = "80px";
    thisTr.children[0].innerHTML = "";
    thisTr.children[0].style.width = "62px";
    thisTr.children[1].style.width = "231px";
    thisTr.children[2].style.width = "232px";
    thisTr.children[3].style.width = "76px";
    thisTr.children[4].style.width = "76px";
    thisTr.children[5].style.width = "76px";
  }

  buildTableForTableType(
    removeNewlines(playerListTable.outerHTML),
    imgToAdd,
    110
  );
  ctx.fillStyle = "#e63946";
  //ctx.fillText(leagueName, 540, 960);
}
