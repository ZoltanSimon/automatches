import { download } from "../common-functions.js";

let c = document.getElementById("starting-eleven-builder");
let ctx = c.getContext("2d");
var BB = c.getBoundingClientRect();

document.getElementById("downloadButton").addEventListener("click", () => {
  download("starting-eleven-builder");
});

const font = "sans-serif";
const ratio = 0.8;
const kitSize = 80 * ratio;
const marg = 20;
const xMarg = 22;
const pitchWidth = 820 * ratio;
const pitchHeight = 1050 * ratio;
const pCentreX = xMarg + pitchWidth / 2;
const pCentreY = marg + pitchHeight / 2;
const goalWidth = 64;
const goalHeight = 18;

let number = 1;
let players = [];

const ids = [
  'formation-selector',
  'kit-color-selector',
  'number-color-selector',
  'show-team-name',
  'team-name',
  'pattern-selector',
  'kit-color-selector2',
  'bottom-text',
  'pitch-selector',
  'watermark',
  'shape-selector',
  'shadow-switch',
];

for (let i = 1; i <= 11; i++) {
  ids.push(`playerpos${i}`);
  ids.push(`playerno${i}`);
  ids.push(`player${i}`);
}

ids.forEach(id => {
  const select = document.getElementById(id);

  if (select) {
    select.addEventListener('change', val);
  }
});



class Shape {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  drawFilled(color) {
    ctx.beginPath();
    this.draw();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.stroke();
  }

  writeText(text, color, x, y, size, bold, shadow) {
    let boldText = bold ? "bold" : "";
    ctx.font = `${boldText} ${size}px ${font}`;
    ctx.textAlign = "center";
    ctx.fillStyle = color;
    ctx.strokeStyle = "black";
    ctx.lineWidth = 0.3;
    shadow == "show-shadow"
      ? (ctx.shadowColor = "black")
      : (ctx.shadowColor = "rgba(0,0,0,0)");

    ctx.fillText(text, marg + x, y + 4);
    //ctx.strokeText(text, marg + x, y + 4);
  }
}

class Player {
  constructor(name, number, position, x, y) {
    this.name = name;
    this.number = number;
    this.position = position;
    this.x = x;
    this.y = y;
    this.isDragging = false;
  }

  drawPlayer(kitDesign) {
    let kit;
    ctx.shadowColor = "black";
    switch (kitDesign.shape) {
      case "kit":
        kit = new Kit(this.x, this.y);
        kit.draw(kitDesign.color1, kitDesign.color2, kitDesign.pattern);
        break;
      case "rectangle":
        kit = new Rectangle(
          this.x - kitSize / 2,
          this.y - kitSize / 2 - 10,
          kitSize,
          kitSize
        );
        kit.drawFilled(kitDesign.color1);
        break;
      default:
        kit = new Circle(this.x, this.y - 10, kitSize / 2, Math.PI * 2, 0);
        kit.drawFilled(kitDesign.color1);
    }

    if (kitDesign.bottomText != "show-off")
      kit.writeText(
        kitDesign.bottomText == "show-number" ? this.number : this.position,
        kitDesign.numberColor,
        this.x - kitSize / 3 + 1,
        this.y + 6,
        kitDesign.bottomText == "show-number" ? 25 : 22,
        true,
        kitDesign.showShadow
      );
    kit.writeText(
      this.name,
      "white",
      this.x - kitSize / 3 + 1,
      this.y + kitSize * 0.75,
      19,
      true
    );
  }
}

class Kit extends Shape {
  constructor(x, y) {
    super(x, y);
  }
  draw(color1, color2, pattern) {
    let x = this.x - kitSize / 4;
    let y = this.y + kitSize / 2;

    ctx.lineWidth = 1;
    ctx.strokeStyle = "black";

    ctx.beginPath();

    ctx.moveTo(x, y);
    ctx.lineTo(x + kitSize / 2 + 2, y); //bottom line
    ctx.lineTo(x + kitSize / 2, y - kitSize / 2 - 14); //right side
    ctx.lineTo(x + kitSize / 2 + 5, y - kitSize / 2); //right sleeve bottom
    ctx.lineTo(x + kitSize / 2 + 20, y - kitSize / 2 - 6); //right sleeve vertical
    ctx.lineTo(x + kitSize / 2 + 5, y - kitSize / 2 - 32); //right sleeve top
    ctx.lineTo(x + kitSize / 2 - 5, y - kitSize - 5); //right top curve
    ctx.lineTo(x + 7, y - kitSize - 5); //center top curve
    ctx.lineTo(x - 5, y - kitSize / 2 - 32); //left top curve
    ctx.lineTo(x - 20, y - kitSize / 2 - 6); //left sleeve top
    ctx.lineTo(x - 5, y - kitSize / 2); //left sleeve vertical
    ctx.lineTo(x, y - kitSize / 2 - 14); //left sleeve bottom*/
    ctx.lineTo(x - 2, y); //left side

    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = color1;
    ctx.fill();

    if (pattern.indexOf("vertical") > -1) {
      this.verticalPattern(x, y, color2);
    }

    if (pattern.indexOf("horizontal") > -1) {
      this.horizontalPattern(x, y, color2);
    }
  }

  verticalPattern(x, y, color) {
    let centreRectangle1 = new Rectangle(x, y - kitSize + 10, 6, kitSize - 11);
    let centreRectangle2 = new Rectangle(
      x + 13,
      y - kitSize + 4,
      6,
      kitSize - 5
    );
    let centreRectangle3 = new Rectangle(
      x + 26,
      y - kitSize + 10,
      6,
      kitSize - 11
    );
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5;
    ctx.shadowColor = "rgba(0,0,0,0)";
    centreRectangle1.drawFilled(color);
    centreRectangle2.drawFilled(color);
    centreRectangle3.drawFilled(color);
  }

  horizontalPattern(x, y, color) {
    let centreRectangle1 = new Rectangle(x + 1, y - kitSize, kitSize / 2, 7);
    let centreRectangle2 = new Rectangle(
      x + 1,
      y - kitSize + 18,
      kitSize / 2,
      7
    );
    let centreRectangle3 = new Rectangle(
      x,
      y - kitSize + 36,
      kitSize / 2 + 1,
      7
    );
    let centreRectangle4 = new Rectangle(
      x - 1,
      y - kitSize + 54,
      kitSize / 2 + 2,
      7
    );
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5;
    ctx.shadowColor = "rgba(0,0,0,0)";
    centreRectangle1.drawFilled(color);
    centreRectangle2.drawFilled(color);
    centreRectangle3.drawFilled(color);
    centreRectangle4.drawFilled(color);
  }
}

class Circle extends Shape {
  constructor(x, y, radius, startAngle, endAngle) {
    super(x, y);
    this.radius = radius;
    this.startAngle = startAngle;
    this.endAngle = endAngle;
  }
  draw() {
    ctx.beginPath();
    ctx.moveTo(this.x + this.radius, this.y);
    ctx.arc(this.x, this.y, this.radius, this.startAngle, this.endAngle);
    ctx.stroke();
    ctx.closePath();
  }
}

class Rectangle extends Shape {
  constructor(x, y, width, height) {
    super(x, y);
    this.height = height;
    this.width = width;
  }
  draw() {
    ctx.beginPath();
    ctx.rect(this.x, this.y, this.width, this.height);
    ctx.stroke();
    ctx.closePath();
  }
}

class pitch extends Rectangle {
  constructor(x, y) {
    super(x, y);
    this.width = pitchWidth;
    this.height = pitchHeight;
  }

  drawBigPitch(patern, watermark) {
    ctx.clearRect(0, 0, c.width, c.height); //clear canvas
    let penAreaBottom = new penArea(marg + pitchHeight - penArea.height);
    let penAreaTop = new penArea(marg);
    let gkAreaBottom = new gkArea(marg + pitchHeight - gkArea.height);
    let gkAreaTop = new gkArea(marg);
    let goalAreaTop = new Rectangle(
      xMarg + (pitchWidth - goalWidth) / 2,
      2,
      goalWidth,
      goalHeight
    );
    let bigCircle = new Circle(pCentreX, pCentreY, 128 * ratio, 0, 2 * Math.PI);
    let smallCircle = new Circle(pCentreX, pCentreY, 3, 0, 2 * Math.PI);
    let penPointTop = new Circle(
      pCentreX,
      marg + 110 * ratio,
      3,
      0,
      2 * Math.PI
    );
    let penPointBottom = new Circle(
      pCentreX,
      marg + pitchHeight - 110,
      3,
      0,
      2 * Math.PI
    );

    ctx.fillStyle = "#457B9D";
    ctx.fillRect(0, 0, c.width, c.height);

    if (watermark == "show-watermark") {
      //Add watermark
      ctx.font = `bold 13px ${font}`;
      ctx.textAlign = "center";
      ctx.fillStyle = "white";
      ctx.fillText(
        "https://generationfootball.net",
        pitchWidth - xMarg * 3 - 10,
        pitchHeight + 35
      );
    }

    ctx.lineWidth = 2;
    ctx.strokeStyle = "#C0C0C0";
    ctx.shadowColor = "rgba(0,0,0,0)";
    this.drawFilled(patern);

    gkAreaBottom.draw();
    gkAreaTop.draw();
    penAreaBottom.draw();
    penAreaTop.draw();
    goalAreaTop.draw();
    bigCircle.draw();
    smallCircle.drawFilled("white");
    penPointTop.drawFilled("white");
    penPointBottom.drawFilled("white");

    ctx.beginPath();
    ctx.moveTo(xMarg, pCentreY);
    ctx.lineTo(pitchWidth + xMarg, pCentreY); //half way line

    ctx.moveTo(pCentreX, marg + penArea.height);
    ctx.arc(pCentreX, marg + 110, 128, 0.87 * Math.PI, 0.13 * Math.PI, true); // D top

    ctx.moveTo(pCentreX, marg + pitchHeight - penArea.height);
    ctx.arc(
      pCentreX,
      marg + pitchHeight - 110,
      128,
      -0.87 * Math.PI,
      -0.13 * Math.PI
    ); // D bottom

    ctx.moveTo(xMarg, marg);
    ctx.arc(xMarg, marg, 10, Math.PI / 2, 0, true); //corner top left

    ctx.moveTo(xMarg + pitchWidth, marg);
    ctx.arc(xMarg + pitchWidth, marg, 10, Math.PI, Math.PI / 2, true); //corner top right

    ctx.moveTo(xMarg, marg + pitchHeight);
    ctx.arc(xMarg, marg + pitchHeight, 10, 1.5 * Math.PI, 0); //corner bottom left

    ctx.moveTo(xMarg + pitchWidth, marg + pitchHeight);
    ctx.arc(
      xMarg + pitchWidth,
      marg + pitchHeight,
      10,
      1.5 * Math.PI,
      Math.PI,
      true
    ); //corner bottom right

    ctx.stroke();
    ctx.closePath();
    ctx.shadowColor = "black";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
  }
}

class penArea extends Rectangle {
  static width = 400;
  static height = 160;

  constructor(y) {
    super(y);
    this.y = y;
    this.x = xMarg + (pitchWidth - penArea.width) / 2;
    this.width = penArea.width;
    this.height = penArea.height;
  }
}

class gkArea extends Rectangle {
  static width = 180;
  static height = 80;

  constructor(y) {
    super(y);
    this.y = y;
    this.x = xMarg + (pitchWidth - gkArea.width) / 2;
    this.width = gkArea.width;
    this.height = gkArea.height;
  }
}

const horizontalPos = [];
for (let i = 0; i < 9; i++) {
  let item = {};
  item.pos = xMarg + (pitchWidth / 10) * (i + 1);
  switch (i) {
    case 0:
    case 1:
      item.name = "L";
      break;
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
      item.name = "C";
      break;
    default:
      item.name = "R";
      break;
  }
  horizontalPos.push(item);
}

let verticalPos = [];
for (let i = 0; i < 7; i++) {
  let item = {};
  item.pos = marg + ((pitchHeight - 35) / 8) * (i + 1);
  switch (i) {
    case 0:
      item.name = "F";
      break;
    case 1:
    case 2:
      item.name = "W";
      break;
    case 3:
      item.name = "M";
      break;
    case 4:
    case 5:
      item.name = "WB";
      break;
    default:
      item.name = "B";
      break;
  }
  verticalPos.push(item);
}
verticalPos.push({ pos: pitchHeight - 16, name: "GK" });
verticalPos = verticalPos.reverse();

val();

function val() {
  let currentFormation = document
    .getElementById("formation-selector")
    .value.split("-")
    .map(Number);
  let kitDesign = {
    shape: document.getElementById("shape-selector").value,
    pattern: document.getElementById("pattern-selector").value,
    color1: document.getElementById("kit-color-selector").value,
    color2: document.getElementById("kit-color-selector2").value,
    numberColor: document.getElementById("number-color-selector").value,
    bottomText: document.getElementById("bottom-text").value,
    showShadow: document.querySelector('input[name="shadow-switch"]:checked')
      .value,
  };

  if (kitDesign.pattern.indexOf("stripes") > -1) {
    document.getElementById("secondary-kit-color").style.display = "flex";
  } else {
    document.getElementById("secondary-kit-color").style.display = "none";
  }

  let watermark = document.getElementById("watermark").value;
  let showTeamName = document.querySelector("#show-team-name").checked;
  let teamName = document.getElementById("team-name").value;

  let pitchPatt = document.getElementById("pitch-selector").value;
  let pitchColor1 = "#00680a";
  let pitchColor2 = "#007b0c";
  let pitchPatern = horizontalPattern(25, pitchColor1, pitchColor2);
  let pitchFill = pitchPatt == "pattern" ? pitchPatern : pitchColor1;

  let bigPitch = new pitch(xMarg, marg);
  bigPitch.drawBigPitch(pitchFill, watermark);

  number = 1;

  for (let i = 0; i < currentFormation.length; i++) {
    let segedTomb = getNumberOfPlayers(currentFormation[i]);
    for (let j = segedTomb.length - 1; j >= 0; j--) {
      if (i == 0) {
        document.getElementById("playerpos" + number).value =
          verticalPos[i].name;
      } else if ([2, 3].includes(i) && [2, 3, 4, 5, 6].includes(segedTomb[j])) {
        document.getElementById("playerpos" + number).value =
          horizontalPos[segedTomb[j]].name + "DM";
      } else if ([5, 6].includes(i) && [2, 3, 4, 5, 6].includes(segedTomb[j])) {
        document.getElementById("playerpos" + number).value =
          horizontalPos[segedTomb[j]].name + "AM";
      } else {
        document.getElementById("playerpos" + number).value =
          horizontalPos[segedTomb[j]].name + verticalPos[i].name;
      }

      let player = new Player(
        document.getElementById("player" + number).value,
        document.getElementById("playerno" + number).value,
        document.getElementById("playerpos" + number).value,
        horizontalPos[segedTomb[j]].pos,
        verticalPos[i].pos
      );
      player.drawPlayer(kitDesign);
      players.push(player);
      number++;
    }
  }
  console.log(players);
  if (showTeamName) {
    addTeamName(teamName);
  }
}

function addTeamName(teamName) {
  ctx.font = `bold 40px ${font}`;
  ctx.textAlign = "left";
  ctx.fillStyle = "white";
  ctx.strokeStyle = "#5A5A5A";
  ctx.lineWidth = 1;
  ctx.fillText(teamName, xMarg + 15, 65);
}

function horizontalPattern(patHeight, color1, color2) {
  let canvasPattern = document.createElement("canvas");
  canvasPattern.width = 1;
  canvasPattern.height = patHeight * 2;
  let contextPattern = canvasPattern.getContext("2d");

  contextPattern.beginPath();
  contextPattern.fillStyle = color1;
  contextPattern.fillRect(0, 0, 1, patHeight);
  contextPattern.fillStyle = color2;
  contextPattern.fillRect(0, patHeight, 1, patHeight);
  contextPattern.stroke();
  return contextPattern.createPattern(canvasPattern, "repeat");
}

function getNumberOfPlayers(numPlayers) {
  let playAr = [];
  switch (numPlayers) {
    case 1:
      playAr = [4];
      break;
    case 2:
      playAr = [2, 6];
      break;
    case 3:
      playAr = [2, 4, 6];
      break;
    case 4:
      playAr = [1, 3, 5, 7];
      break;
    case 5:
      playAr = [0, 2, 4, 6, 8];
      break;
    case 20:
      playAr = [1, 7];
      break;
    case 30:
      playAr = [1, 4, 7];
      break;
    case 40:
      playAr = [0, 3, 5, 8];
      break;
    case 200:
      playAr = [0, 8];
      break;
    case 300:
      playAr = [0, 4, 8];
      break;
    default:
      playAr = [];
  }
  return playAr;
}

var acc = document.getElementsByClassName("accordion");
for (let i = 0; i < acc.length; i++) {
  acc[i].addEventListener("click", function () {
    this.classList.toggle("active");
    var panel = this.nextElementSibling;
    if (panel.style.maxHeight) {
      panel.style.maxHeight = null;
    } else {
      panel.style.maxHeight = panel.scrollHeight + "px";
    }
  });
}

