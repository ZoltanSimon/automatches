let c = document.getElementById("myCanvas");
let ctx = c.getContext("2d");
const font = "Source Sans Pro";
const fontSize = "46px";
const backgroundImageName = "insta_new_no_pic.png";
const borderImage = "border.png";
const sirens = "officialbreakingetc.png";
const lineheight = 50;
let inputTextValue,
  newWidth,
  newHeight,
  base_image,
  imgHeight,
  radioValue,
  fontHeight,
  red_image;
let imgs = {};

let border_image = new Image();
border_image.src = borderImage;
make_base("test");

function make_base(text) {
  base_image = new Image();
  base_image.src = backgroundImageName;
  base_image.onload = function () {
    ctx.drawImage(base_image, 0, 0);

    ctx.font = `bold 76px ${font}`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#e63946";
    radioValue = document
      .querySelector('input[name="bigred"]:checked')
      .value.toUpperCase();

    if (!["NONE", "ELEVEN", "ALLTEXT", "HALF", "TABLE"].includes(radioValue)) {
      ctx.fillText(radioValue, 540, 860);
      red_image = new Image();
      red_image.src = sirens;
      red_image.onload = function () {
        ctx.drawImage(red_image, 294, 810);
      };
    }

    ctx.font = `bold ${fontSize} ${font}`;
    ctx.fillStyle = "#1d3557";

    if (radioValue == "ALLTEXT") {
      fontHeight = 200;
    } else if (radioValue == "HALF") {
      fontHeight = 720;
    } else {
      fontHeight = 920;
    }

    if (radioValue == "TABLE") {
      buildTableForTableType(text);
    } else {
      let lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], 540, fontHeight + i * lineheight);
      }
    }
  };
}

function keyPressed() {
  inputTextValue = document.getElementById("textOnPic").value;
  make_base(inputTextValue);
}

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
}

function copystats() {
  const node = document.getElementById("match-stats").lastChild;
  const clone = node.cloneNode(true);

  document.getElementById("textOnPic").value(clone);
}

function copyStandings() {
  let imgToAdd = [];
  let thisTr, thisTd, thisClub;
  let standingsTable = document.getElementById("league-standings");

  for (let i = 0; i < standingsTable.rows.length; i++) {
    thisTr = standingsTable.rows[i];
    for (let j = 0; j < thisTr.children.length; j++) {
      thisTd = thisTr.children[j];
      for (let k = 0; k < clubs.length; k++) {
        thisClub = clubs[k];
        if (thisTd.innerHTML.indexOf(`*${thisClub}*`) > -1) {
          imgToAdd.push(imgs[thisClub]);
          thisTd.innerHTML = " ";
        }
      }
    }
  }
  buildTableForTableType(removeNewlines(standingsTable.outerHTML), imgToAdd);
}

function pasteImage(event) {
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
      radioValue = document
        .querySelector('input[name="bigred"]:checked')
        .value.toUpperCase();

      switch (radioValue) {
        case "NONE":
          imgHeight = 735;
          break;
        case "ELEVEN":
          imgHeight = 920;
          break;
        case "HALF":
          imgHeight = 570;
          break;
        default:
          imgHeight = 680;
          break;
      }

      base_image = new Image();
      base_image.src = event.target.result;
      base_image.onload = function () {
        drawResizedImage(base_image, imgHeight, 1080, 90);
        ctx.drawImage(border_image, 0, 0);
      };
    };
    reader.readAsDataURL(blob);
  }
}

function addLogos() {
  inputTextValue = document.getElementById("textOnPic").value;
  let texty = inputTextValue.split("\n");
  console.log(imgs);
  for (let j = 0; j < texty.length; j++) {
    for (let i = 0; i < clubs.length; i++) {
      if (texty[j].indexOf(clubs[i]) > -1) {
        drawResizedImage(imgs[clubs[i]], 60, 100 + j * 50, 200 + j * 50);
      }
    }
  }
}

function buildTableForTableType(lines, imgToAdd, yPos = 100) {
  // let imgToAdd = [];
  lines = lines.replaceAll(`width="30px">`, `width="30px" />`);
  /*for (let i = 0; i < clubs.length; i++) {
    if (lines.indexOf(`*${clubs[i]}*`) > -1) {
      console.log(lines.indexOf(`*${clubs[i]}*`));
      imgToAdd.push(imgs[clubs[i]]);
      lines = lines.replace(`*${clubs[i]}*`, "");
    }
  }*/

  ctx.drawImage(border_image, 0, 0);

  let theTable = "<table" + lines.split("<table")[1];
  let theText = lines.split("<table")[0];
  var data = `<svg xmlns='http://www.w3.org/2000/svg' width='800'>
    <foreignObject width='100%' height='100%'>
    <div xmlns='http://www.w3.org/1999/xhtml' style='font-family:Source Sans Pro; font-size:24px; background-color: #A8DADC;'>
    ${theTable}
    </div></foreignObject></svg>`;

  var img = new Image();
  img.onload = function () {
    ctx.drawImage(img, (1080 - img.width) / 2, yPos);
    for (let i = 0; i < imgToAdd.length; i++) {
      drawResizedImage(imgToAdd[i], 40, 398, 144 + i * 42);
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
  b64 = window.btoa(unescape(encodeURIComponent(svg)));
  return "data:image/svg+xml;base64," + b64;
}

function preLoadLogos() {
  for (let i = 0; i < clubs.length; i++) {
    var img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imagePath(clubs[i]);
    imgs[clubs[i]] = img;
  }
  console.log(imgs);
}
