function filterByRound(round) {
  const table = document.getElementById("match-list");
  if (table) {
    if (round) {
      table.dataset.roundFilter = round;
    } else {
      delete table.dataset.roundFilter;
    }
  }

  if (table?._tablePagination) {
    table._tablePagination.refresh({ resetPage: true });
    return;
  }

  const rows = document.querySelectorAll("#match-list tbody tr");
  rows.forEach((row) => {
    if (!round || row.dataset.round === round) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  });
}

function navigateRound(direction) {
  const select = document.getElementById("round-filter");
  const rounds = Array.from(select.options)
    .slice(1)
    .map((opt) => opt.value); // skip "All Rounds"
  let currentValue = select.value;
  if (!currentValue) {
    // If "All Rounds" selected, go to first round
    select.value = rounds[0];
    filterByRound(rounds[0]);
    return;
  }
  const currentIndex = rounds.indexOf(currentValue);
  if (currentIndex === -1) return;
  const newIndex = currentIndex + direction;
  if (newIndex >= 0 && newIndex < rounds.length) {
    select.value = rounds[newIndex];
    filterByRound(rounds[newIndex]);
  }
}

function navigateDate(direction) {
  const input = document.getElementById("matchDate");
  const currentDate = new Date(input.value);
  currentDate.setDate(currentDate.getDate() + direction);

  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");

  input.value = `${year}-${month}-${day}`;
  input.form.submit();
}

