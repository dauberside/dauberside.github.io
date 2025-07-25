import { logError } from "../../lib/logger";

export default function handler(req, res) {
  try {
    throw new Error("Test error");
  } catch (error) {
    console.error("Error caught in API route:", error);
    logError(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
