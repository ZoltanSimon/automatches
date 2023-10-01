export class Stat {
  constructor(tag, title) {
    this.tag = tag;
    this.title = title;
    this.homeTeam = 0;
    this.awayTeam = 0;
  }

  getValues() {
    console.log(this);
    let bold1, bold2;
    if (this.homeTeam > this.awayTeam) {
      bold1 = `<b>${this.homeTeam}</b>`;
    } else {
      bold1 = this.homeTeam;
    }

    if (this.homeTeam < this.awayTeam) {
      bold2 = `<b>${this.awayTeam}</b>`;
    } else {
      bold2 = this.awayTeam;
    }

    return [bold1, bold2];
  }
}
