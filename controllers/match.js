import { playerGoalList } from "../components/player-list.js";

if (document.getElementById("player-list-table")) {
	playerGoalList({ big: false, enableStatFilters: false, pageSize: 10 });
}

document.addEventListener("DOMContentLoaded", () => {
	const tabButtons = [...document.querySelectorAll(".match-tab-btn[data-tab]")];
	const tabPanels = [...document.querySelectorAll(".match-content-panel[data-panel]")];

	if (tabButtons.length > 0) {
		const tabNames = tabButtons.map((button) => button.dataset.tab);

		const setActiveTab = (tab, { updateHash = true } = {}) => {
			tabButtons.forEach((button) => {
				const active = button.dataset.tab === tab;
				button.classList.toggle("is-active", active);
				button.setAttribute("aria-selected", String(active));
			});
			tabPanels.forEach((panel) => {
				panel.classList.toggle("is-active", panel.dataset.panel === tab);
			});

			if (updateHash) {
				history.replaceState(null, "", `${location.pathname}${location.search}#${tab}`);
			}
		};

		tabButtons.forEach((button) => {
			button.addEventListener("click", () => setActiveTab(button.dataset.tab));
		});

		const hashTab = location.hash.slice(1);
		const defaultTab = tabButtons.find((button) => button.classList.contains("is-active"))?.dataset.tab ?? tabNames[0];
		setActiveTab(tabNames.includes(hashTab) ? hashTab : defaultTab, { updateHash: false });
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

	const refetchButton = document.getElementById("refetch-match-btn");
	if (refetchButton) {
		refetchButton.addEventListener("click", () => {
			const matchId = refetchButton.dataset.matchId;
			if (!matchId) {
				return;
			}

			window.runRefetch({
				button: refetchButton,
				url: `/api/grab-match-info?matchID=${encodeURIComponent(matchId)}&omitMatches=1`,
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
