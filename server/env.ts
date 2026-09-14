/**
 * Environment bootstrap.
 *
 * Must be the FIRST import in every entry point (server/index.ts, scripts)
 * so that `.env` is loaded before any module reads `process.env` at load time.
 *
 * LLM credentials are read from OPENAI_API_KEY (see server/ai/openai.ts).
 */
import "dotenv/config";

export const isProduction = process.env.NODE_ENV === "production";
