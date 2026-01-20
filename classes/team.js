import { Match } from "./match.js";
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
  }

  calculatePerGame() {
    this.perGame = this.total.divideStats(this.played);
  }

  calculateLast5() {
    const last5Stats = this.#stats.slice(-5);
    last5Stats.forEach((stat) => {
      this.last5.addStats(stat);
      this.form = this.updateForm(stat, this.form);
    });
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
  }

  extractStats(match, teamIndex, opponentIndex) {
    this.#stats.push({
      goalsFor: match.score.fulltime[teamIndex === 0 ? "home" : "away"],
      goalsAgainst: match.score.fulltime[teamIndex === 0 ? "away" : "home"],
      corners: match.statistics[teamIndex].statistics[7].value,
      cornersAgainst: match.statistics[opponentIndex].statistics[7].value,
      shotsOnGoal: match.statistics[teamIndex].statistics[0].value,
      shotsOnGoalAgainst: match.statistics[opponentIndex].statistics[0].value,
      xG: parseFloat(match.statistics[teamIndex].statistics[16].value),
      xGA: parseFloat(match.statistics[opponentIndex].statistics[16].value),
    });
    if (!this.matches.find((m) => m.id === match.fixture.id)) {
      let thisMatch = new Match(match);
      let thisStats = {
        cornersHome: match.statistics[0].statistics[7].value,
        cornersAway: match.statistics[1].statistics[7].value,
        shotsOnGoalHome: match.statistics[0].statistics[0].value,
        shotsOnGoalAway: match.statistics[1].statistics[0].value,
        xGHome: parseFloat(match.statistics[0].statistics[16].value),
        xGAway: parseFloat(match.statistics[1].statistics[16].value),
      }
      thisMatch.stats = thisStats;
      this.matches.push(thisMatch);
    }
  }
}

export class Stats {
  constructor() {
    this.points = 0;
    this.goals = 0;
    this.goalsAgainst = 0;
    this.xG = 0;
    this.xGA = 0;
    this.corners = 0;
    this.cornersAgainst = 0;
    this.shotsOnGoal = 0;
    this.shotsOnGoalAgainst = 0;
  }

  addStats(stat) {
    this.points +=
      stat.goalsFor > stat.goalsAgainst
        ? 3
        : stat.goalsFor === stat.goalsAgainst
        ? 1
        : 0;

    this.xG = parseFloat((this.xG + (stat.xG || 0)).toFixed(2));
    this.xGA = parseFloat((this.xGA + (stat.xGA || 0)).toFixed(2));
    this.corners += stat.corners;
    this.cornersAgainst += stat.cornersAgainst;
    this.shotsOnGoal += stat.shotsOnGoal;
    this.shotsOnGoalAgainst += stat.shotsOnGoalAgainst;
    this.goals += stat.goalsFor;
    this.goalsAgainst += stat.goalsAgainst;
  }

  divideStats(divisor) {
    let dividedStats = new Stats();
    dividedStats.points = parseFloat((this.points / divisor).toFixed(2));
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
    return dividedStats;
  }
}
