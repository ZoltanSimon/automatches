import { playerGoalList } from "../components/player-list.js";
import { addLeagues } from "../common-functions.js";

await playerGoalList(true);
addLeagues("pleague");

document.querySelector(".more-button").addEventListener("click", function () {
  const container = document.getElementById("stats-filter-side");
  const playersLayout = document.querySelector(".players-page-layout");
  const positionFilterSide = document.querySelector(".position-filter-side");
  const button = this;
  container.style.display = "block";
  
  if (container.classList.contains("open")) {
    container.classList.remove("open");
    playersLayout?.classList.remove("filters-open");
    positionFilterSide?.classList.remove("open");
    button.classList.remove("active");
  } else {
    container.classList.add("open");
    playersLayout?.classList.add("filters-open");
    positionFilterSide?.classList.add("open");
    button.classList.add("active");
  }
});

document.querySelectorAll('.rect-expand-league-list a').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.target.closest('.rect-header').querySelector('.rect-league-list').classList.toggle('visible');
    e.target.closest('.rect-expand-league-list').classList.toggle('active');
  });
});

document.querySelectorAll('.position-filter-btn[data-position]').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();

    const position = btn.dataset.position;
    const urlParams = new URLSearchParams(window.location.search);
    const selectedPositions = (urlParams.get('pposition') || '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    if (selectedPositions.includes(position)) {
      selectedPositions.splice(selectedPositions.indexOf(position), 1);
    } else {
      selectedPositions.push(position);
    }

    const uniquePositions = [...new Set(selectedPositions)];
    if (uniquePositions.length) {
      urlParams.set('pposition', uniquePositions.join(','));
    } else {
      urlParams.delete('pposition');
    }

    window.location.href = `${window.location.pathname}?${urlParams.toString()}`;
  });
});