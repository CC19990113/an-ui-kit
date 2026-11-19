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
  client = new Client({ name: 'an-ui-kit-mcp-test', version: '0.0.0' });
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

test('list_components returns both components', async () => {
  const components = textPayload(await client.callTool({ name: 'list_components', arguments: {} }));

  assert.deepEqual(
    components.map((component) => component.tagName),
    ['an-button', 'an-input'],
  );
  const button = components.find((component) => component.tagName === 'an-button');
  assert.equal(button.name, 'AnButton');
  assert.ok(button.description.length > 0, 'description should not be empty');

  const input = components.find((component) => component.tagName === 'an-input');
  assert.equal(input.name, 'AnInput');
  assert.ok(input.description.length > 0, 'description should not be empty');
});

test('get_component returns the full an-button contract', async () => {
  const component = textPayload(
    await client.callTool({ name: 'get_component', arguments: { tagName: 'an-button' } }),
  );

  const variant = component.attributes.find((attribute) => attribute.name === 'variant');
  assert.ok(variant, 'variant attribute should exist');
  assert.equal(variant.type, "('default'|'primary'|'danger'|'ghost')");
  assert.equal(variant.default, 'default');
  assert.deepEqual(
    component.attributes.map((attribute) => attribute.name),
    ['variant', 'size', 'disabled', 'loading', 'type'],
  );
  assert.equal(component.events[0].name, 'an-button-click');
  assert.equal(component.slots[0].name, '');
  assert.ok(component.cssProperties.some((property) => property.name === '--an-button-height'));
  assert.ok(component.cssParts.some((part) => part.name === 'base'));
  assert.equal(component.description.length > 0, true);
});

test('get_component returns the full an-input contract', async () => {
  const component = textPayload(
    await client.callTool({ name: 'get_component', arguments: { tagName: 'an-input' } }),
  );

  // 与 custom-elements-manifest.json 逐字一致：10 个 attribute、2 个事件、8 个 CSS 变量、3 个 part。
  assert.deepEqual(
    component.attributes.map((attribute) => attribute.name),
    ['value', 'type', 'placeholder', 'label', 'size', 'disabled', 'readonly', 'required', 'invalid', 'name'],
  );
  const value = component.attributes.find((attribute) => attribute.name === 'value');
  assert.equal(value.type, 'string');
  assert.match(value.description, /read once/i);
  assert.equal(component.attributes.find((attribute) => attribute.name === 'size').default, 'md');
  assert.equal(component.attributes.find((attribute) => attribute.name === 'type').default, 'text');

  assert.deepEqual(
    component.events.map((event) => event.name),
    ['an-input', 'an-change'],
  );
  assert.deepEqual(component.slots, []);
  assert.deepEqual(
    component.cssProperties.map((property) => property.name),
    [
      '--an-input-height',
      '--an-input-bg',
      '--an-input-fg',
      '--an-input-border-color',
      '--an-input-radius',
      '--an-input-font-size',
      '--an-input-padding-x',
      '--an-input-focus-ring',
    ],
  );
  assert.deepEqual(
    component.cssParts.map((part) => part.name),
    ['base', 'label', 'input'],
  );
  assert.equal(component.description.length > 0, true);
});

test('get_component tag lookup is case-insensitive', async () => {
  const component = textPayload(
    await client.callTool({ name: 'get_component', arguments: { tagName: '  AN-Button  ' } }),
  );
  assert.equal(component.tagName, 'an-button');
});

test('unknown tagName returns a clear tool error, not a crash', async () => {
  const result = await client.callTool({ name: 'get_component', arguments: { tagName: 'an-nope' } });

  assert.equal(result.isError, true);
  const text = result.content[0].text;
  assert.match(text, /Unknown component "an-nope"/);
  assert.match(text, /Available components: an-button, an-input/);

  // The server must still answer after the error.
  const components = textPayload(await client.callTool({ name: 'list_components', arguments: {} }));
  assert.equal(components.length, 2);
});

test('search_components matches name, attribute, and miss', async () => {
  const byAttribute = textPayload(
    await client.callTool({ name: 'search_components', arguments: { query: 'variant' } }),
  );
  assert.equal(byAttribute.count, 1);
  assert.equal(byAttribute.results[0].tagName, 'an-button');
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
