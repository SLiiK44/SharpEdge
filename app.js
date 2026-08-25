const ESPN_ENDPOINTS = {
  nfl: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
  nba: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
  mlb: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",
  nhl: "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard",
  ncaaf: "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard"
};

const state = {
  allGames: [],
  upcomingGames: [],
  liveGames: [],
  selectedSport: "all"
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function safeText(value, fallback = "") {
  return value ?? fallback;
}

function formatGameTime(dateString) {
  if (!dateString) return "TBD";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return "TBD";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function getStatusType(event) {
  return event?.status?.type?.state || "";
}

function normalizeEvent(event, league) {
  const competition = event?.competitions?.[0];

  if (!competition) return null;

  const competitors = competition.competitors || [];

  const home = competitors.find(
    (team) => team.homeAway === "home"
  );

  const away = competitors.find(
    (team) => team.homeAway === "away"
  );

  const startTime = event.date
    ? new Date(event.date)
    : null;

  return {
    id: event.id,
    league,
    name: event.name || "",
    shortName: event.shortName || "",
    startTime,
    statusType: getStatusType(event),
    statusDetail:
      event?.status?.type?.shortDetail ||
      event?.status?.type?.detail ||
      "",
    venue:
      competition?.venue?.fullName ||
      "",
    home: {
      name:
        home?.team?.displayName ||
        home?.team?.shortDisplayName ||
        "Home",
      abbreviation:
        home?.team?.abbreviation ||
        "",
      logo:
        home?.team?.logo ||
        "",
      score:
        home?.score ||
        ""
    },
    away: {
      name:
        away?.team?.displayName ||
        away?.team?.shortDisplayName ||
        "Away",
      abbreviation:
        away?.team?.abbreviation ||
        "",
      logo:
        away?.team?.logo ||
        "",
      score:
        away?.score ||
        ""
    }
  };
}

function classifyGames(games) {
  const now = Date.now();

  state.upcomingGames = games
    .filter((game) => {
      if (!game?.startTime) return false;

      const time = game.startTime.getTime();

      const isFuture =
        time > now &&
        game.statusType !== "in" &&
        game.statusType !== "post";

      return isFuture;
    })
    .sort(
      (a, b) =>
        a.startTime.getTime() -
        b.startTime.getTime()
    );

  state.liveGames = games
    .filter(
      (game) =>
        game.statusType === "in"
    )
    .sort(
      (a, b) =>
        a.startTime.getTime() -
        b.startTime.getTime()
    );
}

async function fetchLeague(league) {
  const endpoint = ESPN_ENDPOINTS[league];

  if (!endpoint) return [];

  try {
    const response = await fetch(endpoint);

    if (!response.ok) {
      throw new Error(
        `${league.toUpperCase()} request failed`
      );
    }

    const data = await response.json();

    return (data.events || [])
      .map((event) =>
        normalizeEvent(event, league)
      )
      .filter(Boolean);

  } catch (error) {
    console.error(
      `SharpEdge ${league} feed error:`,
      error
    );

    return [];
  }
}

async function loadGames() {
  setLoadingState();

  const leagues = Object.keys(ESPN_ENDPOINTS);

  const results = await Promise.all(
    leagues.map(fetchLeague)
  );

  state.allGames = results.flat();

  classifyGames(state.allGames);

  renderAll();

  updateTimestamp();
}

function setLoadingState() {
  const upcoming = $("#upcomingGamesGrid");
  const live = $("#liveGamesGrid");
  const picks = $("#topPicksGrid");

  if (upcoming) {
    upcoming.innerHTML = `
      <article class="loading-card">
        Loading future games...
      </article>
    `;
  }

  if (live) {
    live.innerHTML = `
      <article class="loading-card">
        Checking live games...
      </article>
    `;
  }

  if (picks) {
    picks.innerHTML = `
      <article class="loading-card">
        Building future game picks...
      </article>
    `;
  }
}

function getFilteredUpcoming() {
  if (state.selectedSport === "all") {
    return state.upcomingGames;
  }

  return state.upcomingGames.filter(
    (game) =>
      game.league === state.selectedSport
  );
}

function getFilteredLive() {
  if (state.selectedSport === "all") {
    return state.liveGames;
  }

  return state.liveGames.filter(
    (game) =>
      game.league === state.selectedSport
  );
}

function gameCard(game, live = false) {
  return `
    <article class="game-card">

      <div class="game-meta">
        <span>
          ${game.league.toUpperCase()}
        </span>

        <span>
          ${
            live
              ? safeText(
                  game.statusDetail,
                  "LIVE"
                )
              : formatGameTime(
                  game.startTime
                )
          }
        </span>
      </div>

      <div class="game-teams">

        <div class="team-row">
          <strong>
            ${game.away.name}
          </strong>

          ${
            live
              ? `<strong>${game.away.score}</strong>`
              : ""
          }
        </div>

        <div class="team-row">
          <strong>
            ${game.home.name}
          </strong>

          ${
            live
              ? `<strong>${game.home.score}</strong>`
              : ""
          }
        </div>

      </div>

      <div class="game-time">
        ${
          live
            ? safeText(
                game.statusDetail,
                "Live now"
              )
            : `Starts ${formatGameTime(
                game.startTime
              )}`
        }
      </div>

    </article>
  `;
}

function renderUpcomingGames() {
  const grid =
    $("#upcomingGamesGrid");

  if (!grid) return;

  const games =
    getFilteredUpcoming().slice(0, 6);

  if (!games.length) {
    grid.innerHTML = `
      <article class="empty-card">
        No future games found for this sport right now.
      </article>
    `;
    return;
  }

  grid.innerHTML =
    games.map(
      (game) =>
        gameCard(game, false)
    ).join("");
}

function renderLiveGames() {
  const grid =
    $("#liveGamesGrid");

  if (!grid) return;

  const games =
    getFilteredLive().slice(0, 6);

  if (!games.length) {
    grid.innerHTML = `
      <article class="empty-card">
        No games live right now.
      </article>
    `;
    return;
  }

  grid.innerHTML =
    games.map(
      (game) =>
        gameCard(game, true)
    ).join("");
}

function calculateEdgeScore(game, index) {
  const base =
    7.2 +
    ((index * 7) % 17) / 10;

  return Math.min(
    9.4,
    Number(base.toFixed(1))
  );
}

function pickCard(game, index) {
  const edgeScore =
    calculateEdgeScore(game, index);

  const pick =
    index % 3 === 0
      ? `${game.home.abbreviation || game.home.name} ML`
      : index % 3 === 1
      ? `${game.away.abbreviation || game.away.name} +3.5`
      : `${game.home.abbreviation || game.home.name} -2.5`;

  const pickType =
    index % 3 === 0
      ? "MONEYLINE"
      : "SPREAD";

  return `
    <article class="pick-card">

      <div class="pick-top">
        <span>
          ${game.league.toUpperCase()}
        </span>

        <span>
          ${formatGameTime(
            game.startTime
          )}
        </span>
      </div>

      <h4>
        ${pick}
      </h4>

      <div class="pick-type">
        ${pickType}
      </div>

      <div class="pick-footer">

        <div class="confidence">
          Confidence:
          ${
            edgeScore >= 8
              ? "High"
              : "Medium"
          }
        </div>

        <div class="edge-score">
          ${edgeScore}
        </div>

      </div>

    </article>
  `;
}

function renderTopPicks() {
  const grid =
    $("#topPicksGrid");

  if (!grid) return;

  const games =
    getFilteredUpcoming().slice(0, 6);

  if (!games.length) {
    grid.innerHTML = `
      <article class="empty-card">
        No future games available for picks right now.
      </article>
    `;
    return;
  }

  grid.innerHTML =
    games.map(
      (game, index) =>
        pickCard(game, index)
    ).join("");
}

function renderAllUpcoming() {
  const grid =
    $("#allPicksGrid");

  if (!grid) return;

  const games =
    getFilteredUpcoming();

  if (!games.length) {
    grid.innerHTML = `
      <article class="empty-card">
        No future games available right now.
      </article>
    `;
    return;
  }

  grid.innerHTML =
    games.map(
      (game, index) =>
        pickCard(game, index)
    ).join("");
}

function renderAllLive() {
  const grid =
    $("#allLiveGames");

  if (!grid) return;

  const games =
    getFilteredLive();

  if (!games.length) {
    grid.innerHTML = `
      <article class="empty-card">
        No games are live right now.
      </article>
    `;
    return;
  }

  grid.innerHTML =
    games.map(
      (game) =>
        gameCard(game, true)
    ).join("");
}

function updateMetrics() {
  const upcoming =
    getFilteredUpcoming();

  const topEdgeMetric =
    $("#topEdgeMetric");

  const pickCountMetric =
    $("#pickCountMetric");

  if (topEdgeMetric) {
    topEdgeMetric.textContent =
      upcoming.length
        ? "58%"
        : "--";
  }

  if (pickCountMetric) {
    pickCountMetric.textContent =
      upcoming.length;
  }
}

function renderAll() {
  renderUpcomingGames();
  renderLiveGames();
  renderTopPicks();
  renderAllUpcoming();
  renderAllLive();
  updateMetrics();
}

function updateTimestamp() {
  const el =
    $("#lastUpdated");

  if (!el) return;

  const now = new Date();

  el.textContent =
    new Intl.DateTimeFormat(
      undefined,
      {
        hour: "numeric",
        minute: "2-digit"
      }
    ).format(now);
}

function openView(viewName) {
  $$(".view").forEach((view) => {
    view.classList.remove("active");
  });

  const target =
    $(`#${viewName}View`);

  if (target) {
    target.classList.add("active");
  }

  $$("[data-view]").forEach((btn) => {
    btn.classList.toggle(
      "active",
      btn.dataset.view === viewName
    );
  });

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function bindNavigation() {
  $$("[data-view]").forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        const view =
          button.dataset.view;

        if (view) {
          openView(view);
        }
      }
    );
  });
}

function bindSportFilters() {
  $$(".sport").forEach((button) => {
    button.addEventListener(
      "click",
      () => {

        state.selectedSport =
          button.dataset.sport;

        $$(".sport").forEach(
          (item) =>
            item.classList.remove(
              "active"
            )
        );

        button.classList.add(
          "active"
        );

        renderAll();
      }
    );
  });
}

function bindRefresh() {
  const button =
    $("#refreshGames");

  if (!button) return;

  button.addEventListener(
    "click",
    async () => {

      button.disabled = true;

      const oldText =
        button.textContent;

      button.textContent =
        "REFRESHING...";

      await loadGames();

      button.textContent =
        oldText;

      button.disabled = false;
    }
  );
}

function setupAuthDialog() {
  const authButton =
    $("#authButton");

  const dialog =
    $("#authDialog");

  const close =
    $("#closeAuth");

  if (
    authButton &&
    dialog
  ) {
    authButton.addEventListener(
      "click",
      () => {
        dialog.showModal();
      }
    );
  }

  if (
    close &&
    dialog
  ) {
    close.addEventListener(
      "click",
      () => {
        dialog.close();
      }
    );
  }
}

function init() {
  bindNavigation();
  bindSportFilters();
  bindRefresh();
  setupAuthDialog();

  loadGames();
}

document.addEventListener(
  "DOMContentLoaded",
  init
);
