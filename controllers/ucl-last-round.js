import { sortTable } from '../common-functions.js';
import { standingsFromTeamList, leagueStandings } from '../components/league-standings.js';

let currentStandings = await standingsFromTeamList(2);
const teams = [
    { id: 66, name: "Aston Villa" },
    { id: 247, name: "Celtic" },
    { id: 529, name: "Barcelona" },
    { id: 499, name: "Atalanta" },
    { id: 168, name: "Bayer 04 Leverkusen" },
    { id: 628, name: "AC Sparta Praha" },
    { id: 165, name: "Borussia Dortmund" },
    { id: 550, name: "Shakhtar Donetsk" },
    { id: 157, name: "FC Bayern München" },
    { id: 656, name: "ŠK Slovan Bratislava" },
    { id: 547, name: "Girona FC" },
    { id: 42, name: "Arsenal" },
    { id: 620, name: "GNK Dinamo Zagreb" },
    { id: 489, name: "Milan" },
    { id: 505, name: "Inter" },
    { id: 91, name: "AS Monaco" },
    { id: 496, name: "Juventus" },
    { id: 211, name: "Benfica" },
    { id: 79, name: "Lille" },
    { id: 209, name: "Feyenoord" },
    { id: 50, name: "Manchester City" },
    { id: 569, name: "Club Brugge KV" },
    { id: 197, name: "PSV Eindhoven" },
    { id: 40, name: "Liverpool" },
    { id: 571, name: "Red Bull Salzburg" },
    { id: 530, name: "Atlético Madrid" },
    { id: 637, name: "SK Sturm Graz" },
    { id: 173, name: "RB Leipzig" },
    { id: 228, name: "Sporting" },
    { id: 500, name: "Bologna" },
    { id: 106, name: "Stade Brestois" },
    { id: 541, name: "Real Madrid" },
    { id: 172, name: "VfB Stuttgart" },
    { id: 85, name: "Paris Saint-Germain" },
    { id: 565, name: "Young Boys" },
    { id: 598, name: "FK Crvena zvezda" }
];

document.querySelectorAll(".score-pred").forEach(input => {
    input.addEventListener("input", () => {
        const teamId = input.dataset.team;
        const opponentId = input.dataset.opponent;

        const teamScore = parseInt(input.value) || 0;
        const opponentScore = parseInt(document.querySelector(`input[data-team="${opponentId}"]`).value) || 0;

        // Find the teams in standings
        const team = currentStandings.find(item => item.id === parseInt(teamId));
        const opponent = currentStandings.find(item => item.id === parseInt(opponentId));
        const points = document.querySelector(`tr[data-id="${teamId}"] td:nth-child(9)`);
        const opPoints = document.querySelector(`tr[data-id="${opponentId}"] td:nth-child(9)`);
        const goalsFor = document.querySelector(`tr[data-id="${teamId}"] td:nth-child(7)`);
        const opGoalsFor = document.querySelector(`tr[data-id="${opponentId}"] td:nth-child(7)`);
        const goalsAg = document.querySelector(`tr[data-id="${teamId}"] td:nth-child(8)`);
        const opGoalsAg = document.querySelector(`tr[data-id="${opponentId}"] td:nth-child(8)`);
        const wins = document.querySelector(`tr[data-id="${teamId}"] td:nth-child(4)`);
        const draws = document.querySelector(`tr[data-id="${teamId}"] td:nth-child(5)`);
        const losses = document.querySelector(`tr[data-id="${teamId}"] td:nth-child(6)`);
        const opWins = document.querySelector(`tr[data-id="${opponentId}"] td:nth-child(4)`);
        const opDraws = document.querySelector(`tr[data-id="${opponentId}"] td:nth-child(5)`);
        const opLosses = document.querySelector(`tr[data-id="${opponentId}"] td:nth-child(6)`);

        if (team && opponent) {
            if (teamScore > opponentScore) {
                points.innerHTML = team.total.points + 3; 
                opPoints.innerHTML = opponent.total.points;
                wins.innerHTML = team.wins + 1;
                opWins.innerHTML = opponent.wins;
                losses.innerHTML = team.losses;
                opLosses.innerHTML = opponent.losses + 1;
                draws.innerHTML = team.draws;
                opDraws.innerHTML = opponent.draws;
            } else if (opponentScore > teamScore) {
                points.innerHTML = team.total.points;
                opPoints.innerHTML = opponent.total.points + 3;
                losses.innerHTML = team.losses + 1;
                wins.innerHTML = team.wins;
                draws.innerHTML = team.draws;
                opLosses.innerHTML = opponent.losses;
                opWins.innerHTML = opponent.wins + 1;
                opDraws.innerHTML = opponent.draws;
            } else if (teamScore === opponentScore) {
                points.innerHTML = team.total.points + 1
                opPoints.innerHTML = opponent.total.points + 1;
                draws.innerHTML = team.draws + 1;
                opDraws.innerHTML = opponent.draws + 1;
                wins.innerHTML = team.wins;
                opWins.innerHTML = opponent.wins;
                losses.innerHTML = team.losses;
                opLosses.innerHTML = opponent.losses;
            }
            goalsFor.innerHTML = team.total.goals + teamScore;
            opGoalsFor.innerHTML = opponent.total.goals + opponentScore;
            goalsAg.innerHTML = team.total.goalsAgainst + opponentScore;
            opGoalsAg.innerHTML = opponent.total.goalsAgainst + teamScore
        } else {
            console.log(`Error: Could not find teams with IDs ${teamId} or ${opponentId}`);
        }
        sortTable(8, document.querySelector('th:nth-child(8)'), document.getElementById('league-standings'), 1, false, 6, 7);
        const tbodyRows = document.getElementById('league-standings').querySelectorAll('tbody tr');

        tbodyRows.forEach((row, index) => {
            row.cells[0].textContent = index + 1;
        });
        const table = document.getElementById('league-standings');
        if (table) {
            for (let i = 1; i <= 8; i++) {
                table.rows[i].style.backgroundColor = '#A8DADC';
            }
            for (let i = 9; i <= 24; i++) {
                table.rows[i].style.backgroundColor = '#F1FAEE';
            }
        }
    }); 
});

leagueStandings(currentStandings);

const table = document.getElementById('league-standings');
if (table) {
    for (let i = 1; i <= 8; i++) {
        table.rows[i].style.backgroundColor = '#A8DADC';
    }
    for (let i = 9; i <= 24; i++) {
        table.rows[i].style.backgroundColor = '#F1FAEE';
    }
    const headerRow = table.querySelector('thead tr');
    if (headerRow) {
        headerRow.deleteCell(8); 
        headerRow.deleteCell(8);
        headerRow.deleteCell(2); 
        headerRow.cells[2].style.width = '30px';
        headerRow.cells[3].style.width = '30px';
        headerRow.cells[4].style.width = '30px';
        headerRow.cells[5].style.width = '30px';
        headerRow.cells[6].style.width = '30px';
        for (let i = 0; i < headerRow.cells.length; i++) {
            headerRow.cells[i].style.paddingTop = '2px';
            headerRow.cells[i].style.paddingBottom = '2px';
        }
    }
    const tbodyRows = table.querySelectorAll('tbody tr');
    tbodyRows.forEach(row => {
        row.deleteCell(9); 
        row.deleteCell(9); 
        row.deleteCell(9); 
        row.deleteCell(9); 
        row.deleteCell(9); 
        row.deleteCell(9); 
        row.deleteCell(3); 
        for (let i = 0; i < row.cells.length; i++) {
            row.cells[i].style.paddingTop = '2px';
            row.cells[i].style.paddingBottom = '2px';
        }
        row.cells[1].querySelector('img').style.width = '30px';

    });

    

}
