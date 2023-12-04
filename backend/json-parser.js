import { readFile } from "fs/promises";
import * as fs from "fs";

let data = JSON.parse(await readFile("../leagues/1.json", "utf8"));
console.log(data[0].fixture.timezone);
//change the value in the in-memory object
data[0].fixture.timezone = "UTC";
//Serialize as JSON and Write it to a file
fs.writeFileSync("../leagues/1.json", JSON.stringify(data));
let dataToWrite = await getResultsDate(39);

fs.writeFile(
  "../leagues/39.json",
  JSON.stringify(dataToWrite.response),
  function (err) {
    if (err) {
      return console.log(err);
    }
    console.log("The file was saved!");
  }
);

export async function getResultsDate(leagueID) {
  const rapidApiHost = "v3.football.api-sports.io";
  const rapidApiKey = "aba57b743572275dac2835162c201c56";
  const season = 2023;
  let url = `https://v3.football.api-sports.io/fixtures?league=${leagueID}&season=${season}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-rapidapi-host": rapidApiHost,
      "x-rapidapi-key": rapidApiKey,
    },
  });
  const data = await response.json();
  console.log(data.response);
  return data;
}
