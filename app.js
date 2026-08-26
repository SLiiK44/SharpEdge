/* SHARPEDGE V3 — SportsGameOdds powered game board */

const SPORT_LEAGUES = {
  nfl: "NFL",
  nba: "NBA",
  mlb: "MLB",
  nhl: "NHL",
  ncaaf: "NCAAF",
  ncaab: "NCAAB"
};

const state = {
  games: [],
  sport: "all",
  day: "today",
  loading: false,
  favorites: new Set(
    JSON.parse(localStorage.getItem("sharpedge-favorites") || "[]")
  ),
  lastUpdated: null
};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function esc(v = "") {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function dayKey(date) {
  const d = new Date(date);

  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function relativeDate(offset) {
  const d = new Date();

  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);

  return d;
}

function sameDay(a, b) {
  return dayKey(a) === dayKey(b);
}

function americanToProbability(odds) {
  const n = Number(odds);

  if (!Number.isFinite(n) || n === 0) return null;

  return n < 0
    ? (Math.abs(n) / (Math.abs(n) + 100)) * 100
    : (100 / (n + 100)) * 100;
}

function normalizeTwoWayProbability(aOdds, bOdds) {
  const a = americanToProbability(aOdds);
  const b = americanToProbability(bOdds);

  if (a == null || b == null || a + b === 0) {
    return null;
  }

  return {
    a: (a / (a + b)) * 100,
    b: (b / (a + b)) * 100
  };
}

function getTeamName(team, fallback) {
  return (
    team?.names?.long ||
    team?.names?.medium ||
    team?.names?.short ||
    team?.name ||
    fallback
  );
}

function getTeamAbbr(team, fallback) {
  return (
    team?.names?.short ||
    team?.short ||
    team?.abbreviation ||
    fallback
  );
}

function pickBookLine(odd) {
  if (!odd) return null;

  const books = Object.entries(
    odd.byBookmaker || {}
  )
    .filter(([, value]) => {
      return value && value.available !== false;
    })
    .map(([book, value]) => ({
      book,
      ...value
    }));

  return books[0] || null;
}

function allMarkets(event) {
  return Object.values(event?.odds || {});
}

function findMarket(event, test) {
  return allMarkets(event).find(test) || null;
}

function normalizeSGOEvent(event, sport) {
  const homeTeam = event?.teams?.home || {};
  const awayTeam = event?.teams?.away || {};
  const status = event?.status || {};

  let gameState = "pre";

  if (status.ended || status.finalized) {
    gameState = "post";
  } else if (status.started) {
    gameState = "in";
  }

  const homeML = findMarket(
    event,
    o =>
      o.betTypeID === "ml" &&
      o.sideID === "home"
  );

  const awayML = findMarket(
    event,
    o =>
      o.betTypeID === "ml" &&
      o.sideID === "away"
  );

  const homeSpread = findMarket(
    event,
    o =>
      o.betTypeID === "sp" &&
      o.sideID === "home"
  );

  const awaySpread = findMarket(
    event,
    o =>
      o.betTypeID === "sp" &&
      o.sideID === "away"
  );

  const over = findMarket(
    event,
    o =>
      o.betTypeID === "ou" &&
      o.sideID === "over" &&
      (
        o.statEntityID === "all" ||
        o.statEntityID == null
      )
  );

  const under = findMarket(
    event,
    o =>
      o.betTypeID === "ou" &&
      o.sideID === "under" &&
      (
        o.statEntityID === "all" ||
        o.statEntityID == null
      )
  );

  const homeMLBook = pickBookLine(homeML);
  const awayMLBook = pickBookLine(awayML);

  const homeSpreadBook =
    pickBookLine(homeSpread);

  const awaySpreadBook =
    pickBookLine(awaySpread);

  const overBook = pickBookLine(over);
  const underBook = pickBookLine(under);

  return {
    id: event.eventID,

    sport,

    league:
      event.leagueID ||
      SPORT_LEAGUES[sport] ||
      sport.toUpperCase(),

    start: new Date(event.startTime),

    state: gameState,

    status:
      status.displayLong ||
      status.displayShort ||
      (
        gameState === "post"
          ? "Final"
          : gameState === "in"
          ? "Live"
          : "Scheduled"
      ),

    home: {
      name:
        getTeamName(
          homeTeam,
          "Home"
        ),

      abbr:
        getTeamAbbr(
          homeTeam,
          "HOME"
        ),

      score:
        event?.scores?.home ??
        event?.score?.home ??
        ""
    },

    away: {
      name:
        getTeamName(
          awayTeam,
          "Away"
        ),

      abbr:
        getTeamAbbr(
          awayTeam,
          "AWAY"
        ),

      score:
        event?.scores?.away ??
        event?.score?.away ??
        ""
    },

    venue:
      event?.venue?.name ||
      event?.venue?.venueName ||
      "",

    odds: {
      homeMoneyline:
        homeMLBook?.odds ??
        homeML?.bookOdds ??
        null,

      awayMoneyline:
        awayMLBook?.odds ??
        awayML?.bookOdds ??
        null,

      homeSpread:
        homeSpreadBook?.spread ??
        homeSpread?.bookSpread ??
        null,

      homeSpreadOdds:
        homeSpreadBook?.odds ??
        homeSpread?.bookOdds ??
        null,

      awaySpread:
        awaySpreadBook?.spread ??
        awaySpread?.bookSpread ??
        null,

      awaySpreadOdds:
        awaySpreadBook?.odds ??
        awaySpread?.bookOdds ??
        null,

      overUnder:
        overBook?.overUnder ??
        underBook?.overUnder ??
        over?.bookOverUnder ??
        under?.bookOverUnder ??
        null,

      overOdds:
        overBook?.odds ??
        over?.bookOdds ??
        null,

      underOdds:
        underBook?.odds ??
        under?.bookOdds ??
        null
    },

    rawOdds:
      event?.odds || {},

    players:
      event?.players || {}
  };
}

async function fetchRange(
  sport,
  range
) {
  const league =
    SPORT_LEAGUES[sport];

  if (!league) {
    return [];
  }

  try {
    const url =
      `/api/upcoming-games?league=${encodeURIComponent(league)}` +
      `&range=${encodeURIComponent(range)}`;

    const res =
      await fetch(url);

    if (!res.ok) {
      console.error(
        "SharpEdge API error",
        sport,
        range,
        res.status
      );

      return [];
    }

    const data =
      await res.json();

    return (data.events || [])
      .map(event =>
        normalizeSGOEvent(
          event,
          sport
        )
      )
      .filter(Boolean);

  } catch (err) {
    console.error(
      "SportsGameOdds error",
      sport,
      range,
      err
    );

    return [];
  }
}

async function loadGames() {
  if (state.loading) {
    return;
  }

  state.loading = true;

  showLoading();

  try {
    const jobs = [];

    for (
      const sport
      of Object.keys(
        SPORT_LEAGUES
      )
    ) {
      jobs.push(
        fetchRange(
          sport,
          "week"
        )
      );
    }

    const results =
      await Promise.all(jobs);

    const unique =
      new Map();

    results
      .flat()
      .forEach(game => {
        unique.set(
          game.id,
          game
        );
      });

    state.games =
      [...unique.values()]
        .sort(
          (a, b) =>
            a.start -
            b.start
        );

    state.lastUpdated =
      new Date();

    renderEverything();

    updateTimestamp();

  } finally {
    state.loading = false;
  }
}

function sportGames() {
  if (
    state.sport === "all"
  ) {
    return state.games;
  }

  return state.games.filter(
    game =>
      game.sport ===
      state.sport
  );
}

function dayGames(
  day = state.day
) {
  const games =
    sportGames();

  if (
    day === "yesterday"
  ) {
    return games.filter(
      game =>
        sameDay(
          game.start,
          relativeDate(-1)
        )
    );
  }

  if (
    day === "today"
  ) {
    return games.filter(
      game =>
        sameDay(
          game.start,
          relativeDate(0)
        )
    );
  }

  if (
    day === "tomorrow"
  ) {
    return games.filter(
      game =>
        sameDay(
          game.start,
          relativeDate(1)
        )
    );
  }

  return games;
}

function upcomingGames() {
  const now = Date.now();

  return sportGames()
    .filter(
      game =>
        game.state === "pre" &&
        game.start.getTime() >
          now
    );
}

function liveGames() {
  return sportGames()
    .filter(
      game =>
        game.state === "in"
    );
}

function fmtOdds(value) {
  if (
    value == null ||
    value === ""
  ) {
    return "—";
  }

  const n = Number(value);

  if (
    Number.isFinite(n) &&
    n > 0
  ) {
    return `+${n}`;
  }

  return String(value);
}

function fmtSpread(value) {
  if (
    value == null ||
    value === ""
  ) {
    return "—";
  }

  const n = Number(value);

  if (
    Number.isFinite(n) &&
    n > 0
  ) {
    return `+${n}`;
  }

  return String(value);
}

function marketInfo(game) {
  const odds =
    game.odds || {};

  const probabilities =
    normalizeTwoWayProbability(
      odds.homeMoneyline,
      odds.awayMoneyline
    );

  let favorite =
    "No market";

  let favoritePct = null;

  if (probabilities) {
    if (
      probabilities.a >=
      probabilities.b
    ) {
      favorite =
        `${game.home.abbr} ` +
        `${probabilities.a.toFixed(0)}%`;

      favoritePct =
        probabilities.a;
    } else {
      favorite =
        `${game.away.abbr} ` +
        `${probabilities.b.toFixed(0)}%`;

      favoritePct =
        probabilities.b;
    }
  }

  const spread =
    odds.homeSpread != null
      ?
        `${game.home.abbr} ` +
        `${fmtSpread(odds.homeSpread)} ` +
        `(${fmtOdds(odds.homeSpreadOdds)})`
      :
      odds.awaySpread != null
      ?
        `${game.away.abbr} ` +
        `${fmtSpread(odds.awaySpread)} ` +
        `(${fmtOdds(odds.awaySpreadOdds)})`
      :
        "—";

  const total =
    odds.overUnder != null
      ?
        `O/U ${odds.overUnder} • ` +
        `O ${fmtOdds(odds.overOdds)} / ` +
        `U ${fmtOdds(odds.underOdds)}`
      :
        "—";

  const moneyline =
    `${game.away.abbr} ` +
    `${fmtOdds(odds.awayMoneyline)} • ` +
    `${game.home.abbr} ` +
    `${fmtOdds(odds.homeMoneyline)}`;

  return {
    spread,
    total,
    moneyline,
    favorite,
    favoritePct
  };
}

function edgeScore(game) {
  const market =
    marketInfo(game);

  if (
    market.favoritePct == null
  ) {
    return null;
  }

  const score =
    5 +
    (
      (
        market.favoritePct -
        50
      ) /
      50
    ) *
    5;

  return Math.max(
    5,
    Math.min(
      9.9,
      score
    )
  );
}

function gameCard(game) {
  const market =
    marketInfo(game);

  const live =
    game.state === "in";

  const final =
    game.state === "post";

  const saved =
    state.favorites.has(
      game.id
    );

  const edge =
    edgeScore(game);

  return `
    <article class="game-card">

      <div class="game-meta">

        <strong>
          ${esc(game.league)}
        </strong>

        <span>
          ${
            live
              ? "🔴 LIVE"
              : final
              ? "FINAL"
              : esc(
                  formatTime(
                    game.start
                  )
                )
          }
        </span>

      </div>

      <div class="game-teams">

        <div class="team-row">

          <strong>
            ${esc(game.away.name)}
          </strong>

          ${
            live || final
              ?
              `<strong>
                ${esc(game.away.score)}
              </strong>`
              :
              ""
          }

        </div>

        <div class="team-row">

          <strong>
            ${esc(game.home.name)}
          </strong>

          ${
            live || final
              ?
              `<strong>
                ${esc(game.home.score)}
              </strong>`
              :
              ""
          }

        </div>

      </div>

      <div class="market-board">

        <div>
          <small>MONEYLINE</small>
          <strong>
            ${esc(market.moneyline)}
          </strong>
        </div>

        <div>
          <small>SPREAD</small>
          <strong>
            ${esc(market.spread)}
          </strong>
        </div>

        <div>
          <small>OVER / UNDER</small>
          <strong>
            ${esc(market.total)}
          </strong>
        </div>

        <div>
          <small>FAVORITE</small>
          <strong>
            ${esc(market.favorite)}
          </strong>
        </div>

      </div>

      ${
        edge != null
          ?
          `
          <div class="edge-line">
            <span>EDGE SCORE</span>
            <strong>
              ${edge.toFixed(1)}
            </strong>
          </div>
          `
          :
          ""
      }

      <div class="game-actions">

        <button
          onclick="saveFavorite('${esc(game.id)}')"
        >
          ${
            saved
              ? "★ Saved"
              : "☆ Favorite"
          }
        </button>

        <button
          onclick="openGame('${esc(game.id)}')"
        >
          Game Details
        </button>

      </div>

    </article>
  `;
}

function emptyCard(message) {
  return `
    <article class="empty-card">
      ${esc(message)}
    </article>
  `;
}

function setHtml(
  id,
  html
) {
  const element =
    document.getElementById(id);

  if (element) {
    element.innerHTML = html;
  }
}

function showLoading() {
  setHtml(
    "upcomingGamesGrid",
    emptyCard(
      "Loading real games and odds..."
    )
  );

  setHtml(
    "liveGamesGrid",
    emptyCard(
      "Checking live games..."
    )
  );

  setHtml(
    "topPicksGrid",
    emptyCard(
      "Building market board..."
    )
  );
}

function renderDashboard() {
  const upcoming =
    upcomingGames()
      .slice(0, 8);

  const live =
    liveGames()
      .slice(0, 8);

  const ranked =
    upcomingGames()
      .map(game => ({
        game,
        score:
          edgeScore(game) || 0
      }))
      .sort(
        (a, b) =>
          b.score -
          a.score
      )
      .slice(0, 8)
      .map(item =>
        item.game
      );

  setHtml(
    "upcomingGamesGrid",

    upcoming.length
      ?
      upcoming
        .map(gameCard)
        .join("")
      :
      emptyCard(
        "No upcoming games found for this sport."
      )
  );

  setHtml(
    "liveGamesGrid",

    live.length
      ?
      live
        .map(gameCard)
        .join("")
      :
      emptyCard(
        "No games live right now."
      )
  );

  setHtml(
    "topPicksGrid",

    ranked.length
      ?
      ranked
        .map(gameCard)
        .join("")
      :
      emptyCard(
        "No market-backed picks available right now."
      )
  );
}

function renderLiveView() {
  const games =
    dayGames("today");

  setHtml(
    "allLiveGames",

    games.length
      ?
      games
        .map(gameCard)
        .join("")
      :
      emptyCard(
        "No games available today."
      )
  );
}

function renderPicksView() {
  const games =
    upcomingGames()
      .sort(
        (a, b) =>
          (
            edgeScore(b) || 0
          ) -
          (
            edgeScore(a) || 0
          )
      );

  setHtml(
    "allPicksGrid",

    games.length
      ?
      games
        .map(gameCard)
        .join("")
      :
      emptyCard(
        "No picks available yet."
      )
  );
}

function renderSaved() {
  const games =
    state.games.filter(
      game =>
        state.favorites.has(
          game.id
        )
    );

  setHtml(
    "savedPicks",

    games.length
      ?
      games
        .map(gameCard)
        .join("")
      :
      emptyCard(
        "No favorites saved yet."
      )
  );
}

function renderParlay() {
  const games =
    upcomingGames()
      .map(game => ({
        game,
        score:
          edgeScore(game) || 0
      }))
      .sort(
        (a, b) =>
          b.score -
          a.score
      )
      .slice(0, 5)
      .map(item =>
        item.game
      );

  setHtml(
    "parlayBuilder",

    games.length
      ?
      games
        .map(gameCard)
        .join("")
      :
      emptyCard(
        "Not enough priced games for a parlay right now."
      )
  );
}

function renderEverything() {
  renderDashboard();
  renderLiveView();
  renderPicksView();
  renderSaved();
  renderParlay();
}

function updateTimestamp() {
  const element =
    $("#lastUpdated");

  if (
    element &&
    state.lastUpdated
  ) {
    element.textContent =
      new Intl.DateTimeFormat(
        undefined,
        {
          hour: "numeric",
          minute: "2-digit"
        }
      )
      .format(
        state.lastUpdated
      );
  }
}

function saveFavorite(id) {
  if (
    state.favorites.has(id)
  ) {
    state.favorites.delete(id);
  } else {
    state.favorites.add(id);
  }

  localStorage.setItem(
    "sharpedge-favorites",
    JSON.stringify(
      [...state.favorites]
    )
  );

  renderEverything();
}

function playerPropsFor(game) {
  return Object.values(
    game.rawOdds || {}
  )
  .filter(market => {
    return (
      market.statEntityID &&
      market.statEntityID !== "all"
    );
  });
}

function openGame(id) {
  const game =
    state.games.find(
      game =>
        game.id === id
    );

  if (!game) {
    return;
  }

  const market =
    marketInfo(game);

  const props =
    playerPropsFor(game)
      .slice(0, 10);

  let propsText =
    "No player props returned yet.";

  if (props.length) {
    propsText =
      props
        .map(prop => {
          const book =
            pickBookLine(prop);

          return (
            `${prop.statID || "Player Prop"} ` +
            `${book?.overUnder ?? prop.bookOverUnder ?? ""} ` +
            `${fmtOdds(book?.odds ?? prop.bookOdds)}`
          );
        })
        .join("\n");
  }

  alert(
    `${game.away.name} @ ${game.home.name}\n\n` +

    `${formatTime(game.start)}\n\n` +

    `Moneyline:\n${market.moneyline}\n\n` +

    `Spread:\n${market.spread}\n\n` +

    `Total:\n${market.total}\n\n` +

    `Favorite:\n${market.favorite}\n\n` +

    `Player Props:\n${propsText}`
  );
}

function openView(view) {
  $$(".view")
    .forEach(element => {
      element.classList.remove(
        "active"
      );
    });

  const target =
    document.getElementById(
      `${view}View`
    );

  if (target) {
    target.classList.add(
      "active"
    );
  }

  $$("[data-view]")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.view ===
          view
      );
    });

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function bindNavigation() {
  $$("[data-view]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          openView(
            button.dataset.view
          );
        }
      );
    });
}

function bindSports() {
  $$(".sport")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {

          state.sport =
            button.dataset.sport ||
            "all";

          $$(".sport")
            .forEach(item => {
              item.classList.toggle(
                "active",
                item === button
              );
            });

          renderEverything();
        }
      );
    });
}

function createDayControls() {
  const sports =
    $(".sports-filter");

  if (
    !sports ||
    $("#sharpedgeDayFilter")
  ) {
    return;
  }

  const controls =
    document.createElement(
      "div"
    );

  controls.id =
    "sharpedgeDayFilter";

  controls.className =
    "day-filter";

  controls.innerHTML = `

    <button data-day="yesterday">
      Yesterday
    </button>

    <button
      data-day="today"
      class="active"
    >
      Today
    </button>

    <button data-day="tomorrow">
      Tomorrow
    </button>

    <button data-day="week">
      Next 7 Days
    </button>

  `;

  sports.insertAdjacentElement(
    "afterend",
    controls
  );

  controls
    .querySelectorAll(
      "button"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          state.day =
            button.dataset.day;

          controls
            .querySelectorAll(
              "button"
            )
            .forEach(item => {
              item.classList.toggle(
                "active",
                item === button
              );
            });

          const games =
            dayGames();

          setHtml(
            "upcomingGamesGrid",

            games.length
              ?
              games
                .map(gameCard)
                .join("")
              :
              emptyCard(
                `No ${state.day} games found for this sport.`
              )
          );
        }
      );
    });
}

function bindButtons() {
  const refresh =
    $("#refreshGames");

  if (refresh) {
    refresh.addEventListener(
      "click",
      loadGames
    );
  }

  const viewUpcoming =
    $("#viewAllUpcoming");

  if (viewUpcoming) {
    viewUpcoming.addEventListener(
      "click",
      () =>
        openView("live")
    );
  }
}

function init() {
  bindNavigation();

  bindSports();

  bindButtons();

  createDayControls();

  renderSaved();

  loadGames();
}

window.saveFavorite =
  saveFavorite;

window.openGame =
  openGame;

window.openView =
  openView;

document.addEventListener(
  "DOMContentLoaded",
  init
);
