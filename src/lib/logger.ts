import fs from "fs/promises";
import path from "path";

const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "error.log");

export async function logError(error: Error): Promise<void> {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    const errorMessage = `${new Date().toISOString()} - ${error.stack}\n`;
    await fs.appendFile(LOG_FILE, errorMessage, "utf8");
  } catch (err) {
    console.error("Failed to log error:", err);
    // ここでフォールバックメカニズムを実装することを検討
  }
}
