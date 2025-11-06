import { Team } from "../classes/team.js";
import { defaultLeagues } from "./services/leagues-service.js";

export function findOrCreateTeam(teams, teamData) {
    let team = teams.find((t) => t.name === teamData.name);
    if (!team) {
      team = new Team(teamData);
      teams.push(team);
    }
    return team;
  }
  
export function extractStats(match, teamIndex, opponentIndex) {
    return {
      goalsFor: match.score.fulltime[teamIndex === 0 ? "home" : "away"],
      goalsAgainst: match.score.fulltime[teamIndex === 0 ? "away" : "home"],
      corners: match.statistics[teamIndex].statistics[7].value,
      cornersAgainst: match.statistics[opponentIndex].statistics[7].value,
      shotsOnGoal: match.statistics[teamIndex].statistics[0].value,
      shotsOnGoalAgainst: match.statistics[opponentIndex].statistics[0].value,
      xG: parseFloat(match.statistics[teamIndex].statistics[16].value),
      xGA: parseFloat(match.statistics[opponentIndex].statistics[16].value),
    };
  }
  
  // Helper function to parse league IDs from query string
  export const parseLeagueIds = (leagueQuery) => {
    if (!leagueQuery) return defaultLeagues;
    
    return leagueQuery
      .split(",")
      .map((id) => Number(id.trim()))
      .filter(Boolean);
  };
  
  // Helper function to parse date from query string
  export const parseDate = (dateQuery) => {
    return dateQuery ? new Date(dateQuery) : new Date();
  };
  
  // Centralized error handler
  export const handleError = (res, error, message = "Error fetching data") => {
    console.error(message, error);
    res.status(500).send(message);
  };
  
