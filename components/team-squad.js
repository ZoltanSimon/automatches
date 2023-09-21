const tds = `<td width='33%' style='text-align: center; border-color: #1D3557; padding: 9px;'>`;

export function addSquad(squadAPI) {
  let addToPage = ``;
  console.log(squadAPI);

  //addToPage = `<div id="match-stats"><table style='border-collapse: collapse;' border='1'><thead><tr>${tds}${homeTeamName}</td>${tds} </td>${tds}${awayTeamName}</td></tr></thead><tbody>`;

  // for (let i = 0; i < stats.length; i++) {
  //  addToPage += `<tr>${tds}${stats[i].homeTeam}</td>${tds}${stats[i].title}</td>${tds}${stats[i].awayTeam}</td></tr>`;
  //}
  addToPage += `</tbody></table></div>`;
  console.log(addToPage);
  document.getElementById("one-fixture").innerHTML += addToPage;
  //1035067
}
