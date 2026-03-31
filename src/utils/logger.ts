/**
 * Structured Logger
 *
 * Why not console.log? Three reasons:
 *
 * 1. STRUCTURED OUTPUT — console.log produces unstructured text that's
 *    impossible to parse in log aggregation tools (Datadog, CloudWatch).
 *    JSON logs let you query: "show me all LLM calls > 500ms" or
 *    "show me all failed verifications for merchant X."
 *
 * 2. LOG LEVELS — In production, you want errors and warns but not debug
 *    spam. Log levels let consumers control verbosity.
 *
 * 3. SECURITY — console.log in a library can accidentally leak sensitive
 *    data (API keys, email content). A controlled logger can redact.
 *
 * We don't use a logging library (winston, pino) to avoid adding deps
 * to this package. Consumers can redirect our output to their logger
 * by providing a custom log handler.
 *
 * FDE pattern: Every production deployment needs structured logging.
 * It's the first thing ops teams ask for during incident response.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

/** Custom log handler — consumers can redirect logs to their own system */
export type LogHandler = (entry: LogEntry) => void;

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Default log handler — outputs JSON to stderr.
 * stderr (not stdout) because stdout might be used for application output.
 */
const defaultHandler: LogHandler = (entry) => {
  // eslint-disable-next-line no-console
  console.error(JSON.stringify(entry));
};

export class Logger {
  private handler: LogHandler;
  private minLevel: LogLevel;
  private context: Record<string, unknown>;

  constructor(options: {
    level?: LogLevel;
    handler?: LogHandler;
    context?: Record<string, unknown>;
  } = {}) {
    this.minLevel = options.level ?? "info";
    this.handler = options.handler ?? defaultHandler;
    this.context = options.context ?? {};
  }

  /** Create a child logger with additional context */
  child(context: Record<string, unknown>): Logger {
    return new Logger({
      level: this.minLevel,
      handler: this.handler,
      context: { ...this.context, ...context },
    });
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log("debug", message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log("info", message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log("warn", message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log("error", message, data);
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
      return;
    }

    this.handler({
      level,
      message,
      timestamp: new Date().toISOString(),
      ...this.context,
      ...data,
    });
  }
}
