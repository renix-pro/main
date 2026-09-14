/**
 * RENIX — OpenAI client
 *
 * Single entry point for every LLM call in the server. Wraps the official
 * OpenAI SDK with the handful of shapes this app needs: plain text completion,
 * JSON completion, streaming text, vision input, image generation and web
 * research.
 *
 * Credentials come from OPENAI_API_KEY (see .env). OPENAI_BASE_URL is optional
 * and only needed when routing through a proxy or gateway.
 */
import OpenAI from "openai";

/** Model used for extraction, the AI companion and anything quality-sensitive. */
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";
/** Cheaper model used for classification, summaries and short insights. */
export const OPENAI_MODEL_FAST = process.env.OPENAI_MODEL_FAST || "gpt-4o-mini";
/** Model used for web-search-backed research (Responses API). */
export const OPENAI_WEB_SEARCH_MODEL = process.env.OPENAI_WEB_SEARCH_MODEL || "gpt-4o-mini";
/** Image model used for project hero images. */
export const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

/**
 * Effort is a coarse quality/cost dial kept from the previous provider so call
 * sites do not need to know model names: "low" routes to the cheap model.
 */
export type Effort = "low" | "medium" | "high";

let client: OpenAI | null = null;
export function getOpenAI(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
    });
  }
  return client;
}

/** True when an API key is present; used for the startup warning. */
export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export type ChatMessage = OpenAI.Chat.ChatCompletionMessageParam;
export type ContentPart = OpenAI.Chat.ChatCompletionContentPart;

export interface CompleteOptions {
  /** One or more system prompt sections; joined with blank lines. */
  system?: string | Array<string | undefined | null | false>;
  messages: ChatMessage[];
  /** Output cap. Default 4096. */
  maxTokens?: number;
  /** Quality/cost dial; "low" uses the cheap model. */
  effort?: Effort;
  /** Sampling temperature. Default 0.3. */
  temperature?: number;
  model?: string;
}

function buildSystem(system: CompleteOptions["system"]): string | undefined {
  if (!system) return undefined;
  const parts = (Array.isArray(system) ? system : [system]).filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0,
  );
  return parts.length ? parts.join("\n\n") : undefined;
}

function modelFor(opts: CompleteOptions): string {
  if (opts.model) return opts.model;
  return opts.effort === "low" ? OPENAI_MODEL_FAST : OPENAI_MODEL;
}

/**
 * Make an arbitrary chat history acceptable to the API: drop empty messages
 * and drop leading assistant turns.
 */
export function normalizeMessages(messages: ChatMessage[]): ChatMessage[] {
  const cleaned = messages.filter((m) => {
    const c = (m as any).content;
    if (typeof c === "string") return c.trim().length > 0;
    return Array.isArray(c) ? c.length > 0 : !!c;
  });
  while (cleaned.length && cleaned[0].role === "assistant") cleaned.shift();
  return cleaned;
}

function buildMessages(opts: CompleteOptions): ChatMessage[] {
  const system = buildSystem(opts.system);
  const history = normalizeMessages(opts.messages);
  return system ? [{ role: "system", content: system }, ...history] : history;
}

/** Plain text completion. */
export async function completeText(opts: CompleteOptions): Promise<string> {
  const response = await getOpenAI().chat.completions.create({
    model: modelFor(opts),
    messages: buildMessages(opts),
    max_completion_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0.3,
  });
  return response.choices[0]?.message?.content || "";
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

/**
 * The word "JSON" must appear in the prompt for OpenAI's JSON mode, and this
 * also keeps models from wrapping the object in prose.
 */
export const JSON_ONLY_RULE =
  "Respond with a single JSON value only — no prose, no markdown code fences, no commentary before or after it.";

/**
 * Completion whose output must be JSON. Uses OpenAI's native JSON mode and
 * parses leniently. Callers validate the shape (zod) as before.
 */
export async function completeJson<T = any>(opts: CompleteOptions): Promise<T> {
  const system = Array.isArray(opts.system)
    ? [...opts.system, JSON_ONLY_RULE]
    : [opts.system, JSON_ONLY_RULE];
  const response = await getOpenAI().chat.completions.create({
    model: modelFor({ ...opts, system }),
    messages: buildMessages({ ...opts, system }),
    max_completion_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0.3,
    response_format: { type: "json_object" },
  });
  return parseJsonLoose<T>(response.choices[0]?.message?.content || "{}");
}

/**
 * Streaming text completion. `onDelta` receives each text chunk; the full text
 * is returned when the stream ends.
 */
export async function streamText(
  opts: CompleteOptions,
  onDelta: (delta: string) => void,
): Promise<string> {
  const stream = await getOpenAI().chat.completions.create({
    model: modelFor(opts),
    messages: buildMessages(opts),
    max_completion_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0.3,
    stream: true,
  });

  let full = "";
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || "";
    if (delta) {
      full += delta;
      onDelta(delta);
    }
  }
  return full;
}

/** Streaming variant of completeJson. Streams raw text, returns parsed JSON. */
export async function streamJson<T = any>(
  opts: CompleteOptions,
  onDelta: (delta: string) => void,
): Promise<{ raw: string; parsed: T | null }> {
  const system = Array.isArray(opts.system)
    ? [...opts.system, JSON_ONLY_RULE]
    : [opts.system, JSON_ONLY_RULE];
  const raw = await streamText({ ...opts, system }, onDelta);
  try {
    return { raw, parsed: parseJsonLoose<T>(raw) };
  } catch {
    return { raw, parsed: null };
  }
}

/** Build an image content part from base64 data, for vision prompts. */
export function imageBlock(base64Data: string, mimeType: string): ContentPart {
  const type = mimeType && mimeType.startsWith("image/") ? mimeType : "image/png";
  return {
    type: "image_url",
    image_url: { url: `data:${type};base64,${base64Data}`, detail: "high" },
  };
}

/** Generate an image and return it as a PNG buffer. */
export async function generateImageBuffer(
  prompt: string,
  size: "1024x1024" | "1536x1024" | "1024x1536" = "1024x1024",
): Promise<Buffer> {
  const response = await getOpenAI().images.generate({
    model: OPENAI_IMAGE_MODEL,
    prompt,
    size,
  });
  const base64 = response.data?.[0]?.b64_json;
  if (!base64) throw new Error("Image generation returned no image data");
  return Buffer.from(base64, "base64");
}

/**
 * Research a question on the web using OpenAI's hosted web-search tool and
 * return the written-up findings as text. Returns an empty string if the
 * account or model does not have the tool available.
 */
export async function webResearch(prompt: string, opts: { model?: string } = {}): Promise<string> {
  const response = await getOpenAI().responses.create({
    model: opts.model || OPENAI_WEB_SEARCH_MODEL,
    tools: [{ type: "web_search" } as any],
    input: prompt,
  });
  return (response as any).output_text || "";
}
