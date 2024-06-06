import { matchList, matchesToCanvas } from "./components/match-list.js";
import { matchStatsToCanvas } from "./components/match-statistics.js";
import { playerStatsToCanvas } from "./components/player-stats.js";
import { standingsToCanvas } from "./components/league-standings.js";
import { playerListToCanvas } from "./components/player-list.js";
import { allLeagues } from "./data/leagues.js";
import { imagePath, download } from "./common-functions.js";

let c = document.getElementById("myCanvas");
export let ctx = c.getContext("2d");
const font = "Source Sans Pro";
const fontSize = 46;
const backgroundImageName = "images/insta_new_no_pic.png";
const borderImage = "images/border.png";
const lineheight = 50;
let inputTextValue,
  newWidth,
  newHeight,
  base_image,
  imgHeight,
  fontY,
  fixtureDate;
export let imgs = {};

const picker = datepicker(document.querySelector("#calendar"), {
  position: "bl",
  alwaysShow: true,
  onSelect: (instance, date) => {
    document.getElementById("fixtures-info").innerHTML = "";
    showMatchesOnDate(date);
  },
});

const date = new Date();

showMatchesOnDate(date);

//Preload images
let border_image = new Image();
border_image.src = borderImage;

make_base("", "");

function make_base(text, breakingText) {
  let lines = text.split(/\r|\r\n|\n/);

  base_image = new Image();
  base_image.src = backgroundImageName;
  base_image.onload = function () {
    ctx.drawImage(base_image, 0, 0);
    ctx.textAlign = "center";

    if (lines.count > 10) {
      ctx.drawImage(border_image, 0, 0);
    }

    fontY = 1080 - 30 - lines.length * 50;

    if (breakingText) {
      writeStrokedText({
        text: [breakingText],
        fontSize: fontSize + 20,
        strokeStyle: "#1d3557",
        fillStyle: "#e63946",
        lineWidth: 4,
        y: fontY - 56,
      });
    }
    writeStrokedText({ text: lines, fontSize: fontSize, y: fontY });
  };
}

document.getElementById("textOnPic").onkeyup = function () {
  inputTextValue = document.getElementById("textOnPic").value;
  let breakingText = document.getElementById("breaking-official").value;
  make_base(inputTextValue, breakingText);
};

document.getElementById("add-breaking").onclick = function () {
  document.getElementById("breaking-official").value =
    document.getElementById("add-breaking").innerHTML;
};

document.getElementById("happy-bday").onclick = function () {
  document.getElementById("breaking-official").value = "🎉HAPPY BIRTHDAY🎂";
};

document.getElementById("pasteArea").onpaste = function (event) {
  let breakingText = document.getElementById("breaking-official").value;
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
      imgHeight = fontY - 34 - lineheight;
      if (breakingText) imgHeight -= 66;

      base_image = new Image();
      base_image.src = event.target.result;
      base_image.onload = function () {
        drawResizedImage(base_image, imgHeight, 1080, 30);
        ctx.drawImage(border_image, 0, 0);
      };
    };
    reader.readAsDataURL(blob);
  }
};

document.getElementById("copy-match-stats").onclick = function () {
  matchStatsToCanvas();
};

document.getElementById("copy-standings").onclick = function (event) {
  standingsToCanvas();
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

document.getElementById("download-image").onclick = function () {
  download();
};

export function buildTableForTableType(lines, imgToAdd, yPos = 100) {
  lines = lines.replaceAll(`width="30px">`, `width="30px" />`);
  ctx.drawImage(border_image, 0, 0);
  console.log(lines);
  let data = `<svg xmlns='http://www.w3.org/2000/svg' width='900'>
    <foreignObject width='100%' height='100%'>
    <div xmlns='http://www.w3.org/1999/xhtml' style='font-family:Source Sans Pro; font-size:24px; background-color: #A8DADC;'>
    ${lines}
    </div></foreignObject></svg>`;

  let img = new Image();
  img.onload = function () {
    ctx.drawImage(img, (1080 - img.width) / 2, yPos);
    for (let i = 0; i < imgToAdd.length; i++) {
      /*ctx.drawImage(
        imgToAdd[i].img,
        imgToAdd[i].startX,
        imgToAdd[i].startY,
        imgToAdd[i].imgHeight,
        imgToAdd[i].imgHeight
      );*/
      drawCentre(
        imgToAdd[i].img,
        imgToAdd[i].startX,
        imgToAdd[i].startY,
        imgToAdd[i].imgHeight
      );
    }
  };

  img.src = buildSvgImageUrl(data);
}

export function drawResizedImage(image, imgHeight, startX, startY) {
  if (image.height > image.width) {
    newHeight = imgHeight;
    newWidth = imgHeight / (image.height / image.width);
  } else {
    newHeight = imgHeight;
    newWidth = imgHeight * (image.width / image.height);
  }
  ctx.drawImage(image, (startX - newWidth) / 2, startY, newWidth, newHeight);
}

function drawCentre(img, x, y, height) {
  ctx.drawImage(img, x - height / 2, y, height, height);
}

function buildSvgImageUrl(svg) {
  let b64 = window.btoa(unescape(encodeURIComponent(svg)));
  return "data:image/svg+xml;base64," + b64;
}

export function loadClubLogo(clubToLoad) {
  var img = new Image();
  img.crossOrigin = "anonymous";
  img.src = imagePath(clubToLoad);
  if (!imgs.clubs) imgs.clubs = [];
  imgs.clubs[clubToLoad] = img;
}

export function loadPlayerFace(playerToLoad) {
  var img = new Image();
  img.crossOrigin = "anonymous";
  img.src = `images/player-pictures/${playerToLoad}.png`;
  if (!imgs.players) imgs.players = [];
  imgs.players[playerToLoad] = img;
}

export function loadCompLogo(compToLoad) {
  var img = new Image();
  img.crossOrigin = "anonymous";
  img.src = `images/competitions/${compToLoad}.png`;
  if (!imgs.leagues) imgs.leagues = [];
  imgs.leagues[compToLoad] = img;
}

export function writeStrokedText({
  text,
  fontSize = 46,
  textAlign = "center",
  strokeStyle = "black",
  fillStyle = "#1d3557",
  lineWidth = 1,
  x = 540,
  y,
} = {}) {
  ctx.font = `bold ${fontSize}px ${font}`; //title
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.fillStyle = fillStyle;
  ctx.textAlign = textAlign;
  for (let i = 0; i < text.length; i++) {
    ctx.strokeText(text[i], x, y + i * lineheight);
    ctx.fillText(text[i], x, y + i * lineheight);
  }
}

export function leagueBannerBig(yPos) {
  let leagueName = document.getElementById("league-name").innerHTML;
  let leagueID = document.getElementById("league-id").innerHTML;
  let round = document.getElementById("round-no").innerHTML;
  writeStrokedText({
    text: [leagueName],
    fontSize: 60,
    textAlign: "right",
    strokeStyle: "#1d3557",
    fillStyle: "#e63946",
    lineWidth: 2,
    x: 990,
    y: yPos - 80,
  });
  writeStrokedText({
    text: [round.replace(`Regular Season -`, "Round")],
    fontSize: 60,
    textAlign: "right",
    x: 990,
    y: yPos - 20,
  });

  ctx.drawImage(imgs.leagues[leagueID], 90, yPos - 160, 150, 150);
}

async function showMatchesOnDate(date) {
  let matches = [];
  for (let i = 0; i < allLeagues.length; i++) {
    let response = await fetch(`data/leagues/${allLeagues[i].id}.json`);
    let league = await response.json();
    for (let j = 0; j < league.length; j++) {
      fixtureDate = new Date(league[j].fixture.date);
      if (fixtureDate.toDateString() == date.toDateString()) {
        matches.push(league[j]);
      }
    }
  }
  if (matches.length > 0) matchList(matches, true);
}
