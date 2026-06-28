const tds = `<td width='33%' style='text-align: center; border-color: #1D3557; padding: 9px;'>`;

export function addSquad(squads = []) {
  const output = document.getElementById("one-fixture");
  if (!output) {
    return;
  }

  if (!Array.isArray(squads) || squads.length === 0) {
    output.innerHTML = `<div id="match-stats">No squads found for the selected league.</div>`;
    return;
  }

  let html = ``;
  for (const squad of squads) {
    const teamName = squad?.team?.name || "Unknown Team";
    const players = Array.isArray(squad?.players) ? squad.players : [];

    html += `<div id="match-stats" style="margin-bottom: 18px;"><h4>${teamName}</h4>`;
    html += `<table style='border-collapse: collapse; width: 100%;' border='1'><thead><tr>${tds}Player</td>${tds}Age</td>${tds}Position</td></tr></thead><tbody>`;

    for (const player of players) {
      html += `<tr>${tds}${player?.name || "-"}</td>${tds}${player?.age || "-"}</td>${tds}${player?.position || "-"}</td></tr>`;
    }

    html += `</tbody></table></div>`;
  }

  output.innerHTML = html;
}
