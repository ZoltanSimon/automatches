import { buildTableForTableType, imgs, ctx } from "./../instapics.js";
import { clubs } from "./../data/clubs.js";

let imgToAdd = [];
let yPos = 140;
let notResultGap = 0;

export function matchList(response, showID = false) {
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
      <td style="text-align: left;">${element.teams.home.name.replace(
        "Borussia Monchengladbach",
        "Gladbach"
      )}</td>
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
  let matchesTable = document.getElementById(sourceDiv);
  let leagueName = document.getElementById("league-name").innerHTML;
  let round = document.getElementById("round-no").innerHTML;
  var rowCount = matchesTable.rows.length;
  let thisTr;
  let index = 7;
  let isResult = true;
  let logo1, logo2;

  if (matchesTable.rows.length < 11) yPos = 240;

  matchesTable.cellPadding = 10;

  for (var i = 0; i < rowCount; i++) {
    if (matchesTable.rows[i].cells.length == index + 1)
      matchesTable.rows[i].deleteCell(index);
  }

  for (let i = 0; i < matchesTable.rows.length; i++) {
    thisTr = matchesTable.rows[i];
    if (thisTr.children[3].innerHTML == "") isResult = false;

    if (!isResult) {
      thisTr.deleteCell(6);
      notResultGap = 60;
      thisTr.children[3].innerHTML = "VS";
      thisTr.children[0].style.width = "120px";
      thisTr.children[3].style.width = "63px";
    } else {
      thisTr.children[0].style.width = "108px";
      thisTr.children[3].style.width = "40px";
      thisTr.children[6].style.width = "40px";
    }

    thisTr.children[1].style.width = "40px";
    thisTr.children[2].style.width = "232px";
    thisTr.children[4].style.width = "40px";
    thisTr.children[5].style.width = "232px";

    logo1 = clubs.find((element) =>
      thisTr.children[1].innerHTML.includes(element)
    );
    logo2 = clubs.find((element) =>
      thisTr.children[4].innerHTML.includes(element)
    );
    thisTr.children[1].innerHTML = "";
    thisTr.children[4].innerHTML = "";

    addImgToArray(234, logo1, i);
    addImgToArray(609, logo2, i);
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
  var table = document.getElementById("selected-matches");
  var newRow = table.insertRow(table.rows.length);
  newRow.innerHTML = event.currentTarget.innerHTML;
}

function addImgToArray(xPos, logo, i) {
  imgToAdd.push({
    img: imgs[logo],
    imgHeight: 50,
    startX: xPos + notResultGap,
    startY: yPos + 2 + i * 52,
  });
}
