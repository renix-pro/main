/**
 * RENIX — Claude client
 *
 * Single entry point for every LLM call in the server. Wraps the official
 * Anthropic SDK (`@anthropic-ai/sdk`) with the handful of shapes this app
 * actually needs: plain text completion, JSON completion, streaming text,
 * vision input and web research.
 *
 * Credentials: the SDK resolves them itself — ANTHROPIC_API_KEY, or
 * ANTHROPIC_AUTH_TOKEN, or a profile created with `ant auth login`.
 * Nothing is hardcoded here.
 */
import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-opus-5";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

let client: Anthropic | null = null;
export function getClaude(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export class ClaudeRefusalError extends Error {
  constructor(public readonly category: string | null | undefined, explanation?: string | null) {
    super(`Claude declined the request${category ? ` (${category})` : ""}${explanation ? `: ${explanation}` : ""}`);
    this.name = "ClaudeRefusalError";
  }
}

export interface CompleteOptions {
  /** One or more system prompt sections; joined with blank lines. */
  system?: string | Array<string | undefined | null | false>;
  messages: Anthropic.MessageParam[];
  /** Hard output cap (thinking tokens count against it). Default 16000. */
  maxTokens?: number;
  /** Thinking depth / token spend. Default is the API default ("high"). */
  effort?: Effort;
  model?: string;
}

function buildSystem(system: CompleteOptions["system"]): string | undefined {
  if (!system) return undefined;
  const parts = (Array.isArray(system) ? system : [system]).filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0,
  );
  return parts.length ? parts.join("\n\n") : undefined;
}

/**
 * Make an arbitrary chat history acceptable to the Messages API:
 * drop empty messages, drop leading assistant turns (the first message must be
 * from the user), and pass everything else through unchanged.
 */
export function normalizeMessages(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  const cleaned = messages.filter((m) =>
    typeof m.content === "string" ? m.content.trim().length > 0 : m.content.length > 0,
  );
  while (cleaned.length && cleaned[0].role !== "user") cleaned.shift();
  return cleaned;
}

function buildParams(opts: CompleteOptions): Anthropic.MessageCreateParamsNonStreaming {
  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: opts.model || CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    messages: normalizeMessages(opts.messages),
  };
  const system = buildSystem(opts.system);
  if (system) params.system = system;
  if (opts.effort) params.output_config = { effort: opts.effort };
  return params;
}

export function textOf(message: Anthropic.Message): string {
  if (message.stop_reason === "refusal") {
    throw new ClaudeRefusalError(message.stop_details?.category, message.stop_details?.explanation);
  }
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/**
 * Plain text completion. Always streams under the hood: the SDK rejects
 * non-streaming requests whose max_tokens could exceed its 10-minute limit,
 * and streaming avoids HTTP timeouts on long extractions either way.
 */
export async function completeText(opts: CompleteOptions): Promise<string> {
  const stream = getClaude().messages.stream(buildParams(opts));
  return textOf(await stream.finalMessage());
}

/**
 * Pull a JSON value out of model output that may be wrapped in markdown fences
 * or surrounded by prose. Throws if nothing parseable is found.
 */
export function parseJsonLoose<T = any>(raw: string): T {
  const text = raw.trim();
  const unfenced = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(unfenced) as T;
  } catch {
    /* fall through */
  }
  const firstObj = unfenced.indexOf("{");
  const firstArr = unfenced.indexOf("[");
  const starts = [firstObj, firstArr].filter((i) => i >= 0);
  if (starts.length === 0) throw new Error("No JSON found in model output");
  const start = Math.min(...starts);
  const closer = unfenced[start] === "{" ? "}" : "]";
  const end = unfenced.lastIndexOf(closer);
  if (end <= start) throw new Error("No JSON found in model output");
  return JSON.parse(unfenced.slice(start, end + 1)) as T;
}

export const JSON_ONLY_RULE =
  "Respond with a single JSON value only — no prose, no markdown code fences, no commentary before or after it.";

/**
 * Completion whose output must be JSON. The prompt is reinforced with a
 * JSON-only rule and the reply is parsed leniently. Callers validate the
 * shape (zod) as they did before.
 */
export async function completeJson<T = any>(opts: CompleteOptions): Promise<T> {
  const system = Array.isArray(opts.system) ? [...opts.system, JSON_ONLY_RULE] : [opts.system, JSON_ONLY_RULE];
  const raw = await completeText({ ...opts, system });
  return parseJsonLoose<T>(raw);
}

/**
 * Streaming text completion. `onDelta` receives each text chunk; the full
 * text is returned when the stream ends.
 */
export async function streamText(
  opts: CompleteOptions,
  onDelta: (delta: string) => void,
): Promise<string> {
  const { max_tokens, ...rest } = buildParams(opts);
  const stream = getClaude().messages.stream({ ...rest, max_tokens: opts.maxTokens ?? 64000 });
  stream.on("text", (delta) => onDelta(delta));
  const finalMessage = await stream.finalMessage();
  return textOf(finalMessage);
}

/** Streaming variant of completeJson. Streams raw text, returns the parsed JSON. */
export async function streamJson<T = any>(
  opts: CompleteOptions,
  onDelta: (delta: string) => void,
): Promise<{ raw: string; parsed: T | null }> {
  const system = Array.isArray(opts.system) ? [...opts.system, JSON_ONLY_RULE] : [opts.system, JSON_ONLY_RULE];
  const raw = await streamText({ ...opts, system }, onDelta);
  try {
    return { raw, parsed: parseJsonLoose<T>(raw) };
  } catch {
    return { raw, parsed: null };
  }
}

const IMAGE_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

/** Build an image content block from base64 data. */
export function imageBlock(base64Data: string, mimeType: string): Anthropic.ImageBlockParam {
  const media_type = (IMAGE_MEDIA_TYPES.has(mimeType) ? mimeType : "image/png") as Anthropic.Base64ImageSource["media_type"];
  return { type: "image", source: { type: "base64", media_type, data: base64Data } };
}

/** Build a PDF document content block from base64 data. */
export function pdfBlock(base64Data: string): Anthropic.DocumentBlockParam {
  return { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64Data } };
}

/**
 * Research a question on the web using Claude's server-side web search tool
 * and return the written-up findings as text.
 */
export async function webResearch(prompt: string, opts: { maxUses?: number; effort?: Effort } = {}): Promise<string> {
  const stream = getClaude().messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    ...(opts.effort ? { output_config: { effort: opts.effort } } : {}),
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: opts.maxUses ?? 5 }],
    messages: [{ role: "user", content: prompt }],
  });
  return textOf(await stream.finalMessage());
}
