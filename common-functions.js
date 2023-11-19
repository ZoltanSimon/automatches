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

function htmlDecode(input) {
  var txt = document.createElement("textarea");
  txt.innerHTML = input;
  return txt.value;
}
