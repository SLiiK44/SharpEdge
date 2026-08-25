const LEAGUES = {
  nfl: ["football", "nfl"],
  nba: ["basketball", "nba"],
  mlb: ["baseball", "mlb"],
  nhl: ["hockey", "nhl"],
  ncaaf: ["football", "college-football"],
  ncaab: ["basketball", "mens-college-basketball"]
};

function ymd(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function addDays(date, amount) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + amount);
  return copy;
}

function normalizeEvent(event, sport) {
  const competition = event?.competitions?.[0];
  if (!competition) return null;

  const competitors = competition.competitors || [];
  const home = competitors.find((x) => x.homeAway === "home");
  const away = competitors.find((x) => x.homeAway === "away");
  const status = event?.status?.type || {};

  return {
    id: `${sport}-${event.id}`,
    eventId: event.id,
    sport,
    name: event.name || "",
    startTime: event.date || null,
    state: status.state || "pre",
    status: status.shortDetail || status.detail || status.description || "Scheduled",
    venue: competition?.venue?.fullName || null,
    home: {
      name: home?.team?.displayName || home?.team?.shortDisplayName || "Home",
      abbreviation: home?.team?.abbreviation || null,
      logo: home?.team?.logo || null,
      score: home?.score ?? null
    },
    away: {
      name: away?.team?.displayName || away?.team?.shortDisplayName || "Away",
      abbreviation: away?.team?.abbreviation || null,
      logo: away?.team?.logo || null,
      score: away?.score ?? null
    },
    odds: competition?.odds?.[0] || null
  };
}

async function fetchBoard(sport, date) {
  const [category, slug] = LEAGUES[sport];
  const url =
    `https://site.api.espn.com/apis/site/v2/sports/${category}/${slug}/scoreboard` +
    `?dates=${ymd(date)}&limit=100`;

  const response = await fetch(url, {
    headers: { "User-Agent": "SharpEdge/2.0" }
  });

  if (!response.ok) {
    throw new Error(`${sport.toUpperCase()} ESPN ${response.status}`);
  }

  const data = await response.json();
  return (data.events || [])
    .map((event) => normalizeEvent(event, sport))
    .filter(Boolean);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sport = String(req.query.sport || "all").toLowerCase();
  const range = String(req.query.range || "week").toLowerCase();

  if (sport !== "all" && !LEAGUES[sport]) {
    return res.status(400).json({
      error: "Unsupported sport",
      supported: ["all", ...Object.keys(LEAGUES)]
    });
  }

  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);

  let startOffset = -1;
  let endOffset = 7;

  if (range === "yesterday") {
    startOffset = -1; endOffset = -1;
  } else if (range === "today") {
    startOffset = 0; endOffset = 0;
  } else if (range === "tomorrow") {
    startOffset = 1; endOffset = 1;
  } else if (range !== "week") {
    return res.status(400).json({
      error: "Unsupported range",
      supported: ["yesterday", "today", "tomorrow", "week"]
    });
  }

  const sports = sport === "all" ? Object.keys(LEAGUES) : [sport];
  const jobs = [];

  for (const s of sports) {
    for (let offset = startOffset; offset <= endOffset; offset++) {
      jobs.push(
        fetchBoard(s, addDays(today, offset))
          .then((games) => ({ ok: true, games, sport: s, offset }))
          .catch((error) => ({ ok: false, games: [], sport: s, offset, error: error.message }))
      );
    }
  }

  const results = await Promise.all(jobs);
  const unique = new Map();

  results.forEach((result) => {
    result.games.forEach((game) => unique.set(game.id, game));
  });

  const games = [...unique.values()].sort(
    (a, b) => new Date(a.startTime) - new Date(b.startTime)
  );

  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=180");

  return res.status(200).json({
    success: true,
    source: "ESPN scoreboard feeds",
    sport,
    range,
    generatedAt: new Date().toISOString(),
    count: games.length,
    games,
    warnings: results
      .filter((r) => !r.ok)
      .map((r) => ({ sport: r.sport, dateOffset: r.offset, message: r.error }))
  });
}
