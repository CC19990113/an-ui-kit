#!/usr/bin/env node
/**
 * @an-ui-kit/tokens build pipeline — zero third-party dependencies.
 *
 *   src/tokens.json  (DTCG-style source, colors in OKLCH)
 *     -> dist/tokens.css   :root / [data-theme] / prefers-color-scheme custom properties
 *     -> dist/tokens.ts    `export const tokens = {...} as const`
 *     -> dist/tokens.json  flattened artifact for AI/tooling
 *
 * Implements its own alias resolver ("{color.palette.blue.9}") and its own
 * CSS naming rules; no style-dictionary / no color library is involved.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_FILE = path.join(PKG_ROOT, "src", "tokens.json");
const DIST_DIR = path.join(PKG_ROOT, "dist");

/* ------------------------------------------------------------------ *
 * Naming contract (consumed by @an-ui-kit/elements) — keep in sync with README.
 * ------------------------------------------------------------------ */
const HUES = ["gray", "blue", "red", "green", "yellow"];
const STEPS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const SEMANTIC_NAMES = ["accent-9", "danger-9", "fg-1", "bg-1", "border-1"];
const SPACE_STEPS = Array.from({ length: 13 }, (_, i) => String(i));
const RADII = ["none", "sm", "md", "lg", "full"];
const FONT_SIZES = ["xs", "sm", "md", "lg", "xl", "xxl"];
const THEMES = ["light", "dark"];
const SEMANTIC_ORDER = ["accent-9", "danger-9", "fg-1", "bg-1", "border-1"];

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */
const isToken = (node) =>
  node !== null && typeof node === "object" && !Array.isArray(node) && Object.hasOwn(node, "$value");

const isOklch = (value) =>
  value !== null &&
  typeof value === "object" &&
  Number.isFinite(value.l) &&
  value.l >= 0 &&
  value.l <= 1 &&
  Number.isFinite(value.c) &&
  value.c >= 0 &&
  value.c <= 0.5 &&
  Number.isFinite(value.h) &&
  value.h >= 0 &&
  value.h < 360;

const fail = (message) => {
  throw new Error(`[tokens] ${message}`);
};

const getPath = (root, dotted) =>
  dotted.split(".").reduce((node, key) => (node === null || node === undefined ? undefined : node[key]), root);

/**
 * Follow DTCG-style aliases to the concrete value.
 * Returns { value, ref } where ref is the last alias target ("color.palette.gray.1"),
 * or undefined when the token holds a literal value.
 */
function deref(root, token, seen = []) {
  if (!isToken(token)) fail(`expected a token, got ${JSON.stringify(token)}`);
  const raw = token.$value;
  if (typeof raw === "string" && /^\{[^{}]+\}$/.test(raw)) {
    const ref = raw.slice(1, -1);
    if (seen.includes(ref)) fail(`alias cycle: ${[...seen, ref].join(" -> ")}`);
    const target = getPath(root, ref);
    if (!target) fail(`unresolved alias {${ref}}`);
    const resolved = deref(root, target, [...seen, ref]);
    return { value: resolved.value, ref };
  }
  return { value: raw, ref: undefined };
}

/** Dotted source path -> CSS custom property name. */
function cssNameForPath(dotted) {
  const parts = dotted.split(".");
  if (parts[0] === "color" && parts[1] === "palette") return `--an-color-${parts[2]}-${parts[3]}`;
  if (parts[0] === "color" && parts[1] === "semantic") return `--an-color-${parts[3]}`;
  if (parts[0] === "space") return `--an-space-${parts[1]}`;
  if (parts[0] === "radius") return `--an-radius-${parts[1]}`;
  if (parts[0] === "fontSize") return `--an-font-size-${parts[1]}`;
  return fail(`no CSS naming rule for "${dotted}"`);
}

/** 0.985, 0.008, 264 -> "oklch(98.5% 0.008 264)" */
function formatOklch({ l, c, h }) {
  const lightness = Number((l * 100).toFixed(2));
  const chroma = Number(c.toFixed(4));
  const hue = Number(h.toFixed(2));
  return `oklch(${lightness}% ${chroma} ${hue})`;
}

/* ------------------------------------------------------------------ *
 * Load + validate the token source
 * ------------------------------------------------------------------ */
const source = JSON.parse(await readFile(SOURCE_FILE, "utf8"));

const palette = source.color?.palette;
const semantic = source.color?.semantic;
if (!palette) fail("missing color.palette");
if (!semantic) fail("missing color.semantic");

for (const hue of HUES) {
  if (!palette[hue]) fail(`missing color.palette.${hue}`);
  for (const step of STEPS) {
    const token = palette[hue][step];
    if (!isToken(token)) fail(`missing color token color.palette.${hue}.${step}`);
    if (!isOklch(token.$value)) fail(`color.palette.${hue}.${step} must be { l, c, h } in OKLCH`);
  }
}

for (const theme of THEMES) {
  for (const name of SEMANTIC_NAMES) {
    const token = semantic[theme]?.[name];
    if (!isToken(token)) fail(`missing semantic token color.semantic.${theme}.${name}`);
    const { value } = deref(source, token);
    if (!isOklch(value)) fail(`color.semantic.${theme}.${name} must resolve to an OKLCH color`);
  }
}

for (const step of SPACE_STEPS) {
  const token = source.space?.[step];
  if (!isToken(token)) fail(`missing space.${step}`);
}
for (const radius of RADII) {
  if (!isToken(source.radius?.[radius])) fail(`missing radius.${radius}`);
}
for (const size of FONT_SIZES) {
  if (!isToken(source.fontSize?.[size])) fail(`missing fontSize.${size}`);
}

/* ------------------------------------------------------------------ *
 * dist/tokens.css
 * ------------------------------------------------------------------ */
function semanticAliasLines(theme, indent = "  ") {
  return SEMANTIC_ORDER.map((name) => {
    const { ref } = deref(source, semantic[theme][name]);
    return `${indent}${cssNameForPath(`color.semantic.${theme}.${name}`)}: var(${cssNameForPath(ref)});`;
  });
}

const css = [];
css.push("/* Generated by @an-ui-kit/tokens — scripts/build.mjs. Do not edit by hand. */");
css.push("/* Colors are OKLCH. Light is the default; dark comes from [data-theme=\"dark\"] */");
css.push('/* or from the system preference, while an explicit [data-theme="light"] wins. */');
css.push("");
css.push(":root {");
css.push("  color-scheme: light;");
css.push("");
css.push("  /* color palette — 1 lightest ... 12 darkest */");
for (const hue of HUES) {
  for (const step of STEPS) {
    const { value } = deref(source, palette[hue][step]);
    css.push(`  ${cssNameForPath(`color.palette.${hue}.${step}`)}: ${formatOklch(value)};`);
  }
}
css.push("");
css.push("  /* color semantic aliases (light) */");
css.push(...semanticAliasLines("light"));
css.push("");
css.push("  /* spacing — 4px steps */");
for (const step of SPACE_STEPS) {
  css.push(`  ${cssNameForPath(`space.${step}`)}: ${source.space[step].$value};`);
}
css.push("");
css.push("  /* radius */");
for (const radius of RADII) {
  css.push(`  ${cssNameForPath(`radius.${radius}`)}: ${source.radius[radius].$value};`);
}
css.push("");
css.push("  /* font size */");
for (const size of FONT_SIZES) {
  css.push(`  ${cssNameForPath(`fontSize.${size}`)}: ${source.fontSize[size].$value};`);
}
css.push("}");
css.push("");
css.push('[data-theme="dark"] {');
css.push("  color-scheme: dark;");
css.push("");
css.push("  /* color semantic aliases (dark) */");
css.push(...semanticAliasLines("dark"));
css.push("}");
css.push("");
css.push('[data-theme="light"] {');
css.push("  color-scheme: light;");
css.push("");
css.push("  /* explicit light: beats an inherited dark theme (e.g. system preference) */");
css.push(...semanticAliasLines("light"));
css.push("}");
css.push("");
css.push("@media (prefers-color-scheme: dark) {");
css.push('  :root:not([data-theme="light"]) {');
css.push("    color-scheme: dark;");
css.push("");
css.push("    /* color semantic aliases (dark, system preference) */");
css.push(...semanticAliasLines("dark", "    "));
css.push("  }");
css.push("}");
css.push("");

/* ------------------------------------------------------------------ *
 * dist/tokens.ts
 * ------------------------------------------------------------------ */
const tsTokens = { color: {}, space: {}, radius: {}, fontSize: {} };
for (const hue of HUES) {
  tsTokens.color[hue] = {};
  for (const step of STEPS) {
    const { value } = deref(source, palette[hue][step]);
    tsTokens.color[hue][step] = { l: value.l, c: value.c, h: value.h };
  }
}
tsTokens.color.semantic = { light: {}, dark: {} };
for (const theme of THEMES) {
  for (const name of SEMANTIC_NAMES) {
    const { value } = deref(source, semantic[theme][name]);
    tsTokens.color.semantic[theme][name] = { l: value.l, c: value.c, h: value.h };
  }
}
for (const step of SPACE_STEPS) tsTokens.space[step] = source.space[step].$value;
for (const radius of RADII) tsTokens.radius[radius] = source.radius[radius].$value;
for (const size of FONT_SIZES) tsTokens.fontSize[size] = source.fontSize[size].$value;

const TS_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** Serialize a JSON-ish value as a TypeScript literal with readable keys. */
function toTsLiteral(value, indent = 0) {
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const inner = value.map((item) => `${"  ".repeat(indent + 1)}${toTsLiteral(item, indent + 1)},`);
    return `[\n${inner.join("\n")}\n${"  ".repeat(indent)}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).map(
      ([key, item]) =>
        `${"  ".repeat(indent + 1)}${TS_IDENTIFIER.test(key) ? key : JSON.stringify(key)}: ${toTsLiteral(item, indent + 1)},`,
    );
    if (entries.length === 0) return "{}";
    return `{\n${entries.join("\n")}\n${"  ".repeat(indent)}}`;
  }
  return JSON.stringify(value);
}

const ts = [
  "/* Generated by @an-ui-kit/tokens — scripts/build.mjs. Do not edit by hand. */",
  "/* Colors are OKLCH: l/c in [0, 1], h in degrees. Semantic tokens are resolved. */",
  "",
  `export const tokens = ${toTsLiteral(tsTokens)} as const;`,
  "",
  "export type Tokens = typeof tokens;",
  "",
].join("\n");

/* ------------------------------------------------------------------ *
 * dist/tokens.json — flattened, resolved artifact for AI/tooling
 * ------------------------------------------------------------------ */
const flat = {
  $meta: {
    generator: "@an-ui-kit/tokens scripts/build.mjs",
    source: "packages/tokens/src/tokens.json",
    format: "flat dotted keys; every entry carries its CSS custom property",
    colorSpace: "OKLCH { l, c, h }; l/c in [0, 1], h in degrees",
    themes: THEMES,
    cssEntry: "dist/tokens.css",
  },
};
for (const hue of HUES) {
  for (const step of STEPS) {
    const { value } = deref(source, palette[hue][step]);
    flat[`color.palette.${hue}.${step}`] = {
      type: "color",
      cssVar: cssNameForPath(`color.palette.${hue}.${step}`),
      value: { l: value.l, c: value.c, h: value.h },
      css: formatOklch(value),
    };
  }
}
for (const theme of THEMES) {
  for (const name of SEMANTIC_NAMES) {
    const { value, ref } = deref(source, semantic[theme][name]);
    flat[`color.semantic.${theme}.${name}`] = {
      type: "color",
      theme,
      cssVar: cssNameForPath(`color.semantic.${theme}.${name}`),
      alias: `{${ref}}`,
      value: { l: value.l, c: value.c, h: value.h },
      css: formatOklch(value),
    };
  }
}
for (const step of SPACE_STEPS) {
  flat[`space.${step}`] = { type: "dimension", cssVar: cssNameForPath(`space.${step}`), value: source.space[step].$value };
}
for (const radius of RADII) {
  flat[`radius.${radius}`] = { type: "dimension", cssVar: cssNameForPath(`radius.${radius}`), value: source.radius[radius].$value };
}
for (const size of FONT_SIZES) {
  flat[`fontSize.${size}`] = { type: "dimension", cssVar: cssNameForPath(`fontSize.${size}`), value: source.fontSize[size].$value };
}

/* ------------------------------------------------------------------ *
 * Write artifacts
 * ------------------------------------------------------------------ */
await mkdir(DIST_DIR, { recursive: true });
await writeFile(path.join(DIST_DIR, "tokens.css"), css.join("\n"), "utf8");
await writeFile(path.join(DIST_DIR, "tokens.ts"), ts, "utf8");
await writeFile(path.join(DIST_DIR, "tokens.json"), JSON.stringify(flat, null, 2) + "\n", "utf8");

const paletteCount = HUES.length * STEPS.length;
const semanticCount = THEMES.length * SEMANTIC_NAMES.length;
console.log(
  `[tokens] built dist/tokens.css, dist/tokens.ts, dist/tokens.json ` +
    `(${paletteCount} palette + ${semanticCount} semantic colors, ${SPACE_STEPS.length + RADII.length + FONT_SIZES.length} scale tokens)`,
);
