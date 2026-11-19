/**
 * Read and query the Custom Elements Manifest (CEM) copied into this package
 * at build time from the repository-root `custom-elements-manifest.json`.
 *
 * The package does not scan component sources itself, so there is exactly one
 * CEM to keep in sync. This module never reads component source files and
 * never talks to the network.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Default manifest location, resolved next to this module (src/ or dist/). */
export const DEFAULT_MANIFEST_PATH = fileURLToPath(new URL('../manifest.json', import.meta.url));

/** Raised when the manifest is missing, unreadable, or not a CEM document. */
export class ManifestError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'ManifestError';
  }
}

function typeText(type) {
  if (!type) return '';
  if (typeof type === 'string') return type;
  return typeof type.text === 'string' ? type.text : '';
}

/**
 * x-cem writes attribute defaults into the JSDoc sentence (`Default: "md".`)
 * instead of a dedicated CEM field, so recover them from the description.
 */
function defaultFromDescription(description = '') {
  const match = /Default:\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`|([^.;\s]+))/i.exec(description);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? match[4] ?? null;
}

/**
 * x-cem 0.1.1 emits a CEM subset without class-level descriptions. When a
 * newer scanner starts emitting `description`, it is used as-is; otherwise a
 * factual one-liner is composed from the manifest (never from hand-written
 * prose) so `list_components` stays useful and in sync.
 */
function describeDeclaration(declaration) {
  const description = typeof declaration.description === 'string' ? declaration.description.trim() : '';
  if (description) return description;

  const parts = [`<${declaration.tagName}> (${declaration.name}) custom element.`];
  const attributes = (declaration.attributes ?? []).map((attribute) => attribute.name).filter(Boolean);
  const events = (declaration.events ?? []).map((event) => event.name).filter(Boolean);
  if (attributes.length > 0) parts.push(`Attributes: ${attributes.join(', ')}.`);
  if (events.length > 0) parts.push(`Events: ${events.join(', ')}.`);
  return parts.join(' ');
}

function defaultOf(attribute) {
  // x-cem 0.1.2+ is expected to emit a structured `default`; 0.1.1 only
  // writes `Default: "..."` into the description, so support both.
  if (attribute.default !== undefined && attribute.default !== null) return attribute.default;
  return defaultFromDescription(attribute.description ?? '');
}

function normalizeComponent(declaration) {
  return {
    tagName: declaration.tagName,
    name: declaration.name,
    description: describeDeclaration(declaration),
    attributes: (declaration.attributes ?? []).map((attribute) => ({
      name: attribute.name,
      type: typeText(attribute.type),
      default: defaultOf(attribute),
      description: attribute.description ?? '',
    })),
    events: (declaration.events ?? []).map((event) => ({
      name: event.name,
      description: event.description ?? '',
    })),
    slots: (declaration.slots ?? []).map((slot) => ({
      name: slot.name ?? '',
      description: slot.description ?? '',
    })),
    cssProperties: (declaration.cssProperties ?? []).map((property) => ({
      name: property.name,
      description: property.description ?? '',
    })),
    cssParts: (declaration.cssParts ?? []).map((part) => ({
      name: part.name,
      description: part.description ?? '',
    })),
  };
}

/**
 * Load `manifest.json` into a queryable store.
 *
 * @param {string} [manifestPath]
 * @returns {{ source: string, schemaVersion: string, components: object[] }}
 */
export function loadManifest(manifestPath = DEFAULT_MANIFEST_PATH) {
  let raw;
  try {
    raw = readFileSync(manifestPath, 'utf8');
  } catch (error) {
    throw new ManifestError(
      `Cannot read the Custom Elements Manifest at ${manifestPath} (${error.code ?? error.message}). ` +
        'Generate the repo-root manifest with "pnpm cem", then run "pnpm --filter @an-ui-kit/mcp build" to copy it here.',
      { cause: error },
    );
  }

  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (error) {
    throw new ManifestError(`Manifest ${manifestPath} is not valid JSON: ${error.message}`, { cause: error });
  }

  if (!manifest || !Array.isArray(manifest.modules)) {
    throw new ManifestError(`Manifest ${manifestPath} is not a Custom Elements Manifest (missing "modules" array).`);
  }

  const components = [];
  const seen = new Set();
  for (const module of manifest.modules) {
    for (const declaration of module.declarations ?? []) {
      if (declaration.customElement !== true || typeof declaration.tagName !== 'string') continue;
      if (seen.has(declaration.tagName)) continue;
      seen.add(declaration.tagName);
      components.push(normalizeComponent(declaration));
    }
  }
  components.sort((a, b) => a.tagName.localeCompare(b.tagName));

  return {
    source: manifestPath,
    schemaVersion: typeof manifest.schemaVersion === 'string' ? manifest.schemaVersion : 'unknown',
    components,
  };
}

/** Component summaries returned by `list_components` and `search_components`. */
export function listComponents(store) {
  return store.components.map(({ tagName, name, description }) => ({ tagName, name, description }));
}

/** Find one component by tag name (case-insensitive); returns `undefined` when absent. */
export function getComponent(store, tagName) {
  if (typeof tagName !== 'string') return undefined;
  const needle = tagName.trim().toLowerCase();
  if (!needle) return undefined;
  return store.components.find((component) => component.tagName.toLowerCase() === needle);
}

/**
 * Fuzzy search across tag name, class name, description, and attribute names.
 * Every whitespace-separated term must match somewhere; stronger hits rank first.
 */
export function searchComponents(store, query) {
  if (typeof query !== 'string') return [];
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const ranked = [];
  for (const component of store.components) {
    const matches = new Set();
    let score = 0;
    let matchedAll = true;

    for (const term of terms) {
      let hit = false;

      if (component.tagName.toLowerCase() === term) {
        score += 100;
        matches.add(`tag:${component.tagName}`);
        hit = true;
      } else if (component.name.toLowerCase() === term) {
        score += 100;
        matches.add(`name:${component.name}`);
        hit = true;
      } else if (component.tagName.toLowerCase().includes(term) || component.name.toLowerCase().includes(term)) {
        score += 40;
        matches.add('name');
        hit = true;
      }

      const exactAttribute = component.attributes.find((attribute) => attribute.name.toLowerCase() === term);
      if (exactAttribute) {
        score += 30;
        matches.add(`attribute:${exactAttribute.name}`);
        hit = true;
      } else if (component.attributes.some((attribute) => attribute.name.toLowerCase().includes(term))) {
        score += 15;
        matches.add('attribute');
        hit = true;
      }

      if (component.description.toLowerCase().includes(term)) {
        score += 5;
        matches.add('description');
        hit = true;
      }

      if (!hit) {
        matchedAll = false;
        break;
      }
    }

    if (matchedAll) {
      ranked.push({
        score,
        result: {
          tagName: component.tagName,
          name: component.name,
          description: component.description,
          matches: [...matches],
        },
      });
    }
  }

  ranked.sort((a, b) => b.score - a.score || a.result.tagName.localeCompare(b.result.tagName));
  return ranked.map((entry) => entry.result);
}
