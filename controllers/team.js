import { playerGoalList } from "../../components/player-list.js";
import { addTablePagination, paginateMatchList } from "../common-functions.js";

const refetchButton = document.getElementById("refetch-team-btn");
if (refetchButton) {
  refetchButton.addEventListener("click", () => {
    const teamId = refetchButton.dataset.teamId;
    if (!teamId) {
      return;
    }

    window.runRefetch({
      button: refetchButton,
      url: `/api/refetch-team?teamID=${encodeURIComponent(teamId)}`,
    });
  });
}

await playerGoalList({ big: false, enableStatFilters: false, pageSize: 20 });
document.getElementById("match-list").style.visibility = "visible";

paginateMatchList({ startOnCurrentMatch: true });
addTablePagination();
