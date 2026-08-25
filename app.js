/* SHARPEDGE V2 — GAME BOARD */

const LEAGUES = {
  nfl: ["football", "nfl"],
  nba: ["basketball", "nba"],
  mlb: ["baseball", "mlb"],
  nhl: ["hockey", "nhl"],
  ncaaf: ["football", "college-football"],
  ncaab: ["basketball", "mens-college-basketball"]
};

const state = {
  games: [],
  sport: "all",
  day: "today"
};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function localDay(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function relativeDate(offset) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

function sameDay(a, b) {
  return localDay(a) === localDay(b);
}

function formatTime(date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(date));
}

function buildUrl(sport, date) {
  const [category, league] = LEAGUES[sport];

  return `https://site.api.espn.com/apis/site/v2/sports/${category}/${league}/scoreboard?dates=${dateKey(date)}&limit=100`;
}

function normalizeEvent(event, sport) {
  const competition = event?.competitions?.[0];
  if (!competition) return null;

  const teams = competition.competitors || [];

  const home = teams.find(t => t.homeAway === "home");
  const away = teams.find(t => t.homeAway === "away");

  const status = event?.status?.type || {};

  return {
    id: `${sport}-${event.id}`,
    eventId: event.id,
    sport,
    start: new Date(event.date),

    state: status.state || "pre",
    status:
      status.shortDetail ||
      status.detail ||
      "Scheduled",

    home: {
      name:
        home?.team?.displayName ||
        home?.team?.shortDisplayName ||
        "Home",
      abbr: home?.team?.abbreviation || "",
      logo: home?.team?.logo || "",
      score: home?.score || ""
    },

    away: {
      name:
        away?.team?.displayName ||
        away?.team?.shortDisplayName ||
        "Away",
      abbr: away?.team?.abbreviation || "",
      logo: away?.team?.logo || "",
      score: away?.score || ""
    },

    venue: competition?.venue?.fullName || "",

    /* Only use market data if ESPN actually supplies it */
    odds: competition?.odds?.[0] || null
  };
}

async function fetchDay(sport, date) {
  try {
    const res = await fetch(buildUrl(sport, date));

    if (!res.ok) return [];

    const data = await res.json();

    return (data.events || [])
      .map(e => normalizeEvent(e, sport))
      .filter(Boolean);

  } catch (err) {
    console.error("SharpEdge feed error:", sport, err);
    return [];
  }
}

async function loadGames() {
  showLoading();

  const jobs = [];

  /*
    -1 = yesterday
     0 = today
     1 = tomorrow
     through +7
  */

  for (const sport of Object.keys(LEAGUES)) {
    for (let offset = -1; offset <= 7; offset++) {
      jobs.push(fetchDay(sport, relativeDate(offset)));
    }
  }

  const results = await Promise.all(jobs);

  const unique = new Map();

  results.flat().forEach(game => {
    unique.set(game.id, game);
  });

  state.games = [...unique.values()].sort(
    (a, b) => a.start - b.start
  );

  renderEverything();
  updateTimestamp();
}

/* -------------------------
   FILTERING
------------------------- */

function sportGames() {
  if (state.sport === "all") return state.games;

  return state.games.filter(
    g => g.sport === state.sport
  );
}

function dayGames() {
  const games = sportGames();

  if (state.day === "yesterday") {
    return games.filter(g =>
      sameDay(g.start, relativeDate(-1))
    );
  }

  if (state.day === "today") {
    return games.filter(g =>
      sameDay(g.start, relativeDate(0))
    );
  }

  if (state.day === "tomorrow") {
    return games.filter(g =>
      sameDay(g.start, relativeDate(1))
    );
  }

  return games.filter(g => {
    const start = g.start.getTime();
    const now = relativeDate(0).setHours(0,0,0,0);
    const end = relativeDate(7).setHours(23,59,59,999);

    return start >= now && start <= end;
  });
}

function upcomingGames() {
  const now = Date.now();

  return sportGames().filter(
    g =>
      g.state === "pre" &&
      g.start.getTime() > now
  );
}

function liveGames() {
  return sportGames().filter(
    g => g.state === "in"
  );
}

function completedGames() {
  return sportGames().filter(
    g => g.state === "post"
  );
}

/* -------------------------
   ODDS
------------------------- */

function americanToProbability(odds) {
  const n = Number(odds);

  if (!Number.isFinite(n) || n === 0) {
    return null;
  }

  if (n < 0) {
    return Math.abs(n) /
      (Math.abs(n) + 100) * 100;
  }

  return 100 / (n + 100) * 100;
}

function marketInfo(game) {
  const o = game.odds;

  if (!o) {
    return {
      spread: "Unavailable",
      total: "Unavailable",
      moneyline: "Unavailable",
      favorite: "Unavailable"
    };
  }

  const spread =
    o.details || "Unavailable";

  const total =
    o.overUnder != null
      ? `O/U ${o.overUnder}`
      : "Unavailable";

  /*
    ESPN odds objects differ by league/feed.
    Never invent missing moneylines.
  */

  const homeML =
    o.homeTeamOdds?.moneyLine ??
    null;

  const awayML =
    o.awayTeamOdds?.moneyLine ??
    null;

  let moneyline = "Unavailable";
  let favorite = "Unavailable";

  if (homeML != null || awayML != null) {
    moneyline =
      `${game.away.abbr || "Away"} ${awayML ?? "—"} • ` +
      `${game.home.abbr || "Home"} ${homeML ?? "—"}`;

    const homeProb =
      americanToProbability(homeML);

    const awayProb =
      americanToProbability(awayML);

    if (homeProb && awayProb) {
      if (homeProb > awayProb) {
        favorite =
          `${game.home.abbr} ${homeProb.toFixed(0)}%`;
      } else {
        favorite =
          `${game.away.abbr} ${awayProb.toFixed(0)}%`;
      }
    }
  }

  return {
    spread,
    total,
    moneyline,
    favorite
  };
}

/* -------------------------
   GAME CARD
------------------------- */

function gameCard(game) {
  const market = marketInfo(game);

  const live = game.state === "in";
  const final = game.state === "post";

  return `
    <article class="game-card">

      <div class="game-meta">
        <strong>${game.sport.toUpperCase()}</strong>

        <span>
          ${live ? "🔴 LIVE" : final ? "FINAL" : formatTime(game.start)}
        </span>
      </div>

      <div class="game-teams">

        <div class="team-row">
          <strong>${game.away.name}</strong>
          ${live || final
            ? `<strong>${game.away.score}</strong>`
            : ""}
        </div>

        <div class="team-row">
          <strong>${game.home.name}</strong>
          ${live || final
            ? `<strong>${game.home.score}</strong>`
            : ""}
        </div>

      </div>

      <div class="market-board">

        <div>
          <small>MONEYLINE</small>
          <strong>${market.moneyline}</strong>
        </div>

        <div>
          <small>SPREAD</small>
          <strong>${market.spread}</strong>
        </div>

        <div>
          <small>OVER / UNDER</small>
          <strong>${market.total}</strong>
        </div>

        <div>
          <small>MARKET FAVORITE</small>
          <strong>${market.favorite}</strong>
        </div>

      </div>

      <div class="game-actions">

        <button onclick="saveFavorite('${game.id}')">
          ☆ Favorite
        </button>

        <button onclick="openGame('${game.id}')">
          Game Details
        </button>

      </div>

    </article>
  `;
}

/* -------------------------
   RENDER
------------------------- */

function renderUpcoming() {
  const el = $("#upcomingGamesGrid");
  if (!el) return;

  const games = dayGames();

  if (!games.length) {
    el.innerHTML =
      `<article class="empty-card">
        No games found for this date.
      </article>`;
    return;
  }

  el.innerHTML = games.map(gameCard).join("");
}

function renderLive() {
  const el = $("#liveGamesGrid");
  if (!el) return;

  const games = liveGames();

  el.innerHTML = games.length
    ? games.map(gameCard).join("")
    : `<article class="empty-card">
         No games live right now.
       </article>`;
}

function renderAllLive() {
  const el = $("#allLiveGames");
  if (!el) return;

  const games = liveGames();

  el.innerHTML = games.length
    ? games.map(gameCard).join("")
    : `<article class="empty-card">
         No games live right now.
       </article>`;
}

/* -------------------------
   PICKS
------------------------- */

function renderPicks() {
  const home = $("#topPicksGrid");
  const all = $("#allPicksGrid");

  const games = upcomingGames();

  /*
    Do NOT manufacture picks.

    Until legitimate odds/model analysis exists,
    show future games as analysis opportunities.
  */

  const html = games.length
    ? games.slice(0, 12).map(game => {

        const market = marketInfo(game);

        return `
          <article class="pick-card">

            <div class="pick-top">
              <span>${game.sport.toUpperCase()}</span>
              <span>${formatTime(game.start)}</span>
            </div>

            <h4>
              ${game.away.abbr || game.away.name}
              @
              ${game.home.abbr || game.home.name}
            </h4>

            <div class="pick-type">
              SHARPEDGE ANALYSIS
            </div>

            <div class="market-board">

              <div>
                <small>ML</small>
                <strong>${market.moneyline}</strong>
              </div>

              <div>
                <small>SPREAD</small>
                <strong>${market.spread}</strong>
              </div>

              <div>
                <small>O/U</small>
                <strong>${market.total}</strong>
              </div>

              <div>
                <small>FAVORITE</small>
                <strong>${market.favorite}</strong>
              </div>

            </div>

            <button onclick="openGame('${game.id}')">
              View Analysis
            </button>

          </article>
        `;
      }).join("")
    : `<article class="empty-card">
         No future games available.
       </article>`;

  if (home) home.innerHTML = html;
  if (all) all.innerHTML = html;
}

function renderEverything() {
  renderUpcoming();
  renderLive();
  renderAllLive();
  renderPicks();

  const count = $("#pickCountMetric");

  if (count) {
    count.textContent = upcomingGames().length;
  }
}

/* -------------------------
   FAVORITES
------------------------- */

function saveFavorite(id) {
  const favorites =
    JSON.parse(
      localStorage.getItem("sharpedge-favorites") || "[]"
    );

  if (!favorites.includes(id)) {
    favorites.push(id);
  }

  localStorage.setItem(
    "sharpedge-favorites",
    JSON.stringify(favorites)
  );

  alert("Saved to SharpEdge Favorites");
}

/* -------------------------
   GAME DETAILS
------------------------- */

function openGame(id) {
  const game =
    state.games.find(g => g.id === id);

  if (!game) return;

  const market = marketInfo(game);

  alert(
    `${game.away.name} @ ${game.home.name}\n\n` +
    `Start: ${formatTime(game.start)}\n` +
    `Moneyline: ${market.moneyline}\n` +
    `Spread: ${market.spread}\n` +
    `Over/Under: ${market.total}\n` +
    `Favorite: ${market.favorite}\n\n` +
    `Props: Waiting for verified prop data.\n` +
    `Starting lineups: will be added when available.`
  );
}

/* -------------------------
   DATE BUTTONS
------------------------- */

function addDateControls() {
  const sports = $(".sports-filter");

  if (!sports) return;

  if ($("#dateFilters")) return;

  const controls =
    document.createElement("div");

  controls.id = "dateFilters";
  controls.className = "sports-filter date-filter";

  controls.innerHTML = `
    <button class="sport day-filter" data-day="yesterday">
      Yesterday
    </button>

    <button class="sport day-filter active" data-day="today">
      Today
    </button>

    <button class="sport day-filter" data-day="tomorrow">
      Tomorrow
    </button>

    <button class="sport day-filter" data-day="week">
      This Week
    </button>
  `;

  sports.after(controls);

  controls.querySelectorAll(".day-filter")
    .forEach(button => {

      button.addEventListener("click", () => {

        state.day = button.dataset.day;

        controls
          .querySelectorAll(".day-filter")
          .forEach(b =>
            b.classList.remove("active")
          );

        button.classList.add("active");

        renderUpcoming();
      });
    });
}

/* -------------------------
   SPORT FILTERS
------------------------- */

function bindSports() {
  $$(".sport[data-sport]")
    .forEach(button => {

      button.addEventListener("click", () => {

        state.sport =
          button.dataset.sport;

        $$(".sport[data-sport]")
          .forEach(b =>
            b.classList.remove("active")
          );

        button.classList.add("active");

        renderEverything();
      });
    });
}

/* -------------------------
   NAVIGATION
------------------------- */

function openView(name) {
  $$(".view").forEach(v =>
    v.classList.remove("active")
  );

  const view = $(`#${name}View`);

  if (view) {
    view.classList.add("active");
  }

  $$("[data-view]").forEach(btn => {
    btn.classList.toggle(
      "active",
      btn.dataset.view === name
    );
  });

  window.scrollTo(0, 0);
}

function bindNavigation() {
  $$("[data-view]").forEach(btn => {

    btn.addEventListener("click", () => {
      openView(btn.dataset.view);
    });

  });
}

/* -------------------------
   REFRESH
------------------------- */

function updateTimestamp() {
  const el = $("#lastUpdated");

  if (el) {
    el.textContent =
      new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
      });
  }
}

function showLoading() {
  const el = $("#upcomingGamesGrid");

  if (el) {
    el.innerHTML =
      `<article class="loading-card">
         Loading SharpEdge game board...
       </article>`;
  }
}

function bindRefresh() {
  const btn = $("#refreshGames");

  if (!btn) return;

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "REFRESHING...";

    await loadGames();

    btn.disabled = false;
    btn.textContent = "REFRESH GAMES ↻";
  });
}

/* -------------------------
   START
------------------------- */

async function initSharpEdge() {
  bindNavigation();
  bindSports();
  bindRefresh();
  addDateControls();

  await loadGames();
}

document.addEventListener(
  "DOMContentLoaded",
  initSharpEdge
);
