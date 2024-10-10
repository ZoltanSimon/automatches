import { players } from "../data/players.js";
export class Player {
  constructor(inputPlayer) {
    let thisPlayer = players.find((element) => element.id == inputPlayer.id);
    this.id = inputPlayer.id;
    this.club = thisPlayer.club;
    this.nation = thisPlayer.nation;
    this.goals = 0;
    this.assists = 0;
    this.shotsOn = 0;
    this.shotsTotal = 0;
    this.shots = ``;
    this.dribbles = ``;
    this.dribblesAttempts = 0;
    this.dribblesSucc = 0;
    this.duelsWon = 0;
    this.duelsTotal = 0;
    this.key_passes = 0;
    this.fouls_drawn = 0;
    this.apps = 0;
    this.minutes = 0;
    this.gap90 = 0;
    this.name = thisPlayer.name;
    this.team = inputPlayer.teamName;
    this.competitions = "";
    this.duels = "";
    this.competitionList = [];
    this.penalties = 0;
  }

  getPlayerStats(playerFound) {
    let stats = playerFound.statistics[0];

    if (stats.goals.total) this.goals += stats.goals.total;
    if (stats.goals.assists) this.assists += stats.goals.assists;
    if (stats.shots.on) this.shotsOn += stats.shots.on;
    if (stats.shots.total) this.shotsTotal += stats.shots.total;
    if (stats.dribbles.attempts)
      this.dribblesAttempts += stats.dribbles.attempts;
    if (stats.dribbles.success) this.dribblesSucc += stats.dribbles.success;
    if (stats.duels.won) this.duelsWon += stats.duels.won;
    if (stats.duels.total) this.duelsTotal += stats.duels.total;
    if (stats.passes.key) this.key_passes += stats.passes.key;
    if (stats.fouls.drawn) this.fouls_drawn += stats.fouls.drawn;
    if (stats.games.minutes) this.apps++;
    this.minutes += stats.games.minutes;
    if (stats.penalty.scored) this.penalties++;

    this.getGAper90();
  }

  getGAper90() {
    this.gap90 = (((this.goals + this.assists) * 90) / this.minutes).toFixed(2);
    this.shots = `${this.shotsOn} / ${this.shotsTotal}`;
    this.dribbles = `${this.dribblesSucc} / ${this.dribblesAttempts}`;
    this.duels = `${this.duelsWon} / ${this.duelsTotal}`;
    this.competitions = this.competitionList.join(", ");
  }
}
