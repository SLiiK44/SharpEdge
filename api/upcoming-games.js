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

  const leagues = {
    nba: {
      sport: "basketball",
      competition: "usa-1"
    }
  };

  const config = leagues[league];

  if (!config) {
    return res.status(400).json({
      error: "Unsupported league",
      supported: ["nba"]
    });
  }

  try {
    // Search today + next 7 days
    const dates = [];

    for (let i = 0; i < 8; i++) {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() + i);
      dates.push(date.toISOString().slice(0, 10));
    }

    const requests = dates.map(async (date) => {
      const url =
        `https://global.sportsdata.io/${config.sport}/${config.competition}` +
        `/event-schedules/by-date/${date}`;

      const response = await fetch(url, {
        headers: {
          "Ocp-Apim-Subscription-Key": apiKey
        }
      });

      const text = await response.text();

      if (!response.ok) {
        throw new Error(
          `SportsDataIO ${response.status}: ${text}`
        );
      }

      return JSON.parse(text);
    });

    const results = await Promise.all(requests);
    const events = results.flat();

    const games = events
      .filter(event => event.StartDate)
      .sort(
        (a, b) =>
          new Date(a.StartDate) - new Date(b.StartDate)
      )
      .map(event => ({
        id: event.GlobalSportsEventId,
        name: event.Name,
        startTime: event.StartDate,
        status: event.Status,
        statusDescription: event.StatusDescription,

        venue: event.Venue?.Name || null,

        teams:
          event.Participants?.map(team => ({
            id: team.GlobalSportsParticipantId,
            name: team.Name,
            type: team.Type
          })) || []
      }));

    res.setHeader(
      "Cache-Control",
      "s-maxage=300, stale-while-revalidate=600"
    );

    return res.status(200).json({
      success: true,
      league: league.toUpperCase(),
      count: games.length,
      games
    });

  } catch (error) {
    console.error("Upcoming games error:", error);

    return res.status(500).json({
      error: "Unable to load upcoming games",
      details: error.message
    });
  }
}
