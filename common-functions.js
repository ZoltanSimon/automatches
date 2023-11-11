let download = function () {
  var link = document.createElement("a");
  link.download = "mysquad.png";
  link.href = document.getElementById("myCanvas").toDataURL();
  link.click();
};

function imagePath(teamName) {
  teamName = teamName.replace("ó", "o").replace("ę", "e");
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
  { id: 56, club: 530 }, //Griezzmann
  { id: 521, club: 529 }, //Lewa
];
