import {
  showMatchesOnDate,
  getTopPlayers,
  getTop10Teams,
} from "../../common-functions.js";

/*const picker = datepicker(document.querySelector("#calendar"), {
    position: "bl",
    alwaysShow: true,
    onSelect: (instance, date) => {
      document.getElementById("fixtures-info").innerHTML = "";
      showMatchesOnDate(date);
    },
  });
  picker.calendarContainer.style.setProperty("left", "374px");*/

showMatchesOnDate(new Date());

await getTopPlayers([39, 140, 135, 78, 61, 88, 94], 10, false);

await getTop10Teams([39, 140, 135, 78, 61, 88, 94]);
