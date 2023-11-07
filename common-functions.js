let download = function () {
  var link = document.createElement("a");
  link.download = "mysquad.png";
  link.href = document.getElementById("myCanvas").toDataURL();
  link.click();
};

function imagePath(teamName) {
  return `Logos//${teamName.replaceAll(" ", "_").toLowerCase()}.png`;
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
  "Nice",
  "Monaco",
  "Reims",
  "Lille",
  "Stade Brestois 29",
  "LE Havre",
  "Nantes",
  "Marseille",
  "Lens",
  "Rennes",
  "Strasbourg",
  "Montpellier",
  "Toulouse",
  "Lorient",
  "Metz",
  "Clermont Foot",
  "Lyon",
];

let allLeagues = [
  "bundesliga",
  "la-liga",
  "premier-league",
  "uefa-champions-league",
  "serie-a",
  "ligue-1",
  "pokal",
];

let players = [
  {
    id: 184, //Harry Kane,
    club: 157, //Bayern
  },
  {
    id: 278, //Mbappe
    club: 85,
  },
  {
    id: 1100,
    club: 50, //Haaland
  },
  {
    id: 129718,
    club: 541, //Bellingham
  },
  {
    id: 631,
    club: 50, //Foden
  },
  {
    id: 644,
    club: 157, //Sane
  },
  {
    id: 762,
    club: 541, //Vini Jr
  },
  {
    id: 6009,
    club: 50, //Alvarez
  },
  {
    id: 21393,
    club: 172, //Guirassy
  },
  {
    id: 217,
    club: 505, //Lautaro
  },
];
