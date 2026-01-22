import { sortTable } from "../common-functions.js";
import { leagueStandings } from "../components/league-standings.js";

// Helper: Apply background colors based on league position
const applyZoneStyles = (table) => {
    if (!table) return;
    const rows = table.rows;
    for (let i = 1; i < rows.length; i++) {
        let color = "#f1faee"; // Default
        if (i <= 8) color = "#457B9D"; // Promotion/Top Zone
        else if (i <= 24) color = "#a8dadc"; // Play-off Zone
        rows[i].style.backgroundColor = color;
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
        const opponentInput = document.querySelector(`input[data-team="${opponentId}"][data-opponent="${teamId}"]`);
        const opponentScore = parseInt(opponentInput?.value) || 0;

        const teamData = currentStandings.find((t) => t.id === parseInt(teamId));
        const opponentData = currentStandings.find((t) => t.id === parseInt(opponentId));

        const teamRow = document.querySelector(`tr[data-id="${teamId}"]`);
        const opponentRow = document.querySelector(`tr[data-id="${opponentId}"]`);

        if (teamData && opponentData && teamRow && opponentRow) {
            // Calculate Match Results
            const teamRes = teamScore > opponentScore ? { pts: 3, w: 1, d: 0, l: 0 } :
                           teamScore < opponentScore ? { pts: 0, w: 0, d: 0, l: 1 } :
                           { pts: 1, w: 0, d: 1, l: 0 };

            const oppRes = { 
                pts: teamRes.pts === 3 ? 0 : (teamRes.pts === 0 ? 3 : 1),
                w: teamRes.l, d: teamRes.d, l: teamRes.w 
            };

            // Update Home Team Cells (using index based on your current structure)
            teamRow.cells[3].textContent = teamData.wins + teamRes.w;     // Wins
            teamRow.cells[4].textContent = teamData.draws + teamRes.d;    // Draws
            teamRow.cells[5].textContent = teamData.losses + teamRes.l;   // Losses
            teamRow.cells[6].textContent = teamData.total.goals + teamScore; // GF
            teamRow.cells[7].textContent = teamData.total.goalsAgainst + opponentScore; // GA
            teamRow.cells[8].textContent = teamData.total.points + teamRes.pts; // Pts

            // Update Away Team Cells
            opponentRow.cells[3].textContent = opponentData.wins + oppRes.w;
            opponentRow.cells[4].textContent = opponentData.draws + oppRes.d;
            opponentRow.cells[5].textContent = opponentData.losses + oppRes.l;
            opponentRow.cells[6].textContent = opponentData.total.goals + opponentScore;
            opponentRow.cells[7].textContent = opponentData.total.goalsAgainst + teamScore;
            opponentRow.cells[8].textContent = opponentData.total.points + oppRes.pts;

            // Sort and Refresh UI
            sortTable(8, document.querySelector("th:nth-child(8)"), table, 1, 6, 7);
            updateRanks(table);
            applyZoneStyles(table);
        }
    });
});

// Initial Table Cleanup and Formatting (Runs once on load)
if (table) {
    const headerRow = table.querySelector("thead tr");
    if (headerRow) {
        [8, 8, 2].forEach(idx => headerRow.deleteCell(idx));
        // Apply specific widths to stats columns
        for (let i = 2; i <= 6; i++) {
            if (headerRow.cells[i]) headerRow.cells[i].style.width = "30px";
        }
    }

    table.querySelectorAll("tbody tr").forEach((row) => {
        [9, 9, 4].forEach(idx => row.deleteCell(idx));
        row.cells[1].querySelector("img").style.width = "30px";
    });

    applyZoneStyles(table);
}