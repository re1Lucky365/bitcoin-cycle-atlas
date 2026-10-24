import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {RESEARCH_SOURCES} from '../dist/research-source-data.js';
import {PERMITTED_SOURCE_RESEARCH} from '../dist/research-source-records.js';
import {getResearchArticle,getResearchSource,researchSourceText,researchSourceMarkup,researchArticleMarkup,researchArticleMarkdown} from '../dist/research-reader.js';

const manifest=JSON.parse(await readFile(new URL('../dist/research-sources/manifest.json',import.meta.url),'utf8'));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const completeArticle=record=>({...record,footer:{copyright:'Atlas summary; upstream CC0 text stored separately.',availability:'Original source scope in separate manifest.'},archiveSha256:'summary-hash'});

test('every permitted original retains upstream Git identity, exact bytes and a distinct download',async()=>{
  assert.equal(RESEARCH_SOURCES.length,2);
  assert.equal(manifest.sources.length,RESEARCH_SOURCES.length);
  for(const source of RESEARCH_SOURCES){
    const record=completeArticle(PERMITTED_SOURCE_RESEARCH.find(article=>article.url===source.sourceUrl));
    const archived=await readFile(new URL(`../${source.path}`,import.meta.url));
    const downloaded=Buffer.from(researchSourceText(record));
    assert.deepEqual(downloaded,archived);
    assert.equal(downloaded.length,source.bytes);
    assert.equal(sha256(downloaded),source.sha256);
    assert.equal(createHash('sha1').update(`blob ${downloaded.length}\0`).update(downloaded).digest('hex'),source.gitBlobSha);
    const entry=manifest.sources.find(item=>item.id===source.id);
    assert.equal(entry.sha256,source.sha256);
    assert.equal(entry.bytes,source.bytes);
    assert.equal(entry.sourceRevision,source.sourceRevision);
    assert.equal(source.license,'CC0-1.0');
    assert.equal(source.completeSourceText,true);
    assert.equal(source.mediaBytesArchived,false);
    assert.ok(downloaded.toString().endsWith('Copyright and related rights waived via [CC0](../LICENSE.md).\n'));
    assert.notEqual(researchSourceText(record),researchArticleMarkdown(record));
  }
  const license=await readFile(new URL(`../${manifest.license.path}`,import.meta.url));
  assert.equal(license.length,manifest.license.bytes);
  assert.equal(sha256(license),manifest.license.sha256);
  assert.match(license.toString(),/CC0 1\.0 Universal/);
});

test('a source view displays complete text and source identity while summary keeps authored analysis',()=>{
  for(const record of PERMITTED_SOURCE_RESEARCH.map(completeArticle)){
    const source=getResearchSource(record);
    const summary=researchArticleMarkup(record);
    const original=researchArticleMarkup(record,{view:'source'});
    assert.match(summary,/data-reader-view="summary" aria-pressed="true"/);
    assert.match(summary,/요약 MD 저장/);
    assert.match(summary,/주장과 교차 확인/);
    assert.ok(!summary.includes('<pre class="research-source-text"'));
    assert.match(original,/data-reader-view="source" aria-pressed="true"/);
    assert.match(original,/원문 MD 저장/);
    assert.ok(original.includes(source.sha256));
    assert.ok(original.includes(source.sourceRevision));
    assert.ok(original.includes(source.retrievedAt));
    assert.ok(original.includes(source.licenseUrl));
    assert.ok(original.includes(source.bytes.toLocaleString('en-US')));
    assert.match(original,/<pre class="research-source-text" lang="en">---\neip:/);
    assert.match(original,/## Copyright\nCopyright and related rights waived via \[CC0\]/);
    assert.ok(!original.includes('<h2>주장과 교차 확인</h2>'));
  }
});

test('unlicensed articles cannot obtain an original tab or a summary disguised as original',()=>{
  const article=getResearchArticle('bmnr-2026-q3-10q');
  assert.equal(getResearchSource(article),null);
  assert.equal(getResearchSource('not-an-article'),null);
  assert.throws(()=>researchSourceText(article),/No permitted source text/);
  assert.throws(()=>researchSourceText('not-an-article'),/No permitted source text/);
  const markup=researchArticleMarkup(article,{view:'source'});
  assert.ok(!markup.includes('data-reader-view'));
  assert.ok(!markup.includes('research-source-text'));
  assert.ok(markup.includes('요약 MD 저장'));
  assert.ok(markup.includes('원문 전체: 미보관'));
});

test('source bytes render as inert text even when they contain HTML or executable Markdown',()=>{
  const source={...RESEARCH_SOURCES[0],text:'</pre><img src=x onerror=alert(1)><script>alert(2)</script>\n[run](javascript:alert(3))\n<iframe src="https://example.com"></iframe> & "',versionedUrl:'javascript:alert(4)',licenseUrl:'data:text/html,<script>alert(5)</script>',sourcePath:'<svg onload=alert(6)>'};
  const markup=researchSourceMarkup(source);
  assert.ok(!/<(?:img|script|iframe|svg)\b/i.test(markup));
  assert.ok(markup.includes('&lt;/pre&gt;&lt;img'));
  assert.ok(markup.includes('[run](javascript:alert(3))'),'Markdown source must remain literal text');
  assert.ok(markup.includes('&amp; &quot;'));
  const hrefs=[...markup.matchAll(/href="([^"]*)"/g)].map(match=>match[1]);
  assert.deepEqual(hrefs,['#','#']);
});

test('source matching uses the full canonical URL and does not grant rights to lookalike hosts',()=>{
  const article=PERMITTED_SOURCE_RESEARCH[0];
  assert.equal(getResearchSource(article)?.id,'eip-1559');
  assert.equal(getResearchSource({...article,url:'https://eips.ethereum.org.evil.example/EIPS/eip-1559'}),null);
  assert.equal(getResearchSource({...article,url:'https://eips.ethereum.org/EIPS/eip-1559?edited=true'}),null);
  assert.equal(getResearchSource({...article,url:'javascript:alert(1)'}),null);
});
