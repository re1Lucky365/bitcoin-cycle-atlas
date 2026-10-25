import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('the current package version has release notes before packaging starts', () => {
  const {version}=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  const name=`RELEASE_V${version.split('.').slice(0,2).join('_')}.md`;
  const notes=readFileSync(new URL(`../docs/${name}`,import.meta.url),'utf8');
  assert.ok(notes.trim().length>100, `${name} must describe the release`);
});
