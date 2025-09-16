export class LineupParser {
    static playerPositionCounts = {}; // { playerName: { role: count } }

    static parseLineups(lineups, clubId = null) {
        const result = {};

        lineups.forEach(team => {
            const formation = team.formation;
            const players = team.startXI.map(p => p.player);

            const gridPlayers = players
                .filter(p => p.grid)
                .map(p => {
                    const [row, col] = p.grid.split(':').map(Number);
                    return { ...p, row, col };
                });

            gridPlayers.sort((a, b) => a.row - b.row || a.col - b.col);

            const formationEntry = LineupParser.formations.find(f => f.formation === formation);
            const positions = formationEntry?.positions;

            if (!positions || positions.length !== gridPlayers.length) {
                console.warn(`Formation mismatch or undefined: ${formation} with ${gridPlayers.length} players.`);
            }

            const teamResult = {};

            // Group players by row
            const rowMap = {};
            gridPlayers.forEach(player => {
                if (!rowMap[player.row]) rowMap[player.row] = [];
                rowMap[player.row].push(player);
            });

            // Rebuild ordered list with mirrored cols (right to left per row)
            const orderedPlayers = Object.keys(rowMap)
                .sort((a, b) => a - b) // top to bottom
                .flatMap(row => rowMap[row].sort((a, b) => b.col - a.col)); // mirror: right to left

            orderedPlayers.forEach((player, i) => {
                const role = positions?.[i] || "Unknown";

                if (!LineupParser.playerPositionCounts[player.id]) {
                    LineupParser.playerPositionCounts[player.id] = {};
                }
                const roleCounts = LineupParser.playerPositionCounts[player.id];
                roleCounts[role] = (roleCounts[role] || 0) + 1;

                teamResult[player.id] = {
                    role,
                    name: player.name,  // Keep name as data, not key
                    number: player.number,
                    pos: player.pos,
                    grid: player.grid
                };
            });

            result[team.team.name] = teamResult;
        });

        // Finalize roles to use the most frequent one - using player IDs
        for (const teamName in result) {
            for (const playerId in result[teamName]) {
                const roleCounts = LineupParser.playerPositionCounts[playerId];
                const finalRole = Object.entries(roleCounts).sort((a, b) => b[1] - a[1])[0][0]; // highest count
                result[teamName][playerId].role = finalRole;
            }
        }

        if (clubId) {
            for (const lineup of lineups) {
                if (lineup.team.id === clubId) {
                    return result[lineup.team.name] || {};
                }
            }
            return {};
        }

        return result;
    }
    
    static formations = [
        {
            "formation": "4-4-2",
            "positions": [
                "Goalkeeper",
                "Right Back",
                "Center Back",
                "Center Back",
                "Left Back",
                "Right Midfielder",
                "Central Midfielder",
                "Central Midfielder",
                "Left Midfielder",
                "Striker",
                "Striker"
            ]
        },
        {
            "formation": "4-2-3-1",
            "positions": [
                "Goalkeeper",
                "Right Back",
                "Center Back",
                "Center Back",
                "Left Back",
                "Defensive Midfielder",
                "Defensive Midfielder",
                "Right Winger",
                "Attacking Midfielder",
                "Left Winger",
                "Striker"
            ]
        },
        {
            "formation": "4-3-3",
            "positions": [
                "Goalkeeper",
                "Right Back",
                "Center Back",
                "Center Back",
                "Left Back",
                "Central Midfielder",
                "Central Midfielder",
                "Central Midfielder",
                "Right Winger",
                "Striker",
                "Left Winger"
            ]
        },
        {
            "formation": "3-5-2",
            "positions": [
                "Goalkeeper",
                "Center Back",
                "Center Back",
                "Center Back",
                "Right Wing Back",
                "Central Midfielder",
                "Central Midfielder",
                "Central Midfielder",
                "Left Wing Back",
                "Striker",
                "Striker"
            ]
        },
        {
            "formation": "3-4-3",
            "positions": [
                "Goalkeeper",
                "Center Back",
                "Center Back",
                "Center Back",
                "Right Midfielder",
                "Central Midfielder",
                "Central Midfielder",
                "Left Midfielder",
                "Right Winger",
                "Striker",
                "Left Winger"
            ]
        },
        {
            "formation": "4-1-4-1",
            "positions": [
                "Goalkeeper",
                "Right Back",
                "Center Back",
                "Center Back",
                "Left Back",
                "Defensive Midfielder",
                "Right Midfielder",
                "Central Midfielder",
                "Central Midfielder",
                "Left Midfielder",
                "Striker"
            ]
        },
        {
            "formation": "3-4-2-1",
            "positions": [
                "Goalkeeper",
                "Center Back",
                "Center Back",
                "Center Back",
                "Right Wing Back",
                "Central Midfielder",
                "Central Midfielder",
                "Left Wing Back",
                "Attacking Midfielder",
                "Attacking Midfielder",
                "Striker"
            ]
        },
        {
            "formation": "4-4-1-1",
            "positions": [
                "Goalkeeper",
                "Right Back",
                "Center Back",
                "Center Back",
                "Left Back",
                "Right Midfielder",
                "Central Midfielder",
                "Central Midfielder",
                "Left Midfielder",
                "Attacking Midfielder",
                "Striker"
            ]
        },
        {
            "formation": "4-2-2-2",
            "positions": [
                "Goalkeeper",
                "Right Back",
                "Center Back",
                "Center Back",
                "Left Back",
                "Defensive Midfielder",
                "Defensive Midfielder",
                "Attacking Midfielder",
                "Attacking Midfielder",
                "Striker",
                "Striker"
            ]
        },
        {
            "formation": "4-3-1-2",
            "positions": [
                "Goalkeeper",
                "Right Back",
                "Center Back",
                "Center Back",
                "Left Back",
                "Central Midfielder",
                "Central Midfielder",
                "Central Midfielder",
                "Attacking Midfielder",
                "Striker",
                "Striker"
            ]
        },
        {
            "formation": "3-4-1-2",
            "positions": [
                "Goalkeeper",
                "Center Back",
                "Center Back",
                "Center Back",
                "Right Wing Back",
                "Central Midfielder",
                "Central Midfielder",
                "Left Wing Back",
                "Attacking Midfielder",
                "Striker",
                "Striker"
            ]
        },
        {
            "formation": "5-4-1",
            "positions": [
                "Goalkeeper",
                "Right Back",
                "Center Back",
                "Center Back",
                "Center Back",
                "Left Back",
                "Right Midfielder",
                "Central Midfielder",
                "Central Midfielder",
                "Left Midfielder",
                "Striker"
            ]
        },
        {
            "formation": "5-3-2",
            "positions": [
                "Goalkeeper",
                "Right Back",
                "Center Back",
                "Center Back",
                "Center Back",
                "Left Back",
                "Central Midfielder",
                "Central Midfielder",
                "Central Midfielder",
                "Striker",
                "Striker"
            ]
        },
        {
            "formation": "4-5-1",
            "positions": [
                "Goalkeeper",
                "Right Back",
                "Center Back",
                "Center Back",
                "Left Back",
                "Right Midfielder",
                "Central Midfielder",
                "Central Midfielder",
                "Central Midfielder",
                "Left Midfielder",
                "Striker"
            ]
        },
        {
            "formation": "3-1-4-2",
            "positions": [
                "Goalkeeper",
                "Center Back",
                "Center Back",
                "Center Back",
                "Defensive Midfielder",
                "Right Midfielder",
                "Central Midfielder",
                "Central Midfielder",
                "Left Midfielder",
                "Striker",
                "Striker"
            ]
        },
        {
            "formation": "3-2-4-1",
            "positions": [
                "Goalkeeper",
                "Center Back",
                "Center Back",
                "Center Back",
                "Defensive Midfielder",
                "Defensive Midfielder",
                "Right Winger",
                "Central Midfielder",
                "Central Midfielder",
                "Left Winger",
                "Striker"
            ]
        },
        {
            "formation": "4-3-2-1",
            "positions": [
                "Goalkeeper",
                "Right Back",
                "Center Back",
                "Center Back",
                "Left Back",
                "Central Midfielder",
                "Central Midfielder",
                "Central Midfielder",
                "Attacking Midfielder",
                "Attacking Midfielder",
                "Striker"
            ]
        },
        {
            "formation": "4-1-2-1-2",
            "positions": [
                "Goalkeeper",
                "Right Back",
                "Center Back",
                "Center Back",
                "Left Back",
                "Defensive Midfielder",
                "Right Midfielder",
                "Left Midfielder",
                "Attacking Midfielder",
                "Striker",
                "Striker"
            ]
        },
        {
            "formation": "5-2-3",
            "positions": [
                "Goalkeeper",
                "Center Back",
                "Center Back",
                "Center Back",
                "Right Wing Back",
                "Left Wing Back",
                "Central Midfielder",
                "Central Midfielder",
                "Right Winger",
                "Striker",
                "Left Winger"
            ]
        },
        {
            "formation": "4-2-4",
            "positions": [
                "Goalkeeper",
                "Right Back",
                "Center Back",
                "Center Back",
                "Left Back",
                "Central Midfielder",
                "Central Midfielder",
                "Right Winger",
                "Left Winger",
                "Striker",
                "Striker"
            ]
        },
        {
            "formation": "4-1-3-2",
            "positions": [
                "Goalkeeper",
                "Right Back",
                "Center Back",
                "Center Back",
                "Left Back",
                "Defensive Midfielder",
                "Right Midfielder",
                "Attacking Midfielder",
                "Left Midfielder",
                "Striker",
                "Striker"
            ]
        }
    ];
}