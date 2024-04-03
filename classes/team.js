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

  getPoints() {
    this.points = 3 * this.wins + this.draws;
  }
}

export class Stats {
  constructor() {
    this.goals = 0;
    this.goalsAgainst = 0;
    this.xG = 0;
    this.xGA = 0;
    this.corners = 0;
    this.cornersAgainst = 0;
    this.shotsOnGoal = 0;
    this.shotsOnGoalAgainst = 0;
  }
}
