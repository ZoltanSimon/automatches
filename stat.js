export class Stat {
  constructor(tag, title) {
    this.tag = tag;
    this.title = title;
    this.homeTeam = 0;
    this.awayTeam = 0;
  }

  getValues() {
    console.log(this.homeTeam);
    let firstValueHome = isNaN(this.homeTeam)
      ? parseInt(this.homeTeam.split(" / ")[0])
      : this.homeTeam;
    let secondValueHome = isNaN(this.awayTeam)
      ? parseInt(this.awayTeam.split(" / ")[0])
      : this.awayTeam;
    let bold1, bold2;
    if (firstValueHome > secondValueHome) {
      bold1 = `<b>${this.homeTeam}</b>`;
    } else {
      bold1 = this.homeTeam;
    }

    if (firstValueHome < secondValueHome) {
      bold2 = `<b>${this.awayTeam}</b>`;
    } else {
      bold2 = this.awayTeam;
    }

    return [bold1, bold2];
  }
}
