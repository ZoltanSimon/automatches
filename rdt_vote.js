import { posreg } from "./allcombos.js";

let selected = {
  region: "",
  position: "",
  players: [],
};
const min = 0;
const max = 3;

// using Array map and Math.random
let allCombos = posreg.sort(() => 0.5 - Math.random());

document.getElementById("submit").onclick = function () {
  if (selected.players.length > min) {
    next();
  } else {
    alert("Please select at least 1 player");
  }
};

function next() {
  if (document.getElementsByClassName("entry-header")[0])
    document.getElementsByClassName("entry-header")[0].remove();
  let email = document.getElementById("email").value;
  let newsletter = document.getElementById("newsletter").checked;
  let newsValue = newsletter ? 1 : 0;
  if (selected.players.length > 0) {
    let stringToSend = `region=${selected.region}&position=${
      selected.position
    }&players=${selected.players.join(
      ","
    )}&email=${email}&newsletter=${newsValue}`;
    sendData(stringToSend);
  }
  if (allCombos.length > 0) {
    let currentPosReg = allCombos[allCombos.length - 1];
    document.getElementById("header-title").innerHTML = `${
      currentPosReg.position
    } - ${currentPosReg.region} - ${49 - allCombos.length}/ 48`;
    document.getElementById("mainVote").innerHTML = currentPosReg.table;
    allCombos.splice(-1);
    selected = {
      region: currentPosReg.region,
      position: currentPosReg.position,
      players: [],
    };
    addRowHandlers();
  } else {
    document.getElementById("submit").remove();
    document.getElementById("header-title").innerHTML = "Thank you!";
    document.getElementById("mainVote").innerHTML =
      "You have finished voting. Continue browsing our website and consider subscribing to our newsletter.";
    document.getElementById("info").innerHTML = "";
  }
}

function addRowHandlers() {
  let table = document
    .getElementById("mainVote")
    .getElementsByTagName("table")[0];
  let rows = table.getElementsByTagName("tr");
  for (let i = 0; i < rows.length; i++) {
    var currentRow = table.rows[i];
    var createClickHandler = function (row) {
      return function () {
        let cell = row.getElementsByTagName("td")[0];
        let id = cell.innerHTML;

        if (!selected.players.includes(id)) {
          if (selected.players.length < max) {
            row.style.backgroundColor = "#A8DADC";
            selected.players.push(id);
          } else {
          }
        } else {
          row.style.backgroundColor = "white";
          selected.players = selected.players.filter((e) => e !== id);
        }
      };
    };

    currentRow.onclick = createClickHandler(currentRow);
  }
}

async function sendData(params) {
  await fetch(`https://generationfootball.net/saveplayers.php?${params}`);
}
window.onload = next();
