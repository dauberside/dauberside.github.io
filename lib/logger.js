import fs from 'fs/promises';
import path from 'path';

export async function logError(error) {
  const logDir = path.join(process.cwd(), 'logs');
  const logFile = path.join(logDir, 'error.log');

  try {
    await fs.mkdir(logDir, { recursive: true });
    const errorMessage = `${new Date().toISOString()} - ${error.stack}\n`;
    await fs.appendFile(logFile, errorMessage, 'utf8');
  } catch (err) {
    console.error('Failed to log error:', err);
  }
}