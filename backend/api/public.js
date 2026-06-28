import { Router } from "express";
import { parseLeagueIds, handleError } from "../backend-helper.js";
import { extractTeams } from "../services/teams-service.js";
import { getRegistry } from "../services/registry-service.js";
import { getPredictionForMatch } from "../services/prediction-service.js";

export function createPublicRouter() {
  const router = Router();

  router.get("/status", (request, response) => {
    response.send({ Status: "Running" });
  });

  router.get("/predict-match", async (request, response) => {
    try {
      const { matchID } = request.query;

      if (!matchID) {
        return response.status(400).json({
          success: false,
          message: "matchID query parameter required",
        });
      }

      const prediction = await getPredictionForMatch(matchID);
      response.json({ success: true, prediction });
    } catch (error) {
      handleError(response, error, "Error generating match prediction");
    }
  });

  router.get("/get-teams", async (request, response) => {
    const selectedTeamLeague = parseLeagueIds(request.query.leagueID);
    const date = request.query.date;

    try {
      const registry = await getRegistry();
      const result = extractTeams(registry, date, selectedTeamLeague);
      response.json(result);
    } catch (error) {
      response.status(400).json({ success: false, message: error.message });
    }
  });

  return router;
}
