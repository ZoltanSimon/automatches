import { renderActiveViewChips } from "../components/player-list.js";
import { addLeagues, addTablePagination, setupLeagueListToggleButtons } from "../common-functions.js";

addLeagues("pleague");
renderActiveViewChips({ leaguesOnly: true });
setupLeagueListToggleButtons();
document.getElementById("match-list").style.visibility = "visible";

addTablePagination();

const refetchButton = document.getElementById("refetch-player-btn");
if (refetchButton) {
  refetchButton.addEventListener("click", () => {
    const playerId = refetchButton.dataset.playerId;
    if (!playerId) {
      return;
    }

    window.runRefetch({
      button: refetchButton,
      url: `/api/refetch-player?playerID=${encodeURIComponent(playerId)}`,
    });
  });
}