export function leagueStandings(response) {
  let standings = response.response[0].league.standings;
  let addToPage = ``;
  let tds = `<td style="padding:5px; text-align: center;">`;
  let ths = `<th style="width:54px; padding: 5px; text-align: center;">`;
  standings.forEach((group) => {
    addToPage += `<table style='border-collapse: collapse; border-color: #1D3557;' border='1' id="league-standings">
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
    //console.log(removeNewlines(addToPage));
  });
  console.log(addToPage);
  document.getElementById("standings").innerHTML += addToPage;
}
