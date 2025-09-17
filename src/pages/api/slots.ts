// Minimal skeleton for GET /api/slots
// Contract: spec/specs/003-my-feature/contracts/booking.openapi.yml

import type { NextApiRequest, NextApiResponse } from "next";

type Slot = { start: string; end: string };
type SlotsResponse = { slots: Slot[] };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SlotsResponse | { message: string }>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  // For now, return an empty list to satisfy the initial contract shape.
  return res.status(200).json({ slots: [] });
}
