import { buildTableForTableType, imgs } from "./../instapics.js";
import { clubs } from "./../data/clubs.js";
import { loadClubLogo } from "./../instapics.js";

export function leagueStandings(response) {
  let standings = response.response[0].league.standings;
  let addToPage = ``;
  let tds = `<td style="padding:5px; text-align: center;">`;
  let ths = `<th style="width:54px; padding: 5px; text-align: center;">`;
  standings.forEach((group) => {
    addToPage += `<table style='border-collapse: collapse; border: 3px solid #1D3557;' border='1' id="league-standings">
        <thead>    
        <tr>
        ${ths}<b>#</b></th>
        <th style="width:383px; padding:5px; text-align: center;" colspan="2"><b>Team</b></th>
        ${ths}<b>P</b></th>
        ${ths}<b>W</b></th>
        ${ths}<b>D</b></th>
        ${ths}<b>L</b></th>
        <th style="width:92px; text-align: center;"><b>Goals</b></th>
        ${ths}<b>Pts</b></th>
      </tr>
      </thead><tbody>`;
    group.forEach((a) => {
      loadClubLogo(a.team.id);
      addToPage += `
      <tr>
      ${tds}<b>${a.rank}</b></td>
      <td style="width:54px; padding: 5px; text-align: center;"><img src="${imagePath(
        a.team.id
      )}" alt="*${a.team.name}*" width="40px" /> </td>
      <td style="padding: 5px;">${a.team.name}</td>
      ${tds}${a.all.played}</td>
      ${tds}${a.all.win}</td>
      ${tds}${a.all.draw}</td>
      ${tds}${a.all.lose}</td>
      ${tds}${a.all.goals.for} : ${a.all.goals.against}</td>
      ${tds}${a.points}</td>
      </tr>`;
    });
    addToPage += `</tbody></table>`;
  });
  console.log(addToPage);
  document.getElementById("standings").innerHTML += addToPage;
}

export function standingsToCanvas() {
  let yPos = 100;
  let imgToAdd = [];
  let thisTr,
    thisTd,
    thisClub,
    l = 0;
  let standingsTable = document.getElementById("league-standings");
  standingsTable.rows[0].style.backgroundColor = "#457B9D";

  if (standingsTable.rows.length < 20) yPos = 150;

  for (let i = 0; i < standingsTable.rows.length; i++) {
    thisTr = standingsTable.rows[i];
    for (let j = 0; j < thisTr.children.length; j++) {
      thisTd = thisTr.children[j];
      for (let k = 0; k < clubs.length; k++) {
        thisClub = clubs[k].name;
        if (thisTd.innerHTML.indexOf(`*${thisClub}*`) > -1) {
          imgToAdd.push({
            img: imgs.clubs[clubs[k].id],
            imgHeight: 40,
            startX: 178,
            startY: yPos + 45 + l * 42,
          });
          l++;
          thisTd.innerHTML = " ";
        }
      }
    }
  }

  buildTableForTableType(
    removeNewlines(standingsTable.outerHTML),
    imgToAdd,
    yPos
  );
}
