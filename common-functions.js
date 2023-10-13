let download = function () {
  var link = document.createElement("a");
  link.download = "mysquad.png";
  link.href = document.getElementById("myCanvas").toDataURL();
  link.click();
  /*var canvas = document.getElementById("myCanvas");
  //var img =
  var img = new Image();
  img.crossOrigin = "anonymous";
  img.setAttribute("crossorigin", "anonymous"); // works for me
  console.log(img);
  img.src = canvas.toDataURL("image/png");*/

  //document.write('<img crossorigin="anonymous" src="' + img + '"/>');
};

function imagePath(teamName) {
  return `../Logos//${teamName.replaceAll(" ", "_").toLowerCase()}.png`;
}

function removeNewlines(str) {
  str = str.replace(/\s{2,}/g, "");
  str = str.replace(/\t/g, "");
  str = str
    .toString()
    .trim()
    .replace(/(\r\n|\n|\r)/g, "");
  return str;
}

let clubs = [
  "Real Madrid",
  "Atletico Madrid",
  "Manchester United",
  "Newcastle",
  "Sheffield Utd",
  "Arsenal",
  "Liverpool",
  "West Ham",
  "Mallorca",
  "Barcelona",
  "Wolves",
  "Manchester City",
  "Tottenham",
  "Aston Villa",
  "Brighton",
  "Fulham",
  "Nottingham Forest",
  "Crystal Palace",
  "Chelsea",
  "Everton",
  "Burnley",
  "Bournemouth",
  "Brentford",
  "Luton",
  "Bayer Leverkusen",
  "VfB Stuttgart",
  "Bayern Munich",
  "Borussia Dortmund",
  "RB Leipzig",
  "1899 Hoffenheim",
  "VfL Wolfsburg",
  "Girona",
  "Real Sociedad",
  "Athletic Club",
  "Real Betis",
  "Rayo Vallecano",
  "Valencia",
  "Osasuna",
  "Getafe",
  "Cadiz",
  "Villarreal",
  "Las Palmas",
  "Sevilla",
  "Alaves",
  "Celta Vigo",
  "Almeria",
  "Granada CF",
  "Inter",
  "AC Milan",
  "Napoli",
  "Juventus",
  "Fiorentina",
  "Atalanta",
  "Lecce",
  "Bologna",
  "Frosinone",
  "Torino",
  "Sassuolo",
  "Monza",
  "AS Roma",
  "Genoa",
  "Verona",
  "Lazio",
  "Udinese",
  "Salernitana",
  "Empoli",
  "Cagliari",
  "Feyenoord",
  "Paris Saint Germain",
  "Eintracht Frankfurt",
  "SC Freiburg",
  "FC Heidenheim",
  "SV Darmstadt 98",
  "Borussia Monchengladbach",
  "Union Berlin",
  "Werder Bremen",
  "FC Augsburg",
  "VfL BOCHUM",
  "FSV Mainz 05",
  "FC Koln",
];
