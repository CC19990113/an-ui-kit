#!/usr/bin/env node
/**
 * Generate shadcn-compatible registry items from the Custom Elements Manifest.
 *
 *   node scripts/gen-registry.mjs [--manifest <path>] [--out <dir>]
 *
 * Zero third-party dependencies: Node built-ins only.
 *
 * The CEM is the single source of truth for the machine-readable contract
 * (attributes / events / slots / cssProperties / cssParts). Every component is
 * emitted as a self-contained file set: its whole relative import graph is
 * copied too, so `shadcn add` produces a tree that resolves without any npm
 * package. The component source is inlined as-is because the CLI copies files
 * verbatim.
 */

import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_ROOT = resolve(ROOT, 'packages/elements/src');
const REGISTRY_ITEM_SCHEMA = 'https://ui.shadcn.com/schema/registry-item.json';
const REGISTRY_SCHEMA = 'https://ui.shadcn.com/schema/registry.json';
const HOMEPAGE = 'https://github.com/CC19990113/an-ui-kit';
const INSTALL_ROOT = '~/src/an-ui-kit';

const args = parseArgs(process.argv.slice(2));
const manifestPath = resolve(ROOT, args.manifest ?? 'custom-elements-manifest.json');
const outDir = resolve(ROOT, args.out ?? 'registry');
const filesDir = join(outDir, 'files');

/** @param {string[]} argv */
function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--manifest' || arg === '--out') {
      const value = argv[i + 1];
      if (!value) throw new Error(`${arg} needs a value`);
      parsed[arg.slice(2)] = value;
      i += 1;
    } else if (arg === '-h' || arg === '--help') {
      console.log('Usage: node scripts/gen-registry.mjs [--manifest <path>] [--out <dir>]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

/**
 * First paragraph of the JSDoc block directly above `export class <name>`.
 * x-cem 0.1.x emits a CEM subset without the declaration-level description, so
 * this is the fallback; a description already present in the CEM always wins.
 *
 * @param {string} source
 * @param {string} className
 * @returns {string | undefined}
 */
function jsdocSummary(source, className) {
  const pattern = new RegExp(
    `/\\*\\*((?:(?!\\*\\/)[\\s\\S])*)\\*\\/\\s*export\\s+(?:default\\s+)?class\\s+${className}\\b`,
  );
  const match = source.match(pattern);
  if (!match) return undefined;

  const body = match[1]
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s?/, '').trimEnd());
  const lines = [];
  for (const line of body) {
    const trimmed = line.trim();
    if (trimmed.startsWith('@')) break;
    if (trimmed === '') {
      if (lines.length > 0) break;
      continue;
    }
    lines.push(trimmed);
  }
  const summary = lines.join(' ').replace(/\s+/g, ' ').trim();
  return summary || undefined;
}

/**
 * Module specifiers referenced by static/dynamic imports and re-exports.
 *
 * @param {string} source
 * @returns {string[]}
 */
function moduleSpecifiers(source) {
  const specifiers = new Set();
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
  }
  return [...specifiers];
}

/** @param {string} specifier */
function isRelative(specifier) {
  return specifier.startsWith('./') || specifier.startsWith('../');
}

/**
 * Resolve a relative import to a real file. Extensionless specifiers are
 * supported because the component sources use extensionless imports.
 *
 * @param {string} fromFile
 * @param {string} specifier
 * @returns {Promise<string>}
 */
async function resolveModule(fromFile, specifier) {
  const stripped = specifier.replace(/[?#].*$/, '');
  const base = resolve(dirname(fromFile), stripped);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mts`,
    `${base}.js`,
    `${base}.mjs`,
    `${base}.css`,
    join(base, 'index.ts'),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try the next candidate
    }
  }
  throw new Error(`Cannot resolve "${specifier}" imported by ${relative(ROOT, fromFile)}`);
}

/**
 * Ambient type declarations at the source root (e.g. `css.d.ts` for
 * `*.css?inline` imports) apply to every component, so they are emitted first.
 *
 * @returns {Promise<string[]>}
 */
async function ambientDeclarations() {
  const entries = await readdir(SOURCE_ROOT, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.d.ts'))
    .map((entry) => join(SOURCE_ROOT, entry.name))
    .sort();
}

/**
 * Depth-first import graph, dependencies before dependents.
 *
 * @param {string} entry
 * @returns {Promise<string[]>}
 */
async function collectDependencyGraph(entry) {
  const seen = new Set();
  const ordered = [];

  /** @param {string} file */
  async function visit(file) {
    if (seen.has(file)) return;
    seen.add(file);

    if (/\.(?:[cm]?[jt]sx?)$/.test(file)) {
      const source = await readFile(file, 'utf8');
      for (const specifier of moduleSpecifiers(source)) {
        if (!isRelative(specifier)) continue;
        await visit(await resolveModule(file, specifier));
      }
    }
    ordered.push(file);
  }

  await visit(entry);
  return ordered;
}

/** @param {unknown} value */
function contract(value) {
  return Array.isArray(value) ? value : [];
}

async function main() {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Cannot read ${relative(ROOT, manifestPath)} — run \`pnpm cem\` first. ${error.message}`,
    );
  }

  await mkdir(filesDir, { recursive: true });

  const items = [];
  for (const module of manifest.modules ?? []) {
    if (module.kind !== 'javascript-module' || typeof module.path !== 'string') continue;

    const sourcePath = resolve(ROOT, module.path);
    const source = await readFile(sourcePath, 'utf8');

    for (const declaration of module.declarations ?? []) {
      if (declaration.customElement !== true || typeof declaration.tagName !== 'string') continue;

      const tagName = declaration.tagName;
      const title = declaration.name;
      const description =
        declaration.description ??
        module.description ??
        jsdocSummary(source, title) ??
        `<${tagName}> custom element.`;

      const files = [];
      for (const absolute of [...(await ambientDeclarations()), ...(await collectDependencyGraph(sourcePath))]) {
        const rel = relative(SOURCE_ROOT, absolute).split(sep).join('/');
        if (rel.startsWith('..')) {
          throw new Error(`Component dependency escapes packages/elements/src: ${absolute}`);
        }
        const content = await readFile(absolute, 'utf8');
        files.push({
          path: `registry/files/${rel}`,
          content,
          type: 'registry:file',
          target: `${INSTALL_ROOT}/${rel}`,
        });
        await mkdir(dirname(join(filesDir, rel)), { recursive: true });
        await writeFile(join(filesDir, rel), content, 'utf8');
      }

      const item = {
        $schema: REGISTRY_ITEM_SCHEMA,
        name: tagName,
        type: 'registry:ui',
        title,
        description,
        files,
        meta: {
          tagName,
          attributes: contract(declaration.attributes),
          events: contract(declaration.events),
          slots: contract(declaration.slots),
          cssProperties: contract(declaration.cssProperties),
          cssParts: contract(declaration.cssParts),
        },
      };

      await writeFile(join(outDir, `${tagName}.json`), `${JSON.stringify(item, null, 2)}\n`, 'utf8');
      items.push(item);
    }
  }

  if (items.length === 0) {
    throw new Error(`No custom elements found in ${relative(ROOT, manifestPath)}`);
  }

  items.sort((a, b) => a.name.localeCompare(b.name));

  const index = {
    $schema: REGISTRY_SCHEMA,
    name: 'an-ui-kit',
    homepage: HOMEPAGE,
    items: items.map((item) => ({
      name: item.name,
      type: item.type,
      title: item.title,
      description: item.description,
      files: item.files.map(({ path, type, target }) => ({ path, type, target })),
      meta: item.meta,
    })),
  };

  await writeFile(join(outDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8');

  for (const item of items) {
    console.log(`registry/${item.name}.json (${item.files.length} files)`);
  }
  console.log(`registry/index.json (${items.length} component${items.length === 1 ? '' : 's'})`);
}

await main();
