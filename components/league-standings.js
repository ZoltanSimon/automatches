export function leagueStandings(response) {
  let standings = response.response[0].league.standings;
  let addToPage = ``;
  let tds = `<td style="padding: 5px; text-align: center;">`;
  standings.forEach((group) => {
    addToPage += `<table style='border-collapse: collapse;' border='1' id="league-standings">
        <thead>    
        <tr>
        ${tds}#</td>
        <td style="width:90px; text-align: center;"> </td>
        <td style="width:450px;">Team</td>
        ${tds}Played</td>
        ${tds}Win</td>
        ${tds}Draw</td>
        ${tds}Lose</td>
        <td style="width:160px; text-align: center;">Goals</td>
        ${tds}Points</td>
      </tr>
      </thead><tbody>`;
    group.forEach((a) => {
      addToPage += `
      <tr>
      ${tds}${a.rank}</td>
          <td><img src="${imagePath(a.team.name)}" alt="*${
        a.team.name
      }*" width="30px" /></td>
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
