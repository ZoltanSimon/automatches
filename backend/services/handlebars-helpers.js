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
