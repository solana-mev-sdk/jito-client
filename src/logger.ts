import type { JitoClientLogger } from "./types";

const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

function isTty(): boolean {
  return typeof process !== "undefined" && process.stderr?.isTTY === true;
}

function defaultLogError(message: string): void {
  if (isTty()) {
    process.stderr.write(`${RED}${message}${RESET}\n`);
  } else {
    process.stderr.write(`${message}\n`);
  }
}

function defaultLogWarning(message: string): void {
  if (isTty()) {
    process.stderr.write(`${YELLOW}${message}${RESET}\n`);
  } else {
    process.stderr.write(`${message}\n`);
  }
}

function defaultLogInfo(message: string): void {
  process.stderr.write(`${message}\n`);
}

export function createLogger(custom?: JitoClientLogger): { logError: (m: string) => void; logWarning: (m: string) => void; logInfo: (m: string) => void } {
  return {
    logError: custom?.logError ?? defaultLogError,
    logWarning: custom?.logWarning ?? defaultLogWarning,
    logInfo: custom?.logInfo ?? console.log
  };
}
