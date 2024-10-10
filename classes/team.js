export class Team {
  constructor(team) {
    this.id = team.id;
    this.name = team.name;
    this.logo = team.logo;
    this.stats = [];
    this.matches = 0;
    this.wins = 0;
    this.draws = 0;
    this.losses = 0;
    this.total = new Stats();
    this.perGame = new Stats();
    this.last5 = new Stats();
    this.last5PerGame = new Stats();
    this.form = "";
    this.points = 0;
  }

  calculateTotals() {
    for (let stat of this.stats) {
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
    this.perGame = this.total.divideStats(this.matches);
  }

  calculateLast5() {
    const last5Stats = this.stats.slice(-5);
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
    this.matches = this.stats.length;
    this.calculateTotals();
    this.calculatePerGame();
    this.calculateLast5();
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

    this.xG += stat.xG || 0;
    this.xGA += stat.xGA || 0;
    this.corners += stat.corners;
    this.cornersAgainst += stat.cornersAgainst;
    this.shotsOnGoal += stat.shotsOnGoal;
    this.shotsOnGoalAgainst += stat.shotsOnGoalAgainst;
    this.goals += stat.goalsFor;
    this.goalsAgainst += stat.goalsAgainst;
  }

  divideStats(divisor) {
    let dividedStats = new Stats();
    dividedStats.points = this.points / divisor;
    dividedStats.xG = this.xG / divisor;
    dividedStats.xGA = this.xGA / divisor;
    dividedStats.corners = this.corners / divisor;
    dividedStats.cornersAgainst = this.cornersAgainst / divisor;
    dividedStats.shotsOnGoal = this.shotsOnGoal / divisor;
    dividedStats.shotsOnGoalAgainst = this.shotsOnGoalAgainst / divisor;
    dividedStats.goals = this.goals / divisor;
    dividedStats.goalsAgainst = this.goalsAgainst / divisor;
    return dividedStats;
  }
}
