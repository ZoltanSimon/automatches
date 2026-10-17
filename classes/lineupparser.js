export class LineupParser {
  static playerPositionCounts = {}; // { playerName: { role: count } }

  // Top to bottom, right to left within each row. Shared with starter role counts.
  static orderedGridPlayers(players) {
    const gridPlayers = players
      .filter((player) => player.grid)
      .map((player) => {
        const [row, col] = String(player.grid).split(":").map(Number);
        return { ...player, row, col };
      });

    gridPlayers.sort((a, b) => a.row - b.row || a.col - b.col);

    const rowMap = {};
    gridPlayers.forEach((player) => {
      if (!rowMap[player.row]) rowMap[player.row] = [];
      rowMap[player.row].push(player);
    });

    return Object.keys(rowMap)
      .sort((a, b) => a - b)
      .flatMap((row) => rowMap[row].sort((a, b) => b.col - a.col));
  }

  static parseLineups(lineups, clubId = null) {
    const result = {};

    lineups.forEach((team) => {
      const formation = team.formation;
      const orderedPlayers = LineupParser.orderedGridPlayers(team.startXI.map((p) => p.player));

      const formationEntry = LineupParser.formations.find(
        (f) => f.formation === formation,
      );
      const positions = formationEntry?.positions;

      if (!positions || positions.length !== orderedPlayers.length) {
        console.warn(
          `Formation mismatch or undefined: ${formation} with ${orderedPlayers.length} players.`,
        );
      }

      const teamResult = {};

      orderedPlayers.forEach((player, i) => {
        const role = positions?.[i] || "Unknown";

        if (!LineupParser.playerPositionCounts[player.id]) {
          LineupParser.playerPositionCounts[player.id] = {};
        }
        const roleCounts = LineupParser.playerPositionCounts[player.id];
        roleCounts[role] = (roleCounts[role] || 0) + 1;

        teamResult[player.id] = {
          role,
          name: player.name, // Keep name as data, not key
          number: player.number,
          pos: player.pos,
          grid: player.grid,
        };
      });

      result[team.team.name] = teamResult;
    });

    // Finalize roles to use the most frequent one - using player IDs
    for (const teamName in result) {
      for (const playerId in result[teamName]) {
        const roleCounts = LineupParser.playerPositionCounts[playerId];
        const finalRole = Object.entries(roleCounts).sort(
          (a, b) => b[1] - a[1],
        )[0][0]; // highest count
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

  static starterRolesByPlayerId(lineups = []) {
    const roles = new Map();
    if (!Array.isArray(lineups)) {
      return roles;
    }

    for (const lineup of lineups) {
      const formationEntry = LineupParser.formations.find(
        (formation) => formation.formation === lineup?.formation,
      );
      const positions = formationEntry?.positions;
      const starters = Array.isArray(lineup?.startXI) ? lineup.startXI : [];
      const orderedPlayers = LineupParser.orderedGridPlayers(
        starters.map((entry) => entry?.player).filter(Boolean),
      );

      orderedPlayers.forEach((player, index) => {
        const role = positions?.[index] || "Unknown";
        const playerId = Number(player.id);
        if (role === "Unknown" || !Number.isFinite(playerId)) {
          return;
        }

        roles.set(playerId, role);
      });
    }

    return roles;
  }

  static formations = [
    {
      formation: "4-4-2",
      positions: [
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
        "Striker",
      ],
    },
    {
      formation: "4-2-3-1",
      positions: [
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
        "Striker",
      ],
    },
    {
      formation: "4-3-3",
      positions: [
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
        "Left Winger",
      ],
    },
    {
      formation: "4-1-2-3",
      positions: [
        "Goalkeeper",
        "Right Back",
        "Center Back",
        "Center Back",
        "Left Back",
        "Defensive Midfielder",
        "Central Midfielder",
        "Central Midfielder",
        "Right Winger",
        "Striker",
        "Left Winger",
      ],
    },
    {
      formation: "3-5-2",
      positions: [
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
        "Striker",
      ],
    },
    {
      formation: "3-4-3",
      positions: [
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
        "Left Winger",
      ],
    },
    {
      formation: "4-1-4-1",
      positions: [
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
        "Striker",
      ],
    },
    {
      formation: "3-4-2-1",
      positions: [
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
        "Striker",
      ],
    },
    {
      formation: "4-4-1-1",
      positions: [
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
        "Striker",
      ],
    },
    {
      formation: "4-2-2-2",
      positions: [
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
        "Striker",
      ],
    },
    {
      formation: "4-3-1-2",
      positions: [
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
        "Striker",
      ],
    },
    {
      formation: "3-4-1-2",
      positions: [
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
        "Striker",
      ],
    },
    {
      formation: "5-4-1",
      positions: [
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
        "Striker",
      ],
    },
    {
      formation: "5-3-2",
      positions: [
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
        "Striker",
      ],
    },
    {
      formation: "4-5-1",
      positions: [
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
        "Striker",
      ],
    },
    {
      formation: "3-1-4-2",
      positions: [
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
        "Striker",
      ],
    },
    {
      formation: "3-2-4-1",
      positions: [
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
        "Striker",
      ],
    },
    {
      formation: "4-3-2-1",
      positions: [
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
        "Striker",
      ],
    },
    {
      formation: "4-1-2-1-2",
      positions: [
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
        "Striker",
      ],
    },
    {
      formation: "5-2-3",
      positions: [
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
        "Left Winger",
      ],
    },
    {
      formation: "4-2-4",
      positions: [
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
        "Striker",
      ],
    },
    {
      formation: "4-1-3-2",
      positions: [
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
        "Striker",
      ],
    },
    {
      formation: "4-2-1-3",
      positions: [
        "Goalkeeper",
        "Right Back",
        "Center Back",
        "Center Back",
        "Left Back",
        "Defensive Midfielder",
        "Defensive Midfielder",
        "Attacking Midfielder",
        "Right Winger",
        "Striker",
        "Left Winger",
      ],
    },
    {
      formation: "3-5-1-1",
      positions: [
        "Goalkeeper",
        "Center Back",
        "Center Back",
        "Center Back",
        "Right Wing Back",
        "Central Midfielder",
        "Central Midfielder",
        "Central Midfielder",
        "Left Wing Back",
        "Attacking Midfielder",
        "Striker",
      ],
    },
    {
      formation: "3-3-3-1",
      positions: [
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
        "Left Winger",
      ],
    },
    {
      formation: "3-3-1-3",
      positions: [
        "Goalkeeper",
        "Center Back",
        "Center Back",
        "Center Back",
        "Right Midfielder",
        "Central Midfielder",
        "Left Midfielder",
        "Attacking Midfielder",
        "Right Winger",
        "Striker",
        "Left Winger",
      ],
    },
    {
      formation: "3-2-5",
      positions: [
        "Goalkeeper",
        "Center Back",
        "Center Back",
        "Center Back",
        "Defensive Midfielder",
        "Defensive Midfielder",
        "Right Winger",
        "Attacking Midfielder",
        "Striker",
        "Attacking Midfielder",
        "Left Winger",
      ],
    },
    {
      formation: "3-2-3-2",
      positions: [
        "Goalkeeper",
        "Center Back",
        "Center Back",
        "Center Back",
        "Defensive Midfielder",
        "Defensive Midfielder",
        "Right Winger",
        "Attacking Midfielder",
        "Left Winger",
        "Striker",
        "Striker",
      ],
    },
    {
      formation: "3-1-5-1",
      positions: [
        "Goalkeeper",
        "Center Back",
        "Center Back",
        "Center Back",
        "Defensive Midfielder",
        "Right Midfielder",
        "Central Midfielder",
        "Attacking Midfielder",
        "Central Midfielder",
        "Left Midfielder",
        "Striker",
      ],
    },
    {
      formation: "3-1-3-3",
      positions: [
        "Goalkeeper",
        "Center Back",
        "Center Back",
        "Center Back",
        "Defensive Midfielder",
        "Right Midfielder",
        "Central Midfielder",
        "Left Midfielder",
        "Right Winger",
        "Striker",
        "Left Winger",
      ],
    },
    {
      formation: "3-3-4",
      positions: [
        "Goalkeeper",
        "Center Back",
        "Center Back",
        "Center Back",
        "Right Midfielder",
        "Central Midfielder",
        "Left Midfielder",
        "Right Winger",
        "Striker",
        "Striker",
        "Left Winger",
      ],
    },
    {
      formation: "3-3-2-2",
      positions: [
        "Goalkeeper",
        "Center Back",
        "Center Back",
        "Center Back",
        "Right Midfielder",
        "Central Midfielder",
        "Left Midfielder",
        "Attacking Midfielder",
        "Attacking Midfielder",
        "Striker",
        "Striker",
      ],
    },
    {
      formation: "3-6-1",
      positions: [
        "Goalkeeper",
        "Center Back",
        "Center Back",
        "Center Back",
        "Right Wing Back",
        "Central Midfielder",
        "Central Midfielder",
        "Central Midfielder",
        "Central Midfielder",
        "Left Wing Back",
        "Striker",
      ],
    },
    {
      formation: "4-1-2-2-1",
      positions: [
        "Goalkeeper",
        "Right Back",
        "Center Back",
        "Center Back",
        "Left Back",
        "Defensive Midfielder",
        "Central Midfielder",
        "Central Midfielder",
        "Right Winger",
        "Left Winger",
        "Striker",
      ],
    },
    {
      formation: "4-1-3-1-1",
      positions: [
        "Goalkeeper",
        "Right Back",
        "Center Back",
        "Center Back",
        "Left Back",
        "Defensive Midfielder",
        "Right Midfielder",
        "Central Midfielder",
        "Left Midfielder",
        "Attacking Midfielder",
        "Striker",
      ],
    },
    {
      formation: "5-2-1-2",
      positions: [
        "Goalkeeper",
        "Right Back",
        "Center Back",
        "Center Back",
        "Center Back",
        "Left Back",
        "Defensive Midfielder",
        "Defensive Midfielder",
        "Attacking Midfielder",
        "Striker",
        "Striker",
      ],
    },
    {
      formation: "5-2-2-1",
      positions: [
        "Goalkeeper",
        "Right Back",
        "Center Back",
        "Center Back",
        "Center Back",
        "Left Back",
        "Central Midfielder",
        "Central Midfielder",
        "Right Winger",
        "Left Winger",
        "Striker",
      ],
    },
    {
      formation: "5-3-1-1",
      positions: [
        "Goalkeeper",
        "Right Back",
        "Center Back",
        "Center Back",
        "Center Back",
        "Left Back",
        "Central Midfielder",
        "Central Midfielder",
        "Central Midfielder",
        "Attacking Midfielder",
        "Striker",
      ],
    },
    {
      formation: "5-1-3-1",
      positions: [
        "Goalkeeper",
        "Right Back",
        "Center Back",
        "Center Back",
        "Center Back",
        "Left Back",
        "Defensive Midfielder",
        "Right Midfielder",
        "Attacking Midfielder",
        "Left Midfielder",
        "Striker",
      ],
    },
    {
      formation: "5-1-2-2",
      positions: [
        "Goalkeeper",
        "Right Back",
        "Center Back",
        "Center Back",
        "Center Back",
        "Left Back",
        "Defensive Midfielder",
        "Attacking Midfielder",
        "Attacking Midfielder",
        "Striker",
        "Striker",
      ],
    },
  ];
}
