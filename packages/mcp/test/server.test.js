/**
 * End-to-end smoke test: spawn the real stdio server and talk MCP to it with
 * the official client, exactly the way an agent host would.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));

let client;

before(async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['src/server.js'],
    cwd: packageRoot,
    stderr: 'pipe',
  });
  client = new Client({ name: 'x-elements-mcp-test', version: '0.0.0' });
  await client.connect(transport);
});

after(async () => {
  await client?.close();
});

function textPayload(result) {
  assert.equal(result.content?.[0]?.type, 'text', 'tool result should contain a text block');
  return JSON.parse(result.content[0].text);
}

test('tools/list exposes the three contract tools', async () => {
  const { tools } = await client.listTools();
  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  assert.deepEqual([...byName.keys()].sort(), ['get_component', 'list_components', 'search_components']);
  assert.equal(byName.get('get_component').inputSchema.required[0], 'tagName');
  assert.equal(byName.get('get_component').inputSchema.properties.tagName.type, 'string');
  assert.equal(byName.get('search_components').inputSchema.properties.query.type, 'string');
  assert.equal(byName.get('list_components').inputSchema.type, 'object');
});

test('list_components returns x-button', async () => {
  const components = textPayload(await client.callTool({ name: 'list_components', arguments: {} }));
  const button = components.find((component) => component.tagName === 'x-button');

  assert.ok(button, 'x-button should be listed');
  assert.equal(button.name, 'XButton');
  assert.ok(button.description.length > 0, 'description should not be empty');
});

test('get_component returns the full x-button contract', async () => {
  const component = textPayload(
    await client.callTool({ name: 'get_component', arguments: { tagName: 'x-button' } }),
  );

  const variant = component.attributes.find((attribute) => attribute.name === 'variant');
  assert.ok(variant, 'variant attribute should exist');
  assert.equal(variant.type, "('default'|'primary'|'danger'|'ghost')");
  assert.equal(variant.default, 'default');
  assert.deepEqual(
    component.attributes.map((attribute) => attribute.name),
    ['variant', 'size', 'disabled', 'loading', 'type'],
  );
  assert.equal(component.events[0].name, 'x-button-click');
  assert.equal(component.slots[0].name, '');
  assert.ok(component.cssProperties.some((property) => property.name === '--x-button-height'));
  assert.ok(component.cssParts.some((part) => part.name === 'base'));
  assert.equal(component.description.length > 0, true);
});

test('get_component tag lookup is case-insensitive', async () => {
  const component = textPayload(
    await client.callTool({ name: 'get_component', arguments: { tagName: '  X-Button  ' } }),
  );
  assert.equal(component.tagName, 'x-button');
});

test('unknown tagName returns a clear tool error, not a crash', async () => {
  const result = await client.callTool({ name: 'get_component', arguments: { tagName: 'x-nope' } });

  assert.equal(result.isError, true);
  const text = result.content[0].text;
  assert.match(text, /Unknown component "x-nope"/);
  assert.match(text, /Available components: x-button/);

  // The server must still answer after the error.
  const components = textPayload(await client.callTool({ name: 'list_components', arguments: {} }));
  assert.equal(components.length, 1);
});

test('search_components matches name, attribute, and miss', async () => {
  const byAttribute = textPayload(
    await client.callTool({ name: 'search_components', arguments: { query: 'variant' } }),
  );
  assert.equal(byAttribute.count, 1);
  assert.equal(byAttribute.results[0].tagName, 'x-button');
  assert.ok(byAttribute.results[0].matches.includes('attribute:variant'));

  const byName = textPayload(
    await client.callTool({ name: 'search_components', arguments: { query: 'BUTTON' } }),
  );
  assert.equal(byName.count, 1);

  const miss = textPayload(
    await client.callTool({ name: 'search_components', arguments: { query: 'nonexistent-widget' } }),
  );
  assert.equal(miss.count, 0);
  assert.deepEqual(miss.results, []);
});
