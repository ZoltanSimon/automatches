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
  
