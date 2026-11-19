#!/usr/bin/env node
/**
 * @an-ui-kit/tokens — WCAG 2.x contrast assertion. Zero dependencies, zero color libs.
 *
 * Reads src/tokens.json, resolves the semantic fg-1 / bg-1 aliases for the
 * light and dark themes, and checks the pair against AA normal text (4.5:1).
 * Any failing theme makes the process exit with code 1.
 *
 * The whole color pipe is implemented here:
 *   OKLCH -> OKLab -> linear sRGB -> (clamp) -> WCAG relative luminance
 *   contrast = (Llight + 0.05) / (Ldark + 0.05)
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_FILE = path.join(PKG_ROOT, "src", "tokens.json");

const THRESHOLD = 4.5; // WCAG 2.1/2.2 AA, normal-size text
const SAMPLE_TEXT = "The quick brown fox jumps over the lazy dog — 敏捷的棕色狐狸跳过懒狗";

const isToken = (node) =>
  node !== null && typeof node === "object" && !Array.isArray(node) && Object.hasOwn(node, "$value");

const getPath = (root, dotted) =>
  dotted.split(".").reduce((node, key) => (node === null || node === undefined ? undefined : node[key]), root);

function deref(root, token, seen = []) {
  if (!isToken(token)) throw new Error(`[contrast] expected a token, got ${JSON.stringify(token)}`);
  const raw = token.$value;
  if (typeof raw === "string" && /^\{[^{}]+\}$/.test(raw)) {
    const ref = raw.slice(1, -1);
    if (seen.includes(ref)) throw new Error(`[contrast] alias cycle: ${[...seen, ref].join(" -> ")}`);
    const target = getPath(root, ref);
    if (!target) throw new Error(`[contrast] unresolved alias {${ref}}`);
    return deref(root, target, [...seen, ref]);
  }
  return raw;
}

function requireOklch(token, label) {
  const value = deref(source, token);
  if (
    value === null ||
    typeof value !== "object" ||
    !Number.isFinite(value.l) ||
    !Number.isFinite(value.c) ||
    !Number.isFinite(value.h)
  ) {
    throw new Error(`[contrast] ${label} is not an OKLCH { l, c, h } token`);
  }
  return value;
}

/* ------------------------------------------------------------------ *
 * Self-implemented color math
 * ------------------------------------------------------------------ */

/** OKLCH -> OKLab -> linear sRGB (Björn Ottosson's published matrices). */
function oklchToLinearSrgb({ l, c, h }) {
  const hue = (h * Math.PI) / 180;
  const a = c * Math.cos(hue);
  const b = c * Math.sin(hue);

  const lPrime = l + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = l - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = lPrime ** 3;
  const m3 = mPrime ** 3;
  const s3 = sPrime ** 3;

  return {
    r: 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    g: -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    b: -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  };
}

const clamp01 = (value) => Math.min(1, Math.max(0, value));

/** sRGB gamma encoding (linear -> display), used for human-readable hex output. */
function linearToSrgb(value) {
  const v = clamp01(value);
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
}

/** WCAG 2.x relative luminance: 0.2126 R + 0.7152 G + 0.0722 B on linear sRGB. */
function relativeLuminance(oklch) {
  const rgb = oklchToLinearSrgb(oklch);
  return 0.2126 * clamp01(rgb.r) + 0.7152 * clamp01(rgb.g) + 0.0722 * clamp01(rgb.b);
}

/** WCAG 2.x contrast ratio, >= 1. */
function contrastRatio(first, second) {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

function toHex(oklch) {
  const rgb = oklchToLinearSrgb(oklch);
  const hex = (channel) =>
    Math.round(clamp01(linearToSrgb(clamp01(channel))) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(rgb.r)}${hex(rgb.g)}${hex(rgb.b)}`;
}

function formatOklch({ l, c, h }) {
  return `oklch(${Number((l * 100).toFixed(2))}% ${Number(c.toFixed(4))} ${Number(h.toFixed(2))})`;
}

/* ------------------------------------------------------------------ *
 * Load tokens + assert
 * ------------------------------------------------------------------ */
const source = JSON.parse(await readFile(SOURCE_FILE, "utf8"));
const semantic = source.color?.semantic;
if (!semantic) throw new Error("[contrast] missing color.semantic in src/tokens.json");

const themes = ["light", "dark"];
const results = [];

for (const theme of themes) {
  const themeTokens = semantic[theme];
  if (!themeTokens) throw new Error(`[contrast] missing color.semantic.${theme}`);

  const fg = requireOklch(themeTokens["fg-1"], `color.semantic.${theme}.fg-1`);
  const bg = requireOklch(themeTokens["bg-1"], `color.semantic.${theme}.bg-1`);
  if (!fg || !bg) throw new Error(`[contrast] missing fg-1/bg-1 in theme "${theme}"`);

  const ratio = contrastRatio(fg, bg);
  results.push({ theme, fg, bg, ratio, pass: ratio >= THRESHOLD });
}

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */
console.log(`@an-ui-kit/tokens — WCAG 2.x contrast check (AA normal text, threshold ${THRESHOLD}:1)`);
console.log(`sample: "${SAMPLE_TEXT}"`);
console.log("");

for (const { theme, fg, bg, ratio, pass } of results) {
  const status = pass ? "PASS" : "FAIL";
  console.log(
    `[${status}] ${theme.padEnd(5)} --an-color-fg-1 ${toHex(fg)} ${formatOklch(fg)} ` +
      `on --an-color-bg-1 ${toHex(bg)} ${formatOklch(bg)} -> ${ratio.toFixed(2)}:1`,
  );
}

const failed = results.filter((result) => !result.pass);
console.log("");
if (failed.length > 0) {
  console.error(
    `[contrast] FAILED: ${failed.map((result) => `${result.theme} ${result.ratio.toFixed(2)}:1`).join(", ")} ` +
      `(need >= ${THRESHOLD}:1)`,
  );
  process.exit(1);
}

console.log(`[contrast] OK — ${results.length}/${results.length} theme pairs meet AA ${THRESHOLD}:1`);
