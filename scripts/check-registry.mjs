#!/usr/bin/env node
/**
 * Validate the generated shadcn registry against the CEM and the sources.
 *
 *   node scripts/check-registry.mjs [--manifest <path>] [--out <dir>]
 *
 * Checks, for every `registry/<tag>.json`:
 *   1. required shadcn registry-item fields are present and well typed;
 *   2. `meta` is a field-for-field copy of the CEM declaration;
 *   3. every `files[].content` is byte-identical to the source on disk;
 *   4. the item is dependency-free and every target stays inside
 *      `~/src/an-ui-kit/`.
 *
 * Exit code 1 on any failure, so CI can gate on it.
 */

import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_ROOT = resolve(ROOT, 'packages/elements/src');
const ITEM_SCHEMA = 'https://ui.shadcn.com/schema/registry-item.json';
const INDEX_SCHEMA = 'https://ui.shadcn.com/schema/registry.json';
const INSTALL_PREFIX = '~/src/an-ui-kit/';
const CONTRACT_KEYS = ['attributes', 'events', 'slots', 'cssProperties', 'cssParts'];

const args = parseArgs(process.argv.slice(2));
const manifestPath = resolve(ROOT, args.manifest ?? 'custom-elements-manifest.json');
const outDir = resolve(ROOT, args.out ?? 'registry');

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
      console.log('Usage: node scripts/check-registry.mjs [--manifest <path>] [--out <dir>]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

const errors = [];

/**
 * @param {boolean} condition
 * @param {string} message
 */
function check(condition, message) {
  if (!condition) errors.push(message);
}

/** @param {unknown} value */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Key-order independent JSON comparison. @param {unknown} value */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (isObject(value)) {
    /** @type {Record<string, unknown>} */
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = canonical(/** @type {Record<string, unknown>} */ (value)[key]);
    }
    return sorted;
  }
  return value;
}

/** @param {unknown} a @param {unknown} b */
function deepEqual(a, b) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

/**
 * @param {Record<string, unknown>} item
 * @param {string} where
 * @param {{ name: string, title: string, tag: string }[]} declarations
 */
async function checkItem(item, where, declarations) {
  check(item.$schema === ITEM_SCHEMA, `${where}: $schema must be ${ITEM_SCHEMA}`);
  check(typeof item.name === 'string' && item.name.length > 0, `${where}: name is required`);
  check(item.type === 'registry:ui', `${where}: type must be "registry:ui"`);
  check(typeof item.title === 'string' && item.title.length > 0, `${where}: title is required`);
  check(
    typeof item.description === 'string' && item.description.length > 0,
    `${where}: description is required`,
  );
  check(!('dependencies' in item), `${where}: must not declare dependencies (self-contained)`);
  check(
    !('devDependencies' in item),
    `${where}: must not declare devDependencies (self-contained)`,
  );
  check(!('registryDependencies' in item), `${where}: must not declare registryDependencies`);
  check(Array.isArray(item.files) && item.files.length > 0, `${where}: files must be a non-empty array`);

  const declaration = declarations.find((entry) => entry.tag === item.name);
  check(Boolean(declaration), `${where}: no CEM declaration with tagName "${String(item.name)}"`);

  const meta = item.meta;
  check(isObject(meta), `${where}: meta is required`);
  if (isObject(meta)) {
    check(meta.tagName === item.name, `${where}: meta.tagName must equal name`);
    if (declaration) {
      check(item.title === declaration.title, `${where}: title must equal the CEM class name`);
      for (const key of CONTRACT_KEYS) {
        check(
          deepEqual(meta[key], declaration[key]),
          `${where}: meta.${key} does not match the CEM`,
        );
      }
    }
  }

  const targets = new Set();
  for (const [index, file] of (Array.isArray(item.files) ? item.files : []).entries()) {
    const at = `${where}: files[${index}]`;
    if (!isObject(file)) {
      check(false, `${at} must be an object`);
      continue;
    }
    check(typeof file.path === 'string', `${at}.path is required`);
    check(file.type === 'registry:file', `${at}.type must be "registry:file"`);
    check(typeof file.target === 'string', `${at}.target is required`);
    check(typeof file.content === 'string', `${at}.content is required`);
    if (typeof file.target !== 'string' || typeof file.content !== 'string') continue;

    check(file.target.startsWith(INSTALL_PREFIX), `${at}.target must start with ${INSTALL_PREFIX}`);
    const rel = file.target.slice(INSTALL_PREFIX.length);
    check(rel.length > 0 && !rel.startsWith('..') && !rel.includes('..\\'), `${at}.target escapes the install root`);
    check(rel.split('/').every((part) => part.length > 0 && part !== '.'), `${at}.target is not a clean path`);
    check(!targets.has(rel), `${at}.target is duplicated`);
    targets.add(rel);

    const expectedPath = `registry/files/${rel}`;
    check(file.path === expectedPath, `${at}.path must be ${expectedPath}`);

    const sourceFile = join(SOURCE_ROOT, rel);
    try {
      const source = await readFile(sourceFile);
      check(
        Buffer.from(file.content, 'utf8').equals(source),
        `${at}.content is not byte-identical to ${relative(ROOT, sourceFile)}`,
      );
    } catch (error) {
      check(false, `${at}: cannot read source ${relative(ROOT, sourceFile)} (${error.message})`);
    }

    const mirrored = join(outDir, 'files', rel);
    try {
      const mirror = await readFile(mirrored);
      check(
        Buffer.from(file.content, 'utf8').equals(mirror),
        `${where}: ${relative(ROOT, mirrored)} does not mirror files[${index}].content`,
      );
    } catch {
      check(false, `${where}: mirror file missing: ${relative(ROOT, mirrored)}`);
    }
  }
}

/**
 * @param {Record<string, unknown>} index
 * @param {Record<string, Record<string, unknown>>} itemsByName
 * @param {string} where
 */
function checkIndex(index, itemsByName, where) {
  check(index.$schema === INDEX_SCHEMA, `${where}: $schema must be ${INDEX_SCHEMA}`);
  check(typeof index.name === 'string' && index.name.length > 0, `${where}: name is required`);
  check(
    typeof index.homepage === 'string' && index.homepage.length > 0,
    `${where}: homepage is required`,
  );
  check(Array.isArray(index.items) && index.items.length > 0, `${where}: items must be non-empty`);

  const listed = new Set();
  for (const [position, item] of (Array.isArray(index.items) ? index.items : []).entries()) {
    const at = `${where}: items[${position}]`;
    if (!isObject(item) || typeof item.name !== 'string') {
      check(false, `${at} must be an object with a name`);
      continue;
    }
    listed.add(item.name);
    const generated = itemsByName[item.name];
    if (!generated) {
      check(false, `${at}: "${item.name}" has no matching registry item`);
      continue;
    }
    check(item.type === generated.type, `${at}: type does not match the item`);
    check(item.title === generated.title, `${at}: title does not match the item`);
    check(deepEqual(item.meta, generated.meta), `${at}: meta does not match the item`);
    check(
      deepEqual(item.files, (generated.files ?? []).map(({ path, type, target }) => ({ path, type, target }))),
      `${at}: files do not match the item`,
    );
    check(!('dependencies' in item), `${at}: must not declare dependencies`);
  }

  for (const name of Object.keys(itemsByName)) {
    check(listed.has(name), `${where}: "${name}" is missing from items[]`);
  }
}

async function main() {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read ${relative(ROOT, manifestPath)}: ${error.message}`);
  }

  /** @type {{ name: string, title: string, tag: string, attributes?: unknown[], events?: unknown[], slots?: unknown[], cssProperties?: unknown[], cssParts?: unknown[] }[]} */
  const declarations = [];
  for (const module of manifest.modules ?? []) {
    for (const declaration of module.declarations ?? []) {
      if (declaration.customElement !== true || typeof declaration.tagName !== 'string') continue;
      declarations.push({
        name: declaration.name,
        title: declaration.name,
        tag: declaration.tagName,
        attributes: Array.isArray(declaration.attributes) ? declaration.attributes : [],
        events: Array.isArray(declaration.events) ? declaration.events : [],
        slots: Array.isArray(declaration.slots) ? declaration.slots : [],
        cssProperties: Array.isArray(declaration.cssProperties) ? declaration.cssProperties : [],
        cssParts: Array.isArray(declaration.cssParts) ? declaration.cssParts : [],
      });
    }
  }
  if (declarations.length === 0) {
    throw new Error(`No custom elements in ${relative(ROOT, manifestPath)}`);
  }

  /** @type {Record<string, Record<string, unknown>>} */
  const itemsByName = {};
  let itemFiles;
  try {
    itemFiles = (await readdir(outDir))
      .filter((entry) => entry.endsWith('.json') && entry !== 'index.json')
      .sort();
  } catch {
    throw new Error(`Cannot read ${relative(ROOT, outDir)} — run \`pnpm registry\` first.`);
  }
  if (itemFiles.length === 0) {
    throw new Error(`No registry items found in ${relative(ROOT, outDir)}`);
  }

  for (const entry of itemFiles) {
    const where = relative(ROOT, join(outDir, entry));
    let item;
    try {
      item = JSON.parse(await readFile(join(outDir, entry), 'utf8'));
    } catch (error) {
      errors.push(`${where}: invalid JSON (${error.message})`);
      continue;
    }
    if (!isObject(item)) {
      errors.push(`${where}: registry item must be an object`);
      continue;
    }
    await checkItem(item, where, declarations);
    if (typeof item.name === 'string') itemsByName[item.name] = item;
  }

  for (const declaration of declarations) {
    check(
      Object.prototype.hasOwnProperty.call(itemsByName, declaration.tag),
      `CEM declares <${declaration.tag}> but registry has no matching item`,
    );
  }

  const indexPath = join(outDir, 'index.json');
  try {
    const index = JSON.parse(await readFile(indexPath, 'utf8'));
    if (isObject(index)) checkIndex(index, itemsByName, relative(ROOT, indexPath));
    else errors.push(`${relative(ROOT, indexPath)}: index must be an object`);
  } catch (error) {
    errors.push(`${relative(ROOT, indexPath)}: invalid JSON (${error.message})`);
  }

  if (errors.length > 0) {
    for (const message of errors) console.error(`✖ ${message}`);
    console.error(`\n✖ registry check failed: ${errors.length} error(s)`);
    process.exit(1);
  }

  for (const [name, item] of Object.entries(itemsByName).sort(([a], [b]) => a.localeCompare(b))) {
    const count = Array.isArray(item.files) ? item.files.length : 0;
    console.log(`✔ registry/${name}.json — ${count} files, meta matches CEM`);
  }
  console.log(`✔ registry/index.json — ${Object.keys(itemsByName).length} component(s)`);
  console.log(`✔ registry check passed (${Object.keys(itemsByName).length} item(s), ${declarations.length} CEM declaration(s))`);
}

await main();
