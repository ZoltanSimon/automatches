import {
  buildTableForTableType,
  imgs,
  ctx,
  loadClubLogos,
} from "./../instapics.js";
import { clubs } from "./../data/clubs.js";

let imgToAdd = [];
let yPos = 120;

export function matchList(fixtures, showID = false) {
  console.log(fixtures);
  let addToPage, date;
  let leagueName = fixtures[0].league.name;
  let round = fixtures[0].league.round;
  let thisID = ``;
  let tds = `<td style="text-align: center;">`;
  let logosToLoad = [];

  fixtures.sort(function (a, b) {
    return new Date(a.fixture.date) - new Date(b.fixture.date);
  });

  addToPage = `<table style='border-collapse: collapse; border-color: #1D3557;' border='1' id="match-list">`;

  fixtures.forEach((element) => {
    if (showID) thisID = `${tds}${element.fixture.id}</td>`;
    date = new Date(element.fixture.date);

    logosToLoad.push({
      id: element.teams.home.id,
      name: element.teams.home.name,
    });
    logosToLoad.push({
      id: element.teams.away.id,
      name: element.teams.away.name,
    });

    addToPage += `<tr">
    ${tds}${date.getDate()}.${
      date.getMonth() + 1
    }.${date.getFullYear()} ${date.getHours()}:${
      (date.getMinutes() < 10 ? "0" : "") + date.getMinutes()
    }</td>
    <td style="text-align: center;"><img src=${imagePath(
      element.teams.home.id
    )} alt="*${element.teams.home.name}*" width="30px"></td>
      <td style="text-align: left;">${element.teams.home.name}</td>
    ${tds}${!isNaN(parseInt(element.goals.home)) ? element.goals.home : ""}</td>
    <td style="text-align: center;"><img src=${imagePath(
      element.teams.away.id
    )} alt="*${element.teams.away.name}*" width="30px"></td>
      <td style="text-align: left;">${truncate(
        element.teams.away.name,
        19
      )}</td>
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

  loadClubLogos(logosToLoad);
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
  let notResultGap = 0;
  let notResultGap2 = 0;

  //if (matchesTable.rows.length < 11) yPos = 140;

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
      notResultGap = 23;
      notResultGap2 = 61;
      thisTr.children[3].innerHTML = "VS";
      thisTr.children[0].style.width = "131px";

      thisTr.children[3].style.width = "78px";
    } else {
      thisTr.children[0].style.width = "108px";
      thisTr.children[3].style.width = "40px";
      thisTr.children[6].style.width = "40px";
    }

    thisTr.children[0].style.fontSize = "22px";
    thisTr.children[1].style.width = "40px";
    thisTr.children[2].style.width = "232px";
    thisTr.children[4].style.width = "40px";
    thisTr.children[5].style.width = "232px";

    logo1 = clubs.find((element) =>
      htmlDecode(thisTr.children[1].innerHTML).includes(element.name)
    );
    logo2 = clubs.find((element) =>
      htmlDecode(thisTr.children[4].innerHTML).includes(element.name)
    );

    thisTr.children[1].innerHTML = "";
    thisTr.children[4].innerHTML = "";

    addImgToArray(235 + notResultGap, logo1.name, i);
    addImgToArray(610 + notResultGap2, logo2.name, i);
  }

  if (sourceDiv == "match-list") {
    ctx.fillText("Round " + round.split(" - ")[1], 540, 990);
    ctx.fillStyle = "#e63946";
    ctx.fillText(leagueName, 540, 940);
  } else {
    ctx.fillText("Season 2023/24, Week 13", 540, 880);
    ctx.fillStyle = "#e63946";
    ctx.fillText("Games to Watch over the Weekend", 540, 820);
  }

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
    startX: xPos,
    startY: yPos + 14 + i * 77,
  });
}
