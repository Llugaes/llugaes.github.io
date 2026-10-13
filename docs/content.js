export const JOURNAL_BASE='https://llugaes.github.io/game-journal/';
export const JOURNAL_FEED=new URL('journal-data.json',JOURNAL_BASE).href;
export const CACHE_KEY='llugaes-journal-v2';
export const PAGE_SIZE=6;
export const gameLink=id=>`${JOURNAL_BASE}#game=${encodeURIComponent(id)}`;
export const escapeHTML=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=text=>String(text??'').normalize('NFKC').replaceAll('亰','京').toLocaleLowerCase();
export function safeCover(value){
  if(typeof value!=='string'||!value)return '';
  try{const url=new URL(value,JOURNAL_BASE);return url.protocol==='https:'?url.href:'';}catch{return '';}
}
export function normalizeJournal(payload){
  if(!payload||!Array.isArray(payload.games))throw new Error('Invalid journal data');
  const seen=new Set();
  return payload.games.map(game=>{
    if(!game||typeof game.id!=='string'||!/^steam-\d+$/.test(game.id)||typeof game.title!=='string'||!game.title.trim()||seen.has(game.id))throw new Error('Invalid journal game');
    seen.add(game.id);
    const reviews=Array.isArray(game.reviews)?game.reviews:(game.review?[game.review]:[]);
    const screenshots=Array.isArray(game.screenshots)?game.screenshots:[];
    const notes=Array.isArray(game.notes)?game.notes:[];
    const authoredDates=[...reviews.filter(item=>typeof item.content==='string'&&item.content.trim()).map(item=>item.postedAt),...notes.filter(item=>item.title||item.feeling||item.moment||item.content).map(item=>item.date)].filter(value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}/.test(value)).sort();
    const dates=[game.recordedAt,game.lastPlayedAt,...reviews.flatMap(item=>[item.updatedAt,item.postedAt]),...screenshots.map(item=>item.date),...notes.map(item=>item.date)].filter(value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}/.test(value)).sort();
    return {id:game.id,title:game.title,originalTitle:game.originalTitle||'',cover:safeCover(game.cover),coverPath:typeof game.cover==='string'?game.cover:'',excerpt:game.summary||'',date:dates.at(-1)?.slice(0,10)||'',authoredDate:authoredDates.at(-1)?.slice(0,10)||'',reviews:reviews.length,screenshots:screenshots.length,notes:notes.length,source:gameLink(game.id),searchText:normalize([game.title,game.originalTitle,game.summary,...reviews.map(r=>r.content),...notes.map(n=>`${n.title||''} ${n.feeling||''} ${n.moment||''}`)].join(' '))};
  });
}
export function selectGames(games,query='',filter='all'){
  const needle=normalize(query.trim());
  return games.filter(game=>normalize(game.searchText||`${game.title} ${game.originalTitle||''} ${game.excerpt||''}`).includes(needle)&&(filter!=='reviews'||game.reviews>0)&&(filter!=='screenshots'||game.screenshots>0));
}
export const journalCounts=games=>games.reduce((total,game)=>({games:total.games+1,reviews:total.reviews+game.reviews,screenshots:total.screenshots+game.screenshots,notes:total.notes+(game.notes||0)}),{games:0,reviews:0,screenshots:0,notes:0});
export function gamePage(games,page=1){
  const pages=Math.max(1,Math.ceil(games.length/PAGE_SIZE));
  const current=Math.max(1,Math.min(pages,Math.floor(Number(page)||1)));
  return {games:games.slice((current-1)*PAGE_SIZE,current*PAGE_SIZE),page:current,pages,total:games.length,start:games.length?(current-1)*PAGE_SIZE+1:0,end:Math.min(current*PAGE_SIZE,games.length)};
}
export function readCachedJournal(storage){
  try{const value=JSON.parse(storage?.getItem(CACHE_KEY)||'null');if(!value||!Number.isFinite(Date.parse(value.fetchedAt)))return null;return {games:normalizeJournal(value.payload),payload:value.payload,fetchedAt:value.fetchedAt,mode:'cached'};}catch{return null;}
}
export async function fetchLiveJournal(fetcher=fetch,storage=null,{timeoutMs=8000,now=()=>new Date().toISOString()}={}){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetcher(JOURNAL_FEED,{mode:'cors',credentials:'omit',cache:'no-store',signal:controller.signal});
    if(!response.ok)throw new Error(`Journal HTTP ${response.status}`);
    const payload=await response.json(),games=normalizeJournal(payload),fetchedAt=now();
    try{storage?.setItem(CACHE_KEY,JSON.stringify({payload,fetchedAt}));}catch{}
    return {games,payload,fetchedAt,mode:'live'};
  }finally{clearTimeout(timeout);}
}
export async function loadFallbackJournal(fetcher=fetch,storage=null){
  const cached=readCachedJournal(storage);let bundled=null;
  try{const response=await fetcher('./journal-fallback.json');if(!response.ok)throw new Error('Snapshot unavailable');const payload=await response.json();bundled={games:normalizeJournal(payload),payload,fetchedAt:payload._snapshot?.fetchedAt||'',mode:'bundled'};}catch{}
  if(cached&&(!bundled||Date.parse(cached.fetchedAt)>Date.parse(bundled.fetchedAt)))return cached;
  if(bundled)return bundled;if(cached)return cached;throw new Error('No journal snapshot available');
}

// Authorship is deliberately separate from play, screenshot and update activity.
export function latestAuthoredEntries(games,count=3){return games.map((game,index)=>({game,index})).filter(({game})=>game.authoredDate).sort((a,b)=>b.game.authoredDate.localeCompare(a.game.authoredDate)||a.index-b.index).slice(0,count).map(({game})=>game);}
