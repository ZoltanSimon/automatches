import { showMatchesOnDate, getTop10Players } from "../../common-functions.js";

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

await getTop10Players([39, 140, 135, 78, 61, 88, 94]);
