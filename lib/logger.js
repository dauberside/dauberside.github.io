import fs from 'fs';
import path from 'path';

export function logError(error) {
  const logDir = path.join(process.cwd(), 'logs');
  const logFile = path.join(logDir, 'error.log');

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }

  const errorMessage = `${new Date().toISOString()} - ${error.stack}\n`;
  fs.appendFileSync(logFile, errorMessage, 'utf8');
}