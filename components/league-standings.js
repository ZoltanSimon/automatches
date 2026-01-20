import {
  buildTableForTableType,
  imgs,
  loadClubLogo,
  writeStrokedText,
  ctx,
  loadCompLogo,
} from "../instapics.js";
import { imagePath, removeNewlines, truncate } from "./../common-functions.js";
import { darkColor } from "../common-styles.js";
import { buildStandings } from "../autotext.js";

async function standingsFromTeamList(selectedLeague) {
  if (document.getElementById("league-name")) {
    //document.getElementById("league-name").innerHTML = document.getElementById(`img-${selectedLeague}`).title;
  }
  
  if (document.getElementById("league-id")) {
    document.getElementById("league-id").innerHTML = selectedLeague;
  }
  
  let response;
  if (selectedLeague == 2) {
    response = await fetch(`/get-teams?leagueID=${selectedLeague}&date=01-09-2025`);
  } else {
    response = await fetch(`/get-teams?leagueID=${selectedLeague}`);
  }

  const standingsFromApi = await response.json();
  standingsFromApi.sort((a, b) => (b.total.goals-b.total.goalsAgainst) - (a.total.goals-a.total.goalsAgainst)); 
  standingsFromApi.sort((a, b) => b.total.points - a.total.points); 
  loadCompLogo(selectedLeague);
  return standingsFromApi;
}

export async function leagueStandings(selectedLeague) {

  let standings = await standingsFromTeamList(selectedLeague);
  let addToPage = ``;
  let tds = `<td style="padding:6px; text-align: center;">`;

  addToPage += `<table style='border-collapse: collapse; border: 3px solid #1D3557;' border='1' id="league-standings">
        <thead>    
          <tr style="border-bottom: 2px solid #1D3557" class="main-table-header">
            <th style="width:48px;" class="list-header"><b>#</b></th>
            <th style="width:274px;" class="list-header" colspan="2"><b>Team</b></th>
            <th style="width:52px;" class="list-header"><b>P</b></th>
            <th style="width:52px;" class="list-header"><b>W</b></th>
            <th style="width:52px;" class="list-header"><b>D</b></th>
            <th style="width:52px;" class="list-header"><b>L</b></th>
            <th style="width:45px;" class="list-header"><b>GF</b></th>
            <th style="width:45px;" class="list-header"><b>GA</b></th>
            <th style="width:90px;" class="list-header"><b>xG</b></th>
            <th style="width:96px; padding: 4px;" class="list-header"><b>Form</b></th>
            <th style="width:58px;" class="list-header"><b>Pts</b></th>
          </tr>
        </thead><tbody>`;

  for (let i = 0; i < standings.length; i++) {
    let team = standings[i];
    let form = team.form.split("");
    loadClubLogo(team.id);
    addToPage += `
      <tr data-id=${team.id}>
      <td style="padding:6px; text-align: center; font-weight: bold">${i + 1}</td>
      <td style="width:36px; padding: 4px; text-align: center;"><img src="${imagePath(
        team.id
      )}" alt="${team.name}" width="40px"/> </td>
      <td style="border-left-style: hidden; padding: 3px;">${truncate(
        team.name,
        22
      )}</td>

      ${tds}${team.played}</td>
      ${tds}${team.wins}</td>
      ${tds}${team.draws}</td>
      ${tds}${team.losses}</td>
      ${tds}${team.total.goals}</td>
      ${tds}${team.total.goalsAgainst}</td>
      ${tds}${team.total.xG.toFixed(
        0
      )} : ${team.total.xGA.toFixed(0)}</td>`;
   addToPage += `<td>`;
      for (const result of form) {
        addToPage += `<span class="form-indicator ${result}"></span>`;
      }

    addToPage += `</td><td style="padding:6px; text-align: center; font-weight: bold">${team.total.points}</td>
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
      thisTr.children[14].style.fontSize = "0px";
      thisTr.children[10].style.fontSize = "0px";
      thisTr.children[11].style.fontSize = "0px";
      thisTr.children[12].style.fontSize = "0px";
      thisTr.children[13].style.fontSize = "0px";

      thisTr.children[14].style.borderLeftStyle = "hidden";
      thisTr.children[11].style.borderLeftStyle = "hidden";
      thisTr.children[12].style.borderLeftStyle = "hidden";
      thisTr.children[13].style.borderLeftStyle = "hidden";

      const teamId = thisTr.getAttribute("data-id");
      if (teamId in imgs.clubs) {
        imgToAdd.push({
          img: imgs.clubs[teamId],
          imgHeight: 40,
          startX: 166,
          startY: yPos + 50 + l * 42,
        });
      
        l++;
      }
      
      for (let j = 1; j < thisTr.children.length; j++) {
        thisTd = thisTr.children[j];
        if (j==1) thisTd.innerHTML = " ";
        if (i > 0 && j > 9 && j < 15) {
          thisForm.push(thisTd.innerHTML);
        }
      }
      
      allForms.push(thisForm);
    }
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

  //console.log(allForms);
  //console.log(imgToAdd);
  //console.log(standingsTable.outerHTML);
  //console.log(yPos);

  buildTableForTableType(
    removeNewlines(standingsTable.outerHTML),
    imgToAdd,
    yPos,
    allForms
  );
}
