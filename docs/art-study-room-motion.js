// One foreground animation clock owns the hands, room details and reactions.
// Every animated object is an aligned slice of the existing illustration.
const $=selector=>document.querySelector(selector);
const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t)};
const number=value=>Number(value.toFixed(3));

export function pressRelease(age,pulseMs) {
  if(age<=0||age>=pulseMs)return 0;
  const phase=age/pulseMs;
  if(phase<.28)return smooth(phase/.28);
  if(phase<.46)return 1;
  return 1-smooth((phase-.46)/.54);
}

export function createSeededRandom(seed) {
  let state=seed>>>0;
  return ()=>{state=(1664525*state+1013904223)>>>0;return state/4294967296};
}

export function createHandSegment(options={}) {
  const random=options.random||Math.random;
  const draw=(min,max)=>min+random()*(max-min);
  const requestedSpanMs=options.spanMs??Math.round(draw(450,3350));
  const gapCenterMs=options.gapCenterMs??Math.round(20+620*random()**2);
  const singleShot=options.singleShot??random()<.23;
  const available={left:0,right:0},events=[];
  let cursor=0;
  const add=(hand,desiredAt,pulseMs)=>{
    const atMs=Math.max(desiredAt,available[hand]);
    events.push({atMs:number(atMs),pulseMs,hands:[hand]});
    available[hand]=atMs+pulseMs+Math.round(draw(2,28));
    return atMs;
  };
  while(cursor<requestedSpanMs&&events.length<28) {
    const hand=random()<.5?'left':'right';
    const pulseMs=options.pulseMs??Math.round(draw(180,240));
    const at=add(hand,cursor,pulseMs);
    if(!singleShot&&options.overlaps!==false&&random()<.16) {
      const other=hand==='left'?'right':'left';
      add(other,at+Math.round(draw(35,120)),options.pulseMs??Math.round(draw(180,240)));
    }
    if(singleShot)break;
    const gap=options.gapMs??Math.round(gapCenterMs*(.25+1.6*random())+draw(0,35));
    cursor=at+pulseMs+gap;
  }
  events.sort((a,b)=>a.atMs-b.atMs);
  // Let the last key finish even when it extends beyond the sampled span.
  const durationMs=Math.max(...events.map(event=>event.atMs+event.pulseMs));
  const pauseAfterMs=options.pauseAfterMs??Math.round(draw(320,2180));
  return {events,durationMs,requestedSpanMs,pauseAfterMs,gapCenterMs,singleShot};
}

export function handPose(events,time) {
  const result={left:0,right:0};
  for(const event of events) {
    const value=pressRelease(time-event.atMs,event.pulseMs);
    for(const hand of event.hands)result[hand]=Math.max(result[hand],value);
  }
  return result;
}

export function toolWrenchAngle(time,reactUntil=0) {
  const local=(time/1000)%9.4;
  const envelope=smooth(local/.45)*smooth((5.6-local)/.7);
  let angle=local<5.6?16*Math.sin(local*2*Math.PI/2.1)*envelope:0;
  if(reactUntil>time) {
    const phase=clamp((time-reactUntil+1250)/1250);
    angle+=9*Math.sin(phase*4*Math.PI)*Math.sin(phase*Math.PI);
  }
  return Math.max(-18,Math.min(18,angle));
}

export function attachRoomMotion(quiet,options={}) {
  const nodes={pad:$('#pad-play'),left:$('#paw-left'),right:$('#paw-right'),fingerLeft:$('#finger-left'),fingerRight:$('#finger-right'),reelBig:$('#film-reel-big'),reelSmall:$('#film-reel-small'),beam:$('#film-beam'),book:$('#study-page'),wrench:$('#tools-wrench'),lamp:$('#tools-lamp-glow'),leafLeft:$('#daily-leaf-left'),leafRight:$('#daily-leaf-right')};
  if(Object.values(nodes).some(node=>!node))throw Error('Room motion layers are incomplete');
  let frame=0,lastStamp=null,elapsed=0,frames=0,transitions=0,bookKick=-1;
  const randomSource=options.random||Math.random;
  let mode='idle',modeTime=0,duration=300+randomSource()*850,nextPauseMs=0,events=[],segmentId=0;
  let presses={left:0,right:0},bookProgress=null,toolAngle=0,dailyTime=0,leafAngles={left:0,right:0};
  const reactions={film:0,study:0,tools:0,daily:0};
  const history=[];
  const set=(node,value)=>node.setAttribute('transform',value);

  function applyHands(value) {
    const gain=document.body.classList.contains('full')?1.28:1;
    const left=value.left*gain,right=value.right*gain;
    set(nodes.left,`rotate(${number(4.5*left)} 555 620)`);
    set(nodes.right,`rotate(${number(-3.1*right)} 1115 860)`);
    set(nodes.fingerLeft,`translate(${number(2*left)} ${number(19*left)}) rotate(${number(3.2*left)} 568 650)`);
    set(nodes.fingerRight,`translate(${number(-2*right)} ${number(17*right)}) rotate(${number(-3*right)} 823 690)`);
    set(nodes.pad,`translate(${number(2*(right-left))} ${number(2.2*(left+right))}) rotate(${number(1.15*(left-right))} 655 750)`);
  }
  function advanceHandPhase() {
    modeTime=0;transitions++;
    if(mode==='active') {
      mode='idle';duration=nextPauseMs;nextPauseMs=0;events=[];return;
    }
    const plan=createHandSegment({random:randomSource});
    mode='active';duration=plan.durationMs;events=plan.events;nextPauseMs=plan.pauseAfterMs;segmentId++;
    history.push({segmentId,...plan,eventCount:events.length});
    if(history.length>32)history.shift();
  }

  function paintRooms() {
    const seconds=elapsed/1000;
    // A complete two-turn cycle ends at the same pixels, then rests.
    const reelCycle=(seconds%15.8)/15.8;
    const turn=reelCycle<.68?720*smooth(reelCycle/.68):720;
    const filmProgress=clamp((elapsed-reactions.film+1250)/1250);
    const filmActive=reactions.film>elapsed;
    const extra=filmActive?360*smooth(filmProgress):0;
    set(nodes.reelBig,`translate(1034.3 507.8) scale(1 1.075) rotate(${number(turn+extra)}) scale(1 .930233) translate(-1034.3 -507.8)`);
    set(nodes.reelSmall,`translate(1004.2 508.5) scale(1 1.04) rotate(${number(turn*1.5+extra)}) scale(1 .961538) translate(-1004.2 -508.5)`);
    nodes.beam.setAttribute('opacity',number(.09+.055*Math.sin(seconds*2*Math.PI/7.3)+(filmActive?.12*Math.sin(Math.PI*filmProgress):0)));

    const auto=(seconds%21.7)-17.4;
    const kicked=bookKick>=0?(elapsed-bookKick)/1850:-1;
    const progress=kicked>=0&&kicked<=1?kicked:auto>=0&&auto<=2.15?auto/2.15:null;
    bookProgress=progress;
    if(progress===null) {
      nodes.book.setAttribute('opacity','0');set(nodes.book,'translate(0 0)');
    } else {
      const fold=Math.cos(Math.PI*progress),lift=5*Math.sin(Math.PI*progress);
      set(nodes.book,`translate(1098.5 350) skewY(${number(-8*Math.sin(Math.PI*progress))}) scale(${number(fold)} 1) translate(-1098.5 -350)`);
      // A page is lifted from the existing stack, and lands without a loop jump.
      nodes.book.setAttribute('opacity',number(smooth(progress/.1)*smooth((1-progress)/.17)));
      nodes.book.setAttribute('data-lift',number(lift));
    }
    toolAngle=toolWrenchAngle(elapsed,reactions.tools);
    set(nodes.wrench,`rotate(${number(toolAngle)} 1298.4 659)`);
    nodes.lamp.setAttribute('opacity',number(.12+.13*(.5+.5*Math.sin(seconds*2*Math.PI/10.1))+.2*Math.abs(toolAngle)/18));
  }

  function paintDaily() {
    const t=dailyTime/1000,warm=smooth(t/.85);
    const reaction=reactions.daily>elapsed?Math.sin(Math.PI*clamp((elapsed-reactions.daily+1250)/1250)):0;
    leafAngles={left:warm*(1.7*Math.sin(t*2*Math.PI/3.9)+.45*Math.sin(t*2*Math.PI/6.7)),right:warm*(3.7*Math.sin(t*2*Math.PI/4.6+.35)+.65*Math.sin(t*2*Math.PI/7.8))*(1+.25*reaction)};
    set(nodes.leafLeft,`rotate(${number(leafAngles.left)} 1033 95)`);
    set(nodes.leafRight,`rotate(${number(leafAngles.right)} 1039 94)`);
  }

  function tick(stamp) {
    frame=0;
    if(quiet()){sync();return;}
    const delta=lastStamp===null?0:Math.min(80,stamp-lastStamp);
    lastStamp=stamp;elapsed+=delta;modeTime+=delta;dailyTime+=delta;frames++;
    if(modeTime>=duration)advanceHandPhase();
    presses=handPose(events,modeTime);applyHands(presses);paintRooms();paintDaily();
    for(const room of Object.keys(reactions)) {
      document.querySelector(`[data-room-button="${room}"]`)?.classList.toggle('responding',reactions[room]>elapsed);
    }
    frame=requestAnimationFrame(tick);
  }
  function sync() {
    if(quiet()) {
      if(frame)cancelAnimationFrame(frame);frame=0;lastStamp=null;
      mode='idle';modeTime=0;duration=0;nextPauseMs=0;events=[];presses={left:0,right:0};applyHands(presses);
      for(const room of Object.keys(reactions))reactions[room]=0;
      document.querySelectorAll('[data-room-button]').forEach(node=>node.classList.remove('responding'));
      // Low motion always shows the original resting book and tool.
      if(matchMedia('(prefers-reduced-motion:reduce)').matches) {
        dailyTime=0;
        nodes.book.setAttribute('opacity','0');set(nodes.wrench,'rotate(0 1298.4 659)');
        nodes.beam.setAttribute('opacity','0');nodes.lamp.setAttribute('opacity','0');
        set(nodes.leafLeft,'rotate(0 1033 95)');set(nodes.leafRight,'rotate(0 1039 94)');
      }
    } else if(!frame) {
      if(duration<=0)duration=300+randomSource()*850;
      lastStamp=null;frame=requestAnimationFrame(tick);
    }
  }
  function react(room) {
    if(quiet()) {
      $('#room-motion-status').textContent='动态已暂停。';return;
    }
    if(reactions[room]<=elapsed)reactions[room]=elapsed+1250;
    if(room==='study'&&bookProgress===null)bookKick=elapsed;
    $('#room-motion-status').textContent={film:'卷盘轻转，投影光亮了一点。',study:'书页翻过一页。',tools:'工具轻摆，桌灯暖了一点。',daily:'叶片随微风轻摆。'}[room];
  }
  for(const button of document.querySelectorAll('[data-room-button]')) {
    const room=button.dataset.roomButton;
    button.addEventListener('click',()=>react(room));
  }
  for(const target of document.querySelectorAll('[data-room-hit]')) {
    const room=target.dataset.roomHit;
    target.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')react(room)});
    target.addEventListener('click',()=>react(room));
  }
  const api={sync,react,diagnostics:()=>({mode,modeTimeMs:number(modeTime),durationMs:number(duration),segmentId,nextPauseMs,events:events.map(event=>({...event})),presses,leafAngles,toolAngleDeg:number(toolAngle),activeClockMs:number(elapsed),frames,transitions,activeLoopCount:frame?1:0,bookProgress,history:[...history],reactions:{...reactions}})};
  Object.defineProperty(window,'artRoomMotionDiagnostics',{get:api.diagnostics});
  sync();return api;
}
