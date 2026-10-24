// The build archive and browser download must serialize the same UTF-8 bytes.
// Keep this module pure: it is shared by Node's archive generator and the reader.
export function safeResearchUrl(value){
  try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:'#';}
  catch{return '#';}
}

const markdownText=value=>String(value??'').replace(/\\/g,'\\\\').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])).replace(/([`*_[\]{}!])/g,'\\$1');
const externalLink=(title,url)=>`[${markdownText(title)}](<${safeResearchUrl(url)}>)`;
const archiveLink=(id,aliases)=>{
  const target=aliases[id]||id;
  return `[${markdownText(id)}](${/^[a-z0-9-]+$/.test(target)?`./${target}.md`:'#'})`;
};

export function serializeResearchArticleMarkdown(r,aliases={}){
  if(!r)throw new RangeError('Unknown research article');
  const t=markdownText;
  let text=`# ${t(r.title)}\n\n> Atlas가 작성한 연구 요약·검토 보관본. 원문 전체 복제본이 아닙니다.\n\n- 원제: ${t(r.originalTitle||r.title)}\n- 글쓴이: ${t(r.author)}\n- 발행자: ${t(r.publisher)}\n- 발행일: ${t(r.publishedAt||'미확인')}\n- 검토·수집 기록: ${t(r.reviewedAt)}\n- 종목: ${r.symbols.map(t).join(', ')}\n- 분류: ${t(r.category)}\n- 접근 상태: ${t(r.access)}\n- 원문: ${safeResearchUrl(r.url)}\n- 원문 위치: ${t(r.sourceAnchor||r.evidenceAnchor||'페이지 본문 또는 아래 제한 참조')}\n\n## 본문 · 연구 요약\n\n${t(r.summary)}\n`;
  if(r.reviewNote)text+=`\n${t(r.reviewNote)}\n`;
  if(r.claims.length)text+=`\n## 주장과 교차 확인\n\n${r.claims.map(c=>`### ${t(c.claim)}\n\n판정: ${t(c.status)}\n\n${t(c.assessment)}\n\n대조 자료: ${(c.crossCheckIds||[]).map(id=>archiveLink(id,aliases)).join(', ')||'별도 독립 대조 자료 미기재'}`).join('\n\n')}\n`;
  text+=`\n## 한계와 반대 조건\n\n${r.limitations.map(s=>`- ${t(s)}`).join('\n')||'- 원문 확인과 예측 적중 검증은 다릅니다.'}\n`;
  text+=`\n## 이미지·동영상 기록\n\n${r.media.length?r.media.map(m=>`- ${t(m.type)}: ${externalLink(m.title||m.url,m.url)} · 링크와 메타데이터 보존 · 파일 원본 미보관`).join('\n'):'별도 미디어 URL을 확보하지 않았습니다. 미디어가 없다는 의미는 아닙니다.'}\n`;
  if(r.relatedLinks?.length)text+=`\n## 관련 링크\n\n${r.relatedLinks.map(link=>`- ${externalLink(link.title,link.url)}`).join('\n')}\n`;
  const original=r.sourceArchive&&/^eip-[1-9][0-9]*$/.test(r.sourceArchive.id)?`허용 원문은 별도 [${t(r.sourceArchive.id)}](../research-sources/${r.sourceArchive.id}.md) 파일로 보관합니다. 라이선스 ${t(r.sourceArchive.license)} · SHA-256 ${t(r.sourceArchive.sha256)}. 이 파일은 자체 요약입니다.`:t(r.footer.availability);
  const scope=r.sourceArchive?'이 요약 파일에는 원문 전체와 이미지·영상 파일을 포함하지 않습니다.':'원문 전체: 미보관. 이미지·영상 파일: 미보관.';
  text+=`\n## 푸터 · 보존 범위\n\n${t(r.footer.copyright)}\n\n${original}\n\n${scope} 보존 대상: 제목·글쓴이·날짜·출처·직접 작성한 본문·판정·미디어 링크·이 보존 고지.\n`;
  return text;
}
