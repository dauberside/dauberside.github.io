export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store");
    res
      .status(410)
      .json({ error: "This endpoint is deprecated and no longer available." });
    return;
  } catch {
    res.status(410).json({ error: "Endpoint deprecated." });
    return;
  }
}
