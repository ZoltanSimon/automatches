import { buildTableForTableType, imgs, ctx } from "./../instapics.js";
import { clubs } from "./../data/clubs.js";

export function matchList(response, showID = false) {
  console.log(response);
  let addToPage;
  let fixtures = response.response;
  let leagueName = fixtures[0].league.name;
  let round = fixtures[0].league.round;
  let thisID = ``;
  let tds = `<td style="text-align: center;">`;

  fixtures.sort(function (a, b) {
    return new Date(a.fixture.date) - new Date(b.fixture.date);
  });

  addToPage = `<table style='border-collapse: collapse; border-color: #1D3557;' border='1' id="match-list">`;

  fixtures.forEach((element) => {
    if (showID) thisID = `${tds}${element.fixture.id}</td>`;

    addToPage += `<tr">
    ${tds}${new Date(element.fixture.date).getDate()}.${
      new Date(element.fixture.date).getMonth() + 1
    }.${new Date(element.fixture.date).getFullYear()}</td>
    <td style="text-align: center;"><img src=${imagePath(
      element.teams.home.name
    )} alt="*${element.teams.home.name
      .replace("ó", "o")
      .replace("ę", "e")}*" width="30px"></td>
      <td style="text-align: left;">${element.teams.home.name}</td>
    ${tds}${!isNaN(parseInt(element.goals.home)) ? element.goals.home : ""}</td>
    <td style="text-align: center;"><img src=${imagePath(
      element.teams.away.name
    )} alt="*${element.teams.away.name
      .replace("ó", "o")
      .replace("ę", "e")}*" width="30px"></td>
      <td style="text-align: left;">${element.teams.away.name}</td>
    ${tds}${
      !isNaN(parseInt(element.goals.away)) ? element.goals.away : ""
    }</td>${thisID}
      </tr>`;
  });

  addToPage += `</table>`;
  document.getElementById("league-name").innerHTML = leagueName;
  document.getElementById("round-no").innerHTML = round;
  document.getElementById("fixtures-info").innerHTML += addToPage;

  document
    .querySelectorAll("#match-list tr")
    .forEach((e) => e.addEventListener("click", clickHandler));
}

export function matchesToCanvas(sourceDiv) {
  let yPos = 140;
  let imgToAdd = [];
  let matchesTable = document.getElementById(sourceDiv);
  let leagueName = document.getElementById("league-name").innerHTML;
  let round = document.getElementById("round-no").innerHTML;
  var rowCount = matchesTable.rows.length;
  let thisTr, thisTd, thisClub;
  let index = 7;
  let isResult = true;
  let notResultGap = 0;
  let notResultGap2 = 0;
  let date, logo1, team1, logo2, team2;

  if (matchesTable.rows.length < 11) yPos = 240;

  matchesTable.cellPadding = 10;

  for (var i = 0; i < rowCount; i++) {
    console.log(matchesTable.rows[i].cells.length);
    if (matchesTable.rows[i].cells.length == index + 1)
      matchesTable.rows[i].deleteCell(index);
  }

  for (let i = 0; i < matchesTable.rows.length; i++) {
    thisTr = matchesTable.rows[i];
    if (thisTr.children[3].innerHTML == "") isResult = false;

    if (!isResult) {
      thisTr.deleteCell(6);
      notResultGap = 60;
      notResultGap2 = 10;
      thisTr.children[3].innerHTML = "VS";
      thisTr.children[3].style.width = "63px";
    } else {
      thisTr.children[3].style.width = "50px";
      thisTr.children[6].style.width = "50px";
    }

    thisTr.children[0].style.width = "130px";
    thisTr.children[1].style.width = "40px";
    thisTr.children[2].style.width = "240px";
    thisTr.children[4].style.width = "40px";
    thisTr.children[5].style.width = "240px";

    for (let j = 0; j < thisTr.children.length; j++) {
      thisTd = thisTr.children[j];
      for (let k = 0; k < clubs.length; k++) {
        thisClub = clubs[k];
        if (thisTd.innerHTML.indexOf(`*${thisClub}*`) > -1) {
          imgToAdd.push({
            img: imgs[thisClub],
            imgHeight: 50,
            startX: 235 + notResultGap + j * (260 + notResultGap2),
            startY: yPos + 2 + i * 52,
          });
          thisTd.innerHTML = " ";
        }
      }
    }
  }

  ctx.fillText("Round " + round.split(" - ")[1], 540, 880);
  ctx.fillStyle = "#e63946";
  ctx.fillText(leagueName, 540, 820);

  /*ctx.fillText("Season 2023/24, Week 12", 540, 880);
  ctx.fillStyle = "#e63946";
  ctx.fillText("Games to Watch over the Weekend", 540, 820);*/

  console.log(removeNewlines(matchesTable.outerHTML));

  buildTableForTableType(
    removeNewlines(matchesTable.outerHTML),
    imgToAdd,
    yPos
  );
}

function clickHandler(event) {
  // Here, `this` refers to the element the event was hooked on
  console.log(event.currentTarget);
  var table = document.getElementById("selected-matches");
  var newRow = table.insertRow(table.rows.length);
  newRow.innerHTML = event.currentTarget.innerHTML;
}
