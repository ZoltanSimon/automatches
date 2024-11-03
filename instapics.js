import { imagePath } from "./common-functions.js";
import { darkColor, redColor } from "./common-styles.js";

let c = document.getElementById("myCanvas");
export let ctx = c?.getContext("2d");
const font = "Source Sans Pro";
const fontSize = 46;
const backgroundImageName = "images/insta_new_no_pic.png";
const borderImage = "images/border.png";
const lineheight = 50;
let newWidth, newHeight, base_image, fontY;
export let imgs = {};

//Preload images
let border_image = new Image();
border_image.src = borderImage;

if (c) make_base("", "");

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
        strokeStyle: darkColor,
        fillStyle: redColor,
        lineWidth: 4,
        y: fontY - 56,
      });
    }
    writeStrokedText({ text: lines, fontSize: fontSize, y: fontY });
  };
}

export function buildTableForTableType(
  lines,
  imgToAdd,
  yPos = 100,
  allForms = []
) {
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
      drawCentre(
        imgToAdd[i].img,
        imgToAdd[i].startX,
        imgToAdd[i].startY,
        imgToAdd[i].imgHeight
      );
    }
    drawFormBars(allForms);
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
  fillStyle = darkColor,
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
    strokeStyle: darkColor,
    fillStyle: redColor,
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

function drawFormBars(formArrays) {
  const barWidth = 18;
  const barHeight = 37;
  const spacing = 3;

  for (let i = 0; i < formArrays.length; i++) {
    let formArray = formArrays[i];
    formArray.forEach((result, index) => {
      let color;
      if (result === "W") color = "green";
      else if (result === "D") color = darkColor;
      else if (result === "L") color = redColor;

      ctx.fillStyle = color;
      const x = 823 + index * (barWidth + spacing);
      ctx.fillRect(x, 130 + i * (barHeight + 5), barWidth, barHeight);
    });
  }
}
