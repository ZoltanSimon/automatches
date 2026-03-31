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

	if (!eventsPanel || !toggleButton) {
		return;
	}

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
