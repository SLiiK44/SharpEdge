export default async function handler(req, res) {
  try {
    const apiKey = process.env.ODDS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "ODDS_API_KEY is not configured"
      });
    }

    const sport = req.query.sport || "americanfootball_nfl";

    const url =
      `https://api.the-odds-api.com/v4/sports/${sport}/odds/` +
      `?apiKey=${apiKey}` +
      `&regions=us` +
      `&markets=h2h,spreads,totals` +
      `&oddsFormat=american` +
      `&dateFormat=iso`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();

      return res.status(response.status).json({
        error: "Odds API request failed",
        details: errorText
      });
    }

    const games = await response.json();

    const formattedGames = games.map(game => {
      const bookmaker = game.bookmakers?.[0];

      const moneyline =
        bookmaker?.markets?.find(m => m.key === "h2h") || null;

      const spread =
        bookmaker?.markets?.find(m => m.key === "spreads") || null;

      const total =
        bookmaker?.markets?.find(m => m.key === "totals") || null;

      return {
        id: game.id,
        sport: game.sport_key,
        league: game.sport_title,
        startTime: game.commence_time,

        homeTeam: game.home_team,
        awayTeam: game.away_team,

        moneyline: moneyline?.outcomes || [],
        spread: spread?.outcomes || [],
        total: total?.outcomes || [],

        bookmaker: bookmaker?.title || "Sportsbook"
      };
    });

    return res.status(200).json({
      success: true,
      count: formattedGames.length,
      games: formattedGames
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "SharpEdge server error",
      message: error.message
    });
  }
}
