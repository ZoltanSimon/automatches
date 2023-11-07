export function matchList(response) {
  let addToPage;
  let fixtures = response.response;
  fixtures.sort(function (a, b) {
    return new Date(a.fixture.date) - new Date(b.fixture.date);
  });
  addToPage = `<table>`;
  fixtures.forEach((element) => {
    addToPage += `<tr>
      <td>${new Date(element.fixture.date).toDateString()}</td>
      <td><img src=${imagePath(element.teams.home.name)} width="30px"></td>
      <td>${element.teams.home.name}</td>
      <td width="30px">${
        !isNaN(parseInt(element.goals.home)) ? element.goals.home : ""
      }</td>
      <td><img src=${imagePath(element.teams.away.name)} width="30px"</td>
      <td>${element.teams.away.name}</td>
      <td width="30px">${
        !isNaN(parseInt(element.goals.away)) ? element.goals.away : ""
      }</td><td>${element.fixture.id}</td>
      </tr>`;
  });
  addToPage += `</table>`;
  document.getElementById("fixtures-info").innerHTML += addToPage;
}

export function matchesToCanvas() {
  console.log("a");
}
