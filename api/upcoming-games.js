export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.SPORTSDATAIO_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "SPORTSDATAIO_API_KEY is not configured"
    });
  }

  const league = String(req.query.league || "nba").toLowerCase();

  const leagueConfig = {
    nfl: {
      base: "https://api.sportsdata.io/v3/nfl/scores/json",
      schedule: "Schedules"
    },
    nba: {
      base: "https://api.sportsdata.io/v3/nba/scores/json",
      schedule: "Schedules"
    },
    mlb: {
      base: "https://api.sportsdata.io/v3/mlb/scores/json",
      schedule: "Schedules"
    },
    nhl: {
      base: "https://api.sportsdata.io/v3/nhl/scores/json",
      schedule: "Schedules"
    },
    ncaaf: {
      base: "https://api.sportsdata.io/v3/cfb/scores/json",
      schedule: "Schedules"
    }
  };

  const config = leagueConfig[league];

  if (!config) {
    return res.status(400).json({
      error: "Unsupported league",
      supported: ["nfl", "nba", "mlb", "nhl", "ncaaf"]
    });
  }

  try {
    const response = await fetch(
      `${config.base}/${config.schedule}/2026`,
      {
        headers: {
          "Ocp-Apim-Subscription-Key": apiKey
        }
      }
    );

    const text = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "SportsDataIO request failed",
        league,
        details: text
      });
    }

    const games = JSON.parse(text);

    const now = new Date();

    const upcoming = games
      .filter(game => {
        const gameTime = game.DateTime || game.Day;
        if (!gameTime) return false;

        return new Date(gameTime) >= now;
      })
      .sort((a, b) => {
        const aTime = new Date(a.DateTime || a.Day);
        const bTime = new Date(b.DateTime || b.Day);
        return aTime - bTime;
      })
      .slice(0, 50)
      .map(game => ({
        id: game.GameID,
        league: league.toUpperCase(),
        status: game.Status,
        date: game.Day,
        startTime: game.DateTime,
        awayTeam: game.AwayTeam,
        homeTeam: game.HomeTeam,
        stadium:
          game.Stadium?.Name ||
          game.StadiumDetails?.Name ||
          null
      }));

    res.setHeader(
      "Cache-Control",
      "s-maxage=300, stale-while-revalidate=600"
    );

    return res.status(200).json({
      success: true,
      league: league.toUpperCase(),
      count: upcoming.length,
      games: upcoming
    });

  } catch (error) {
    console.error("Upcoming games error:", error);

    return res.status(500).json({
      error: "Unable to load upcoming games"
    });
  }
}
