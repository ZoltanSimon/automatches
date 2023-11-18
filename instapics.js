import { matchesToCanvas } from "./components/match-list.js";
import { matchStatsToCanvas } from "./components/match-statistics.js";
import { playerStatsToCanvas } from "./components/player-stats.js";
import { clubs } from "./data/clubs.js";
import { playerListToCanvas } from "./components/player-list.js";

let c = document.getElementById("myCanvas");
export let ctx = c.getContext("2d");
const font = "Source Sans Pro";
const fontSize = 46;
const backgroundImageName = "insta_new_no_pic.png";
const borderImage = "border.png";
const lineheight = 50;
let inputTextValue,
  newWidth,
  newHeight,
  base_image,
  imgHeight,
  fontY,
  i,
  breakingText;
export let imgs = {};

//Preload images
let border_image = new Image();
border_image.src = borderImage;
for (i = 0; i < clubs.length; i++) {
  var img = new Image();
  img.crossOrigin = "anonymous";
  img.src = imagePath(clubs[i].id);
  imgs[clubs[i].name] = img;
}
for (i = 0; i < players.length; i++) {
  var img = new Image();
  img.crossOrigin = "anonymous";
  img.src = `Players-pictures/${players[i].id}.png`;
  imgs[players[i].id] = img;
}

make_base("", "");

function make_base(text, breakingText) {
  let lines = text.split(/\r|\r\n|\n/);

  base_image = new Image();
  base_image.src = backgroundImageName;
  base_image.onload = function () {
    ctx.drawImage(base_image, 0, 0);

    //ctx.font = `bold 76px ${font}`; //title

    ctx.textAlign = "center";

    if (lines.count > 10) {
      ctx.drawImage(border_image, 0, 0);
    }

    fontY = 1080 - 20 - lines.length * 50;

    if (breakingText) {
      ctx.font = `bold ${fontSize + 20}px ${font}`; //title
      ctx.fillStyle = "#e63946"; //red
      ctx.fillText(breakingText, 540, fontY - 50);
    }
    ctx.fillStyle = "#1d3557"; //blue
    ctx.font = `bold ${fontSize}px ${font}`;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], 540, fontY + i * lineheight);
    }
  };
}

document.getElementById("textOnPic").onkeyup = function () {
  inputTextValue = document.getElementById("textOnPic").value;
  breakingText = document.getElementById("breaking-official").value;
  make_base(inputTextValue, breakingText);
};

/*
Should convert transfermarkt transfers to tables we can use
function keyPresszer() {
  inputTextValue = document.getElementById("cleanTmarks").value;
  var lines = inputTextValue.split("\n");
  lines.splice(0, 1);

  let players = [];
  let player = {};
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] == " \t") {
      //lines.splice(i, 1);
    }
    console.log(i % 6);
    if (i % 7 == 0) {
      player.name = lines[i];
      console.log(player.name);
    }
    if (i % 7 == 1) {
      player.pos = lines[i];
      console.log(player.pos);
    }
    if (i % 7 == 5) {
      player.price = lines[i];
      console.log(player.price);
      players.push(player);
      player = {};
    }
  }
  console.log(players);
}*/

document.getElementById("pasteArea").onpaste = function (event) {
  // use event.originalEvent.clipboard for newer chrome versions
  var items = (event.clipboardData || event.originalEvent.clipboardData).items;
  // find pasted image among pasted items
  var blob = null;
  for (var i = 0; i < items.length; i++) {
    if (items[i].type.indexOf("image") === 0) {
      blob = items[i].getAsFile();
    }
  }
  // load image if there is a pasted image
  if (blob !== null) {
    var reader = new FileReader();
    reader.onload = function (event) {
      console.log(fontY);

      imgHeight = fontY - 84 - lineheight;
      if (breakingText) imgHeight -= 60;

      base_image = new Image();
      base_image.src = event.target.result;
      base_image.onload = function () {
        drawResizedImage(base_image, imgHeight, 1080, 78);
        ctx.drawImage(border_image, 0, 0);
      };
    };
    reader.readAsDataURL(blob);
  }
};

document.getElementById("copy-match-stats").onclick = function (event) {
  matchStatsToCanvas();
};

document.getElementById("copy-standings").onclick = function (event) {
  let yPos = 100;
  let imgToAdd = [];
  let thisTr,
    thisTd,
    thisClub,
    l = 0;
  let standingsTable = document.getElementById("league-standings");

  if (standingsTable.rows.length < 20) yPos = 150;

  for (let i = 0; i < standingsTable.rows.length; i++) {
    thisTr = standingsTable.rows[i];
    for (let j = 0; j < thisTr.children.length; j++) {
      thisTd = thisTr.children[j];
      for (let k = 0; k < clubs.length; k++) {
        thisClub = clubs[k].name;
        if (thisTd.innerHTML.indexOf(`*${thisClub}*`) > -1) {
          imgToAdd.push({
            img: imgs[thisClub],
            imgHeight: 40,
            startX: 178,
            startY: yPos + 44 + l * 42,
          });
          l++;
          thisTd.innerHTML = " ";
        }
      }
    }
  }

  buildTableForTableType(
    removeNewlines(standingsTable.outerHTML),
    imgToAdd,
    yPos
  );
};

document.getElementById("copy-player-stats").onclick = function () {
  playerStatsToCanvas();
};

document.getElementById("copy-matches").onclick = function () {
  matchesToCanvas("match-list");
};

document.getElementById("copy-selected").onclick = function () {
  matchesToCanvas("selected-matches");
};

document.getElementById("copy-player-list").onclick = function () {
  playerListToCanvas();
};

export function buildTableForTableType(lines, imgToAdd, yPos = 100) {
  lines = lines.replaceAll(`width="30px">`, `width="30px" />`);
  ctx.drawImage(border_image, 0, 0);

  let theTable = "<table" + lines.split("<table")[1];
  let theText = lines.split("<table")[0];
  var data = `<svg xmlns='http://www.w3.org/2000/svg' width='880'>
    <foreignObject width='100%' height='100%'>
    <div xmlns='http://www.w3.org/1999/xhtml' style='font-family:Source Sans Pro; font-size:24px; background-color: #A8DADC;'>
    ${theTable}
    </div></foreignObject></svg>`;

  var img = new Image();
  img.onload = function () {
    ctx.drawImage(img, (1080 - img.width) / 2, yPos);
    for (let i = 0; i < imgToAdd.length; i++) {
      ctx.drawImage(
        imgToAdd[i].img,
        imgToAdd[i].startX,
        imgToAdd[i].startY,
        imgToAdd[i].imgHeight,
        imgToAdd[i].imgHeight
      );
    }
  };

  img.src = buildSvgImageUrl(data);
  ctx.fillText(theText, 540, 160);
}

function drawResizedImage(image, imgHeight, startX, startY) {
  if (image.height > image.width) {
    newHeight = imgHeight;
    newWidth = imgHeight / (image.height / image.width);
  } else {
    newHeight = imgHeight;
    newWidth = imgHeight * (image.width / image.height);
  }
  ctx.drawImage(image, (startX - newWidth) / 2, startY, newWidth, newHeight);
}

function buildSvgImageUrl(svg) {
  let b64 = window.btoa(unescape(encodeURIComponent(svg)));
  return "data:image/svg+xml;base64," + b64;
}
