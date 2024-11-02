import {
  buildTableForTableType,
  imgs,
  loadClubLogo,
  writeStrokedText,
  ctx,
} from "../instapics.js";
import { clubs } from "./../data/clubs.js";
import { imagePath, removeNewlines, truncate } from "./../common-functions.js";

export function leagueStandings(standings) {
  let addToPage = ``;
  let tds = `<td style="padding:5px 3px; text-align: center;">`;

  addToPage += `<table style='border-collapse: collapse; border: 3px solid #1D3557;' border='1' id="league-standings">
        <thead>    
        <tr style="border-bottom: 2px solid #1D3557">
        <th style="width:46px; padding:4px 2px; text-align: center;"><b>#</b></th>
        <th style="width:258px; padding:4px 3px; text-align: center;" colspan="2"><b>Team</b></th>
        <th style="width:52px; padding:5px 2px; text-align: center;"><b>P</b></th>
        <th style="width:52px; padding:5px 2px; text-align: center;"><b>W</b></th>
        <th style="width:52px; padding:5px 2px; text-align: center;"><b>D</b></th>
        <th style="width:52px; padding:5px 2px; text-align: center;"><b>L</b></th>
        <th style="width:90px; text-align: center;"><b>Goals</b></th>
        <th style="width:86px; text-align: center;"><b>xG</b></th>
        <th style="width:52px; padding: 4px; text-align: center;" colspan=5><b>Form</b></th>
        <th style="width:52px; padding:5px 3px; text-align: center;"><b>Pts</b></th>
      </tr>
      </thead><tbody>`;

  for (let i = 0; i < standings.length; i++) {
    let team = standings[i];
    let form = team.form.split("");
    loadClubLogo(team.id);
    addToPage += `
      <tr>
      <td style="padding:5px 2px; text-align: center;"><b>${i + 1}</b></td>
      <td style="width:36px; padding: 4px; text-align: center;"><img src="${imagePath(
        team.id
      )}" alt="*${team.name}*" width="40px" /> </td>
      <td style="border-left-style: hidden; padding: 3px;">${truncate(
        team.name,
        17
      )}</td>

      <td style="padding:5px 2px; text-align: center;">${team.matches}</td>
      <td style="padding:5px 2px; text-align: center;">${team.wins}</td>
      <td style="padding:5px 2px; text-align: center;">${team.draws}</td>
      <td style="padding:5px 2px; text-align: center;">${team.losses}</td>
      ${tds}${team.total.goals} : ${team.total.goalsAgainst}</td>
      <td style="padding:5px 3px; text-align: center; font-style: italic">${team.total.xG.toFixed(
        0
      )} : ${team.total.xGA.toFixed(0)}</td>`;
    for (let f of form) {
      addToPage += `<td style="color:${
        f == "W" ? "green" : f == "L" ? "#E63946" : ""
      }; padding:2px; text-align: center; font-weight: bold;">${f}</td>`;
    }

    addToPage += `<td style="padding:5px 3px; text-align: center; font-weight: bold">${team.total.points}</td>
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

  standingsTable.rows[0].style.backgroundColor = "#1D3557";
  standingsTable.rows[0].style.color = "#F1FAEE";

  if (standingsTable.rows.length < 20) yPos = 150;

  for (let i = 0; i < standingsTable.rows.length; i++) {
    thisTr = standingsTable.rows[i];

    if (i > 0) {
      thisTr.children[8].style.fontSize = "22px";
      thisTr.children[9].style.fontSize = "22px";
      thisTr.children[10].style.fontSize = "22px";
      thisTr.children[11].style.fontSize = "22px";
      thisTr.children[12].style.fontSize = "22px";
      thisTr.children[13].style.fontSize = "22px";

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
            startX: 166,
            startY: yPos + 46 + l * 42,
          });
          l++;
          thisTd.innerHTML = " ";
        }
      }
    }
  }

  writeStrokedText({
    text: [leagueName],
    fontSize: 60,
    textAlign: "right",
    strokeStyle: "#1d3557",
    fillStyle: "#e63946",
    lineWidth: 2,
    x: 990,
    y: yPos - 20,
  });
  ctx.drawImage(imgs.leagues[leagueID], 90, yPos - 86, 80, 80);

  buildTableForTableType(
    removeNewlines(standingsTable.outerHTML),
    imgToAdd,
    yPos
  );
}
