export class Match {
  constructor(match) {
    this.homeTeam = match.teams.home;
    this.awayTeam = match.teams.away;
    this.date = match.fixture.date;
    this.venue = match.fixture.venue;
    this.homeScore = match.score.fulltime.home;
    this.awayScore = match.score.fulltime.away;
    this.status = match.fixture.status;
    this.startTime = match.fixture.timestamp;
    this.endTime = null;
    this.isDownloaded = false;
    this.stats = {};
    this.league = match.league.name;
  }
}