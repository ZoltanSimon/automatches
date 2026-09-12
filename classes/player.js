import { formatPlayerPosition } from "../backend/lib/backend-helper.js";

export class Player {
  constructor(inputPlayer) {
    const birthDate = inputPlayer.birth_date || inputPlayer.birthdate || "";
    const birthLocation = inputPlayer.birth_location || inputPlayer.birthLocation || "";
    const height = inputPlayer.height || "";
    const firstName = (inputPlayer.first_name || inputPlayer.firstname || inputPlayer.firstName || "").trim();
    const lastName = (inputPlayer.last_name || inputPlayer.lastname || inputPlayer.lastName || "").trim();
    const combinedFullName = `${firstName} ${lastName}`.trim();

    this.id = inputPlayer.id;
    this.name = inputPlayer.name;
    this.fullName = combinedFullName || inputPlayer.name;
    this.club = inputPlayer.club;
    this.nation = inputPlayer.nation;
    this.position = inputPlayer.position;
    this.displayPosition = formatPlayerPosition(inputPlayer.position);
    this.goals = 0;
    this.assists = 0;
    this.apps = 0;
    this.avRating = 0;
    this.blocks = 0;
    this.captainApps = 0;
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
    this.goalsConceded = 0;
    this.goalkeeperSaves = 0;
    this.interceptions = 0;
    this.keyPasses = 0;
    this.matchPositions = "";
    this.minutes = 0;
    this.npg = 0;
    this.offsides = 0;
    this.passAccuracy = "0%";
    this.passesAccurate = 0;
    this.passes = 0;
    this.penalties = 0;
    this.penaltiesCommitted = 0;
    this.penaltiesMissed = 0;
    this.penaltiesSaved = 0;
    this.penaltiesWon = 0;
    this.rating = 0;
    this.redCards = 0;
    this.shots = ``;
    this.shotsOn = 0;
    this.shotsTotal = 0;
    this.starts = 0;
    this.substituteApps = 0;
    this.tackles = 0;
    this.yellowCards = 0;
    this.birthdate = birthDate;
    this.birthLocation = birthLocation;
    this.height = height;
    this.age = Number(inputPlayer.age) || this.calculateAgeFromBirthDate(birthDate);
    this.exactPositions = [];
    this.shirtNumber = inputPlayer.shirtNumber || inputPlayer.shirt_number || "";
    this.shirtNumbers = this.shirtNumber;
  }

  calculateAgeFromBirthDate(birthDate) {
    if (!birthDate) {
      return 0;
    }

    const parsedDate = new Date(birthDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return 0;
    }

    const today = new Date();
    let age = today.getFullYear() - parsedDate.getFullYear();
    const monthDiff = today.getMonth() - parsedDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsedDate.getDate())) {
      age -= 1;
    }

    return age > 0 ? age : 0;
  }

  getPlayerStats(playerFound, league) {
    const stats = playerFound.statistics?.[0];
    if (!stats) {
      return;
    }

    const numberValue = (value) => {
      const parsedValue = Number(value);
      return Number.isFinite(parsedValue) ? parsedValue : 0;
    };

    const games = stats.games || {};
    const goals = stats.goals || {};
    const shots = stats.shots || {};
    const dribbles = stats.dribbles || {};
    const duels = stats.duels || {};
    const passes = stats.passes || {};
    const fouls = stats.fouls || {};
    const tackles = stats.tackles || {};
    const cards = stats.cards || {};
    const penalty = stats.penalty || {};
    const minutes = numberValue(games.minutes);

    if (goals.total) {
      this.goals += goals.total;
      this.ga += goals.total;
    }
    if (goals.assists) {
      this.assists += goals.assists;
      this.ga += goals.assists;
    }
    if (shots.on) this.shotsOn += shots.on;
    if (shots.total) this.shotsTotal += shots.total;
    if (dribbles.attempts) this.dribblesAttempts += dribbles.attempts;
    if (dribbles.success) this.dribblesSucc += dribbles.success;
    if (duels.won) this.duelsWon += duels.won;
    if (duels.total) this.duelsTotal += duels.total;
    if (passes.key) this.keyPasses += passes.key;
    if (fouls.drawn) this.foulsAgainst += fouls.drawn;
    if (minutes > 0) {
      this.apps++;
      if (games.substitute) {
        this.substituteApps++;
      } else {
        this.starts++;
      }
      if (games.captain) this.captainApps++;
    }
    this.minutes += minutes;
    if (penalty.scored) this.penalties += penalty.scored;
    if (games.rating) this.rating += parseFloat(games.rating);
    if (games.position && !this.exactPositions.includes(games.position)) {
      this.exactPositions.push(games.position);
      if (!this.position || (Array.isArray(this.position) && this.position.length === 0)) {
        this.position = this.exactPositions.join(", ");
        this.displayPosition = formatPlayerPosition(this.position);
      }
    }
    if (games.number) {
      this.shirtNumber = games.number;
    }
    if (stats.offsides) this.offsides += stats.offsides;
    if (goals.conceded) this.goalsConceded += goals.conceded;
    if (goals.saves) this.goalkeeperSaves += goals.saves;
    if (passes.total) this.passes += passes.total;
    if (passes.accuracy) this.passesAccurate += numberValue(passes.accuracy);
    if (tackles.total) this.tackles += tackles.total;
    if (tackles.blocks) this.blocks += tackles.blocks;
    if (tackles.interceptions) this.interceptions += tackles.interceptions;
    if (dribbles.past) this.dribblesPast += dribbles.past;
    if (fouls.committed) this.foulsCommited += fouls.committed;
    if (cards.yellow) this.yellowCards += cards.yellow;
    if (cards.red) this.redCards += cards.red;
    if (penalty.won) this.penaltiesWon += penalty.won;
    if (penalty.commited) this.penaltiesCommitted += penalty.commited;
    if (penalty.missed) this.penaltiesMissed += penalty.missed;
    if (penalty.saved) this.penaltiesSaved += penalty.saved;

    // Add competition (id + name) to competitionList if not already present
    if (league && league.id && league.name) {
      const leagueId = Number(league.id);
      const exists = this.competitionList.some((comp) => Number(comp.id) === leagueId);
      if (!exists) {
        this.competitionList.push({ id: leagueId, name: league.name });
      }
    }

    this.getGAper90();
  }

  getGAper90() {
    this.gap90 = this.minutes > 0 ? (((this.goals + this.assists) * 90) / this.minutes).toFixed(2) : "0.00";
    this.shots = `${this.shotsOn} / ${this.shotsTotal}`;
    this.dribbles = `${this.dribblesSucc} / ${this.dribblesAttempts}`;
    this.duels = `${this.duelsWon} / ${this.duelsTotal}`;
    this.competitions = this.competitionList.map((comp) => comp.name).join(", ");
    this.avRating = this.apps > 0 ? (this.rating / this.apps).toFixed(2) : "0.00";
    this.npg = this.goals - this.penalties;
    this.passAccuracy = this.passes > 0 ? `${((this.passesAccurate / this.passes) * 100).toFixed(0)}%` : "0%";
    this.matchPositions = this.exactPositions.join(", ");
    this.shirtNumbers = this.shirtNumber;
    if (!this.displayPosition) {
      this.displayPosition = formatPlayerPosition(this.position);
    }
  }
}
