// Structured logs: one JSON object per line, filtered by LOG_LEVEL
// (debug, info, warn or error; default info).

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const ORDER: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function isLevel(value: string | undefined): value is Level {
  return value !== undefined && value in ORDER;
}

function threshold(): number {
  const configured = process.env.LOG_LEVEL?.toLowerCase();
  return ORDER[isLevel(configured) ? configured : "info"];
}

function write(level: Level, message: string, fields?: Fields) {
  if (ORDER[level] < threshold()) return;
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    message,
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, fields?: Fields) => write("debug", message, fields),
  info: (message: string, fields?: Fields) => write("info", message, fields),
  warn: (message: string, fields?: Fields) => write("warn", message, fields),
  error: (message: string, fields?: Fields) => write("error", message, fields),
};
