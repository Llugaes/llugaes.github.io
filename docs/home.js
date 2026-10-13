import {attachRoomMotion} from './art-study-room-motion.js';
import {attachTV} from './art-study-video.js';
import {loadFallbackJournal,fetchLiveJournal,latestAuthoredEntries,escapeHTML as e,JOURNAL_BASE} from './content.js';
import {ROOMS} from './rooms.js';
import {parseHomeRoute,homeHash,normalizeHomeContent} from './home-content.js';
const $=s=>document.querySelector(s),dialog=$('#room-panel'),body=$('#panel-body'),media=matchMedia('(prefers-reduced-motion:reduce)'),KEY='llugaesHome';
let paused=false,television,roomMotion,route={room:null,note:null},renderedHash=null,opener=null;
let entries=JSON.parse($('#journal-preview').textContent),covers={},source='embedded',liveFailed=false,content=null,contentState='loading';
let storage=null;try{storage=localStorage}catch{}
const quiet=()=>paused||media.matches||document.hidden||dialog.open;
function motion(){
  document.body.classList.toggle('paused',quiet());
  $('#motion').textContent=media.matches?'系统低动态':paused?'恢复动态':'暂停动态';
  $('#motion').setAttribute('aria-pressed',String(paused||media.matches));
  if(window.artTVDiagnostics?.state!=='error')television?.sync();roomMotion?.sync();
}
$('#motion').addEventListener('click',()=>{paused=!paused;motion()});
media.addEventListener('change',motion);document.addEventListener('visibilitychange',motion);
motion();television=attachTV(quiet);roomMotion=attachRoomMotion(quiet);
document.documentElement.classList.add('enhanced');

function statusText(){return source==='live'?'已连接原游记 · 最近发表的评测／随笔':source==='cached'?'游记缓存副本 · 最近发表的评测／随笔':liveFailed?'游记暂时无法更新 · 当前为离线快照':'游记离线快照 · 正在检查更新…'}
function guardImages(scope){
  scope.querySelectorAll('img').forEach(image=>{
    const fail=()=>{image.hidden=true;image.closest('.entry-card')?.classList.add('has-no-image')};
    image.addEventListener('error',fail,{once:true});if(image.complete&&!image.naturalWidth)fail();
  });
}
function gameCard(game){return `<a class="entry-card" data-content-key="${e(game.id)}" href="${e(game.source)}"><div class="cover"><img src="${e(covers[game.id]||game.cover)}" alt="" width="460" height="215"><span class="cover-fallback" aria-hidden="true">封面暂时不可用</span></div><h3>${e(game.title)}</h3><span class="meta"><time datetime="${e(game.authoredDate)}">${e(game.authoredDate)}</time> · 打开原游记 ↗</span></a>`}
function contentCard(item,room){
  const target=item.url||homeHash({room,note:item.id}),attributes=item.url?'':`data-note="${e(item.id)}"`;
  if(room==='tools')return `<a class="entry-card tool-card" data-content-key="${e(item.id)}" href="${e(target)}" ${attributes}><div class="cover">${item.cover?`<img src="${e(item.cover)}" alt="${e(item.coverAlt)}" width="960" height="540">`:''}<span class="cover-fallback" aria-hidden="true">封面暂时不可用</span></div><h3>${e(item.title)}</h3>${item.description?`<p>${e(item.description)}</p>`:''}<span class="meta">${item.url?'打开 GitHub 项目 ↗':'阅读笔记'}</span></a>`;
  return `<a class="note-link" data-content-key="${e(item.id)}" href="${e(target)}" ${attributes}><h3>${e(item.title)}</h3>${item.date?`<time datetime="${e(item.date)}">${e(item.date)}</time>`:''}${item.description?`<p>${e(item.description)}</p>`:''}${item.url?'<span>打开原文 ↗</span>':''}</a>`;
}
function panelHTML(){
  if(route.room==='games')return `<p class="panel-intro">最近三篇评测／随笔，点封面打开原游记。</p><p class="journal-status" data-journal-status>${e(statusText())}</p><div class="entry-grid">${entries.map(gameCard).join('')||'<p>暂无公开游戏游记。</p>'}</div><a class="panel-link" href="${JOURNAL_BASE}">全部游戏游记 ↗</a>`;
  if(contentState==='loading')return '<div class="empty-room"><p role="status">正在读取房间内容…</p></div>';
  if(contentState==='failed')return `<div class="empty-room"><p>房间内容暂时无法加载。</p><button class="motion-button" id="retry-content">重试</button>${route.room==='tools'?'<p><a class="panel-link" href="https://github.com/Llugaes/bilingual-sora-2nd">打开双语 MOD 项目 ↗</a></p>':''}</div>`;
  const items=content[route.room];
  if(route.note){const item=items.find(item=>item.id===route.note&&!item.url);return item?`<article class="note-body">${item.date?`<p class="note-date"><time datetime="${e(item.date)}">${e(item.date)}</time></p>`:''}${item.body.map(p=>`<p>${e(p)}</p>`).join('')}</article>`:'<div class="empty-room"><p>这条笔记不存在。</p></div>'}
  return items.length?`<div class="note-list">${items.map(item=>contentCard(item,route.room)).join('')}</div>`:`<div class="empty-room"><p>${e(ROOMS[route.room].empty||'暂无公开工具项目。')}</p></div>`;
}
function renderPanel(){
  if(!route.room)return;
  const focusKey=document.activeElement?.closest('[data-content-key]')?.dataset.contentKey;
  const item=route.note&&content?.[route.room]?.find(item=>item.id===route.note&&!item.url);
  $('#panel-title').textContent=item?.title||ROOMS[route.room].title;
  $('#panel-back').hidden=!route.note;
  body.innerHTML=panelHTML();guardImages(body);
  document.querySelectorAll('[data-home-room]').forEach(a=>{if(a.dataset.homeRoom===route.room)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  document.title=`${item?.title||ROOMS[route.room].title} · Llugaes`;
  if(focusKey)body.querySelector(`[data-content-key="${CSS.escape(focusKey)}"]`)?.focus({preventScroll:true});
}
const depth=()=>Number.isInteger(history.state?.[KEY]?.depth)?history.state[KEY].depth:0;
function navigate(next,trigger=null,{replace=false}={}){
  const hash=homeHash(next);if(hash===location.hash){syncRoute();return}
  if(trigger&&!dialog.open)opener=trigger;
  const state={[KEY]:{depth:replace?depth():depth()+1}};
  history[replace?'replaceState':'pushState'](state,'',hash||location.pathname+location.search);syncRoute();
}
function closeRoom(){if(!dialog.open)return;if(depth()>0)history.go(-depth());else{history.replaceState(null,'',location.pathname+location.search);syncRoute()}}
function syncRoute(){
  if(renderedHash===location.hash)return;renderedHash=location.hash;
  const previous=route;route=parseHomeRoute(location.hash);
  if(route.room){
    renderPanel();
    if(!dialog.open){dialog.showModal();document.body.classList.add('room-open');$('#panel-close').focus({preventScroll:true})}
    else if(previous.note!==route.note){body.scrollTop=0;(route.note?$('#panel-back'):$('#panel-close')).focus({preventScroll:true})}
  }else{
    if(dialog.open)dialog.close();document.body.classList.remove('room-open');document.title='Llugaes · 小屋';
    document.querySelectorAll('[data-home-room]').forEach(a=>a.removeAttribute('aria-current'));
    const fallback=$(`#room-navigation [data-home-room="${previous.room||'games'}"]`);
    if(previous.room)(opener?.isConnected&&!opener.closest('dialog')?opener:fallback)?.focus({preventScroll:true});opener=null;
  }
  motion();
}
document.addEventListener('click',event=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const link=event.target.closest?.('a[data-home-room],a[data-note]');if(!link)return;
  event.preventDefault();navigate(link.hasAttribute('data-note')?{room:route.room,note:link.dataset.note}:{room:link.dataset.homeRoom,note:null},link);
});
$('#panel-close').addEventListener('click',closeRoom);
$('#panel-back').addEventListener('click',()=>{if(depth()>1)history.back();else navigate({room:route.room,note:null},null,{replace:true})});
dialog.addEventListener('cancel',event=>{event.preventDefault();closeRoom()});
dialog.addEventListener('close',motion);
dialog.addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;
  const controls=[...dialog.querySelectorAll('a[href],button:not([disabled]),[tabindex="0"]')].filter(node=>!node.hidden&&node.getClientRects().length);
  const first=controls[0],last=controls.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
});
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeRoom()}});
body.addEventListener('click',event=>{if(event.target.closest('#retry-content'))loadContent()});
window.addEventListener('popstate',syncRoute);window.addEventListener('hashchange',syncRoute);syncRoute();

function fitBoardTitles(){
  $('#board-current-links').querySelectorAll('text').forEach(text=>{
    const chars=Array.from(text.dataset.fullTitle);text.textContent=chars.join('');
    while(text.getComputedTextLength()>171&&chars.length>1){chars.pop();text.textContent=chars.join('')+'…'}
  });
}
function renderLatest(){
  const ns='http://www.w3.org/2000/svg',board=$('#board-current-links'),ground=$('#ground-cards');board.replaceChildren();ground.replaceChildren();
  entries.forEach((game,i)=>{
    const link=document.createElementNS(ns,'a');link.classList.add('board-link');link.setAttribute('href',game.source);link.setAttribute('aria-label',`${game.title} · 打开原游记`);link.dataset.boardId=game.id;
    const title=document.createElementNS(ns,'title');title.textContent=game.title;link.append(title);
    const text=document.createElementNS(ns,'text');text.dataset.fullTitle=game.title;for(const[k,v]of Object.entries({x:175,y:690+i*38,transform:`rotate(-2 175 ${690+i*38})`}))text.setAttribute(k,v);text.textContent=game.title;link.append(text);board.append(link);
    const floor=document.createElementNS(ns,'a');floor.classList.add('floor-cartridge');floor.setAttribute('href',game.source);floor.setAttribute('aria-label',`${game.title} · 打开原游记`);floor.setAttribute('transform',`translate(${475+i*61} ${756+i*3}) skewX(${-6+i*2}) rotate(${-5+i*4} 29 15)`);floor.append(title.cloneNode(true));
    const image=document.createElementNS(ns,'image');for(const[k,v]of Object.entries({width:58,height:30,href:covers[game.id]||game.cover,preserveAspectRatio:'xMidYMid slice'}))image.setAttribute(k,v);image.addEventListener('error',()=>image.setAttribute('visibility','hidden'),{once:true});floor.append(image);
    const edge=document.createElementNS(ns,'rect');for(const[k,v]of Object.entries({width:58,height:30,fill:'none',stroke:'#ad9276','stroke-width':.65,'pointer-events':'none'}))edge.setAttribute(k,v);floor.append(edge);ground.append(floor);
  });
  fitBoardTitles();document.querySelectorAll('[data-journal-status]').forEach(n=>n.textContent=statusText());if(route.room==='games')renderPanel();
}
function adopt(snapshot){entries=latestAuthoredEntries(snapshot.games,3);source=snapshot.mode;renderLatest()}
fetch('./assets/journal/manifest.json').then(r=>{if(!r.ok)throw Error();return r.json()}).then(manifest=>{covers=manifest.covers||{};renderLatest()}).catch(()=>{});
loadFallbackJournal(fetch,storage).then(s=>{if(source!=='live')adopt(s)}).catch(()=>{});
fetchLiveJournal(fetch,storage).then(adopt).catch(()=>{liveFailed=true;renderLatest()});
async function loadContent(){
  contentState='loading';if(route.room&&route.room!=='games')renderPanel();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000);
  try{const response=await fetch('./site-content.json',{signal:controller.signal});if(!response.ok)throw Error();content=normalizeHomeContent(await response.json());contentState='ready'}catch{contentState='failed'}finally{clearTimeout(timer)}
  if(route.room&&route.room!=='games')renderPanel();
}
loadContent();fitBoardTitles();window.addEventListener('resize',fitBoardTitles);
Object.defineProperty(window,'homeDiagnostics',{get:()=>({route:{...route},source,contentState,paused:quiet(),manualPaused:paused,reducedMotion:media.matches,modalOpen:dialog.open,entries:entries.map(g=>({id:g.id,title:g.title,date:g.authoredDate,source:g.source})),historyDepth:depth()})});
