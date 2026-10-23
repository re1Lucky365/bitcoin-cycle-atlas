import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
const image=await readFile(new URL('../dist/social-preview.png',import.meta.url));
const meta=(attribute,key)=>{
  const matches=[...html.matchAll(new RegExp(`<meta ${attribute}="${key}" content="([^"]+)"`, 'g'))];
  assert.equal(matches.length,1,`${key} must be unique`);return matches[0][1];
};

test('social cards point to one public PNG under the real Pages subpath',()=>{
  const og=new URL(meta('property','og:image')),twitter=new URL(meta('name','twitter:image'));
  assert.equal(og.href,twitter.href);
  assert.equal(og.origin,'https://twoimo.github.io');
  assert.equal(og.pathname,'/bitcoin-cycle-atlas/social-preview.png');
  assert.ok(og.searchParams.has('v'),'changed artwork has a crawler cache key');
  assert.equal(meta('name','twitter:card'),'summary_large_image');
  assert.equal(meta('property','og:url'),'https://twoimo.github.io/bitcoin-cycle-atlas/');
  assert.ok(meta('property','og:image:alt').length>10);
});

test('shared PNG bytes match the advertised 1200 by 630 size',()=>{
  assert.equal(image.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(image.readUInt32BE(16),Number(meta('property','og:image:width')));
  assert.equal(image.readUInt32BE(20),Number(meta('property','og:image:height')));
  assert.equal(image.readUInt32BE(16),1200);assert.equal(image.readUInt32BE(20),630);
  assert.equal(meta('property','og:image:type'),'image/png');
});
