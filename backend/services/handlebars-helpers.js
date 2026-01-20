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
export const percentage = (wins, played) => {
  return ((wins / played) * 100).toFixed(1);
}