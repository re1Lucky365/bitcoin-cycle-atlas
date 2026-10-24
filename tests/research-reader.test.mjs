import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {RESEARCH_ARTICLES,ARTICLE_ALIASES} from '../dist/research-library-data.js';
import {getResearchArticle,researchArticleMarkdown,researchArticleMarkup} from '../dist/research-reader.js';
import {serializeResearchArticleMarkdown,safeResearchUrl} from '../dist/research-format.js';

const manifest=JSON.parse(await readFile(new URL('../dist/research/manifest.json',import.meta.url),'utf8'));
const byManifestId=new Map(manifest.articles.map(row=>[row.id,row]));
const sample=()=>structuredClone(RESEARCH_ARTICLES.find(row=>row.id==='bmnr-2026-q3-10q'));

test('every reader download is byte-identical to its stored archive and SHA-256 manifest',async()=>{
  assert.equal(RESEARCH_ARTICLES.length,manifest.articles.length);
  assert.ok(RESEARCH_ARTICLES.length>400,'the check must cover the complete library, not a sample');
  for(const article of RESEARCH_ARTICLES){
    const entry=byManifestId.get(article.id);
    assert.ok(entry,`missing manifest record ${article.id}`);
    const archived=await readFile(new URL(`../${entry.path}`,import.meta.url));
    const downloaded=Buffer.from(researchArticleMarkdown(article),'utf8');
    assert.deepEqual(downloaded,archived,`download differs from archive: ${article.id}`);
    const digest=createHash('sha256').update(downloaded).digest('hex');
    assert.equal(digest,entry.sha256,`manifest digest mismatch: ${article.id}`);
    assert.equal(digest,article.archiveSha256,`reader digest mismatch: ${article.id}`);
    assert.equal(downloaded.length,entry.bytes,`UTF-8 byte length mismatch: ${article.id}`);
    assert.equal(entry.sourceUrl,article.url);
  }
});

test('aliases resolve to the canonical article and canonical downloadable bytes',()=>{
  let duplicates=0;
  for(const [alias,id]of Object.entries(ARTICLE_ALIASES)){
    assert.equal(getResearchArticle(alias)?.id,id,`broken alias ${alias}`);
    assert.equal(researchArticleMarkdown(alias),researchArticleMarkdown(id));
    if(alias!==id)duplicates++;
  }
  assert.ok(duplicates>0,'exercise actual source de-duplication aliases');
  for(const article of RESEARCH_ARTICLES)for(const claim of article.claims)for(const id of claim.crossCheckIds||[])assert.ok(getResearchArticle(id),`broken cross-check ${article.id} -> ${id}`);
});

test('an unknown article cannot silently produce a different or empty export',()=>{
  assert.equal(getResearchArticle('not-a-research-article'),null);
  assert.throws(()=>researchArticleMarkdown('not-a-research-article'),/Unknown research article/);
});

test('HTML rendering escapes source text in headings, metadata, verdicts and media labels',()=>{
  const article=sample(),attack='"><img src=x onerror="alert(1)"><script>alert(2)</script>&';
  for(const key of ['title','originalTitle','author','publisher','summary','reviewNote','sourceAnchor'])article[key]=attack;
  article.symbols=[attack];article.limitations=[attack];article.footer={copyright:attack,availability:attack};
  article.claims=[{claim:attack,assessment:attack,status:attack,crossCheckIds:[]}];
  article.media=[{type:'video',url:'https://example.org/video',title:attack}];
  article.relatedLinks=[{url:'https://example.org/related',title:attack}];
  const markup=researchArticleMarkup(article);
  assert.ok(!/<(?:img|script)\b/i.test(markup));
  assert.ok(markup.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'));
  assert.ok(markup.includes('&amp;'));
  assert.ok(markup.includes('<h1 id="research-reader-title">'),'the dialog must have its labelled heading');
  assert.ok(markup.includes('aria-label="연구 글 닫기"'));
});

test('all external reader URL positions block executable or non-web schemes',()=>{
  for(const url of ['javascript:alert(1)','data:text/html,<script>alert(1)</script>','vbscript:msgbox(1)','file:///tmp/example','//example.org/path','not a URL']){
    const article=sample();article.url=url;article.media=[{type:'video',url,title:'media'}];article.relatedLinks=[{url,title:'related'}];
    const markup=researchArticleMarkup(article);
    const hrefs=[...markup.matchAll(/href="([^"]*)"/g)].map(match=>match[1]);
    assert.equal(hrefs.length,4);
    assert.ok(hrefs.every(href=>href==='#'),`unsafe URL survived: ${url}`);
    assert.equal(safeResearchUrl(url),'#');
  }
  assert.equal(safeResearchUrl('https://example.org/원문'),'https://example.org/%EC%9B%90%EB%AC%B8');
  assert.equal(safeResearchUrl('http://example.org/report'),'http://example.org/report');
});

test('Markdown exports neutralize raw HTML, injected link labels and unsafe destinations',()=>{
  const article=sample();
  article.title='<svg onload="alert(1)">';
  article.summary='[click](javascript:alert(1)) <script>alert(2)</script>';
  article.url='javascript:alert(1)';
  article.media=[{type:'video',title:'](javascript:alert(1)) <img src=x>',url:'data:text/html,unsafe'}];
  article.relatedLinks=[{title:'[click]',url:'https://example.org/report_(final)?q=a&b=c'}];
  const markdown=serializeResearchArticleMarkdown(article,ARTICLE_ALIASES);
  assert.ok(!/<(?:svg|script|img)\b/i.test(markdown));
  assert.ok(markdown.includes('\\[click\\](javascript:alert(1))'));
  assert.ok(markdown.includes('- 원문: #\n'));
  assert.ok(markdown.includes('](<#>)'));
  assert.ok(markdown.includes('](<https://example.org/report_(final)?q=a&b=c>)'),'parentheses in a web URL must not truncate the Markdown destination');
});

test('Markdown cross-check links use canonical archive IDs without path traversal',()=>{
  const article=sample();
  article.claims=[{claim:'교차 확인',assessment:'검토',status:'fact',crossCheckIds:['legacy-id','unsafe-id']}];
  const markdown=serializeResearchArticleMarkdown(article,{'legacy-id':'canonical-id','unsafe-id':'../../outside'});
  assert.ok(markdown.includes('[legacy-id](./canonical-id.md)'));
  assert.ok(markdown.includes('[unsafe-id](#)'));
  assert.ok(!markdown.includes('../outside'));
});
