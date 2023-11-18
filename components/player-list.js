import { buildTableForTableType, imgs, ctx } from "./../instapics.js";

export function playerGoalList(response) {
  console.log(response);
  let addToPage;
  let tds = `<td style="text-align: center;">`;
  let thisPlayer;

  addToPage = `<table style='border-collapse: collapse; border-color: #1D3557;' border='1' id="player-list-table">`;

  for (let i = 0; i < response.length; i++) {
    thisPlayer = response[i];
    addToPage += `<tr><td>${thisPlayer.name}</td><td>${thisPlayer.goals}</td><td>${thisPlayer.assists}</td></tr>`;
  }
  addToPage += `</table>`;

  document.getElementById("player-list").innerHTML += addToPage;
}

export function playerListToCanvas() {
  let imgToAdd = [];
  let playerListTable = document.getElementById("player-list-table");

  playerListTable.rows[0].style.backgroundColor = "#457B9D";
  playerListTable.rows[0].style.fontWeight = "bold";

  /*for (let i = 0; i < teamLogos.length; i++) {
    for (let j = 0; j < clubs.length; j++) {
      if (teamLogos[i].indexOf(`*${clubs[j].name}*`) > -1) {
        imgToAdd.push({
          img: imgs[clubs[j].name],
          imgHeight: 50,
          startX: 430 + i * 172,
          startY: 181,
        });
      }
    }
  }*/

  //playerListTable.rows[0].children[1].innerHTML = "-";

  buildTableForTableType(
    removeNewlines(playerListTable.outerHTML),
    imgToAdd,
    180
  );
  ctx.fillStyle = "#e63946";
  //ctx.fillText(leagueName, 540, 960);
}
