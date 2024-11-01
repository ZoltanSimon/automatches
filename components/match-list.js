import {
  buildTableForTableType,
  imgs,
  ctx,
  loadClubLogo,
  loadCompLogo,
  leagueBannerBig,
} from "../instapics.js";
import { clubs } from "./../data/clubs.js";
import { getMatch } from "../local-handler.js";
import {
  imagePath,
  truncate,
  htmlDecode,
  removeNewlines,
} from "../common-functions.js";

let imgToAdd = [];
let yPos = 200;

export function matchList(fixtures, showID = false) {
  console.log(fixtures);
  let addToPage, date;
  let leagueName = fixtures[0].league.name;
  let leagueID = fixtures[0].league.id;
  let round = fixtures[0].league.round;
  let thisID = ``;

  loadCompLogo(leagueID);

  fixtures.sort(function (a, b) {
    return new Date(a.fixture.date) - new Date(b.fixture.date);
  });

  addToPage = `<table style='border-collapse: collapse; border: 3px solid #1D3557;' border='1' id="match-list">`;

  fixtures.forEach((element) => {
    if (showID) {
      thisID = `<td rowspan=2 class="match-id">${element.fixture.id}</td>`;
    } else {
      thisID = `<td rowspan=2><img width=50 src="images/competitions/${element.league.id}.png"/></td>`;
    }
    date = new Date(element.fixture.date);
    let dateToAdd = `${date.getDate()}.${
      (date.getMonth() + 1 < 10 ? "0" : "") + (parseInt(date.getMonth()) + 1)
    }.${date.getFullYear()}`;

    loadClubLogo(element.teams.home.id);
    loadClubLogo(element.teams.away.id);

    addToPage += `
    <tr>
      <td style="text-align: center;">${dateToAdd}</td>
      <td style="text-align: left;" rowspan=2 id="${element.teams.home.id}">${
      element.teams.home.name
    }</td>
      <td style="text-align: center;" rowspan=2><img src=${imagePath(
        element.teams.home.id
      )} alt="*${element.teams.home.name}*" width="30px"></td>
      <td style="text-align: center; font-weight: bold">${
        !isNaN(parseInt(element.goals.home)) ? element.goals.home : ""
      }</td>
      <td style="text-align: center;" rowspan=2> - </td>
      <td style="text-align: center; font-weight: bold">${
        !isNaN(parseInt(element.goals.away)) ? element.goals.away : ""
      }</td>
      <td style="text-align: center;" rowspan=2><img src=${imagePath(
        element.teams.away.id
      )} alt="*${element.teams.away.name}*" width="30px">
      <td style="text-align: left;" rowspan=2 id="${
        element.teams.away.id
      }">${truncate(element.teams.away.name, 19)}</td>
      ${thisID}
    </tr>
    <tr>
      <td style="text-align: center;">${date.getUTCHours()} : ${
      (date.getMinutes() < 10 ? "0" : "") + date.getMinutes()
    }</td>
      <td style="text-align: center;">(${
        element.statistics ? element.statistics[0].statistics[16].value : ""
      })</td>
      <td style="text-align: center;">(${
        element.statistics ? element.statistics[1].statistics[16].value : ""
      })</td>
    </tr>`;
  });

  addToPage += `</table>`;
  document.getElementById("league-name").innerHTML = leagueName;
  document.getElementById("league-id").innerHTML = leagueID;
  document.getElementById("round-no").innerHTML = round;
  document.getElementById("fixtures-info").innerHTML += addToPage;

  document
    .querySelectorAll("#match-list tr")
    .forEach((e) => e.addEventListener("click", clickHandler));

  document
    .querySelectorAll(".match-id")
    .forEach((e) => e.addEventListener("click", getMatch));
}

export function matchesToCanvas(sourceDiv) {
  let matchesTable = document.getElementById(sourceDiv);
  var rowCount = matchesTable.rows.length;
  let thisTr;
  let isResult = true;
  let logo1, logo2;
  let notResultGap = 0;
  let notResultGap2 = 0;

  matchesTable.cellPadding = 4;

  yPos += (10 - rowCount / 2) * 30;

  for (let i = 0; i < rowCount; i++) {
    thisTr = matchesTable.rows[i];
    thisTr.children[0].style.backgroundColor = "F1FAEE";
    if (i % 2 == 0) {
      if (thisTr.children[3].innerHTML == "") isResult = false;

      if (!isResult) {
        thisTr.deleteCell(6);
        notResultGap = 22;
        notResultGap2 = 60;
        thisTr.children[3].innerHTML = "VS";
        thisTr.children[0].style.width = "131px";
        thisTr.children[3].style.width = "78px";
      } else {
        thisTr.deleteCell(8);
        thisTr.children[0].style.width = "120px";
        thisTr.children[1].style.width = "238px";
        thisTr.children[2].style.width = "50px"; //logo
        thisTr.children[3].style.width = "50px"; //score
        thisTr.children[4].style.width = "30px"; //-
        thisTr.children[5].style.width = "50px"; //score
        thisTr.children[6].style.width = "50px"; //logo
        thisTr.children[7].style.width = "238px";

        thisTr.children[0].style.fontSize = "22px";
        thisTr.children[6].style.fontSize = "22px";

        thisTr.children[0].style.borderBottomStyle = "hidden";
        thisTr.children[1].style.borderRightStyle = "hidden";
        thisTr.children[7].style.borderLeftStyle = "hidden";

        thisTr.children[1].style.borderLeftColor = "#457B9D";
        thisTr.children[1].style.borderLeftWidth = "2px";

        thisTr.children[1].style.textAlign = "right";

        thisTr.children[0].cellPadding = 2;
      }

      logo1 = clubs.find((element) =>
        htmlDecode(thisTr.children[2].innerHTML).includes(element.name)
      );

      logo2 = clubs.find((element) =>
        htmlDecode(thisTr.children[6].innerHTML).includes(element.name)
      );

      thisTr.children[2].innerHTML = "";
      thisTr.children[6].innerHTML = "";

      addImgToArray(494 + notResultGap, logo1.id, i / 2);
      addImgToArray(714 + notResultGap2, logo2.id, i / 2);
    } else {
      thisTr.children[0].style.fontSize = "22px";
      thisTr.children[1].style.fontSize = "18px";
      thisTr.children[2].style.fontSize = "18px";
      thisTr.children[0].cellPadding = 2;
    }
  }

  if (rowCount <= 22)
    if (sourceDiv == "match-list") {
      leagueBannerBig(yPos);
    } else {
      let bottomText = document.getElementById("breaking-official").value;
      ctx.fillText("Season 2023/24", 540, yPos + 58 + rowCount * 77);
      ctx.fillStyle = "#e63946";
      ctx.fillText(bottomText, 540, yPos - 22);
    }
  console.log(matchesTable.outerHTML);
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
    img: imgs.clubs[logo],
    imgHeight: 50,
    startX: xPos,
    startY: yPos + 16 + i * 77,
  });
}
