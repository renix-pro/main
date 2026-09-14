/**
 * Environment bootstrap.
 *
 * Must be the FIRST import in every entry point (server/index.ts, scripts)
 * so that `.env` is loaded before any module reads `process.env` at load time.
 *
 * LLM credentials are read by the Anthropic SDK itself (ANTHROPIC_API_KEY,
 * ANTHROPIC_AUTH_TOKEN, or an `ant auth login` profile) — nothing to map here.
 */
import "dotenv/config";

export const isProduction = process.env.NODE_ENV === "production";
