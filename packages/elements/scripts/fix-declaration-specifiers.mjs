import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const dist = fileURLToPath(new URL('../dist', import.meta.url));

// NodeNext requires explicit extensions in ESM declarations. TypeScript
// resolves these .js specifiers to .d.ts files, even in a single-bundle package.
function addJsExtensions(fileName, text) {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest);
  const insertions = [];

  function record(specifier) {
    if (!specifier || !ts.isStringLiteralLike(specifier)) return;
    const { text: path } = specifier;
    if ((path.startsWith('./') || path.startsWith('../')) && !posix.extname(path)) {
      insertions.push(specifier.getEnd() - 1);
    }
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      record(node.moduleSpecifier);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      record(node.argument.literal);
    } else if (ts.isExternalModuleReference(node)) {
      record(node.expression);
    } else if (ts.isModuleDeclaration(node)) {
      record(node.name);
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  for (const offset of insertions.sort((a, b) => b - a)) {
    text = `${text.slice(0, offset)}.js${text.slice(offset)}`;
  }
  return text;
}

for (const entry of readdirSync(dist, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.d.ts')) continue;
  const fileName = join(entry.parentPath, entry.name);
  const text = readFileSync(fileName, 'utf8');
  const rewritten = addJsExtensions(fileName, text);
  if (rewritten !== text) writeFileSync(fileName, rewritten);
}
