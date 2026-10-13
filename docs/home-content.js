import {ROOMS} from './rooms.js';

export const CONTENT_ROOMS=['films','learning','tools','diary'];
export function parseHomeRoute(hash=''){
  const params=new URLSearchParams(hash.replace(/^#/,'')),room=params.get('room');
  if(!Object.hasOwn(ROOMS,room))return {room:null,note:null};
  const note=params.get('note');
  return {room,note:note&&/^[a-z0-9][a-z0-9_-]{0,79}$/.test(note)?note:null};
}
export function homeHash({room,note=null}){
  if(!Object.hasOwn(ROOMS,room))return '';
  const params=new URLSearchParams({room});
  if(note&&/^[a-z0-9][a-z0-9_-]{0,79}$/.test(note))params.set('note',note);
  return '#'+params;
}
export function publicURL(value){
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:''}catch{return ''}
}
export function contentCover(value){
  return typeof value==='string'&&/^\.\/assets\/[a-z0-9_./-]+\.(?:jpg|jpeg|png|webp|svg)$/i.test(value)&&!value.includes('..')?value:'';
}
export function normalizeHomeContent(payload){
  if(payload?.version!==1||!payload.rooms||typeof payload.rooms!=='object')throw Error('Invalid home content');
  const rooms={};
  for(const id of CONTENT_ROOMS){
    const items=payload.rooms[id]?.items;
    if(!Array.isArray(items))throw Error('Invalid room items');
    const seen=new Set();
    rooms[id]=items.map(item=>{
      if(!item||typeof item.id!=='string'||!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(item.id)||seen.has(item.id)||typeof item.title!=='string'||!item.title.trim())throw Error('Invalid content item');
      seen.add(item.id);
      const url=publicURL(item.url),body=Array.isArray(item.body)?item.body.filter(p=>typeof p==='string'&&p.trim()):[];
      if(!url&&!body.length)throw Error('Content needs a source URL or real text');
      return {id:item.id,title:item.title.trim(),date:typeof item.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(item.date)?item.date:'',description:typeof item.description==='string'?item.description:'',url,body,cover:contentCover(item.cover),coverAlt:typeof item.coverAlt==='string'?item.coverAlt:''};
    });
  }
  return rooms;
}
