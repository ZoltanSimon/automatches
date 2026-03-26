export const gt = (a, b) => a > b;
export const lt = (a, b) => a < b;
export const eq = (a, b) => a === b;
export const json = (context) => JSON.stringify(context);

export const formatTime = (datestamp) => {
  if (!datestamp) return "";
  const date = datestamp instanceof Date ? datestamp : new Date(datestamp);
  if (isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Berlin" // CET/CEST
  });
};

export const currentDate = () => {
  const now = new Date();
  return now.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Berlin"
  });
};

export const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

export const formatDateOnly = (date) => {
  return new Date(date).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\//g, '.');
}

export const percentage = (wins, played) => {
  return ((wins / played) * 100).toFixed(1);
}

export const includesID = (array, id) => {
  const arrayToCheck = Array.isArray(array) ? array : [array];
  return arrayToCheck && arrayToCheck.includes(id);
}

export const increment = (nr) => {
  return parseInt(nr) + 1;
}

export const perGame = (total, games) => {
  const g = Number(games);
  if (!g || g === 0) return 0;
  const t = Number(total);
  if (Number.isNaN(t)) return 0;
  return (t / g).toFixed(2);
}

export const zeroDefault = (value) => {
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

export const ratingClass = (rating) => {
  const r = parseFloat(rating);
  if (isNaN(r)) return '';
  if (r >= 8) return 'rating-dark-green';
  if (r >= 7) return 'rating-green';
  if (r >= 6) return 'rating-yellow';
  if (r >= 5) return 'rating-orange';
  return 'rating-red';
}