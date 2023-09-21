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
  return `"https://generationfootball.net/wp-content/uploads/Logos//${teamName
    .replaceAll(" ", "_")
    .toLowerCase()}.png"`;
}

function removeNewlines(str) {
  str = str.replace(/\s{2,}/g, " ");
  str = str.replace(/\t/g, " ");
  str = str
    .toString()
    .trim()
    .replace(/(\r\n|\n|\r)/g, "");
  return str;
}
