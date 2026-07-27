/**
 * Structured JSON logging via Pino. See docs/03-TECHNOLOGY-STACK.md §2 and
 * docs/13-SECURITY.md §9 (redaction of secrets and PII).
 */
import pino from "pino";
import { env } from "@/env";

const REDACT_PATHS = [
  "password",
  "*.password",
  "passwordHash",
  "*.passwordHash",
  "token",
  "*.token",
  "secret",
  "*.secret",
  "signature",
  "*.signature",
  "authorization",
  "*.authorization",
  "cookie",
  "*.cookie",
  "otp",
  "*.otp",
  "pidx",
  "*.pidx",
  "req.headers.authorization",
  "req.headers.cookie",
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: REDACT_PATHS, censor: "[redacted]" },
  base: { service: "citycomputer" },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
