const board = document.getElementById("starting-eleven-board");
const pitch = document.getElementById("s11-pitch");
const playersLayer = document.getElementById("s11-players");
const teamNameEl = document.getElementById("s11-team-name");
const watermarkEl = document.getElementById("s11-watermark");
const controls = document.getElementById("s11-controls");

const PLAYER_COUNT = 11;

// Pitch coordinates are percentages of the pitch box, so positions survive resizing.
const horizontalPos = [];
for (let i = 0; i < 9; i++) {
  let name = "C";
  if (i < 2) name = "L";
  else if (i > 6) name = "R";
  horizontalPos.push({ pos: (i + 1) * 10, name });
}

const verticalNames = ["F", "W", "W", "M", "WB", "WB", "B"];
let verticalPos = verticalNames.map((name, i) => ({
  pos: (((840 - 35) / 8) * (i + 1) / 840) * 100,
  name,
}));
verticalPos.push({ pos: (804 / 840) * 100, name: "GK" });
verticalPos = verticalPos.reverse();

let positions = [];
let drag = null;
let fontEmbedCSS = null;

buildPlayerInputs();
const playerEls = buildPlayerElements();
applyFormation();

controls.addEventListener("input", (event) => {
  if (event.target.id === "formation-selector") {
    applyFormation();
  } else {
    render();
  }
});

document.getElementById("resetButton").addEventListener("click", applyFormation);
document.getElementById("downloadButton").addEventListener("click", downloadBoard);

function buildPlayerInputs() {
  const container = document.getElementById("player-inputs");
  for (let i = 1; i <= PLAYER_COUNT; i++) {
    const row = document.createElement("div");
    row.className = "s11-player-row";
    row.innerHTML = `
      <input type="text" id="playerpos${i}" class="s11-input" aria-label="Player ${i} position" />
      <input type="number" id="playerno${i}" value="${i}" class="s11-input" aria-label="Player ${i} number" />
      <input type="text" id="player${i}" value="Player${i}" class="s11-input" aria-label="Player ${i} name" />
    `;
    container.appendChild(row);
  }
}

function buildPlayerElements() {
  const els = [];
  for (let i = 0; i < PLAYER_COUNT; i++) {
    const el = document.createElement("div");
    el.className = "s11-player";
    el.dataset.index = i;
    el.innerHTML = `
      <div class="s11-shape-wrap"><div class="s11-shape"></div></div>
      <span class="s11-kit-text"></span>
      <span class="s11-name"></span>
    `;
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    playersLayer.appendChild(el);
    els.push(el);
  }
  return els;
}

// Places every player on its formation slot and fills in the position labels.
function applyFormation() {
  const currentFormation = document
    .getElementById("formation-selector")
    .value.split("-")
    .map(Number);

  positions = [];
  let number = 1;

  for (let i = 0; i < currentFormation.length; i++) {
    const slots = getNumberOfPlayers(currentFormation[i]);
    for (let j = slots.length - 1; j >= 0; j--) {
      const horizontal = horizontalPos[slots[j]];
      let label;
      if (i == 0) {
        label = verticalPos[i].name;
      } else if ([2, 3].includes(i) && [2, 3, 4, 5, 6].includes(slots[j])) {
        label = horizontal.name + "DM";
      } else if ([5, 6].includes(i) && [2, 3, 4, 5, 6].includes(slots[j])) {
        label = horizontal.name + "AM";
      } else {
        label = horizontal.name + verticalPos[i].name;
      }

      document.getElementById("playerpos" + number).value = label;
      positions.push({ x: horizontal.pos, y: verticalPos[i].pos });
      number++;
    }
  }

  render();
}

function render() {
  const pattern = radioValue("pattern-selector");
  const bottomText = radioValue("bottom-text");

  board.dataset.shape = radioValue("shape-selector");
  board.dataset.pattern = pattern;
  board.dataset.bottomText = bottomText;
  board.dataset.shadow = radioValue("shadow-switch");
  board.style.setProperty("--kit-1", document.getElementById("kit-color-selector").value);
  board.style.setProperty("--kit-2", document.getElementById("kit-color-selector2").value);
  board.style.setProperty("--kit-text", document.getElementById("number-color-selector").value);

  document.getElementById("secondary-kit-color").hidden = pattern.indexOf("stripes") == -1;

  pitch.classList.toggle("solid", radioValue("pitch-selector") == "solid");
  watermarkEl.hidden = radioValue("watermark") != "show-watermark";

  teamNameEl.hidden = !document.getElementById("show-team-name").checked;
  teamNameEl.textContent = document.getElementById("team-name").value;

  playerEls.forEach((el, i) => {
    const n = i + 1;
    let kitText = "";
    if (bottomText == "show-number") kitText = document.getElementById("playerno" + n).value;
    else if (bottomText == "show-position") kitText = document.getElementById("playerpos" + n).value;

    el.querySelector(".s11-kit-text").textContent = kitText;
    el.querySelector(".s11-name").textContent = document.getElementById("player" + n).value;
    placePlayer(i);
  });
}

function radioValue(name) {
  return document.querySelector(`input[name="${name}"]:checked`).value;
}

function placePlayer(index) {
  const el = playerEls[index];
  el.style.left = positions[index].x + "%";
  el.style.top = positions[index].y + "%";
}

function onPointerDown(event) {
  if (event.button !== 0) return;
  const el = event.currentTarget;
  const index = Number(el.dataset.index);
  const rect = pitch.getBoundingClientRect();
  const anchorX = rect.left + (positions[index].x / 100) * rect.width;
  const anchorY = rect.top + (positions[index].y / 100) * rect.height;

  // The anchor may only go as far as keeps the whole player (kit + name) on the board.
  const boardRect = board.getBoundingClientRect();
  const kitRect = el.getBoundingClientRect();
  const nameRect = el.querySelector(".s11-name").getBoundingClientRect();
  const bounds = {
    minX: boardRect.left + anchorX - Math.min(kitRect.left, nameRect.left),
    maxX: boardRect.right - (Math.max(kitRect.right, nameRect.right) - anchorX),
    minY: boardRect.top + anchorY - Math.min(kitRect.top, nameRect.top),
    maxY: boardRect.bottom - (Math.max(kitRect.bottom, nameRect.bottom) - anchorY),
  };

  // Keep the grab offset so the player doesn't jump to the cursor.
  drag = {
    el,
    index,
    rect,
    bounds,
    offsetX: event.clientX - anchorX,
    offsetY: event.clientY - anchorY,
  };

  el.setPointerCapture(event.pointerId);
  el.classList.add("dragging");
  event.preventDefault();
}

function onPointerMove(event) {
  if (!drag || drag.el !== event.currentTarget) return;
  const { rect, bounds, index } = drag;
  const x = clamp(event.clientX - drag.offsetX, bounds.minX, bounds.maxX);
  const y = clamp(event.clientY - drag.offsetY, bounds.minY, bounds.maxY);
  positions[index] = {
    x: ((x - rect.left) / rect.width) * 100,
    y: ((y - rect.top) / rect.height) * 100,
  };
  placePlayer(index);
}

function onPointerUp(event) {
  if (!drag || drag.el !== event.currentTarget) return;
  drag.el.classList.remove("dragging");
  if (drag.el.hasPointerCapture(event.pointerId)) {
    drag.el.releasePointerCapture(event.pointerId);
  }
  drag = null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

async function downloadBoard() {
  try {
    // Inlining the web font is slow, so only do it on the first export.
    fontEmbedCSS ??= await getFontEmbedCSS();
    const dataUrl = await window.htmlToImage.toPng(board, {
      pixelRatio: 1400 / board.offsetWidth,
      fontEmbedCSS,
    });
    const link = document.createElement("a");
    link.download = "genfoot.png";
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error("Error exporting starting 11 image", error);
  }
}

// html-to-image can't read the cross-origin Google Fonts stylesheet, so fetch it
// ourselves and inline the upright Source Sans 3 files as data URLs.
async function getFontEmbedCSS() {
  const link = document.querySelector('link[href*="fonts.googleapis.com/css"]');
  if (!link) return "";

  const css = await (await fetch(link.href)).text();
  const faces = (css.match(/@font-face\s*{[^}]*}/g) || []).filter((face) =>
    /font-style:\s*normal/.test(face)
  );

  const inlined = await Promise.all(
    faces.map(async (face) => {
      const url = face.match(/url\(([^)]+)\)/)?.[1];
      if (!url) return face;
      const blob = await (await fetch(url)).blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      return face.replace(url, dataUrl);
    })
  );
  return inlined.join("\n");
}

function getNumberOfPlayers(numPlayers) {
  switch (numPlayers) {
    case 1:
      return [4];
    case 2:
      return [2, 6];
    case 3:
      return [2, 4, 6];
    case 4:
      return [1, 3, 5, 7];
    case 5:
      return [0, 2, 4, 6, 8];
    case 20:
      return [1, 7];
    case 30:
      return [1, 4, 7];
    case 40:
      return [0, 3, 5, 8];
    case 200:
      return [0, 8];
    case 300:
      return [0, 4, 8];
    default:
      return [];
  }
}
