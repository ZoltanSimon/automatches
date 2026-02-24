import { getLeagueFromDb } from "./../data-access.js";
import { getMatchFromServer, buildTeamList } from "./../json-reader.js";

export async function extractTeams(leagueIDs, date) {
  let filterDate;

  if (date) {
    const [day, month, year] = date.split("-").map(Number);
    filterDate = new Date(year, month - 1, day);
    if (isNaN(filterDate.getTime())) {
      throw new Error("Invalid date format. Use 'DD-MM-YYYY'.");
    }
  } else {
    filterDate = new Date(2000, 0, 1);
  }

  const data = await getLeagueFromDb(leagueIDs);

  const matchIDs = data
    .filter(({ fixture }) => {
      const fixtureDate = new Date(fixture.date);
      return (
        ["FT", "AET"].includes(fixture.status.short) && fixtureDate > filterDate
      );
    })
    .map(({ fixture }) => fixture.id);

  const allMatches = (
    await Promise.allSettled(matchIDs.map((id) => getMatchFromServer(id)))
  )
    .filter(({ status, value }, i) => {
      if (status === "rejected") {
        console.error(`Error fetching match with ID ${matchIDs[i]}:`, value);
        return false;
      }
      if (!value?.[0]) {
        console.warn(`No data found for matchID: ${matchIDs[i]}`);
        return false;
      }
      return true;
    })
    .map(({ value }) => value[0]);

  return buildTeamList(allMatches);
}
