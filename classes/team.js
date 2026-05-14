import { Match } from "./match.js";
import { calculateXPts } from "../backend/services/poisson-model.js";
export class Team {
  #stats;
  constructor(team) {
    this.id = team.id;
    this.name = team.name;
    this.logo = team.logo;
    this.#stats = [];
    this.played = 0;
    this.wins = 0;
    this.draws = 0;
    this.losses = 0;
    this.total = new Stats();
    this.perGame = new Stats();
    this.last5 = new Stats();
    this.last5PerGame = new Stats();
    this.form = "";
    this.points = 0;
    this.matches = [];
    this.leagues = new Map();
  }

  calculateTotals() {
    for (let stat of this.#stats) {
      this.total.addStats(stat);

      if (stat.goalsFor > stat.goalsAgainst) {
        this.wins++;
      } else if (stat.goalsFor < stat.goalsAgainst) {
        this.losses++;
      } else {
        this.draws++;
      }
    }
    this.total.winPercentage = parseFloat(((this.wins / this.played) * 100).toFixed(1));
    this.total.xG = parseFloat(this.total.xG.toFixed(1));
    this.total.xGA = parseFloat(this.total.xGA.toFixed(1));
  }

  calculatePerGame() {
    this.perGame = this.total.divideStats(this.played);
    this.perGame.possession = this.perGame.possession.toFixed(1);
  }

  calculateLast5() {
    const last5Stats = this.#stats.slice(-5);
    let last5Wins = 0;
    last5Stats.forEach((stat) => {
      this.last5.addStats(stat);
      this.form = this.updateForm(stat, this.form);
      if (stat.goalsFor > stat.goalsAgainst) {
        last5Wins++;
      }
    });
    this.last5.winPercentage = parseFloat(((last5Wins / last5Stats.length) * 100).toFixed(2));
    this.last5PerGame = this.last5.divideStats(5);
  }

  updateForm(stat, currentForm) {
    if (stat.goalsFor > stat.goalsAgainst) {
      return currentForm + "W";
    } else if (stat.goalsFor === stat.goalsAgainst) {
      return currentForm + "D";
    } else {
      return currentForm + "L";
    }
  }

  calculateStats() {
    this.played = this.#stats.length;
    this.calculateTotals();
    this.calculatePerGame();
    this.calculateLast5();
    this.formArray = this.form.split('');
  }

  extractStats(match, teamIndex, opponentIndex) {
    const tStats = match.statistics[teamIndex].statistics;
    const oStats = match.statistics[opponentIndex].statistics;
    this.#stats.push({
      goalsFor: match.score.fulltime[teamIndex === 0 ? "home" : "away"],
      goalsAgainst: match.score.fulltime[teamIndex === 0 ? "away" : "home"],
      corners: tStats[7]?.value ?? 0,
      cornersAgainst: oStats[7]?.value ?? 0,
      shotsOnGoal: tStats[0]?.value ?? 0,
      shotsOnGoalAgainst: oStats[0]?.value ?? 0,
      xG: parseFloat(tStats[16]?.value ?? 0),
      xGA: parseFloat(oStats[16]?.value ?? 0),
      fouls: tStats[4]?.value ?? 0,
      foulsAgainst: oStats[4]?.value ?? 0,
      possession: parseInt(tStats[9]?.value ?? 0),
      yellowCards: tStats[10]?.value ?? 0,
      redCards: tStats[11]?.value ?? 0,
      yellowCardsAgainst: oStats[10]?.value ?? 0,
      redCardsAgainst: oStats[11]?.value ?? 0,
      offsides: tStats[6]?.value ?? 0,
      offsidesAgainst: oStats[6]?.value ?? 0,
    });
    if (!this.matches.find((m) => m.id === match.fixture.id)) {
      let thisMatch = new Match(match);
      const hStats = match.statistics[0].statistics;
      const aStats = match.statistics[1].statistics;
      let thisStats = {
        cornersHome: hStats[7]?.value ?? 0,
        cornersAway: aStats[7]?.value ?? 0,
        shotsOnGoalHome: hStats[0]?.value ?? 0,
        shotsOnGoalAway: aStats[0]?.value ?? 0,
        xGHome: parseFloat(hStats[16]?.value ?? 0),
        xGAway: parseFloat(aStats[16]?.value ?? 0),
      }
      thisMatch.stats = thisStats;
      this.matches.push(thisMatch);
    }

    this.leagues.set(match.league.id, {
      id: match.league.id,
      name: match.league.name,
      country: match.league.country
    });

  }
}

export class Stats {
  constructor() {
    this.points = 0;
    this.xPoints = 0;
    this.goals = 0;
    this.goalsAgainst = 0;
    this.xG = 0;
    this.xGA = 0;
    this.corners = 0;
    this.cornersAgainst = 0;
    this.shotsOnGoal = 0;
    this.shotsOnGoalAgainst = 0;
    this.fouls = 0;
    this.foulsAgainst = 0;
    this.possession = 0;
    this.yellowCards = 0;
    this.redCards = 0;
    this.yellowCardsAgainst = 0;
    this.redCardsAgainst = 0;
    this.offsides = 0;
    this.offsidesAgainst = 0;
  }

  addStats(stat) {
    this.points +=
      stat.goalsFor > stat.goalsAgainst
        ? 3
        : stat.goalsFor === stat.goalsAgainst
        ? 1
        : 0;

    const xgFor = Number(stat.xG) || 0;
    const xgAgainst = Number(stat.xGA) || 0;
    this.xPoints = parseFloat(
      (this.xPoints + calculateXPts(xgFor, xgAgainst).xPts).toFixed(2)
    );

    this.xG = parseFloat((this.xG + (stat.xG || 0)).toFixed(2));
    this.xGA = parseFloat((this.xGA + (stat.xGA || 0)).toFixed(2));
    this.corners += stat.corners;
    this.cornersAgainst += stat.cornersAgainst;
    this.shotsOnGoal += stat.shotsOnGoal;
    this.shotsOnGoalAgainst += stat.shotsOnGoalAgainst;
    this.goals += stat.goalsFor;
    this.goalsAgainst += stat.goalsAgainst;
    this.fouls += stat.fouls || 0;
    this.foulsAgainst += stat.foulsAgainst || 0;
    this.possession += parseInt(stat.possession) || 0;
    this.yellowCards += stat.yellowCards || 0;
    this.redCards += stat.redCards || 0;
    this.yellowCardsAgainst += stat.yellowCardsAgainst || 0;
    this.redCardsAgainst += stat.redCardsAgainst || 0;
    this.offsides += stat.offsides || 0;
    this.offsidesAgainst += stat.offsidesAgainst || 0;
  }

  divideStats(divisor) {
    let dividedStats = new Stats();
    dividedStats.points = parseFloat((this.points / divisor).toFixed(2));
    dividedStats.xPoints = parseFloat((this.xPoints / divisor).toFixed(2));
    dividedStats.xG = parseFloat((this.xG / divisor).toFixed(2));
    dividedStats.xGA = parseFloat((this.xGA / divisor).toFixed(2));
    dividedStats.corners = parseFloat((this.corners / divisor).toFixed(2));
    dividedStats.cornersAgainst = parseFloat(
      (this.cornersAgainst / divisor).toFixed(2)
    );
    dividedStats.shotsOnGoal = parseFloat(
      (this.shotsOnGoal / divisor).toFixed(2)
    );
    dividedStats.shotsOnGoalAgainst = parseFloat(
      (this.shotsOnGoalAgainst / divisor).toFixed(2)
    );
    dividedStats.goals = parseFloat((this.goals / divisor).toFixed(2));
    dividedStats.goalsAgainst = parseFloat(
      (this.goalsAgainst / divisor).toFixed(2)
    );
    dividedStats.fouls = parseFloat((this.fouls / divisor).toFixed(2));
    dividedStats.foulsAgainst = parseFloat(
      (this.foulsAgainst / divisor).toFixed(2)
    );
    dividedStats.possession = parseFloat(
      (this.possession / divisor).toFixed(2)
    );
    dividedStats.yellowCards = parseFloat(
      (this.yellowCards / divisor).toFixed(2)
    );
    dividedStats.redCards = parseFloat((this.redCards / divisor).toFixed(2));
    dividedStats.yellowCardsAgainst = parseFloat(
      (this.yellowCardsAgainst / divisor).toFixed(2)
    );
    dividedStats.redCardsAgainst = parseFloat(
      (this.redCardsAgainst / divisor).toFixed(2)
    );
    dividedStats.offsides = parseFloat(
      (this.offsides / divisor).toFixed(2)
    );
    dividedStats.offsidesAgainst = parseFloat(
      (this.offsidesAgainst / divisor).toFixed(2)
    );
    return dividedStats;
  }
}
