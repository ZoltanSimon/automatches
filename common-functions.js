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

function htmlDecode(input) {
  var txt = document.createElement("textarea");
  txt.innerHTML = input;
  return txt.value;
}

function truncate(str, n) {
  return str.length > n ? str.slice(0, n - 1) + "&hellip;" : str;
}
