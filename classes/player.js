export class Player {
  constructor(inputPlayer) {
    this.id = inputPlayer.id;
    this.name = inputPlayer.name;
    this.club = inputPlayer.club;
    this.nation = inputPlayer.nation;
    this.goals = 0;
    this.assists = 0;
    this.apps = 0;
    this.avRating = 0;
    this.blocks = 0;
    this.competitionList = [];
    this.competitions = "";
    this.dribbles = ``;
    this.dribblesAttempts = 0;
    this.dribblesPast = 0;
    this.dribblesSucc = 0;
    this.duels = "";
    this.duelsTotal = 0;
    this.duelsWon = 0;
    this.foulsCommited = 0;
    this.foulsAgainst = 0;
    this.ga=0;
    this.gap90 = 0;
    this.interceptions = 0;
    this.keyPasses = 0;
    this.minutes = 0;
    this.npg = 0;
    this.passes = 0;
    this.penalties = 0;
    this.penaltiesMissed = 0;
    this.position = "";
    this.rating = 0;
    this.redCards = 0;
    this.shots = ``;
    this.shotsOn = 0;
    this.shotsTotal = 0;
    this.tackles = 0;
    this.yellowCards = 0;
    this.positions=[];    
  }

  getPlayerStats(playerFound) {
    let stats = playerFound.statistics[0];

    if (stats.goals.total) {
      this.goals += stats.goals.total;
      this.ga += stats.goals.total;
    }
    if (stats.goals.assists) {
      this.assists += stats.goals.assists;
      this.ga += stats.goals.assists;
    }
    if (stats.shots.on) this.shotsOn += stats.shots.on;
    if (stats.shots.total) this.shotsTotal += stats.shots.total;
    if (stats.dribbles.attempts)
      this.dribblesAttempts += stats.dribbles.attempts;
    if (stats.dribbles.success) this.dribblesSucc += stats.dribbles.success;
    if (stats.duels.won) this.duelsWon += stats.duels.won;
    if (stats.duels.total) this.duelsTotal += stats.duels.total;
    if (stats.passes.key) this.keyPasses += stats.passes.key;
    if (stats.fouls.drawn) this.foulsAgainst += stats.fouls.drawn;
    if (stats.games.minutes) this.apps++;
    this.minutes += stats.games.minutes;
    if (stats.penalty.scored) this.penalties++;
    if (stats.games.rating) this.rating += parseFloat(stats.games.rating);
    if (stats.position) this.position = position.concat(stats.games.position);
    if (stats.passes.total) this.passes += stats.passes.total;
    if (stats.tackles.total) this.tackles += stats.tackles.total;
    if (stats.tackles.blocks) this.blocks += stats.tackles.blocks;
    if (stats.tackles.interceptions)
      this.interceptions += stats.tackles.interceptions;
    if (stats.dribbles.past) this.dribblesPast += stats.dribbles.past;
    if (stats.fouls.committed) this.foulsCommited += stats.fouls.committed;
    if (stats.cards.yellow) this.yellowCards += stats.cards.yellow;
    if (stats.cards.red) this.redCards += stats.cards.red;
    if (stats.penalty.missed) this.penaltiesMissed += stats.penalty.missed;

    this.getGAper90();
  }

  getGAper90() {
    this.gap90 = (((this.goals + this.assists) * 90) / this.minutes).toFixed(2);
    this.shots = `${this.shotsOn} / ${this.shotsTotal}`;
    this.dribbles = `${this.dribblesSucc} / ${this.dribblesAttempts}`;
    this.duels = `${this.duelsWon} / ${this.duelsTotal}`;
    this.competitions = this.competitionList.join(", ");
    this.avRating = (this.rating / this.apps).toFixed(2);
    this.npg = this.goals - this.penalties;
  }
}
