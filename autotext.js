let opening = [
  `The matchday kicked off with `,
  `The matchday began with`,
  `The matchday started with `,
  `The round started with `,
  `The round kicked off with `,
  `In the first match of the round, it was `,
  `In the first match of the matchday, we had `,
];

let facing = [
  `facing `,
  `coming up against `,
  `meeting `,
  `playing against `,
  `hosting `,
  `played versus `,
  `up against `,
  `pitted against `,
];

let matchEndings = [
  `The match ended `,
  `After the final whistle it was `,
  `The final score was `,
  `After a fierce battle, the match ended `,
  `After 90 minutes it was `,
  `The final result was `,
  `The game concluded at `,
];

let lastMatches = [
  `In the last match of the round, we had `,
  `In the last match of the matchday, we had `,
  `To conclude the round, we had `,
  `To conclude the matchday, we had `,
  `For the conclusion of the round we had `,
  `For the conclusion of the matchday we had `,
];

let draws = [
  `both teams getting a point each. `,
  `the teams splitting the points. `,
  `and a draw. `,
  `the two teams cancelling each other out. `,
  `and a draw was recorded. `,
  `both teams walking him with a point. `,
];
let wins = [
  `grabbing the 3 points. `,
  `taking all 3 points home. `,
  `gaining the crucial 3 points. `,
  `securing the three points. `,
  `securing the 3 points.`,
  `adding 3 more points to their tally. `,
  `grabbing the crucial win. `,
  `grabbing the win.`,
  `winning the match.`,
];

let losses = [
  `losing the match. `,
  `losing the battle. `,
  `walking home with 0 points. `,
  `getting 0 points. `,
  `getting zero points.`,
  `getting 0 points and another loss to their name. `,
  `getting no points. `,
  `suffering a defeat. `,
];

let matchTransitions = [
  `We also had `,
  `In the next match `,
  `In another interesting match it was `,
  `In one of the more interesting matches of the round, it was `,
  `In another highly anticipated match, we had `,
  `For one of the highlight matches of the round we had `,
  `In another match `,
  `In another key match `,
  `In another important match `,
  `In another fixture `,
  `In another key fixture `,
  `In another important fixture `,
  `In one of the key fixtures of the round, we had `,
];

let leadersPlay = [
  `The leaders `,
  `1st placed team `,
  `First placed team `,
  `The first placed team `,
];

let firsts = [
  `are first. `,
  `are the leaders. `,
  `is the team with the most points. `,
  `holding strong as leaders. `,
  `are first in the league. `,
];

let lasts = [
  `are last. `,
  `are still last. `,
  `still occupy the last position. `,
  `are still last and not looking good. `,
  `are last and looking almost certain to get relegated.`,
];

let Napolis = [`Napoli `];

export function addText(resultsObj, standingsObj) {
  let textToPage = ``;
  let matchEnding, leader, firstPart, finalPart;

  let theOpening = opening[Math.floor(Math.random() * opening.length)];
  let lastMatch = lastMatches[Math.floor(Math.random() * lastMatches.length)];
  let first = firsts[Math.floor(Math.random() * firsts.length)];
  let last = lasts[Math.floor(Math.random() * lasts.length)];

  let fixtures = resultsObj.response;

  fixtures.sort(function (a, b) {
    return new Date(a.fixture.date) - new Date(b.fixture.date);
  });

  let standings = standingsObj.response[0].league.standings;
  standings.forEach((group) => {
    group.forEach((a, index) => {
      if (index == 0) {
        leader = a.team.name;
        textToPage = `${leader} ${first}<br/>`;
      }
      if (index == group.length - 1) {
        textToPage += `${a.team.name} ${last}`;
      }
    });
    document.getElementById("standings_text").innerHTML += textToPage;
  });
  textToPage = "";

  fixtures.forEach((a, index) => {
    matchEnding = matchEndings[Math.floor(Math.random() * matchEndings.length)];

    if (index == 0) {
      firstPart = theOpening;
    } else if (index == fixtures.length - 1) {
      firstPart = lastMatch;
    } else
      firstPart = getMatchTransition(
        a.teams.home.name,
        a.goals.home,
        a.teams.away.name,
        a.goals.away,
        leader
      );

    finalPart = `${matchEnding} ${a.goals.home}-${a.goals.away}, ${getWinner(
      a.teams.home.name,
      a.goals.home,
      a.teams.away.name,
      a.goals.away
    )}`;

    textToPage += buildMatch(
      a.teams.home.name,
      a.teams.away.name,
      firstPart,
      finalPart
    );
  });

  document.getElementById("results_text").innerHTML += textToPage;
}

function buildMatch(homeTeam, awayTeam, firstPart, finalPart) {
  let theFacing = facing[Math.floor(Math.random() * facing.length)];
  if (Math.random() > 0.5)
    return `${firstPart} ${homeTeam} ${theFacing} ${awayTeam}. ${finalPart}<br/>`;
  else
    return `${firstPart} ${homeTeam} ${theFacing} ${awayTeam} and ${finalPart}<br/>`;
}

function getWinner(homeTeam, homeGoals, awayTeam, awayGoals) {
  let draw = draws[Math.floor(Math.random() * draws.length)];

  if (homeGoals > awayGoals) {
    return winOrLoss(homeTeam, awayTeam);
  }
  if (awayGoals > homeGoals) {
    return winOrLoss(awayTeam, homeTeam);
  }
  return draw;
}

function winOrLoss(winner, loser) {
  let win = wins[Math.floor(Math.random() * wins.length)];
  let loss = losses[Math.floor(Math.random() * losses.length)];
  return Math.random() > 0.3 ? winner + ` ` + win : loser + ` ` + loss;
}

function getMatchTransition(homeTeam, homeGoals, awayTeam, awayGoals, leader) {
  let matchTransition =
    matchTransitions[Math.floor(Math.random() * matchTransitions.length)];
  let leaderPlay = leadersPlay[Math.floor(Math.random() * leadersPlay.length)];
  if (homeTeam == leader) {
    return leaderPlay;
  }
  return matchTransition;
}
