function formatApiCall(call) {
  if (!call) {
    return "";
  }

  const errors = call.errors ? ` errors=${JSON.stringify(call.errors)}` : "";
  const limits = call.limits
    ? ` dailyRemaining=${call.limits.dailyRemaining} perMinuteRemaining=${call.limits.perMinuteRemaining}`
    : "";
  return `${call.method || "GET"} ${call.url} → ${call.httpStatus} results=${call.results}${errors}${limits}`;
}

function showRefetchCalls(calls) {
  const lines = (Array.isArray(calls) ? calls : []).map(formatApiCall).filter(Boolean);
  lines.forEach((line) => console.log(line));

  let log = document.getElementById("refetch-call-log");
  if (!log) {
    log = document.createElement("pre");
    log.id = "refetch-call-log";
    log.className = "refetch-call-log";
    document.body.append(log);
  }

  log.textContent = lines.join("\n") || "No API calls recorded";
  log.hidden = false;
}

async function runRefetch({ button, url, nextUrl, onReset } = {}) {
  if (!button || !url) {
    return;
  }

  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Fetching...";

  try {
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      throw new Error(data.message || "Refetch failed");
    }

    showRefetchCalls(data.calls);
    const delay = Math.min(8000, 1500 + (Array.isArray(data.calls) ? data.calls.length : 1) * 400);
    window.setTimeout(() => {
      if (nextUrl) {
        window.location.assign(nextUrl);
        return;
      }
      window.location.reload();
    }, delay);
  } catch (error) {
    console.error("Refetch failed:", error);
    button.textContent = "Failed";
    button.disabled = false;
    setTimeout(() => {
      button.textContent = originalLabel;
      onReset?.();
    }, 2000);
  }
}

window.runRefetch = runRefetch;
