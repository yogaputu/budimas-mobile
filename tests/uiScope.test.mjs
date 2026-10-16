import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parse, compileStyle } from '@vue/compiler-sfc';
import * as icons from '@fortawesome/free-solid-svg-icons';

test('theme ancestors retain the component selector, not a bare html/body rule', () => {
  for (const name of readdirSync(new URL('../src/views/', import.meta.url)).filter(n => n.endsWith('.vue'))) {
    const source = readFileSync(new URL('../src/views/' + name, import.meta.url), 'utf8');
    const { descriptor } = parse(source);
    if (!name.includes('copy')) assert.deepEqual(parse(source).errors, [], `${name}: Vue template must remain valid`);
    for (const style of descriptor.styles.filter(s => s.scoped)) {
      assert.doesNotMatch(style.content, /:global\((?:html|body|:root)[^()]*\)[ \t]+[\w.#:*\[]/, name);
      const compiled = compileStyle({ source: style.content, id: 'data-v-ui-test', scoped: true });
      assert.deepEqual(compiled.errors, [], name);
    }
  }
});

test('Vue keeps dark selectors on the intended card and excludes light mode', () => {
  const { code } = compileStyle({ source: "html[data-theme='dark'] .card { color: white; }", id: 'data-v-test', scoped: true });
  assert.match(code, /html\[data-theme='dark'\] \.card\[data-v-test\]/);
  assert.doesNotMatch(code, /html\[data-theme='dark'\]\s*\{/);
});

test('literal Font Awesome icons used by Sales menus are registered', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const registered = main.match(/library.add\(([\s\S]*?)\);/)[1].match(/\bfa[A-Z]\w+/g);
  const names = new Set(registered.flatMap(name => icons[name]
    ? [icons[name].iconName, ...icons[name].icon[2].filter(alias => typeof alias === 'string')]
    : []));
  for (const file of readdirSync(new URL('../src/views/', import.meta.url)).filter(n => n.endsWith('.vue') && !n.includes('copy'))) {
    const template = parse(readFileSync(new URL('../src/views/' + file, import.meta.url), 'utf8')).descriptor.template?.content || '';
    for (const [, name] of template.matchAll(/(?<!:)\bicon="([a-z][a-z-]+)"/g)) assert.ok(names.has(name), `${file}: missing icon ${name}`);
  }
});
