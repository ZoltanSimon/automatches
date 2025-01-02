import {
  buildTableForTableType,
  imgs,
  loadClubLogo,
  writeStrokedText,
  ctx,
} from "../instapics.js";
import { clubs } from "./../data/clubs.js";
import { imagePath, removeNewlines, truncate } from "./../common-functions.js";
import { darkColor } from "../common-styles.js";

export function leagueStandings(standings) {
  let addToPage = ``;
  let tds = `<td style="padding:6px; text-align: center;">`;

  addToPage += `<table style='border-collapse: collapse; border: 3px solid #1D3557;' border='1' id="league-standings">
        <thead>    
        <tr style="border-bottom: 2px solid #1D3557">
        <th style="width:48px;"><b>#</b></th>
        <th style="width:272px;" colspan="2"><b>Team</b></th>
        <th style="width:52px;"><b>P</b></th>
        <th style="width:52px;"><b>W</b></th>
        <th style="width:52px;"><b>D</b></th>
        <th style="width:52px;"><b>L</b></th>
        <th style="width:90px;"><b>Goals</b></th>
        <th style="width:86px;"><b>xG</b></th>
        <th style="width:98px; padding: 4px;" colspan=5><b>Form</b></th>
        <th style="width:58px;"><b>Pts</b></th>
      </tr>
      </thead><tbody>`;

  for (let i = 0; i < standings.length; i++) {
    let team = standings[i];
    let form = team.form.split("");
    loadClubLogo(team.id);
    addToPage += `
      <tr>
      <td style="padding:6px; text-align: center; font-weight: bold">${i + 1}</td>
      <td style="width:36px; padding: 4px; text-align: center;"><img src="${imagePath(
        team.id
      )}" alt="*${team.name}*" width="40px" /> </td>
      <td style="border-left-style: hidden; padding: 3px;">${truncate(
        team.name,
        16
      )}</td>

      ${tds}${team.matches}</td>
      ${tds}${team.wins}</td>
      ${tds}${team.draws}</td>
      ${tds}${team.losses}</td>
      ${tds}${team.total.goals} : ${team.total.goalsAgainst}</td>
      ${tds}${team.total.xG.toFixed(
        0
      )} : ${team.total.xGA.toFixed(0)}</td>`;
    for (let f of form) {
      addToPage += `<td style="color:${
        f == "W" ? "green" : f == "L" ? "#E63946" : ""
      }; padding:2px; text-align: center; font-weight: bold;">${f}</td>`;
    }

    addToPage += `<td style="padding:6px; text-align: center; font-weight: bold">${team.total.points}</td>
      </tr>`;
  }
  addToPage += `</tbody></table>`;
  document.getElementById("standings").innerHTML += addToPage;
}

export function standingsToCanvas() {
  let yPos = 124;
  let imgToAdd = [];
  let thisTr,
    thisTd,
    thisClub,
    l = 0;
  let standingsTable = document.getElementById("league-standings");
  let leagueName = document.getElementById("league-name").innerHTML;
  let leagueID = document.getElementById("league-id").innerHTML;
  let allForms = [],
    thisForm = [];

  standingsTable.rows[0].style.backgroundColor = darkColor;
  standingsTable.rows[0].style.color = "#F1FAEE";
  standingsTable.rows[0].style.borderRightColor = "#F1FAEE";

  if (standingsTable.rows.length < 20) yPos = 150;

  for (let i = 0; i < standingsTable.rows.length; i++) {
    thisForm = [];
    thisTr = standingsTable.rows[i];

    if (i > 0) {
      thisTr.children[8].style.fontSize = "22px";
      thisTr.children[9].style.fontSize = "0px";
      thisTr.children[10].style.fontSize = "0px";
      thisTr.children[11].style.fontSize = "0px";
      thisTr.children[12].style.fontSize = "0px";
      thisTr.children[13].style.fontSize = "0px";

      thisTr.children[10].style.borderLeftStyle = "hidden";
      thisTr.children[11].style.borderLeftStyle = "hidden";
      thisTr.children[12].style.borderLeftStyle = "hidden";
      thisTr.children[13].style.borderLeftStyle = "hidden";
    }

    for (let j = 0; j < thisTr.children.length; j++) {
      thisTd = thisTr.children[j];
      for (let k = 0; k < clubs.length; k++) {
        thisClub = clubs[k].name;
        if (thisTd.innerHTML.indexOf(`*${thisClub}*`) > -1) {
          imgToAdd.push({
            img: imgs.clubs[clubs[k].id],
            imgHeight: 40,
            startX: 168,
            startY: yPos + 42 + l * 42,
          });
          l++;
          thisTd.innerHTML = " ";
        }
      }
      if (i > 0 && j > 8 && j < 14) thisForm.push(thisTd.innerHTML);
    }
    allForms.push(thisForm);
  }

  writeStrokedText({
    text: [leagueName],
    fontSize: 50,
    textAlign: "right",
    strokeStyle: darkColor,
    fillStyle: "#1D3557",
    lineWidth: 2,
    x: 990,
    y: yPos - 20,
  });
  ctx.drawImage(imgs.leagues[leagueID], 90, yPos - 86, 80, 80);

  buildTableForTableType(
    removeNewlines(standingsTable.outerHTML),
    imgToAdd,
    yPos,
    allForms
  );
}
