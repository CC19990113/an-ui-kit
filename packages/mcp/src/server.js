/**
 * x-elements MCP server (stdio).
 *
 * Exposes the generated Custom Elements Manifest as three read-only tools so
 * an AI agent can look up the real component contract instead of guessing:
 * `list_components`, `get_component`, `search_components`.
 *
 * stdout carries JSON-RPC only; every log line goes to stderr.
 */
import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  ManifestError,
  getComponent,
  listComponents,
  loadManifest,
  searchComponents,
} from './manifest.js';

function packageVersion() {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const VERSION = packageVersion();
const manifestPath = process.env.X_ELEMENTS_MCP_MANIFEST?.trim() || undefined;

let store;
try {
  store = loadManifest(manifestPath);
} catch (error) {
  const detail = error instanceof ManifestError ? error.message : String(error);
  console.error(`[x-elements-mcp] failed to start: ${detail}`);
  process.exit(1);
}

const asJson = (value) => ({
  content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
});
const asError = (text) => ({ content: [{ type: 'text', text }], isError: true });

function availableNames() {
  const names = store.components.map((component) => component.tagName);
  return names.length > 0
    ? names.join(', ')
    : '(none — run "pnpm cem" then "pnpm --filter @x/mcp build")';
}

/** Keep a handler failure a tool error instead of a crashed process. */
function guarded(label, handler) {
  return async (args) => {
    try {
      return await handler(args);
    } catch (error) {
      console.error(`[x-elements-mcp] ${label} failed: ${error?.stack ?? error}`);
      return asError(`${label} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
}

const server = new McpServer({
  name: 'x-elements',
  title: 'x-elements component contracts',
  version: VERSION,
  instructions:
    'x-elements component contracts. Call list_components first, then get_component({ tagName }) before writing UI code. ' +
    'Only use attributes and events returned by the manifest; in React 19, listen to an event with "on" + its exact name ' +
    '(x-button-click -> onx-button-click).',
});

server.registerTool(
  'list_components',
  {
    title: 'List x-elements components',
    description:
      'List every custom element in the x-elements manifest with its tag name, class name, and a short description. ' +
      'Use this first to discover which components exist; call get_component for the full contract.',
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  guarded('list_components', async () => asJson(listComponents(store))),
);

server.registerTool(
  'get_component',
  {
    title: 'Get one component contract',
    description:
      'Return the complete contract of a single x-elements component: attributes (name, declared type, default, description), ' +
      'events, slots, CSS custom properties, and CSS parts. Attribute types are verbatim CEM type text such as ' +
      "\"('default'|'primary'|'danger'|'ghost')\". Only use attributes returned here.",
    inputSchema: {
      tagName: z
        .string()
        .min(1)
        .describe('Custom element tag name as written in HTML, e.g. "x-button".'),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  guarded('get_component', async ({ tagName }) => {
    const component = getComponent(store, tagName);
    if (!component) {
      return asError(
        `Unknown component "${String(tagName).trim()}". Available components: ${availableNames()}. ` +
          'Call list_components to discover the full list.',
      );
    }
    return asJson(component);
  }),
);

server.registerTool(
  'search_components',
  {
    title: 'Search x-elements components',
    description:
      'Fuzzy-search x-elements components. Matches whitespace-separated terms against tag names, class names, descriptions, ' +
      'and attribute names (case-insensitive); every term must match. Returns matching components plus why each matched.',
    inputSchema: {
      query: z
        .string()
        .min(1)
        .describe('Search terms, e.g. "button", "variant", "loading button", or "primary".'),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  guarded('search_components', async ({ query }) => {
    const trimmed = String(query).trim();
    if (!trimmed) {
      return asError(`search_components needs a non-empty query. Available components: ${availableNames()}.`);
    }
    const results = searchComponents(store, trimmed);
    return asJson({ query: trimmed, count: results.length, results });
  }),
);

const transport = new StdioServerTransport();
await server.connect(transport);

console.error(
  `[x-elements-mcp] v${VERSION} ready on stdio — ${store.components.length} component(s) ` +
    `from ${store.source} (CEM ${store.schemaVersion})`,
);
