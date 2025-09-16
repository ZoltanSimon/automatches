import {
  buildTableForTableType,
  imgs,
  ctx,
  loadClubLogo,
  loadCompLogo,
  leagueBannerBig,
} from "../instapics.js";
import { downloadMatch } from "../local-handler.js";
import {
  imagePath,
  truncate,
  htmlDecode,
  removeNewlines,
  getDate,
} from "../common-functions.js";

let imgToAdd = [];
let yPos = 220;

 export function matchList(fixtures, showID = false) {
  let addToPage, date;
  let leagueName = fixtures[0].league.name;
  let leagueID = fixtures[0].league.id;
  let round = fixtures[0].league.round;
  let thisID = ``,
  thisDate = ``,
  thisTime = ``;

  loadCompLogo(leagueID);

  fixtures.sort(function (a, b) {
    return new Date(a.fixture.date) - new Date(b.fixture.date);
  });

  addToPage = `<table style='border-collapse: collapse; border: 3px solid #1D3557;' border='1' id="match-list"><thead>
    <tr class="main-table-header"><th colspan=9>${getDate(new Date())}</th></tr></thead><tbody>`;

  fixtures.forEach((element) => {
    date = new Date(element.fixture.date);
    let dateToAdd = getDate(date);

    if (showID) {
      thisID = `<td rowspan=2 class="match-id">${element.fixture.id}</td>`;      
      thisTime = `<td style="text-align: center;">${date.getUTCHours()} : ${(date.getMinutes() < 10 ? "0" : "") + date.getMinutes()}</td>`;
      thisDate = `<td style="text-align: center;">${dateToAdd}</td>`;
    } else {
      thisID = `<td width=40 rowspan=2><img width=40 src="images/competitions/${element.league.id}.png"/></td>`;
      thisTime = ``;
      thisDate = `<td rowspan=2 style="text-align: center;">${date.getUTCHours()} : ${(date.getMinutes() < 10 ? "0" : "") + date.getMinutes()}</td>`;
    }

    let homeTeam = element.teams.home;
    let awayTeam = element.teams.away;

    loadClubLogo(homeTeam.id);
    loadClubLogo(awayTeam.id);

    addToPage += `
    <tr>
      ${thisDate}
      <td style="text-align: left;" rowspan=2 id="${homeTeam.id}">${homeTeam.name}</td>
      <td style="text-align: center;" rowspan=2><img src=${imagePath(homeTeam.id)} alt="${homeTeam.name}" id="${homeTeam.id}" width="44px"></td>
      <td style="text-align: center; font-weight: bold">${!isNaN(parseInt(element.goals.home)) ? element.goals.home : ""}</td>
      <td style="text-align: center;" rowspan=2> - </td>
      <td style="text-align: center; font-weight: bold">${!isNaN(parseInt(element.goals.away)) ? element.goals.away : ""}</td>
      <td style="text-align: center;" rowspan=2><img src=${imagePath(element.teams.away.id)} alt="${awayTeam.name}" id="${awayTeam.id}" width="44px">
      <td style="text-align: left;" rowspan=2 id="${awayTeam.id}">${awayTeam.name}</td>
      ${thisID}
    </tr>
    <tr>
      ${thisTime}
      <td style="text-align: center;">(${element.statistics?.[0]?.statistics?.[16]?.value || ""})</td>
      <td style="text-align: center;">(${element.statistics?.[1]?.statistics?.[16]?.value || ""})</td>
    </tr>`;
  });

  addToPage += `</tbody></table>`;

  document.getElementById("league-name").innerHTML = leagueName;
  document.getElementById("league-id").innerHTML = leagueID;
  document.getElementById("round-no").innerHTML = round;
  document.getElementById("fixtures-info").innerHTML += addToPage;

  document
    .querySelectorAll("#match-list tr")
    .forEach((e) => e.addEventListener("click", clickHandler));

  document
    .querySelectorAll(".match-id")
    .forEach((e) => e.addEventListener("click", downloadMatch));
} 

export function matchesToCanvas(sourceDiv) {
  let matchesTable = document.getElementById(sourceDiv);
  matchesTable.deleteRow(0);
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

      logo1 = thisTr.children[1].id;

      logo2 = thisTr.children[7].id;

      thisTr.children[2].innerHTML = "";
      thisTr.children[6].innerHTML = "";

      addImgToArray(494 + notResultGap, logo1, i / 2);
      addImgToArray(714 + notResultGap2, logo2, i / 2);
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
    startY: yPos + 16 + i * 72,
  });
}
