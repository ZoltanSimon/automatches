import { getTopTeams } from "../../common-functions.js";

await getTopTeams([39, 140, 135, 78, 61, 88, 94], 100, true);

document.querySelector(".more-button").addEventListener("click", function () {
  const container = document.getElementById("statSelectorContainer");
  const button = this;

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