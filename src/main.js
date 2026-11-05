import './styles.css'
import playlistFile from '../content/playlists.json'
const playlists=playlistFile.playlists||[]
import site from '../content/site.json'

// Text that lives in content/site.json
const esc=t=>t.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
// turns plain email addresses and web addresses in the content files into links
const linkify=t=>esc(t).replace(/([\w.+-]+@[\w-]+(?:\.[\w-]+)+)|((?:https?:\/\/)?(?:[\w-]+\.)+(?:com|org|uk|io|co|net)\b(?:\/[^\s]*)?)/g,
  (m,email,url)=>email?`<a href="mailto:${email}">${email}</a>`:`<a href="${url.startsWith('http')?url:'https://'+url}" target="_blank" rel="noopener">${url}</a>`);
document.getElementById('j-intro').textContent=site.subscribe.intro;
document.getElementById('f-consent-text').textContent=site.subscribe.consent;
document.getElementById('j-done').textContent=site.subscribe.done;
document.getElementById('j-back').textContent=site.subscribe.back;
document.getElementById('pv-updated').textContent=site.privacy.updated;
document.getElementById('pv-body').innerHTML=site.privacy.paragraphs.map(t=>`<p>${linkify(t)}</p>`).join('');

const PLAYLISTS = playlists.filter(p=>p.apple||p.spotify||p.cover);   // newest first, from content/playlists.json
function paint(c,p){ // generative placeholder cover
  const s=600;c.width=c.height=s;const g=c.getContext('2d');
  const [h1,h2]=p.hue||[220,250];const seed=parseInt(p.vol||'1',10);
  const lg=g.createLinearGradient(0,0,s,s);
  lg.addColorStop(0,`hsl(${h1} 42% 30%)`);lg.addColorStop(1,`hsl(${h2} 50% 12%)`);
  g.fillStyle=lg;g.fillRect(0,0,s,s);
  for(let i=0;i<6;i++){const r=(Math.sin(seed*9.1+i*3.7)+1)/2, q=(Math.cos(seed*4.3+i*1.9)+1)/2;
    const rg=g.createRadialGradient(r*s,q*s,0,r*s,q*s,s*(.25+.2*r));
    rg.addColorStop(0,`hsla(${h1+i*12} 70% 62% / .55)`);rg.addColorStop(1,'transparent');g.fillStyle=rg;g.fillRect(0,0,s,s);}
  const img=g.getImageData(0,0,s,s),d=img.data;for(let i=0;i<d.length;i+=4){const n=(Math.random()-.5)*26;d[i]+=n;d[i+1]+=n;d[i+2]+=n}
  g.putImageData(img,0,0);
}

const field=document.getElementById('field');
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

function coverEl(p,wrap,withName){
  wrap.innerHTML='';
  if(p.cover){const im=new Image();im.src=p.cover;im.alt='';im.decoding='async';wrap.append(im);}
  else{const c=document.createElement('canvas');paint(c,p);wrap.append(c);
    if(withName)wrap.insertAdjacentHTML('beforeend',`<span class="name">${p.title}</span>`);}
}
const art=PLAYLISTS.map(p=>{const d=document.createElement('div');d.className='cover';coverEl(p,d,false);return d});

// Tuning
const DRIFT=100;                // px/s the stack moves on its own
const HOLD=1;                   // seconds a cover stays in focus after the visitor stops scrolling
const SWAY=0;                   // how far a card drifts ahead of or behind its slot, as a fraction of card size
// Spacing curve, in cover-heights. A cover n slots from the centre sits at EDGE*n + OPEN*tanh(n/REACH),
// so the centred cover gets a little air while covers further out compress into an overlapping deck.
const EDGE=.24;                 // spacing per slot far from the centre (well under 1 = strong overlap)
const OPEN=.72;                 // extra spacing near the centre
const REACH=.8;                 // how quickly that extra spacing runs out
const SHRINK=.38;               // how much smaller covers get away from the centre
const FAN=32;                   // degrees covers tip away from the viewer towards the edges
let pos=0,t=0,target=0;
const rand=(a,b)=>a+Math.random()*(b-a);

let W,H,SIZE,cards=[],next=0;
function style(c){
  // each card: its own speed, depth and fixed tilt
  c.k=rand(-1,1);                                   // -1 = far, 1 = near
  c.phase=rand(0,Math.PI*2);c.rate=rand(.35,.6);     // each card runs slightly fast or slow around its slot
  c.scale=1;
  c.rz=0; // in-plane tilt; about a third sit almost flat
  c.rx=0;                                   // tipped back slightly
  c.ry=0;
  c.dx=0;                            // slight horizontal offset so overlaps read as layers
}
function assign(c){
  const idx=next++%PLAYLISTS.length;c.idx=idx;
  c.el.replaceChildren(art[idx].cloneNode(true));
  const src=art[idx].querySelector('canvas'),dst=c.el.querySelector('canvas');if(src&&dst)dst.getContext('2d').drawImage(src,0,0);
  c.el.setAttribute('aria-label',PLAYLISTS[idx].title);
}
function build(){
  field.innerHTML='';W=innerWidth;H=innerHeight;pos=0;target=0;
  SIZE=.99*Math.min(600,Math.max(260,Math.min(W*.875,H*.45)));
  document.documentElement.style.setProperty('--focus',SIZE+'px'); // grid matches the focused cover's width
  const reach=Math.ceil((H/2/SIZE+1.3-OPEN)/EDGE), n=2*reach+3;
  const L=PLAYLISTS.length;next=((-Math.floor(n/2))%L+L)%L;   // so the newest playlist starts in focus
  cards=Array.from({length:n},(_,i)=>{
    const el=document.createElement('button');el.className='card';el.type='button';
    el.style.width=el.style.height=SIZE+'px';
    const c={el,slot:i,lastU:null};
    style(c);assign(c);
    el.addEventListener('click',e=>{if(moved>6){e.preventDefault();return}open(PLAYLISTS[c.idx])});
    field.append(el);return c;
  });
}
build();
let rt;addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(build,200)});

// Input. pos is measured in covers; a spring pulls it onto whole numbers so a cover always lands in focus.
let vpos=0,hover=false,lastInput=-1e9,held=0,phase='drift',driftV=0,gridOn=false;
// phase: 'drift' moves on its own, 'glide' coasts with momentum after a scroll,
// 'settle' eases onto the nearest cover and holds it, then it's back to 'drift'
const slope=()=>SIZE*(EDGE+OPEN/REACH);                   // px the centre cover moves per cover of travel
const MAXV=25;                                            // covers per second
const interrupt=()=>{lastInput=performance.now();held=0;if(phase==='drift')vpos=driftV;driftV=0};
field.addEventListener('wheel',e=>{e.preventDefault();interrupt();
  const d=e.deltaMode===1?e.deltaY*32:e.deltaY;
  pos+=d*.9/slope();                                      // move straight away, like a native scroll
  vpos=Math.max(-MAXV,Math.min(MAXV,vpos*.85+d*6/slope())); // and build momentum to coast on
  phase='glide'},{passive:false});
field.addEventListener('pointerover',e=>{hover=e.pointerType==='mouse'&&!!e.target.closest('.card')});
field.addEventListener('pointerleave',()=>{hover=false});
// Drag moves the stack 1:1 under the finger; release coasts with the finger's speed, then lands on a cover
let dragging=false,py=0,moved=0,dragV=0,lastT=0;
field.addEventListener('pointerdown',e=>{interrupt();dragging=true;py=e.clientY;moved=0;dragV=0;vpos=0;lastT=performance.now();field.classList.add('dragging')});
addEventListener('pointermove',e=>{if(!dragging)return;const now=performance.now(),dy=py-e.clientY;py=e.clientY;moved+=Math.abs(dy);
  pos+=dy/slope();const ms=Math.max(4,now-lastT);lastT=now;dragV=dragV*.6+(dy/ms*1000)*.4});
const release=()=>{if(!dragging)return;dragging=false;field.classList.remove('dragging');interrupt();
  vpos=performance.now()-lastT>90?0:Math.max(-MAXV,Math.min(MAXV,dragV/slope()));phase='glide'};
addEventListener('pointerup',release);addEventListener('pointercancel',release);
addEventListener('keydown',e=>{if(!sheet.hidden||gridOn)return;const dir=e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0;if(!dir)return;
  interrupt();target=(phase==='settle'?target:Math.round(pos))+dir;phase='settle'});

let last=performance.now();
function frame(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  if(!gridOn){
    if(dragging){}
    else if(phase==='glide'){
      // coast with friction; once slow enough, pick the cover it's heading for
      vpos*=Math.pow(.12,dt);pos+=vpos*dt;
      if(Math.abs(vpos)<1.6){target=Math.round(pos+vpos*.18);phase='settle'}
    }else if(phase==='settle'){
      const k=42, c=2*Math.sqrt(k);                       // critically damped: lands without bouncing
      vpos+=(k*(target-pos)-c*vpos)*dt;pos+=vpos*dt;
      if(Math.abs(target-pos)<.003&&Math.abs(vpos)<.02){pos=target;vpos=0;
        if(sheet.hidden&&!reduce){held+=dt;if(held>HOLD)phase='drift'}}
    }else{
      // drifting: ease up to speed, slow right down while a mouse hovers a cover
      const want=(reduce||!sheet.hidden||!about.hidden||!join.hidden||!privacy.hidden)?0:DRIFT/slope()*(hover?.2:1);
      driftV+=(want-driftV)*(1-Math.pow(.15,dt));pos+=driftV*dt;
    }
    const loop=cards.length;
    for(const c of cards){
      let u=((c.slot-pos)%loop+loop)%loop-Math.floor(loop/2);          // slots from the centre: negative above, positive below
    if(c.lastU!=null&&Math.abs(u-c.lastU)>loop/2){style(c);assign(c)} // wrapped round: fresh tilt and cover
    c.lastU=u;
    const sy=(EDGE*u+OPEN*Math.tanh(u/REACH))*SIZE;     // centre of the cover, px from screen centre
    const away=Math.tanh(Math.abs(u)/1.1);              // 0 at the centre, towards 1 at the edges
    const sc=(1-SHRINK*away)*c.scale;
    const rx=-Math.tanh(u/1.4)*FAN;                     // top covers tip back, bottom covers tip forward
    const y=H/2+sy-SIZE/2, x=W/2-SIZE/2+c.dx;
    c.el.style.zIndex=1000-Math.round(Math.abs(u)*20);  // covers stack towards the centre: over the one above at the top, over the one below at the bottom
    c.el.style.filter=`brightness(${(1-.42*away).toFixed(3)})`;
    c.el.style.transform=`translate3d(${x}px,${y}px,${-away*140}px) rotateX(${rx}deg) scale(${sc})`;
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const sheet=document.getElementById('sheet');
function open(p){
  const i=PLAYLISTS.indexOf(p);
  coverEl(p,document.getElementById('d-cover'),true);
  document.getElementById('d-no').textContent=String(PLAYLISTS.length-i).padStart(2,'0');
  document.getElementById('d-title').textContent=p.title;
  document.getElementById('d-time').textContent=p.runtime||'XX:XX';
  const d=document.getElementById('d-desc');d.textContent=p.desc||'';d.hidden=!p.desc;
  // each whole row is the link; the right-hand slot takes the platform's official logo file when it's added
  const l=(href,label,key)=>{const mark=`<span class="p-mark" data-brand="${key}" aria-hidden="true">↗</span>`;
    return href?`<a class="p-row p-link" href="${href}" target="_blank" rel="noopener"><span>Listen on ${label}</span>${mark}</a>`
               :`<div class="p-row p-link off"><span>Listen on ${label}</span>${mark}</div>`};
  document.getElementById('d-links').innerHTML=l(p.apple,'Apple Music','apple')+l(p.spotify,'Spotify','spotify');
  // focus the panel itself rather than CLOSE, so no focus ring appears on open; keyboard users can still tab to CLOSE
  showSheet(sheet);document.getElementById('panel').focus({preventScroll:true});
}
// panels open and close instantly; fades are kept for the loader and the view switch
function showSheet(el){el.hidden=false}
function hideSheet(el){el.hidden=true}
function close(){hideSheet(sheet)}
document.getElementById('close').onclick=close;
sheet.addEventListener('click',e=>{if(e.target===sheet)close()});
// About panel, opened from SOUNDS in the header
const about=document.getElementById('about');
// One source for the bio and links: the SOUNDS box on the stack and the footer on the list are both built from this
const ABOUT=site.about;   // from content/site.json
const ENVELOPE='<svg width="13" height="10" viewBox="0 0 13 10" fill="none" stroke="currentColor" stroke-width="1"><rect x=".5" y=".5" width="12" height="9"/><path d="M.5 .5 6.5 5.5 12.5 .5"/></svg>';
function renderAbout(el,bioClass){
  const bio=document.createElement('div');bio.className=bioClass;
  ABOUT.bio.forEach(t=>{const p=document.createElement('p');p.textContent=t;bio.append(p)});
  el.replaceChildren(bio);
  ABOUT.links.forEach(l=>{
    const row=document.createElement(l.subscribe?'button':'a');row.className='p-row p-link';
    if(l.subscribe){row.type='button';row.addEventListener('click',()=>openJoin())}else{row.href=l.href;row.target='_blank';row.rel='noopener'}
    const a=document.createElement('span');a.textContent=l.label;
    const m=document.createElement('span');m.className='p-mark';m.setAttribute('aria-hidden','true');m.innerHTML=l.subscribe?ENVELOPE:'\u2197';
    row.append(a,m);el.append(row);
  });
}
renderAbout(document.getElementById('about-body'),'p-body');
renderAbout(document.getElementById('list-about'),'list-bio');
const openAbout=()=>{showSheet(about);document.getElementById('about-panel').focus({preventScroll:true})};
const closeAbout=()=>hideSheet(about);
// Subscribe form. Posts to /api/subscribe on the live site, which adds the person to the mailing list; visitors never leave the page.
const join=document.getElementById('join'),form=document.getElementById('join-form'),msg=document.getElementById('f-msg'),sub=document.getElementById('f-submit');
const openJoin=()=>{hideSheet(about);showSheet(join);document.getElementById('join-panel').focus({preventScroll:true})};
const closeJoin=()=>{hideSheet(join);setTimeout(()=>{form.hidden=false;document.getElementById('join-done').hidden=true;form.reset();msg.hidden=true;form.querySelectorAll('.bad').forEach(x=>x.classList.remove('bad'))},300)};
document.getElementById('join-close').onclick=closeJoin;
document.getElementById('join-done-close').onclick=closeJoin;
join.addEventListener('click',e=>{if(e.target===join)closeJoin()});
// Privacy notice: hides the form without resetting it, so closing returns to the form exactly as it was
const privacy=document.getElementById('privacy');
const openPrivacy=()=>{hideSheet(join);showSheet(privacy);privacy.querySelector('.panel').scrollTop=0;document.getElementById('privacy-panel').focus({preventScroll:true})};
const closePrivacy=()=>{hideSheet(privacy);showSheet(join);document.getElementById('join-panel').focus({preventScroll:true})};
document.getElementById('f-privacy').onclick=openPrivacy;
document.getElementById('privacy-close').onclick=closePrivacy;
privacy.addEventListener('click',e=>{if(e.target===privacy)closePrivacy()});
document.getElementById('f-consent').addEventListener('change',e=>{if(e.target.checked)document.getElementById('f-consent-row').classList.remove('bad')});
form.addEventListener('submit',async e=>{
  e.preventDefault();
  const f=Object.fromEntries(new FormData(form));for(const k in f)f[k]=String(f[k]).trim();
  const bad=[];if(!f.name)bad.push('name');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email))bad.push('email');
  const agreed=document.getElementById('f-consent').checked;f.consent=agreed;
  form.querySelectorAll('.f-row').forEach(r=>r.classList.toggle('bad',bad.includes(r.querySelector('input,textarea').name)));
  document.getElementById('f-consent-row').classList.toggle('bad',!agreed);
  if(bad.length||!agreed){const E=site.subscribe.errors;msg.textContent=bad.includes('email')?E.email:bad.includes('name')?E.name:E.consent;msg.hidden=false;return}
  msg.hidden=true;sub.disabled=true;sub.firstChild.textContent='Sending';
  let ok=false;
  try{const res=await fetch('/api/subscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(f)});ok=res.ok}catch{}
  if(!ok&&(location.hostname==='localhost'||location.hostname==='127.0.0.1'))ok=true;   // local development only
  sub.disabled=false;sub.firstChild.textContent='Submit';
  if(ok){form.hidden=true;document.getElementById('join-done').hidden=false}
  else{msg.textContent=site.subscribe.errors.failed;msg.hidden=false}
});
// SOUNDS: a box over the stack; on the list, glide down to the same content in the footer
document.getElementById('homebtn').onclick=()=>{
  if(!gridOn){openAbout();return}
  const foot=document.getElementById('list-about'),bar=document.querySelector('.listbar').offsetHeight;
  grid.scrollTo({top:grid.scrollTop+foot.getBoundingClientRect().top-bar,behavior:reduce?'auto':'smooth'});
};
document.getElementById('about-close').onclick=closeAbout;
about.addEventListener('click',e=>{if(e.target===about)closeAbout()});
addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(!privacy.hidden)closePrivacy();else if(!join.hidden)closeJoin();else if(!about.hidden)closeAbout();else if(!sheet.hidden)close();else if(gridOn)setGrid(false)});

// List view: every playlist, newest first
const grid=document.getElementById('grid'),gridInner=document.getElementById('grid-inner'),viewbtn=document.getElementById('viewbtn');
PLAYLISTS.forEach((p,i)=>{
  const b=document.createElement('button');b.className='tile';b.type='button';b.setAttribute('aria-label',p.title);
  const no=document.createElement('span');no.className='tile-no';no.textContent=String(PLAYLISTS.length-i).padStart(2,'0'); // newest has the highest number
  b.append(no,art[i].cloneNode(true));
  const src=art[i].querySelector('canvas'),dst=b.querySelector('canvas');if(src&&dst)dst.getContext('2d').drawImage(src,0,0);
  const tx=document.createElement('span');tx.className='tile-text';
  const ti=document.createElement('span');ti.className='tile-title';ti.textContent=p.title;
  const tm=document.createElement('span');tm.className='tile-time';tm.textContent=p.runtime||'XX:XX';p._time=tm; // HH:MM
  tx.append(ti,tm);b.append(tx);
  b.addEventListener('click',()=>open(p));gridInner.append(b);
});
function setGrid(on){
  gridOn=on;grid.classList.toggle('on',on);grid.setAttribute('aria-hidden',String(!on));
  viewbtn.setAttribute('aria-pressed',String(on));viewbtn.setAttribute('aria-label',on?'Back to the stack':'Show all playlists as a list');
  document.getElementById('ico-grid').toggleAttribute('hidden',on);document.getElementById('ico-stack').toggleAttribute('hidden',!on); // SVG elements have no .hidden property, so set the attribute
  if(on)grid.scrollTop=0;
}
viewbtn.addEventListener('click',()=>setGrid(!gridOn));

// Loader: crosshair draws out, holds while covers download, then splits to frame the first cover and hands over to the stack
(()=>{
  const ld=document.getElementById('loader'),text=document.getElementById('ld-text'),spin=document.getElementById('ld-spin'),status=document.getElementById('ld-status');
  const $=id=>document.getElementById(id);
  const LABELS=site.loader;
  const MIN=2400, MAX=8000, t0=performance.now();
  let ready=false,li=0,locked=false;
  const covers=PLAYLISTS.filter(p=>p.cover).map(p=>{const im=new Image();im.src=p.cover;return im.decode?im.decode().catch(()=>{}):new Promise(r=>{im.onload=im.onerror=r})});
  Promise.all([...covers,document.fonts?document.fonts.ready:null]).then(()=>{ready=true});
  requestAnimationFrame(()=>requestAnimationFrame(()=>ld.classList.add('drawn')));
  const showText=()=>status.classList.remove('wait');
  (document.fonts&&document.fonts.load?document.fonts.load('11px "Fragment Mono"').then(showText,showText):Promise.resolve().then(showText));
  setTimeout(showText,2500);   // never wait on the font for too long   // crosshair draws out from the centre
  const glyphs=['|','/','-','\\'];let g=0;const spinT=setInterval(()=>{spin.textContent=glyphs[g++%4]},110);
  const textT=setInterval(()=>{if(!locked)text.textContent=LABELS[++li%LABELS.length]},800);
  const check=setInterval(()=>{const el=performance.now()-t0;if((ready&&el>=MIN)||el>=MAX){clearInterval(check);lock()}},100);
  function lock(){
    locked=true;clearInterval(textT);text.textContent='Signal locked';
    // the focus cover sits exactly here (scale 1, no tilt), so split the lines out to its edges
    const W=innerWidth,H=innerHeight;
    const x0=Math.round(W/2-SIZE/2),x1=Math.round(W/2+SIZE/2),y0=Math.round(H/2-SIZE/2),y1=Math.round(H/2+SIZE/2);
    Object.assign($('ld-frame').style,{left:x0+'px',top:y0+'px',width:(x1-x0)+'px',height:(y1-y0)+'px'});
    pos=0;target=0;vpos=0;driftV=0;phase='settle';held=-1e9;   // newest playlist parked exactly where the frame lands; only the timer below releases it
    // open like an aperture: the stack shows through only between the four lines, so the cover is revealed as they part
    const EASE='cubic-bezier(.7,0,.2,1)';
    field.style.transition='none';field.style.clipPath='inset(50% 50% 50% 50%)';field.classList.remove('pre');
    ld.classList.add('opening');void field.offsetWidth;
    field.style.transition=`clip-path .9s ${EASE}`;
    field.style.clipPath=`inset(${y0}px ${W-x1}px ${H-y1}px ${x0}px)`;
    $('ln-t').style.top=y0+'px';$('ln-b').style.top=(y1-1)+'px';$('ln-l').style.left=x0+'px';$('ln-r').style.left=(x1-1)+'px';
    status.style.left=(x0+10)+'px';status.style.top=(y1+8)+'px';   // same 10px / 8px offset from the lines as at the start
    // once the lines land: the outline fades straight away, the neighbouring covers fade in,
    // and the drift starts as soon as the outline has gone
    setTimeout(()=>{clearInterval(spinT);ld.classList.add('framed');void ld.offsetWidth;ld.classList.add('fade');   // reflow so the outline fades rather than vanishing
      // the other covers fade in around the cover rather than being unmasked
      const others=cards.filter(c=>Math.abs(c.lastU??1)>.01);
      others.forEach(c=>{c.el.style.transition='none';c.el.style.opacity='0'});
      field.style.transition='none';field.style.clipPath='none';void field.offsetWidth;
      others.forEach(c=>{c.el.style.transition='opacity .8s ease'   /* slower than --fade: the loader is a one-off moment, not a control */;c.el.style.opacity='1'});
      setTimeout(()=>{ld.remove();phase='drift'},160);
      setTimeout(()=>others.forEach(c=>{c.el.style.transition='';c.el.style.opacity=''}),900)},920);
  }

})();

// Runtimes (and any missing titles or covers) arrive from /api/playlists, which reads the public playlist pages
fetch('/api/playlists').then(r=>r.ok?r.json():null).then(d=>{
  if(!d||!Array.isArray(d.playlists))return;
  d.playlists.forEach((x,i)=>{const p=PLAYLISTS[i];if(!p||!x)return;
    if(x.runtime&&!p.runtime){p.runtime=x.runtime;if(p._time)p._time.textContent=x.runtime}
  });
}).catch(()=>{});
