document.addEventListener("DOMContentLoaded", () => {
	const summaryTab = document.getElementById("match-summary-tab");
	const previewTab = document.getElementById("match-preview-tab");
	const summaryPanel = document.getElementById("match-summary-panel");
	const previewPanel = document.getElementById("match-preview-panel");

	if (summaryTab && previewTab && summaryPanel && previewPanel) {
		const setActiveTab = (tab) => {
			const summaryActive = tab === "summary";

			summaryTab.classList.toggle("is-active", summaryActive);
			previewTab.classList.toggle("is-active", !summaryActive);
			summaryTab.setAttribute("aria-selected", String(summaryActive));
			previewTab.setAttribute("aria-selected", String(!summaryActive));

			summaryPanel.classList.toggle("is-active", summaryActive);
			previewPanel.classList.toggle("is-active", !summaryActive);
		};

		summaryTab.addEventListener("click", () => setActiveTab("summary"));
		previewTab.addEventListener("click", () => setActiveTab("preview"));
	}

	const eventsPanel = document.querySelector(".match-events-panel");
	const toggleButton = document.getElementById("events-toggle-btn");
	const matchCards = document.querySelectorAll(".match-detail[data-match-id]");

	if (matchCards.length > 0) {
		matchCards.forEach((card) => {
			const openMatchPage = () => {
				const { matchId } = card.dataset;
				if (!matchId) return;
				window.location.href = `/match?matchID=${matchId}`;
			};

			card.addEventListener("click", (event) => {
				if (event.target.closest("a")) {
					return;
				}
				openMatchPage();
			});

			card.addEventListener("keydown", (event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					openMatchPage();
				}
			});
		});
	}

	if (!eventsPanel || !toggleButton) {
		return;
	}

	// Ensure default view is goals only on initial load.
	eventsPanel.classList.add("goals-only");

	const updateButtonState = (isGoalsOnly) => {
		toggleButton.textContent = isGoalsOnly ? "Show All Events" : "Show Goals Only";
		toggleButton.setAttribute("aria-pressed", String(!isGoalsOnly));
	};

	updateButtonState(eventsPanel.classList.contains("goals-only"));

	toggleButton.addEventListener("click", () => {
		eventsPanel.classList.toggle("goals-only");
		updateButtonState(eventsPanel.classList.contains("goals-only"));
	});
});
