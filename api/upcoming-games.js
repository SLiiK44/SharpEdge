export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const apiKey = process.env.SPORTSGAMEODDS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "SPORTSGAMEODDS_API_KEY is not configured"
    });
  }

  const league = String(
    req.query.league || "MLB"
  ).toUpperCase();

  const range = String(
    req.query.range || "today"
  ).toLowerCase();

  const supported = [
    "NFL",
    "NBA",
    "MLB",
    "NHL",
    "NCAAF",
    "NCAAB"
  ];

  if (!supported.includes(league)) {
    return res.status(400).json({
      error: "Unsupported league",
      supported
    });
  }

  function startOfDay(offset = 0) {
    const d = new Date();

    d.setDate(d.getDate() + offset);

    d.setHours(0, 0, 0, 0);

    return d;
  }

  function endOfDay(offset = 0) {
    const d = new Date();

    d.setDate(d.getDate() + offset);

    d.setHours(23, 59, 59, 999);

    return d;
  }

  let startsAfter;
  let startsBefore;

  if (range === "yesterday") {
    startsAfter = startOfDay(-1);
    startsBefore = endOfDay(-1);
  }

  else if (range === "today") {
    startsAfter = startOfDay(0);
    startsBefore = endOfDay(0);
  }

  else if (range === "tomorrow") {
    startsAfter = startOfDay(1);
    startsBefore = endOfDay(1);
  }

  else if (range === "week") {
    startsAfter = startOfDay(-1);
    startsBefore = endOfDay(7);
  }

  else {
    return res.status(400).json({
      error: "Unsupported range",
      supported: [
        "yesterday",
        "today",
        "tomorrow",
        "week"
      ]
    });
  }

  try {
    const params = new URLSearchParams({
      leagueID: league,
      startsAfter: startsAfter.toISOString(),
      startsBefore: startsBefore.toISOString(),
      limit: "100",
      includeOpposingOdds: "true",
      includeAltLines: "true"
    });

    const response = await fetch(
      `https://api.sportsgameodds.com/v2/events?${params.toString()}`,
      {
        headers: {
          "x-api-key": apiKey
        }
      }
    );

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = {
        success: false,
        error: text
      };
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: "SportsGameOdds request failed",
        league,
        details: data
      });
    }

    const events = Array.isArray(data.data)
      ? data.data
      : [];

    res.setHeader(
      "Cache-Control",
      "s-maxage=60, stale-while-revalidate=180"
    );

    return res.status(200).json({
      success: true,
      source: "SportsGameOdds",
      league,
      range,
      count: events.length,
      events,
      nextCursor: data.nextCursor || null
    });

  } catch (error) {
    console.error(
      "SharpEdge SportsGameOdds error:",
      error
    );

    return res.status(500).json({
      error: "Unable to load sports data",
      details: error.message
    });
  }
}
