import { addLeagues, addTablePagination } from "../common-functions.js";

addLeagues("pleague");
document.getElementById("match-list").style.visibility = "visible";

addTablePagination();