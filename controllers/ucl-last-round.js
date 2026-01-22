import { sortTable } from "../common-functions.js";
import { leagueStandings } from "../components/league-standings.js";

// Helper: Apply background colors based on league position
const applyZoneStyles = (table) => {
  if (!table) return;
  const rows = table.rows;
  for (let i = 1; i < rows.length; i++) {
    let color = "#f1faee"; // Default
    if (i <= 8)
      color = "#457B9D"; // Promotion/Top Zone
    else if (i <= 24) color = "#a8dadc"; // Play-off Zone
    
    rows[i].style.backgroundColor = color;
    
    // Make text white for first 8 rows
    if (i <= 8) {
      rows[i].style.color = "white";
    } else {
        rows[i].style.color = "black";
    }
  }
};

// Helper: Update Rank Numbers
const updateRanks = (table) => {
  table.querySelectorAll("tbody tr").forEach((row, index) => {
    row.cells[0].textContent = index + 1;
  });
};

let currentStandings = await leagueStandings(2);
const table = document.getElementById("league-standings");

document.querySelectorAll(".score-pred").forEach((input) => {
  input.addEventListener("input", () => {
    const teamId = input.dataset.team;
    const opponentId = input.dataset.opponent;

    const teamScore = parseInt(input.value) || 0;
    const opponentInput = document.querySelector(
      `input[data-team="${opponentId}"][data-opponent="${teamId}"]`,
    );
    const opponentScore = parseInt(opponentInput?.value) || 0;

    const teamData = currentStandings.find((t) => t.id === parseInt(teamId));
    const opponentData = currentStandings.find(
      (t) => t.id === parseInt(opponentId),
    );

    const teamRow = document.querySelector(`tr[data-id="${teamId}"]`);
    const opponentRow = document.querySelector(`tr[data-id="${opponentId}"]`);

    if (teamData && opponentData && teamRow && opponentRow) {
      // Calculate Match Results
      const teamRes =
        teamScore > opponentScore
          ? { pts: 3, w: 1, d: 0, l: 0 }
          : teamScore < opponentScore
            ? { pts: 0, w: 0, d: 0, l: 1 }
            : { pts: 1, w: 0, d: 1, l: 0 };

      const oppRes = {
        pts: teamRes.pts === 3 ? 0 : teamRes.pts === 0 ? 3 : 1,
        w: teamRes.l,
        d: teamRes.d,
        l: teamRes.w,
      };

      // Update Home Team Cells (using index based on your current structure)
      teamRow.cells[3].textContent = teamData.wins + teamRes.w; // Wins
      teamRow.cells[4].textContent = teamData.draws + teamRes.d; // Draws
      teamRow.cells[5].textContent = teamData.losses + teamRes.l; // Losses
      teamRow.cells[6].textContent = teamData.total.goals + teamScore; // GF
      teamRow.cells[7].textContent =
        teamData.total.goalsAgainst + opponentScore; // GA
      teamRow.cells[8].textContent = teamData.total.points + teamRes.pts; // Pts

      // Update Away Team Cells
      opponentRow.cells[3].textContent = opponentData.wins + oppRes.w;
      opponentRow.cells[4].textContent = opponentData.draws + oppRes.d;
      opponentRow.cells[5].textContent = opponentData.losses + oppRes.l;
      opponentRow.cells[6].textContent =
        opponentData.total.goals + opponentScore;
      opponentRow.cells[7].textContent =
        opponentData.total.goalsAgainst + teamScore;
      opponentRow.cells[8].textContent = opponentData.total.points + oppRes.pts;

      // Sort and Refresh UI
      sortTable(8, document.querySelector("th:nth-child(8)"), table, 1, 6, 7);
      const sortedData = Array.from(table.querySelectorAll("tbody tr")).map(
        (row) => ({
          name: row.cells[2].innerText,
          id: row.dataset.id,
        }),
      );
      updateBracket(sortedData);
      updateRanks(table);
      applyZoneStyles(table);
    }
  });
});

// Initial Table Cleanup and Formatting (Runs once on load)
if (table) {
  const headerRow = table.querySelector("thead tr");
  if (headerRow) {
    [8, 8, 2].forEach((idx) => headerRow.deleteCell(idx));
    // Apply specific widths to stats columns
    for (let i = 2; i <= 6; i++) {
      if (headerRow.cells[i]) headerRow.cells[i].style.width = "30px";
    }
  }

  table.querySelectorAll("tbody tr").forEach((row) => {
    [9, 9, 3].forEach((idx) => row.deleteCell(idx));
    row.cells[1].querySelector("img").style.width = "30px";
  });

  applyZoneStyles(table);
}
const updateBracket = (standings) => {
  const container = document.getElementById("left-bottom");
  if (!container) return;

  const getT = (rank) => {
    const team = standings[rank - 1];
    const name = team ? team.name : `TBD`;
    return `<div class="team-unit"><strong>${rank}.</strong> ${name}</div>`;
  };

  const paths = [
    { groupA: [21, 22], groupB: [11, 12], highSeed: [5, 6] },
    { groupA: [19, 20], groupB: [13, 14], highSeed: [3, 4] },
    { groupA: [23, 24], groupB: [9, 10], highSeed: [7, 8] },
    { groupA: [17, 18], groupB: [15, 16], highSeed: [1, 2] },
    { groupA: [22, 21], groupB: [12, 11], highSeed: [6, 5] },
    { groupA: [20, 19], groupB: [14, 13], highSeed: [4, 3] },
    { groupA: [24, 23], groupB: [10, 9], highSeed: [8, 7] },
    { groupA: [18, 17], groupB: [16, 15], highSeed: [2, 1] },
  ];

  let html = `<h2 style="color: #1d3557; margin: 0; margin-left: 4px;">Play-off Brackets</h2>`;

  paths.forEach((path, index) => {
    html += `
        <div class="path-group">
            <div class="bracket-flex">
                
                <div class="column prelim-col">
                    <div class="horizontal-pair">
                        ${getT(path.groupA[0])}
                        <div class="or-badge">OR</div>
                        ${getT(path.groupA[1])}
                    </div>
                    
                    <div class="vs-divider">VS</div>

                    <div class="horizontal-pair">
                        ${getT(path.groupB[0])}
                        <div class="or-badge">OR</div>
                        ${getT(path.groupB[1])}
                    </div>
                </div>

                <div class="arrow">➔</div>

                <div class="column seed-col">
                    <div class="high-seed-box">
                        <div class="seed-label">Winner plays:</div>
                        <div class="horizontal-pair no-border">
                            ${getT(path.highSeed[0])}
                            <div class="or-badge">OR</div>
                            ${getT(path.highSeed[1])}
                        </div>
                    </div>
                </div>

            </div>
        </div>`;
  });

  container.innerHTML = html;
};

updateBracket(currentStandings);
