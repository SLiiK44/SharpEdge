const fallback = [
  {
    id: "nfl1",
    league: "NFL",
    home_team: "Kansas City",
    away_team: "Buffalo",
    market: "Moneyline",
    selection: "Kansas City ML",
    odds: "-130",
    decimal: 1.77,
    confidence: 84,
    edge: "+6.8%",
    reasons: ["QB efficiency", "Home field", "Line value"],
    status: "pregame",
  },
  {
    id: "nba1",
    league: "NBA",
    home_team: "Boston",
    away_team: "New York",
    market: "Total",
    selection: "Over 221.5",
    odds: "-108",
    decimal: 1.93,
    confidence: 76,
    edge: "+3.7%",
    reasons: ["Pace", "Shot profile"],
    status: "pregame",
  },
  {
    id: "mlb1",
    league: "MLB",
    home_team: "Los Angeles",
    away_team: "San Diego",
    market: "Moneyline",
    selection: "Los Angeles ML",
    odds: "-145",
    decimal: 1.69,
    confidence: 82,
    edge: "+5.9%",
    reasons: ["Starter edge", "Bullpen form"],
    status: "pregame",
  },
];

function getTeamName(event, side) {
  return (
    event?.teams?.[side]?.name ||
    event?.teams?.[side]?.names?.long ||
    event?.teams?.[side]?.names?.short ||
    side
  );
}

export default async function handler(req, res) {
  res.setHeader(
    "Cache-Control",
    "s-maxage=60, stale-while-revalidate=300"
  );

  const apiKey = process.env.SPORTSGAMEODDS_API_KEY;

  if (!apiKey) {
    return res.status(200).json({
      source: "fallback",
      warning: "Sports provider not configured",
      games: fallback,
    });
  }

  try {
    const url =
      "https://api.sportsgameodds.com/v2/events" +
      "?leagueID=NBA,NFL,MLB" +
      "&oddsAvailable=true" +
      "&limit=25";

    const response = await fetch(url, {
      headers: {
        "x-api-key": apiKey,
        Accept: "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok || data?.success === false) {
      return res.status(200).json({
        source: "fallback",
        warning: `Provider ${response.status}: ${
          data?.error || "Request failed"
        }`,
        games: fallback,
      });
    }

    const events = Array.isArray(data?.data) ? data.data : [];

    if (!events.length) {
      return res.status(200).json({
        source: "fallback",
        warning: "Provider returned no games",
        games: fallback,
      });
    }

    const games = events.map((event) => ({
      id: event.eventID,
      league: event.leagueID || "",
      home_team: getTeamName(event, "home"),
      away_team: getTeamName(event, "away"),
      start_time: event.startTime || null,
      status:
        event?.status?.live === true
          ? "live"
          : event?.status?.ended === true
          ? "final"
          : "pregame",
      odds: event.odds || {},
    }));

    return res.status(200).json({
      source: "provider",
      count: games.length,
      games,
    });
  } catch (error) {
    return res.status(200).json({
      source: "fallback",
      warning: error.message || "Provider request failed",
      games: fallback,
    });
  }
}
