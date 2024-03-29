import {
  buildTableForTableType,
  imgs,
  ctx,
  loadClubLogo,
  loadCompLogo,
  writeStrokedText,
} from "./../instapics.js";
import { clubs } from "./../data/clubs.js";
import { getMatch } from "../local-handler.js";
import {
  imagePath,
  truncate,
  htmlDecode,
  removeNewlines,
} from "../common-functions.js";

let imgToAdd = [];
let yPos = 100;

export function matchList(fixtures, showID = false) {
  console.log(fixtures);
  let addToPage, date;
  let leagueName = fixtures[0].league.name;
  let leagueID = fixtures[0].league.id;
  let round = fixtures[0].league.round;
  let thisID = ``;
  let tds = `<td style="text-align: center;">`;

  loadCompLogo(leagueID);

  fixtures.sort(function (a, b) {
    return new Date(a.fixture.date) - new Date(b.fixture.date);
  });

  addToPage = `<table style='border-collapse: collapse; border: 3px solid #1D3557;' border='1' id="match-list">`;

  fixtures.forEach((element) => {
    if (showID) thisID = `<td class="match-id">${element.fixture.id}</td>`;
    date = new Date(element.fixture.date);

    loadClubLogo(element.teams.home.id);
    loadClubLogo(element.teams.away.id);

    addToPage += `<tr">
    ${tds}${date.getDate()}.${
      date.getMonth() + 1
    }.${date.getFullYear()} ${date.getUTCHours()}:${
      (date.getMinutes() < 10 ? "0" : "") + date.getMinutes()
    }</td>
    <td style="text-align: center;"><img src=${imagePath(
      element.teams.home.id
    )} alt="*${element.teams.home.name}*" width="30px"></td>
      <td style="text-align: left;" id="${element.teams.home.id}">${
      element.teams.home.name
    }</td>
    ${tds}${!isNaN(parseInt(element.goals.home)) ? element.goals.home : ""}</td>
    <td style="text-align: center;"><img src=${imagePath(
      element.teams.away.id
    )} alt="*${element.teams.away.name}*" width="30px"></td>
      <td style="text-align: left;" id="${element.teams.away.id}">${truncate(
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
  let leagueName = document.getElementById("league-name").innerHTML;
  let leagueID = document.getElementById("league-id").innerHTML;
  let round = document.getElementById("round-no").innerHTML;
  var rowCount = matchesTable.rows.length;
  let thisTr;
  let index = 7;
  let isResult = true;
  let logo1, logo2;
  let notResultGap = 0;
  let notResultGap2 = 0;

  matchesTable.cellPadding = 10;

  for (var i = 0; i < rowCount; i++) {
    if (matchesTable.rows[i].cells.length == index + 1)
      matchesTable.rows[i].deleteCell(index);
  }
  yPos += (10 - rowCount) * 30;

  for (let i = 0; i < rowCount; i++) {
    thisTr = matchesTable.rows[i];
    if (thisTr.children[3].innerHTML == "") isResult = false;

    if (!isResult) {
      thisTr.deleteCell(6);
      notResultGap = 22;
      notResultGap2 = 60;
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

    console.log(thisTr.children[1].innerHTML);
    console.log(logo1);

    thisTr.children[1].innerHTML = "";
    thisTr.children[4].innerHTML = "";

    addImgToArray(262 + notResultGap, logo1.id, i);
    addImgToArray(634 + notResultGap2, logo2.id, i);
  }

  //text: ["Round " + round.split(" - ")[1]],
  if (rowCount <= 11)
    if (sourceDiv == "match-list") {
      writeStrokedText({
        text: [leagueName],
        fontSize: 60,
        textAlign: "center",
        strokeStyle: "#1d3557",
        fillStyle: "#e63946",
        lineWidth: 2,
        x: 256,
        y: yPos + 90 + rowCount * 77,
      });
      writeStrokedText({
        text: [round.replace(`Regular Season -`, "Round")],
        fontSize: 60,
        textAlign: "center",
        x: 815,
        y: yPos + 90 + rowCount * 77,
      });
    } else {
      let bottomText = document.getElementById("breaking-official").value;
      ctx.fillText("Season 2023/24", 540, yPos + 58 + rowCount * 77);
      ctx.fillStyle = "#e63946";
      ctx.fillText(bottomText, 540, yPos - 22);
    }

  imgToAdd.push({
    img: imgs.leagues[leagueID],
    imgHeight: 140,
    startX: 540,
    startY: yPos + rowCount * 77,
  });

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
    startY: yPos + 15 + i * 77,
  });
}
