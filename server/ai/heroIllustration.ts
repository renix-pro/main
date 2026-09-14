/**
 * RENIX — AI hero illustrations
 *
 * Project cards used to get an AI-generated PNG from an image model. Claude
 * does not render raster images, but it writes SVG well, so the hero is now a
 * Claude-authored vector illustration in the RENIX palette (cool neutrals,
 * copper accent, sage). The SVG is sanitized before it is stored and served
 * from the app origin: no scripts, event handlers, foreignObject, raster
 * images or external references survive.
 */
import { completeText } from "./claude";

export const HERO_WIDTH = 1024;
export const HERO_HEIGHT = 576;

const PALETTE = `Palette (use only these, plus white and soft gradients between them):
- Cool neutrals: #F4F5F7, #E6E8EC, #C9CDD4, #9AA0AB, #5C6370, #2E3440
- Copper accent: #B87333, #D9A066 (small, deliberate highlights only)
- Sage: #A8B5A0, #C8D2C2
- Warm paper: #F7F1EA`;

const SYSTEM_PROMPT = `You are an illustrator who produces clean, minimal, premium SVG artwork for a home-renovation planning app called RENIX.

Style: soft architectural illustration inspired by watercolor and flat design. Calm, aspirational, uncluttered. Layered simple shapes (rectangles, polygons, paths, circles) with subtle linear/radial gradients and low-opacity overlaps that read as washes of color. Generous negative space. Wide landscape composition with a low horizon.

${PALETTE}

Hard constraints:
- Output exactly one <svg> element and nothing else — no markdown fences, no prose.
- Root: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${HERO_WIDTH} ${HERO_HEIGHT}" width="${HERO_WIDTH}" height="${HERO_HEIGHT}"> with a full-bleed background rect.
- Only these elements: svg, defs, linearGradient, radialGradient, stop, g, rect, circle, ellipse, line, polyline, polygon, path, clipPath, mask, filter, feGaussianBlur.
- No text, letters, numbers, words, logos or signage. No people or animals.
- No <script>, <image>, <foreignObject>, <a>, <use> with external href, event-handler attributes, CSS url() to external resources, or anything referencing http(s).
- Keep it under 12,000 characters; prefer ~40-120 shapes over thousands of tiny paths.`;

export interface HeroIllustrationInput {
  projectName: string;
  projectType?: string | null;
  projectDescription?: string | null;
}

/** Ask Claude for a hero illustration and return sanitized SVG markup. */
export async function generateHeroSvg(input: HeroIllustrationInput): Promise<string> {
  const typeLabel = input.projectType || "home renovation";
  const desc = input.projectDescription?.trim() ? `\nProject description: ${input.projectDescription.trim().slice(0, 600)}` : "";
  const raw = await completeText({
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Create the hero illustration for this project.\nProject type: ${typeLabel}\nProject name: ${input.projectName}${desc}\n\nDepict the essence of this kind of project as an architectural scene or a composed abstract of its key elements (e.g. a kitchen run, a bathroom, a facade, a roofline, an extension, a garden). Remember: no text of any kind.`,
      },
    ],
    maxTokens: 32000,
  });
  const svg = extractSvg(raw);
  if (!svg) throw new Error("Model output did not contain an <svg> element");
  return sanitizeSvg(svg);
}

/** Pull the first <svg>…</svg> element out of arbitrary model output. */
export function extractSvg(raw: string): string | null {
  const start = raw.search(/<svg[\s>]/i);
  if (start < 0) return null;
  const end = raw.lastIndexOf("</svg>");
  if (end < start) return null;
  return raw.slice(start, end + "</svg>".length).trim();
}

const FORBIDDEN_ELEMENTS = ["script", "image", "foreignObject", "a", "iframe", "object", "embed", "video", "audio", "style", "animate", "animateTransform", "animateMotion", "set", "use"];

/**
 * Defensive sanitization for SVG that will be served from the app origin.
 * Removes active content and external references; keeps plain vector shapes.
 */
export function sanitizeSvg(svg: string): string {
  let out = svg;
  // Remove processing instructions, doctype, comments and CDATA.
  out = out.replace(/<\?[\s\S]*?\?>/g, "").replace(/<!DOCTYPE[\s\S]*?>/gi, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  // Drop forbidden elements, with their content where they have any.
  for (const el of FORBIDDEN_ELEMENTS) {
    out = out.replace(new RegExp(`<${el}\\b[\\s\\S]*?<\\/${el}\\s*>`, "gi"), "");
    out = out.replace(new RegExp(`<${el}\\b[^>]*\\/?>`, "gi"), "");
  }
  // Strip event handlers and any attribute carrying a javascript:/data:/http(s): value.
  out = out.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/\s+(href|xlink:href)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, (m, _name, value: string) =>
    /^["']?#/.test(value) ? m : "");
  out = out.replace(/\s+[a-zA-Z:-]+\s*=\s*("[^"]*(?:javascript:|data:|https?:)[^"]*"|'[^']*(?:javascript:|data:|https?:)[^']*')/gi, "");
  // Neutralize CSS url() references that are not local ids.
  out = out.replace(/url\(\s*(?!["']?#)[^)]*\)/gi, "none");
  if (!/^<svg[\s>]/i.test(out.trim()) || !/<\/svg>\s*$/i.test(out.trim())) {
    throw new Error("Sanitized output is not a well-formed <svg> element");
  }
  // Make sure the namespace is present so browsers render it standalone.
  if (!/xmlns\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["']/i.test(out)) {
    out = out.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return out.trim();
}
