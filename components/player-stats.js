//129718, 1100
//sfsdfdsfwefwefwefwefew<table style='border-collapse: collapse;' border='1'> <thead> <tr> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>J. Bellingham</td> </tr> </thead> <tbody> <tr> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>Games</td> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>undefined</td> </tr> <tr> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>Goals</td> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>5</td> </tr> <tr> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>Assists</td> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>1</td> </tr> <tr> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>Shots</td> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>7/8</td> </tr> <tr> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>Dribbles</td> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>6/11</td> </tr> <tr> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>Fouls drawn</td> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>14</td> </tr> <tr> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>Yellow cards</td> <td width='50%' style='text-align: center; border-color: #1D3557; padding: 20px;'>0</td> </tr> </tbody> </table>
let width = 50;

export function addPlayerStats(statsAPI, statsAPI2 = null) {
  if (statsAPI) width = 33;
  let tds = `<td width='${width}%' style='text-align: center; border-color: #1D3557; padding: 18px;'>`;
  let goals1 = statsAPI[0].statistics[0].goals.total;
  let goals2 = statsAPI2[0].statistics[0].goals.total;
  let assists1 = statsAPI[0].statistics[0].goals.assists
    ? statsAPI[0].statistics[0].goals.assists
    : 0;
  let assists2 = statsAPI2[0].statistics[0].goals.assists
    ? statsAPI2[0].statistics[0].goals.assists
    : 0;
  let addToPage = `
    <table style='border-collapse: collapse;' border='1'>
        <thead>
        </thead>
        <tbody>
          <tr>
          ${tds}${statsAPI[0].statistics[0].league.name}</td>
          ${tds}League</td>
          ${tds}${statsAPI2[0].statistics[0].league.name}</td>
          </tr>
          <tr>
          ${tds}${statsAPI[0].statistics[0].games.appearences}</td>
          ${tds}Games</td>
          ${tds}${statsAPI2[0].statistics[0].games.appearences}</td>
          </tr>
          <tr>
          ${tds}${statsAPI[0].statistics[0].games.minutes}</td>
          ${tds}Minutes</td>
          ${tds}${statsAPI2[0].statistics[0].games.minutes}</td>
          </tr>
          <tr>
          ${tds}${goals1}</td>
          ${tds}Goals</td>
          ${tds}${goals2}</td>
          </tr>
          <tr>
          ${tds}${assists1}</td>
          ${tds}Assists</td>
          ${tds}${assists2}</td>
          </tr>
          <tr>
          ${tds}${(
    ((goals1 + assists1) * 90) /
    statsAPI[0].statistics[0].games.minutes
  ).toFixed(2)}</td>
          ${tds}G + A / 90 minutes</td>
          ${tds}${(
    ((goals2 + assists2) * 90) /
    statsAPI2[0].statistics[0].games.minutes
  ).toFixed(2)}</td>
          </tr>
          <tr>
          ${tds}${statsAPI[0].statistics[0].shots.on}/${
    statsAPI[0].statistics[0].shots.total
  }</td>
          ${tds}Shots</td>
          ${tds}${statsAPI2[0].statistics[0].shots.on}/${
    statsAPI[0].statistics[0].shots.total
  }</td>
          </tr>
          <tr>
          ${tds}${statsAPI[0].statistics[0].dribbles.success}/${
    statsAPI[0].statistics[0].dribbles.attempts
  }</td>
          ${tds}Dribbles</td>
          ${tds}${statsAPI2[0].statistics[0].dribbles.success}/${
    statsAPI2[0].statistics[0].dribbles.attempts
  }</td>
          </tr>
          <tr>
          ${tds}${statsAPI[0].statistics[0].duels.won}/${
    statsAPI[0].statistics[0].duels.total
  }</td>
          ${tds}Duels</td>
          ${tds}${statsAPI2[0].statistics[0].duels.won}/${
    statsAPI2[0].statistics[0].duels.total
  }</td>
          </tr>
          <tr>
          ${tds}${statsAPI[0].statistics[0].passes.key}</td>
          ${tds}Key Passes</td>
          ${tds}${statsAPI2[0].statistics[0].passes.key}</td>
          </tr>
          <tr>
          ${tds}${statsAPI[0].statistics[0].fouls.drawn}</td>
          ${tds}Fouls drawn</td>
          ${tds}${statsAPI2[0].statistics[0].fouls.drawn}</td>
          </tr>
        </tbody>
    </table>`;
  console.log(removeNewlines(addToPage));
  document.getElementById("one-fixture").innerHTML += addToPage;
}
