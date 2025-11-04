import fs from 'fs';
import path from 'path';

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  stack?: string;
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private logFile: string;

  private constructor() {
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
    this.logFile = process.env.LOG_FILE || '/opt/Smart-Parking/logs/app.log';

    // Ensure log directory exists
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    };
    return levels[level] <= levels[this.logLevel];
  }

  private formatLogEntry(entry: LogEntry): string {
    const { timestamp, level, message, data, stack } = entry;
    let logLine = `[${timestamp}] ${level.toUpperCase()}: ${message}`;

    if (data) {
      logLine += ` | Data: ${JSON.stringify(data)}`;
    }

    if (stack) {
      logLine += `\n${stack}`;
    }

    return logLine + '\n';
  }

  private writeToFile(entry: LogEntry): void {
    try {
      const logLine = this.formatLogEntry(entry);
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private log(level: LogLevel, message: string, data?: any, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      stack: error?.stack,
    };

    // Always write errors and warnings to file
    if (level === 'error' || level === 'warn') {
      this.writeToFile(entry);
    }

    // Console output for development
    if (process.env.NODE_ENV !== 'production') {
      const consoleMethod = level === 'error' ? console.error :
                           level === 'warn' ? console.warn :
                           console.log;

      consoleMethod(`[${entry.timestamp}] ${level.toUpperCase()}: ${message}`,
                   data ? data : '');

      if (error?.stack) {
        console.error(error.stack);
      }
    }
  }

  public error(message: string, data?: any, error?: Error): void {
    this.log('error', message, data, error);
  }

  public warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  public info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  public debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }
}

export const logger = Logger.getInstance();
export default logger;