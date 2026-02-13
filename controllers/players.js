import { playerGoalList } from "../components/player-list.js";
import { addLeagues } from "../common-functions.js";

await playerGoalList(true);

const response = await fetch(`/get-all-leagues`);
let allLeagues = await response.json();
allLeagues = allLeagues.filter((league) => league.type === "league");
addLeagues(allLeagues);

document.querySelector(".more-button").addEventListener("click", function () {
  console.log("More button clicked");
  const container = document.getElementById("statSelectorContainer");
  const button = this;
  container.style.display = "block";
  
  if (container.style.maxHeight) {
    container.style.maxHeight = null;
    container.classList.remove("open");
    button.classList.remove("active");
  } else {
    container.style.maxHeight = container.scrollHeight + "px";
    container.classList.add("open");
    button.classList.add("active");
  }
});
