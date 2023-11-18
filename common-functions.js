let download = function () {
  var link = document.createElement("a");
  link.download = "mysquad.png";
  link.href = document.getElementById("myCanvas").toDataURL();
  link.click();
};

function imagePath(teamID) {
  return `logos//${teamID}.png`;
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
  "uefa-europa-league",
  "serie-a",
  "ligue-1",
  "pokal",
  "euro-quali",
  "world-cup-qualifiers-south-america",
  "world-cup-2022",
];

let players = [
  {
    id: 184, //Harry Kane,
    club: 157, //Bayern
    nation: 10, //England
  },
  {
    id: 278, //Mbappe
    club: 85, //PSG
    nation: 2, //France
  },
  {
    id: 1100,
    club: 50, //Haaland
  },
  {
    id: 129718,
    club: 541, //Bellingham
    nation: 10, //England
  },
  {
    id: 631,
    club: 50, //Foden
    nation: 10, //England
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
  { id: 56, club: 530, nation: 2 }, //Griezzmann
  { id: 521, club: 529 }, //Lewa
  { id: 306, club: 40 }, //Salah
  { id: 907, club: 497, nation: 1 }, //Lukaku
  { id: 874, club: 0, nation: 27 }, //Ronaldo
  { id: 59, name: "Álvaro Morata", club: 530, nation: 9 },
];

function htmlDecode(input) {
  var txt = document.createElement("textarea");
  txt.innerHTML = input;
  return txt.value;
}
