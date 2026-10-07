/* ============================================================
   AETERNUS Checker — логика приложения
   ------------------------------------------------------------
   Разметка — в checker.html, оформление — в styles.css,
   данные — в config.js, db.js и остальных файлах.
   Здесь только поведение.
   ============================================================ */

/* ═══════════════════════════════════════════════════════════
   AETERNUS Checker
   ═══════════════════════════════════════════════════════════ */

/* Строка авторства. Меняется здесь и больше нигде. */
const CREDIT = 'AETERNUS SEO Audit · developed by Alexander Kurbatov · 2026';

const SCHEMA_VERSION = 1;
const PRI = {crit:['crit','критично',0],high:['high','важно',1],med:['med','средне',2],low:['low','мелочь',3]};
/* Названия разделов живут только в config.js — см. sectionName() */
const STORE_KEY = 'aeternus:project';
const THEME_KEY = 'aeternus:theme';
const PREFS_KEY = 'aeternus:prefs';

/* ─── Хранилище: три бэкенда с определением доступности ─── */
const Store = (()=>{
  let mode='memory', mem={};
  try{
    if(typeof window.storage!=='undefined' && window.storage && window.storage.get) mode='window';
  }catch(e){}
  if(mode==='memory'){
    try{
      const k='__aeternus_probe__';
      localStorage.setItem(k,'1'); localStorage.removeItem(k);
      mode='local';
    }catch(e){}
  }
  return {
    mode,
    async get(k){
      try{
        if(mode==='window'){ const r=await window.storage.get(k); return r? r.value : null; }
        if(mode==='local')  return localStorage.getItem(k);
        return mem[k]||null;
      }catch(e){ return mem[k]||null; }
    },
    async set(k,v){
      try{
        if(mode==='window'){ await window.storage.set(k,v); return true; }
        if(mode==='local'){ localStorage.setItem(k,v); return true; }
        mem[k]=v; return true;
      }catch(e){ mem[k]=v; return false; }
    },
    async del(k){
      try{
        if(mode==='window'){ await window.storage.delete(k); return; }
        if(mode==='local'){ localStorage.removeItem(k); return; }
        delete mem[k];
      }catch(e){ delete mem[k]; }
    }
  };
})();

/* ─── Состояние ─── */
let S = null;
function blank(){
  return {
    schemaVersion:SCHEMA_VERSION, dbVersion:DB_VERSION,
    meta:{client:'',domain:'',author:'',date:new Date().toISOString().slice(0,10),note:''},
    config:{siteType:'shop',sales:'b2c',industry:'general',geo:'city',se:'ya',
            flags:['office'], sections:AXES.find(a=>a.id==='sections').opts.map(o=>o[0])},
    items:{}, custom:[], orphans:[], imports:[],
    ui:{filter:'all',q:''}
  };
}

/* ─── Теги и видимость ─── */
let _tagCache={key:null,set:null};
function tagSet(cfg){
  const key=JSON.stringify(cfg);
  if(_tagCache.key===key) return _tagCache.set;
  const s=new Set(['always']);
  AXES.forEach(ax=>{
    if(ax.id==='sections') return;
    if(ax.type==='many') (cfg[ax.id]||[]).forEach(v=>{const o=ax.opts.find(o=>o[0]===v); if(o) o[2].forEach(t=>s.add(t));});
    else { const o=ax.opts.find(o=>o[0]===cfg[ax.id]); if(o) o[2].forEach(t=>s.add(t)); }
  });
  const res=derive(s);
  _tagCache={key:JSON.stringify(cfg),set:res};
  return res;
}
function visible(show,set){
  if(!show) return true;
  if(show.not && show.not.some(t=>set.has(t))) return false;
  if(show.all && !show.all.every(t=>set.has(t))) return false;
  if(show.any && !show.any.some(t=>set.has(t))) return false;
  return true;
}
function activeBlocks(cfg){
  const set=tagSet(cfg), secs=cfg.sections||[];
  const out=[];
  BLOCKS.forEach(b=>{
    const sec=SECTION_OF_BLOCK[b.id];
    if(!secs.includes(sec)) return;
    if(!visible(b.show,set)) return;
    const items=b.items.filter(i=>!i.sub&&visible(i.show,set));
    const mine=(S? S.custom.filter(c=>c.block===b.id):[]);
    const all=items.concat(mine);
    if(all.length) out.push({...b,list:all,sec});
  });
  const ord=(typeof SECTION_ORDER!=='undefined')?SECTION_ORDER:[];
  out.sort((a,b)=>{
    const d=ord.indexOf(a.sec)-ord.indexOf(b.sec);
    return d!==0? d : 0;
  });
  return out;
}
function countFor(cfg){ return activeBlocks(cfg).reduce((a,b)=>a+b.list.length,0); }

/* ═══════════════ ПРИЛОЖЕНИЕ ═══════════════ */
const App = {

/* ─── старт ─── */
async init(){
  S = blank();
  this.screen('setup');
  this.renderOwnThemes();
  await this.loadTheme();
  await this.loadPrefs();
  this.renderSetup();
  this.bindDrop();
  await this.renderResume();
  if(Store.mode==='memory') this.setSave('off');
  else this.setSave('idle');
  this.bindKeys();
  document.addEventListener('click',e=>{
    if(!e.target.closest('.menu')) document.querySelectorAll('.menu.open').forEach(m=>m.classList.remove('open'));
  });
  window.addEventListener('beforeunload',e=>{
    if(this.dirty){ e.preventDefault(); e.returnValue=''; }
  });
  document.getElementById('fileIn').addEventListener('change',e=>this.readFile(e.target));
  document.getElementById('sfIn').addEventListener('change',e=>this.readSFFiles(e.target));
  const ovn=(typeof OVERRIDES!=='undefined')?
    Object.keys(OVERRIDES.items||{}).length+Object.keys(OVERRIDES.tpl||{}).length+
    Object.keys(OVERRIDES.arg||{}).length+Object.keys(OVERRIDES.lib||{}).length : 0;
  const mark=ovn? ' · применено переопределений: '+ovn : '';
  document.getElementById('creditSetup').textContent=CREDIT+mark;
  document.getElementById('creditAudit').textContent=CREDIT+mark;
},

/* ─── настройки интерфейса (не часть проекта) ─── */
async loadPrefs(){
  this.follow=true; this.helpOn=false;
  try{
    const raw=await Store.get(PREFS_KEY);
    if(raw){ const p=JSON.parse(raw); if(typeof p.follow==='boolean') this.follow=p.follow; }
  }catch(e){}
  const f=document.getElementById('hpFollow'); if(f) f.checked=this.follow;
},
savePrefs(){ Store.set(PREFS_KEY,JSON.stringify({follow:this.follow})); },

/* ─── темы ─── */
renderOwnThemes(){
  const box=document.getElementById('ownThemes');
  const t=this.customThemes||{};
  const keys=Object.keys(t);
  if(!box) return;
  box.innerHTML = keys.length
    ? '<div class="lbl">Свои темы</div>'+keys.map(k=>
        '<button data-th="'+esc(k)+'" onclick="App.theme(\''+k+'\')">'+esc(t[k].label||k)+'</button>').join('')
    : '';
},
async loadTheme(){
  let t = await Store.get(THEME_KEY);
  if(!t) t='paper';
  this.applyTheme(t);
},
applyTheme(t){
  this.curTheme=t;
  let real=t;
  if(t==='auto') real = matchMedia('(prefers-color-scheme: dark)').matches ? 'graphite':'paper';
  document.documentElement.dataset.theme=real;
  document.querySelectorAll('[data-th]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.th===t));
},
theme(t){ this.applyTheme(t); Store.set(THEME_KEY,t); },

/* ─── строка продолжения ─── */
async renderResume(){
  const box=document.getElementById('resume');
  if(!box) return;
  box.innerHTML='';
  let d=null;
  try{
    const raw=await Store.get(STORE_KEY);
    if(raw) d=JSON.parse(raw);
  }catch(e){ return; }
  if(!d||!d.items||!Object.keys(d.items).length) return;

  this.resumeData=d;
  const cfg=Object.assign(blank().config,d.config||{});
  const total=countFor(cfg)||1;
  const done=Object.keys(d.items).length;
  const pct=Math.min(100,Math.round(done/total*100));
  const dom=(d.meta&&d.meta.domain)||'без домена';
  const date=(d.meta&&d.meta.date)||'';
  box.innerHTML='<div class="resume"><div class="t"><b>Незавершённый аудит: '+esc(dom)+'</b>'+
    '<span>пройдено '+pct+'% · '+done+' из '+total+(date?' · '+esc(date):'')+'</span></div>'+
    '<button class="btn btn-p" onclick="App.resume()">Продолжить</button>'+
    '<button class="btn" onclick="App.dropResume()">Удалить</button></div>';
},
resume(){ if(this.resumeData) this.load(this.resumeData,true); },
dropResume(){
  this.modal('Удалить сохранённый аудит','Автосохранение будет очищено. Если файл проекта не выгружен, восстановить его не получится.',
    [['Удалить',async()=>{ await Store.del(STORE_KEY); this.resumeData=null; document.getElementById('resume').innerHTML=''; this.closeModal(); this.toast('Автосохранение очищено'); },true],
     ['Отмена',()=>this.closeModal()]]);
},

/* ─── перетаскивание файла проекта ─── */
bindDrop(){
  const veil=document.getElementById('drop');
  let depth=0;
  const show=on=>{ if(veil) veil.classList.toggle('on',on); };
  ['dragenter','dragover','dragleave','drop'].forEach(ev=>
    document.addEventListener(ev,e=>{ e.preventDefault(); e.stopPropagation(); },false));
  document.addEventListener('dragenter',e=>{
    if(!e.dataTransfer||!Array.from(e.dataTransfer.types||[]).includes('Files')) return;
    depth++; show(true);
  });
  document.addEventListener('dragleave',()=>{ depth=Math.max(0,depth-1); if(!depth) show(false); });
  document.addEventListener('drop',e=>{
    depth=0; show(false);
    const f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];
    if(!f) return;
    if(!/\.json$/i.test(f.name)){ this.toast('Нужен файл проекта в формате .json'); return; }
    const r=new FileReader();
    r.onload=()=>{ try{ this.load(JSON.parse(r.result)); }
                   catch(err){ this.toast('Не удалось прочитать файл: это не файл аудита или он повреждён'); } };
    r.readAsText(f);
  });
},

/* ─── конфигуратор ─── */
renderSetup(){
  const c=S.config;
  ['client','domain','author'].forEach(k=>{
    const el=document.getElementById('f-'+k);
    el.value=S.meta[k];
    el.oninput=()=>{S.meta[k]=el.value;this.touch();};
  });
  document.getElementById('presets').innerHTML =
    '<p class="presets-note">Заполнить все ответы разом под типовой проект:</p>'+
    PRESETS.map((p,i)=>'<button class="preset" onclick="App.usePreset('+i+')">'+esc(p[0])+'</button>').join('');

  document.getElementById('axes').innerHTML = AXES.map(ax=>{
    let h='<div class="eyebrow">'+esc(ax.t)+(ax.req?' <em>•</em>':'')+'</div>';
    if(ax.type==='many'){
      h+='<div class="checks">'+ax.opts.map(o=>{
        const on=(c[ax.id]||[]).includes(o[0]);
        return '<button class="chk" aria-pressed="'+on+'" onclick="App.toggleMany(\''+ax.id+'\',\''+o[0]+'\')"><s></s>'+esc(o[1])+'</button>';
      }).join('')+'</div>';
    } else {
      h+='<div class="opts">'+ax.opts.map(o=>{
        let pre='';
        if(o[3]&&o[3].startsWith('grp:')) pre='<div class="grp-lbl">'+esc(o[3].slice(4))+'</div>';
        const on=c[ax.id]===o[0];
        const delta=this.delta(ax.id,o[0]);
        return pre+'<button class="opt" aria-pressed="'+on+'" onclick="App.pick(\''+ax.id+'\',\''+o[0]+'\')">'+
               esc(o[1])+'<kbd>'+delta+'</kbd></button>';
      }).join('')+'</div>';
      const cur=ax.opts.find(o=>o[0]===c[ax.id]);
      if(cur&&cur[3]&&!cur[3].startsWith('grp:')) h+='<div class="opt-note">'+esc(cur[3])+'</div>';
    }
    return h;
  }).join('');

  const n=countFor(c);
  document.getElementById('goCount').innerHTML='В чек-листе <b>'+n+'</b> проверок';
},
delta(axId,val){
  const cur=countFor(S.config);
  const test=JSON.parse(JSON.stringify(S.config)); test[axId]=val;
  const d=countFor(test)-cur;
  return d>0? '+'+d : (d<0? String(d) : '·');
},
pick(ax,v){ S.config[ax]=v; this.touch(); this.renderSetup(); },
toggleMany(ax,v){
  const a=S.config[ax]||[];
  S.config[ax]= a.includes(v)? a.filter(x=>x!==v) : a.concat([v]);
  this.touch(); this.renderSetup();
},
usePreset(i){
  const p=PRESETS[i][1];
  Object.assign(S.config,JSON.parse(JSON.stringify(p)));
  this.touch(); this.renderSetup();
  this.toast('Профиль «'+PRESETS[i][0]+'» применён');
},

/* ─── переход в аудит ─── */
screen(name){
  const audit = name==='audit';
  document.getElementById('setup').hidden = audit;
  document.getElementById('audit').hidden = !audit;
  document.querySelectorAll('.audit-only').forEach(el=>el.hidden=!audit);
  const st=document.getElementById('stat'); if(st) st.hidden=!audit;
  const si=document.getElementById('saveInd'); if(si) si.hidden=!audit;
},
build(){
  this._foldInit=false;
  if(!countFor(S.config)){ this.toast('При таких настройках не осталось ни одной проверки'); return; }
  this.screen('audit');
  this.render();
  scrollTo(0,0);
},
backToSetup(){
  this.helpClose();
  this.screen('setup');
  this.renderSetup(); scrollTo(0,0);
},

/* ─── отрисовка чек-листа ─── */
render(){
  const blocks=activeBlocks(S.config);
  this.blocks=blocks;
  this.flat=blocks.flatMap(b=>b.list.map(i=>i.slug));
  this.flatItems={};
  blocks.forEach((b,bi)=>{
    b.num=String(bi+1).padStart(2,'0');
    b.list.forEach((i,ii)=>{ i.num=b.num+'.'+String(ii+1).padStart(2,'0'); this.flatItems[i.slug]=i; });
  });
  const m=S.meta;
  document.getElementById('printHead').hidden=false;
  document.getElementById('printHead').innerHTML=
    '<div class="dochead">'+
    '<div class="dh-main"><span class="dh-lbl">Аудит сайта</span><b>'+esc(m.domain||'—')+'</b></div>'+
    [['Клиент',m.client],['Аудитор',m.author],['Дата',m.date]].filter(x=>x[1]).map(x=>
      '<div class="dh-cell"><span class="dh-lbl">'+x[0]+'</span>'+esc(x[1])+'</div>').join('')+
    '</div>';

  document.getElementById('chips').innerHTML=[
    ['all','Все'],['todo','Не проверено'],['bad','Ошибки'],
    ['crit','Критичные'],['crithigh','Критичные и важные'],['noted','С комментарием']
  ].map(f=>'<button class="chip" data-f="'+f[0]+'" aria-pressed="'+(S.ui.filter===f[0])+'" onclick="App.filter(\''+f[0]+'\')">'+f[1]+'</button>').join('');

  const q=document.getElementById('q');
  q.value=S.ui.q;
  q.oninput=()=>{
    S.ui.q=q.value;
    /* список из 336 строк — это ~140 КБ разметки и около 4000 узлов.
       Перерисовывать его на каждую букву незачем */
    clearTimeout(this._q);
    this._q=setTimeout(()=>this.renderList(),180);
  };

  this.renderList();
},
pass(it){
  const st=(S.items[it.slug]||{}).status, note=(S.items[it.slug]||{}).note;
  switch(S.ui.filter){
    case 'todo': if(st) return false; break;
    case 'bad': if(st!=='bad') return false; break;
    case 'crit': if(it.p!=='crit') return false; break;
    case 'crithigh': if(it.p!=='crit'&&it.p!=='high') return false; break;
    case 'noted': if(!note) return false; break;
  }
  const q=S.ui.q.trim().toLowerCase();
  if(q){
    const hay=(it.t+' '+(it.hint||'')+' '+it.slug).toLowerCase();
    if(!hay.includes(q)) return false;
  }
  return true;
},
renderList(){
  this.initFold(this.blocks);
  const q=S.ui.q.trim();
  let html='', navHtml='', lastSec=null, shownTotal=0;

  const forceOpen = !!q || S.ui.filter!=='all';
  this.blocks.forEach(b=>{
    const shown=b.list.filter(i=>this.pass(i));
    shownTotal+=shown.length;
    const done=b.list.filter(i=>S.items[i.slug]&&S.items[i.slug].status).length;
    const bad=b.list.filter(i=>S.items[i.slug]&&S.items[i.slug].status==='bad').length;

    if(b.sec!==lastSec){ navHtml+='<div class="side-sec">'+esc(sectionName(b.sec))+'</div>'; lastSec=b.sec; }
    navHtml+='<a href="#b-'+b.id+'" onclick="App.openBlock(\''+b.id+'\')" class="'+(done===b.list.length?'done':'')+' '+(bad?'bad':'')+'">'+
             '<span title="'+esc(b.n)+'">'+esc(b.n)+'</span><em>'+(bad?bad+'! ':'')+done+'/'+b.list.length+'</em></a>';

    const shut=!forceOpen && !!(this.closed&&this.closed[b.id]);
    html+='<section class="blk'+(shut?' closed':'')+'" id="b-'+b.id+'">'+
      '<div class="blk-h" onclick="App.foldClick(event,\''+b.id+'\')">'+
      '<span class="fold">'+(shut?'▸':'▾')+'</span>'+
      '<span class="bnum">'+esc(b.num||'')+'</span><h2>'+esc(b.n)+'</h2>'+
      '<span class="n">'+done+'/'+b.list.length+'</span>'+
      '<button class="mass noprint" onclick="App.markBlock(\''+b.id+'\')">отметить блок как неприменимый</button></div>'+
      (b.d?'<p class="d">'+esc(b.d)+'</p>':'');

    html += shown.length ? shown.map(i=>this.itemHtml(i,q)).join('')
          : '<p class="empty">По текущему фильтру в этом блоке ничего нет.</p>';
    html+='<button class="addown noprint" onclick="App.addOwn(\''+b.id+'\')">+ Добавить свой пункт</button></section>';
  });

  if(!shownTotal && q) html='<p class="empty">Ничего не найдено по запросу «'+esc(q)+'». Попробуйте другое слово или сбросьте фильтр.</p>';

  document.getElementById('list').innerHTML=html;
  document.getElementById('nav').innerHTML=navHtml;
  this.stats();
},
itemHtml(it,q){
  const st=S.items[it.slug]||{};
  const cls=[st.status||'', (st.note&&st.status!=='bad')?'noting':'', this.cur===it.slug?'cur':''].filter(Boolean).join(' ');
  const hl=s=>q? esc(s).replace(new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig'),'<mark>$1</mark>') : esc(s);
  return '<div class="item '+cls+'" id="i-'+cssId(it.slug)+'" data-slug="'+esc(it.slug)+'" onclick="App.focusItem(event,\''+it.slug+'\')">'+
    '<div class="ihead">'+
      '<span class="num">'+esc(it.num||'')+'</span>'+
      '<span class="pri '+it.p+'">'+PRI[it.p][1]+'</span>'+
      '<div class="itxt"><p>'+hl(it.t)+
        ' <span class="slug">'+esc(it.slug)+'</span></p>'+
        (it.hint?'<p class="hint">'+hl(it.hint)+'</p>':'')+
      '</div>'+
      (typeof HELP!=='undefined'&&HELP[it.slug]?
        '<button class="iq noprint" aria-expanded="'+(this.helpOn&&this.helpSlug===it.slug)+'" title="Справка" '+
        'onclick="App.helpToggle(\''+it.slug+'\')">?</button>':'')+
      '<div class="acts noprint">'+
        '<button class="a-ok"  aria-pressed="'+(st.status==='ok')+'"  onclick="App.setStatus(\''+it.slug+'\',\'ok\')">ок</button>'+
        '<button class="a-bad" aria-pressed="'+(st.status==='bad')+'" onclick="App.setStatus(\''+it.slug+'\',\'bad\')">ошибка</button>'+
        '<button class="a-na"  aria-pressed="'+(st.status==='na')+'"  onclick="App.setStatus(\''+it.slug+'\',\'na\')">н/п</button>'+
      '</div></div>'+
    '<div class="note">'+sfHtml(it.slug)+toolHtml(it,st)+varsHtml(it.slug,st.vars||{})+
      '<textarea placeholder="Что именно не так и что сделать — попадёт в ТЗ" '+
      'oninput="App.setNote(\''+it.slug+'\',this.value)">'+esc(st.note||'')+'</textarea></div>'+
  '</div>';
},

/* ─── панель справки ─── */
helpToggle(slug){
  if(this.helpOn && this.helpSlug===slug) return this.helpClose();
  this.cur=slug; this.helpOpen(slug);
},
helpOpen(slug){
  if(typeof HELP==='undefined'||!HELP[slug]) return;
  this.helpOn=true; this.helpSlug=slug;
  document.querySelector('.cols').classList.add('help');
  this.helpRender(slug);
  this.savePrefs();
  document.querySelectorAll('.iq').forEach(b=>b.setAttribute('aria-expanded',false));
  const host=document.getElementById('i-'+cssId(slug));
  if(host){ const q=host.querySelector('.iq'); if(q) q.setAttribute('aria-expanded',true); }
},
helpClose(){
  this.helpOn=false; this.helpSlug=null;
  document.querySelector('.cols').classList.remove('help');
  document.querySelectorAll('.iq').forEach(b=>b.setAttribute('aria-expanded',false));
  this.savePrefs();
},
helpFollow(v){ this.follow=v; this.savePrefs(); },
helpRender(slug){
  const h=HELP[slug];
  const it=this.flatItems&&this.flatItems[slug];
  if(!h||!it) return;
  document.getElementById('hpTitle').textContent=it.t;
  const pri=document.getElementById('hpPri');
  pri.className='pri '+it.p; pri.textContent=PRI[it.p][1];
  document.getElementById('hpSlug').textContent=slug;

  const sec=(label,inner,cls)=>inner? '<div class="hp-sec '+(cls||'')+'"><h4>'+label+'</h4>'+inner+'</div>' : '';
  const list=a=>a&&a.length? '<ul>'+a.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>' : '';
  let b='';
  b+=sec('Зачем', h.why? '<p>'+esc(h.why)+'</p>':'');
  b+=sec('Как проверить', list(h.how));
  b+=sec('Инструменты', h.tools? h.tools.map(t=>'<div class="hp-tool"><b>'+esc(t.t)+'</b><span>'+esc(t.d)+'</span></div>').join(''):'');
  b+=sec('На что смотреть', list(h.watch), 'hp-warn');
  b+=sec('Когда это не ошибка', list(h.falsePos), 'hp-ok');
  b+=sec('Норма', h.norm? '<p>'+esc(h.norm)+'</p>':'');
  b+=sec('Синтаксис правил', list(h.syntax));
  b+=sec('Как исправить', h.fix? '<p>'+esc(h.fix)+'</p>':'');
  if(h.related&&h.related.length){
    const links=h.related.filter(r=>this.flatItems[r]);
    if(links.length) b+=sec('Смежные проверки','<div class="hp-rel">'+
      links.map(r=>'<button onclick="App.helpJump(\''+r+'\')">'+esc(this.flatItems[r].t.slice(0,42))+(this.flatItems[r].t.length>42?'…':'')+'</button>').join('')+'</div>');
  }
  document.getElementById('hpBody').innerHTML=b;
  document.getElementById('hpBody').scrollTop=0;

  const st=S.items[slug]||{};
  document.getElementById('hpActs').innerHTML=
    '<button class="a-ok"  aria-pressed="'+(st.status==='ok')+'"  onclick="App.setStatus(\''+slug+'\',\'ok\')">ок</button>'+
    '<button class="a-bad" aria-pressed="'+(st.status==='bad')+'" onclick="App.setStatus(\''+slug+'\',\'bad\')">ошибка</button>'+
    '<button class="a-na"  aria-pressed="'+(st.status==='na')+'"  onclick="App.setStatus(\''+slug+'\',\'na\')">н/п</button>';
},
helpJump(slug){ this.goTo(slug); if(typeof HELP!=='undefined'&&HELP[slug]) this.helpOpen(slug); },
helpSync(){ if(this.helpOn&&this.follow&&this.cur&&typeof HELP!=='undefined'&&HELP[this.cur]) this.helpOpen(this.cur); },

/* ─── свёрнутые блоки и боковая колонка на узком экране ─── */
isNarrow(){ try{ return matchMedia('(max-width:940px)').matches; }catch(e){ return false; } },
toggleSide(){
  const el=document.querySelector('.side'), btn=document.getElementById('sideToggle');
  if(!el) return;
  const open=el.classList.toggle('open');
  if(btn) btn.setAttribute('aria-expanded',open);
},
foldClick(e,id){
  if(e.target.closest('button.mass')) return;
  this.toggleBlock(id);
},
toggleBlock(id){
  this.closed=this.closed||{};
  this.closed[id]=!this.closed[id];
  const el=document.getElementById('b-'+id);
  if(el){
    el.classList.toggle('closed',!!this.closed[id]);
    const f=el.querySelector('.fold'); if(f) f.textContent=this.closed[id]?'▸':'▾';
  }
},
/* на узком экране раскрыт только первый блок: список из 336 строк
   на телефоне невозможно листать целиком */
initFold(blocks){
  if(this._foldInit) return;
  this._foldInit=true;
  this.closed={};
  if(this.isNarrow()) blocks.forEach((b,i)=>{ if(i>0) this.closed[b.id]=true; });
},

/* ─── текущий пункт ─── */
focusItem(e,slug){
  /* клик по кнопке, ссылке или полю ввода не меняет текущий пункт */
  if(e.target.closest('button,a,input,textarea,select')) return;
  if(this.cur===slug) return;
  const prev=this.cur; this.cur=slug;
  if(prev) this.patchItem(prev);
  this.patchItem(slug);
  this.helpSync();
},

/* ─── статусы ─── */
setStatus(slug,v){
  const rec=S.items[slug]||(S.items[slug]={});
  rec.status = rec.status===v ? null : v;
  rec.source = 'manual';
  if(!rec.status && !rec.note && !rec.vars) delete S.items[slug];
  this.touch();
  this.patchItem(slug);
  this.stats();
  this.syncNav();
  if(this.helpOn&&this.helpSlug===slug) this.helpRender(slug);
},
toolCms(slug,k){ this.toolToggle(slug,'cms',k); },
toolCommon(slug,k){ this.toolToggle(slug,'common',k); },
toolToggle(slug,field,k){
  const rec=S.items[slug]||(S.items[slug]={});
  rec.vars=rec.vars||{};
  const a=(rec.vars[field]||'').split(',').filter(Boolean);
  rec.vars[field]= a.includes(k)? a.filter(x=>x!==k).join(',') : a.concat([k]).join(',');
  if(!rec.vars[field]) delete rec.vars[field];
  this.touch(); this.renderList();
},
robotsCopy(slug){
  const t=robotsText((S.items[slug]||{}).vars||{});
  this.toast(copyPlain(t)? 'Файл скопирован' : 'Браузер не дал доступ к буферу');
},
robotsDownload(slug){
  const t=robotsText((S.items[slug]||{}).vars||{});
  this.dl('robots.txt',t,'text/plain');
  this.toast('robots.txt сохранён');
},
setVar(slug,k,v){
  const rec=S.items[slug]||(S.items[slug]={});
  rec.vars=rec.vars||{};
  if(v==='') delete rec.vars[k]; else rec.vars[k]=v;
  if(!Object.keys(rec.vars).length) delete rec.vars;
  if(!rec.status&&!rec.note&&!rec.vars) delete S.items[slug];
  this.touch();
  const item=this.flatItems&&this.flatItems[slug];
  if(item&&item.tool){ clearTimeout(this._tool); this._tool=setTimeout(()=>this.renderList(),600); }
},
setNote(slug,v){
  const rec=S.items[slug]||(S.items[slug]={});
  rec.note=v;
  if(!v && !rec.status) delete S.items[slug];
  this.touch();
},
patchItem(slug){
  const el=document.getElementById('i-'+cssId(slug));
  if(!el) return;
  const st=S.items[slug]||{};
  el.className='item '+[st.status||'',(st.note&&st.status!=='bad')?'noting':'',this.cur===slug?'cur':''].filter(Boolean).join(' ');
  el.querySelectorAll('.acts button').forEach(b=>{
    const v=b.className.replace('a-','');
    b.setAttribute('aria-pressed', st.status===v);
  });
},
markBlock(id){
  const b=this.blocks.find(x=>x.id===id); if(!b) return;
  this.modal('Отметить блок как неприменимый',
    '«'+b.n+'»: '+b.list.length+' проверок получат статус «н/п». Уже отмеченные не изменятся.',
    [['Отметить',()=>{
        b.list.forEach(i=>{ if(!S.items[i.slug]||!S.items[i.slug].status){
          S.items[i.slug]=Object.assign(S.items[i.slug]||{},{status:'na',source:'manual'}); }});
        this.touch(); this.renderList(); this.closeModal();
        this.toast('Блок отмечен как неприменимый');
      },true],
     ['Отмена',()=>this.closeModal()]]);
},
addOwn(block){
  const t=prompt('Текст проверки:');
  if(!t||!t.trim()) return;
  let p=(prompt('Приоритет: crit / high / med / low','high')||'high').trim();
  if(!PRI[p]) p='high';
  S.custom.push({slug:'custom.'+Date.now(),block,p,t:t.trim(),hint:'Свой пункт',show:null});
  this.touch(); this.render();
},

/* ─── счётчики ─── */
stats(){
  const all=this.flat;
  let ok=0,bad=0,na=0;
  all.forEach(s=>{const st=(S.items[s]||{}).status; if(st==='ok')ok++;else if(st==='bad')bad++;else if(st==='na')na++;});
  const done=ok+bad+na, total=all.length;
  const box=v=>'<i>'+v+'</i>';
  document.getElementById('stat').innerHTML=
    '<span>'+box((total?Math.round(done/total*100):0)+'%')+' пройдено</span>'+
    '<span><u style="background:var(--bad)"></u>'+box(bad)+' ошибок</span>'+
    '<span><u style="background:var(--ok)"></u>'+box(ok)+' ок</span>'+
    '<span><u style="background:var(--na)"></u>'+box(na)+' н/п</span>'+
    '<span>осталось '+box(total-done)+'</span>';

  const spec=document.getElementById('spectrum');
  if(spec.childElementCount!==total){
    spec.innerHTML=all.map(s=>'<i data-slug="'+esc(s)+'"></i>').join('');
    spec.onclick=e=>{ const t=e.target.closest('i'); if(t) this.goTo(t.dataset.slug); };
  }
  [...spec.children].forEach((el,i)=>{
    const st=(S.items[all[i]]||{}).status;
    if(st) el.dataset.s=st; else el.removeAttribute('data-s');
  });
},
syncNav(){
  let lastSec=null,h='';
  this.blocks.forEach(b=>{
    const done=b.list.filter(i=>S.items[i.slug]&&S.items[i.slug].status).length;
    const bad=b.list.filter(i=>S.items[i.slug]&&S.items[i.slug].status==='bad').length;
    if(b.sec!==lastSec){ h+='<div class="side-sec">'+esc(sectionName(b.sec))+'</div>'; lastSec=b.sec; }
    h+='<a href="#b-'+b.id+'" onclick="App.openBlock(\''+b.id+'\')" class="'+(done===b.list.length?'done':'')+' '+(bad?'bad':'')+'">'+
       '<span title="'+esc(b.n)+'">'+esc(b.n)+'</span><em>'+(bad?bad+'! ':'')+done+'/'+b.list.length+'</em></a>';
  });
  document.getElementById('nav').innerHTML=h;
},
openBlock(id){
  if(this.closed&&this.closed[id]) this.toggleBlock(id);
  const side=document.querySelector('.side');
  if(side&&this.isNarrow()&&side.classList.contains('open')) this.toggleSide();
},
goTo(slug){
  const el=document.getElementById('i-'+cssId(slug));
  if(!el){ this.filter('all'); setTimeout(()=>this.goTo(slug),40); return; }
  el.scrollIntoView({block:'center',behavior:'smooth'});
  this.cur=slug; this.patchItem(slug);
},
filter(f){ S.ui.filter=f; document.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed',c.dataset.f===f)); this.renderList(); },
clearSearch(){ S.ui.q=''; document.getElementById('q').value=''; this.renderList(); },

/* ─── автосохранение ─── */
touch(){
  this.dirty=true; this.setSave('dirty');
  clearTimeout(this._t);
  this._t=setTimeout(()=>this.autosave(),1500);
},
async autosave(){
  if(Store.mode==='memory'){ this.setSave('off'); return; }
  const ok=await Store.set(STORE_KEY,JSON.stringify(S));
  if(ok){ this.dirty=false; this.savedAt=new Date(); this.setSave('idle'); }
  else this.setSave('off');
},
setSave(s){
  const el=document.getElementById('saveInd');
  if(!el) return;
  el.dataset.s=s;
  if(s==='off') el.textContent='автосохранение недоступно';
  else if(s==='dirty') el.textContent='есть несохранённое';
  else el.textContent = this.savedAt? 'сохранено '+this.savedAt.toTimeString().slice(0,5) : 'сохранено';
},

/* ─── импорт выгрузок Screaming Frog ─── */
openImport(){
  if(typeof SF_RULES==='undefined'){ this.toast('Файл sf-map.js не подключён'); return; }
  const im=S.imports&&S.imports.length? S.imports[S.imports.length-1] : null;
  const done=Object.keys(this.sf||{}).length;
  this.modal('Импорт выгрузок Screaming Frog',
    (im? 'Последняя загрузка: '+im.at+'. Распознано файлов: '+im.files+', заполнено пунктов: '+done+'.\n\n' : '')+
    'Выгрузите из Screaming Frog в формате CSV: Internal → All и, при наличии, All Inlinks по адресам с кодом ответа не 200. '+
    'Можно выбрать сразу несколько файлов — каждый опознаётся по колонкам, лишнее игнорируется.',
    [['Выбрать файлы',()=>{ this.closeModal(); document.getElementById('sfIn').click(); },true],
     ['Отмена',()=>this.closeModal()]]);
},
readSFFiles(inp){
  const list=Array.from(inp.files||[]);
  if(!list.length) return;
  let left=list.length; const parsed=[], bad=[];
  list.forEach(f=>{
    const r=new FileReader();
    r.onload=()=>{
      try{
        const text=decodeSF(r.result);
        const d=readSF(text,(typeof OVERRIDES!=='undefined'&&OVERRIDES.sf)||null,f.name);
        if(d&&d.kind) parsed.push(Object.assign(d,{file:f.name}));
        else bad.push(Object.assign(d||{},{file:f.name}));
      }catch(e){ bad.push({file:f.name}); }
      if(!--left) this.applyImport(parsed,bad);
    };
    r.onerror=()=>{ bad.push(f.name); if(!--left) this.applyImport(parsed,bad); };
    r.readAsArrayBuffer(f);
  });
  inp.value='';
},
applyImport(files,bad){
  if(!files.length){
    /* Файл не опознан ни по имени, ни по колонкам. Скорее всего
       изменился заголовок: предлагаем сопоставить вручную. */
    if(bad.length&&bad[0].header) return this.askColumns(bad[0],bad,files);
    this.modal('Не удалось распознать файлы',
      'Ни один файл не опознан. Проверьте, что выгрузка сделана в формате CSV и содержит строку заголовков. '+
      (bad.length? 'Не распознаны: '+bad.map(b=>b.file||b).join(', ') : ''),
      [['Понятно',()=>this.closeModal(),true]]);
    return;
  }
  const out=runRules(files);
  this.sf=out.res; this.sfNotes=out.notes;

  /* порог значимости: единичная находка на большом сайте не задача для ТЗ */
  const pagesTotal=Math.max(1,out.counts.html);
  let applied=0, skipped=0, conflicts=0;
  Object.entries(out.res).forEach(([slug,sum])=>{
    const n=sum.pages||sum.total;
    if(n<3 && n/pagesTotal<0.005){ skipped++; return; }
    const rec=S.items[slug];
    if(rec&&rec.status&&rec.source==='manual'&&rec.status!=='bad'){ conflicts++; return; }
    S.items[slug]=Object.assign(rec||{},{status:'bad',source:'sf'});
    applied++;
  });
  S.imports=(S.imports||[]).concat([{at:new Date().toLocaleString('ru-RU'),
    files:files.length, rows:out.counts, applied}]);
  this.touch(); this.renderList();

  const lines=[];
  lines.push('Распознано файлов: '+files.length+'. Строк: обход '+out.counts.internal+
    ', ссылки '+out.counts.inlinks+'.');
  lines.push('Отмечено пунктов: '+applied+(skipped? ', пропущено ниже порога значимости: '+skipped:'')+
    (conflicts? ', расхождений с вашими отметками: '+conflicts:'')+'.');
  out.notes.forEach(n=>lines.push('· '+n));
  if(bad.length) lines.push('Не распознаны: '+bad.map(b=>b.file||b).join(', '));
  this.modal('Импорт завершён',lines.join('\n'),[['Понятно',()=>this.closeModal(),true]]);
},
/* Ручное сопоставление колонок. Нужно, когда версия Screaming Frog
   переименовала заголовок: чинить приходится в момент импорта,
   а не в отдельном файле. Выбор сохраняется в переопределениях. */
askColumns(file,bad,files){
  const need=['address','statusCode','indexability','from','to'];
  const opts=file.header.map((h,i)=>'<option value="'+i+'">'+esc(h||('колонка '+(i+1)))+'</option>').join('');
  const rows=need.map(f=>'<div class="fld2"><label>'+esc(f)+'</label>'+
    '<select id="mc-'+f+'"><option value="">— не использовать —</option>'+opts+'</select></div>').join('');
  this.modal('Не удалось определить колонки',
    'Файл «'+esc(file.file||'')+'» не опознан. Укажите, какие колонки чему соответствуют — выбор сохранится и применится к следующим выгрузкам.',
    [['Сохранить',()=>{
        const man=Object.assign({}, (typeof OVERRIDES!=='undefined'&&OVERRIDES.sf)||{});
        need.forEach(f=>{ const el=document.getElementById('mc-'+f);
          if(el&&el.value!=='') man[f]=Number(el.value); });
        if(typeof OVERRIDES!=='undefined') OVERRIDES.sf=man;
        this.closeModal();
        this.toast('Сопоставление сохранено. Выгрузите overrides.js в админке, чтобы оно не потерялось');
      },true],
     ['Отмена',()=>this.closeModal()]]);
  const box=document.getElementById('mText');
  if(box) box.insertAdjacentHTML('afterend','<div class="mapcols">'+rows+'</div>');
},
copySfTable(slug,mode){
  const t=sfTable(slug,this.sf&&this.sf[slug],mode);
  if(!t){ this.toast('Данных для таблицы нет'); return; }
  this.toast(copyPlain(t)? 'Таблица скопирована. Вставьте в Google Таблицы'
                         : 'Браузер не дал доступ к буферу');
},

/* ─── файлы ─── */
fname(ext){
  const d=(S.meta.domain||'site').replace(/^https?:\/\//,'').replace(/[^\w.-]/g,'');
  return 'audit-'+d+'-'+S.meta.date+'.'+ext;
},
dl(name,text,type){
  const b=new Blob([text],{type:(type||'text/plain')+';charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(b); a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
},
saveFile(){ this.dl(this.fname('json'),JSON.stringify(S,null,1),'application/json'); this.autosave(); this.toast('Файл аудита сохранён'); },
openFile(){ document.getElementById('fileIn').click(); },
readFile(inp){
  const f=inp.files&&inp.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{
    try{ this.load(JSON.parse(r.result)); }
    catch(e){ this.toast('Не удалось прочитать файл: это не файл аудита или он повреждён'); }
    inp.value='';
  };
  r.readAsText(f);
},
load(d,silent){
  const migrated=migrate(d);
  S=migrated.state;
  this.dirty=false;
  this.renderSetup();
  this.build();
  if(migrated.orphans.length){
    this.toast('Загружено. '+migrated.orphans.length+' пунктов из файла больше нет в базе — они сохранены в проекте');
  } else if(!silent) this.toast('Аудит загружен');
},
askReset(){
  this.modal('Начать новый аудит','Текущий прогресс будет очищен. Сохраните файл, если он нужен.',
    [['Начать новый',async()=>{await Store.del(STORE_KEY);S=blank();this.dirty=false;this.resumeData=null;this.closeModal();this.backToSetup();await this.renderResume();},true],
     ['Отмена',()=>this.closeModal()]]);
},

/* ─── выгрузка ТЗ ─── */
tzData(){
  const order=['tech','pages','blocks','geo','external'];
  const secTitle={tech:'Технические правки',pages:'Создание и доработка страниц',
    blocks:'Блоки и коммерческие элементы',geo:'GEO: видимость в нейропоиске',external:'Внешние сигналы'};
  const mapSec={tech:'tech',analytics:'tech',legal:'tech',commerce:'blocks',blocks:'blocks',
    trust:'blocks',pages:'pages',local:'external',geo:'geo'};
  const groups={};
  this.blocks.forEach(b=>{
    const g=mapSec[b.sec]||'tech';
    b.list.forEach(i=>{
      if(i.sub) return;
      const st=S.items[i.slug];
      if(!st||st.status!=='bad') return;
      (groups[g]=groups[g]||[]).push({...i,block:b.n,note:st.note||'',vars:st.vars||{}});
    });
  });
  /* объединение пунктов одной группы в одну задачу */
  const GR=(typeof GROUPS!=='undefined')?GROUPS:{};
  Object.keys(groups).forEach(k=>{
    const byGroup={};
    groups[k].forEach(i=>{ if(i.group&&GR[i.group]) (byGroup[i.group]=byGroup[i.group]||[]).push(i); });
    Object.entries(byGroup).forEach(([gk,members])=>{
      if(members.length<2) return;
      groups[k]=groups[k].filter(i=>!members.includes(i));
      groups[k].push({
        merged:true, gk, members,
        p:members.map(m=>m.p).sort((a,b)=>PRI[a][2]-PRI[b][2])[0],
        block:members[0].block,
        t:GR[gk].title, slug:'group.'+gk
      });
    });
  });
  order.forEach(k=>{ if(groups[k]) groups[k].sort((a,b)=>PRI[a.p][2]-PRI[b.p][2]); });
  return {order,secTitle,groups,total:Object.values(groups).reduce((a,g)=>a+g.length,0)};
},
tzHtml(){
  const d=this.tzData(), m=S.meta;
  if(!d.total) return null;
  let h='<h1>'+esc(m.domain||'Сайт')+' — техническое задание на доработку</h1>';
  h+='<p><b>Клиент:</b> '+esc(m.client||'—')+'<br><b>Дата:</b> '+esc(m.date)+'<br><b>Аудитор:</b> '+esc(m.author||'—')+'</p>';
  h+='<p>Ниже перечислены задачи по итогам аудита. Просьба вносить статус выполнения и комментарии по каждому пункту.</p>';
  d.order.forEach(k=>{
    const g=d.groups[k]; if(!g||!g.length) return;
    h+='<h2>'+esc(d.secTitle[k])+'</h2>';
    if(typeof SECTION_INTRO!=='undefined'&&SECTION_INTRO[k]) h+='<p>'+esc(SECTION_INTRO[k])+'</p>';
    g.forEach((it,n)=>{ h+=renderNodesHtml(it.merged? groupNodes(it,n+1) : itemNodes(it,n+1)); });
  });
  return h;
},
async copyTZ(){
  const h=this.tzHtml();
  if(!h){ this.toast('Ни одна проверка не отмечена как ошибка — выгружать нечего'); return; }
  const plain=h.replace(/<[^>]+>/g,'\n').replace(/\n{2,}/g,'\n').trim();
  let done=false;
  try{
    if(navigator.clipboard && window.ClipboardItem){
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([h],{type:'text/html'}),
        'text/plain': new Blob([plain],{type:'text/plain'})
      })]);
      done=true;
    }
  }catch(e){}
  if(!done) done=legacyCopyHtml(h);
  this.toast(done? 'ТЗ скопировано. Вставьте в пустой документ Google Docs'
                 : 'Браузер не дал доступ к буферу. Скачайте ТЗ файлом');
},
downloadTZ(){
  const d=this.tzData(), m=S.meta;
  if(!d.total){ this.toast('Ни одна проверка не отмечена как ошибка'); return; }
  let o='# '+(m.domain||'Сайт')+' — техническое задание на доработку\n\n';
  o+='**Клиент:** '+(m.client||'—')+'  \n**Дата:** '+m.date+'  \n**Аудитор:** '+(m.author||'—')+'\n\n';
  o+='Задач по итогам аудита: '+d.total+'\n';
  d.order.forEach(k=>{
    const g=d.groups[k]; if(!g||!g.length) return;
    o+='\n## '+d.secTitle[k]+'\n\n';
    if(typeof SECTION_INTRO!=='undefined'&&SECTION_INTRO[k]) o+=SECTION_INTRO[k]+'\n\n';
    g.forEach((it,n)=>{ o+=renderNodesMd(it.merged? groupNodes(it,n+1) : itemNodes(it,n+1)); });
  });
  this.dl(this.fname('md'),o,'text/markdown');
},
downloadFull(){
  const m=S.meta, L={ok:'ОК',bad:'ОШИБКА',na:'н/п'};
  let o='# Чек-лист аудита '+(m.domain||'')+'\n\n';
  o+='**Клиент:** '+(m.client||'—')+'  \n**Дата:** '+m.date+'  \n**Аудитор:** '+(m.author||'—')+'\n';
  this.blocks.forEach(b=>{
    const done=b.list.filter(i=>S.items[i.slug]&&S.items[i.slug].status).length;
    o+='\n## '+b.n+' — '+done+'/'+b.list.length+'\n\n';
    b.list.forEach(i=>{
      const st=S.items[i.slug]||{};
      o+='- ['+(st.status==='ok'?'x':' ')+'] ('+PRI[i.p][1]+') '+i.t+(st.status?' — **'+L[st.status]+'**':'')+'\n';
      if(st.note) o+='    > '+st.note.replace(/\n/g,' ')+'\n';
    });
  });
  this.dl(this.fname('md'),o,'text/markdown');
},
copyTasks(){
  const d=this.tzData();
  if(!d.total){ this.toast('Нет задач для выгрузки'); return; }
  let tsv='Задача\tРаздел\tПриоритет\tСтатус\tКомментарий подрядчика\n';
  d.order.forEach(k=>(d.groups[k]||[]).forEach(it=>{
    tsv+=[it.t.replace(/\t/g,' '),it.block,PRI[it.p][1],'',''].join('\t')+'\n';
  }));
  copyPlain(tsv);
  this.toast('Таблица задач скопирована. Вставьте в Google Sheets');
},

/* ─── служебное ─── */
toggleMenu(id){
  const m=document.getElementById(id);
  const was=m.classList.contains('open');
  document.querySelectorAll('.menu.open').forEach(x=>x.classList.remove('open'));
  if(!was) m.classList.add('open');
},
toast(t){
  const el=document.getElementById('toast');
  el.textContent=t; el.classList.add('on');
  clearTimeout(this._toast);
  this._toast=setTimeout(()=>el.classList.remove('on'),3400);
},
modal(title,text,acts){
  document.getElementById('mTitle').textContent=title;
  document.getElementById('mText').textContent=text;
  const box=document.getElementById('mActs');
  box.innerHTML='';
  acts.forEach(([label,fn,primary])=>{
    const b=document.createElement('button');
    b.className='btn'+(primary?' btn-p':''); b.textContent=label; b.onclick=fn;
    box.appendChild(b);
  });
  document.getElementById('modal').classList.add('on');
},
closeModal(){ document.getElementById('modal').classList.remove('on'); },
showAbout(){
  this.modal('Конфигуратор аудита',
    'Ответы на вопросы ниже определяют, какие проверки попадут в чек-лист. '+
    'Нерелевантное не появится: у интернет-магазина не будет пунктов про запись к врачу, '+
    'а у контентного проекта — про корзину. Отраслевые и юридические требования добавляются сами. '+
    'Число рядом с каждым вариантом показывает, сколько проверок он добавит или уберёт. '+
    'Быстрый старт заполняет все ответы разом под типовой проект — дальше их можно поправить. '+
    'Файл ранее сохранённого аудита можно перетащить прямо на страницу.',
    [['Понятно',()=>this.closeModal(),true]]);
},
showKeys(){
  this.modal('Горячие клавиши',
    '1 — ок · 2 — ошибка · 3 — неприменимо · J и K или стрелки — следующая и предыдущая проверка · ? — справка по текущему пункту · / — поиск · Ctrl+S — сохранить файл · Esc — закрыть окно или панель',
    [['Понятно',()=>this.closeModal(),true]]);
},
bindKeys(){
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      if(document.getElementById('modal').classList.contains('on')) this.closeModal();
      else if(document.querySelector('.menu.open')) document.querySelectorAll('.menu.open').forEach(m=>m.classList.remove('open'));
      else if(this.helpOn) this.helpClose();
      return;
    }
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){ e.preventDefault(); this.saveFile(); return; }
    const tag=(e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea') return;
    if(document.getElementById('audit').hidden) return;
    if(e.key==='/'){ e.preventDefault(); document.getElementById('q').focus(); return; }
    if(e.key==='?'&&this.cur){ e.preventDefault(); this.helpToggle(this.cur); return; }
    const map={'1':'ok','2':'bad','3':'na'};
    if(map[e.key] && this.cur){ e.preventDefault(); this.setStatus(this.cur,map[e.key]); return; }
    if(['j','ArrowDown','k','ArrowUp'].includes(e.key)){
      e.preventDefault();
      const vis=[...document.querySelectorAll('.item')].map(el=>el.dataset.slug);
      if(!vis.length) return;
      let i=vis.indexOf(this.cur);
      i = (e.key==='j'||e.key==='ArrowDown') ? Math.min(i+1,vis.length-1) : Math.max(i-1,0);
      if(i<0) i=0;
      const prev=this.cur; this.cur=vis[i];
      if(prev) this.patchItem(prev);
      this.patchItem(this.cur);
      this.helpSync();
      document.getElementById('i-'+cssId(this.cur)).scrollIntoView({block:'center',behavior:'smooth'});
    }
  });
}
};

/* сводка импорта под пунктом */
function sfHtml(slug){
  const sum=App.sf&&App.sf[slug];
  if(!sum) return '';
  const hasTable=(typeof SF_RULES!=='undefined')&&SF_RULES.some(r=>r.slug===slug&&r.table);
  return '<div class="sfsum"><p>'+esc(sum.text)+'</p>'+
    (hasTable? '<button class="btn btn-s noprint" onclick="App.copySfTable(\''+slug+'\')">'+
      'Скопировать таблицу ('+sum.rows.length+')</button>':'')+'</div>';
}

/* ─── инструмент: генератор robots.txt ─── */
function defaultSitemap(){
  let d=(S&&S.meta&&S.meta.domain||'').trim();
  if(!d) return 'https://example.ru/sitemap.xml';
  d=d.replace(/^https?:\/\//i,'').replace(/\/+$/,'');
  return 'https://'+d+'/sitemap.xml';
}
function robotsCfg(v){
  return {cms:(v.cms||'').split(',').filter(Boolean),
          common:(v.common||'').split(',').filter(Boolean),
          allow:v.allow||'', disallow:v.disallow||'', clean:v.clean||'',
          sitemap:(v.sitemap||'').trim()||defaultSitemap()};
}
function robotsText(v){
  if(typeof buildRobots==='undefined') return '';
  return buildRobots(robotsCfg(v));
}
function toolHtml(it,st){
  if(it.tool!=='robots' || typeof CMS_PRESETS==='undefined') return '';
  const v=st.vars||{}, slug=it.slug;
  const cms=(v.cms||'').split(',').filter(Boolean), com=(v.common||'').split(',').filter(Boolean);
  const chip=(k,label,on,fn)=>'<button aria-pressed="'+on+'" onclick="App.'+fn+'(\''+slug+'\',\''+k+'\')">'+esc(label)+'</button>';

  let h='<div class="tool"><h4>robots.txt: сборка нового файла</h4>'+
    '<details class="syntax"><summary>Как записывать правила: спецсимволы и порядок</summary>'+
    '<table>'+
    '<tr><td><code>*</code></td><td>любая последовательность символов, в том числе пустая. '+
      '<code>/*?sort=</code> закроет адреса с этим параметром на любом уровне вложенности</td></tr>'+
    '<tr><td><code>$</code></td><td>конец адреса. <code>/*.pdf$</code> — только файлы с этим расширением, '+
      'без него правило зацепит и <code>/file.pdf?id=1</code></td></tr>'+
    '<tr><td><code>/</code> в конце</td><td>каталог и всё внутри: <code>/admin/</code>. '+
      'Без слэша <code>/admin</code> закроет ещё и <code>/administrator</code></td></tr>'+
    '<tr><td><code>#</code></td><td>комментарий до конца строки</td></tr>'+
    '</table>'+
    '<ul>'+
    '<li>В конце каждого правила подразумевается <code>*</code>, писать его не нужно</li>'+
    '<li>Пути пишутся от корня сайта, домен не указывается</li>'+
    '<li>Регистр важен: <code>/Catalog/</code> и <code>/catalog/</code> — разные правила</li>'+
    '<li>При конфликте применяется более длинное правило, а не то, что выше. '+
      '<code>Allow: /*.css$</code> перебьёт <code>Disallow: /assets/</code> для файлов стилей</li>'+
    '<li>Пустой <code>Disallow:</code> разрешает всё, пустой <code>Allow:</code> запрещает всё — не путать</li>'+
    '<li>Если для робота есть своя секция, общую он не читает. Поэтому секция Яндекса дублирует все правила</li>'+
    '<li><code>Clean-param</code> понимает только Яндекс, параметры перечисляются через <code>&amp;</code></li>'+
    '</ul></details>';

  /* система управления */
  h+='<div class="sec"><p class="lbl">Система управления сайтом</p><div class="grid">'+
     Object.keys(CMS_PRESETS).map(k=>chip(k,CMS_PRESETS[k].name,cms.includes(k),'toolCms')).join('')+'</div></div>';

  /* функциональные наборы */
  h+='<div class="sec"><p class="lbl">Что закрыть дополнительно</p><div class="grid">'+
     Object.keys(CMS_COMMON).map(k=>chip(k,CMS_COMMON[k].name,com.includes(k),'toolCommon')).join('')+'</div></div>';

  const fld=(k,label,ph,rows)=>'<div class="sec"><p class="lbl">'+esc(label)+'</p>'+
    (rows? '<textarea placeholder="'+esc(ph)+'" oninput="App.setVar(\''+slug+'\',\''+k+'\',this.value)">'+esc(v[k]||'')+'</textarea>'
         : '<input value="'+esc(v[k]||'')+'" placeholder="'+esc(ph)+'" oninput="App.setVar(\''+slug+'\',\''+k+'\',this.value)">')+'</div>';

  h+=fld('disallow','Свои запреты, по одному в строке','/*?promocode=',1);
  h+=fld('allow','Свои разрешения, по одному в строке','*/upload/*',1);
  h+=fld('clean','Clean-param: параметры через запятую или перенос','utm_source, from, gclid',1);
  h+=fld('sitemap','Адрес карты сайта — если пусто, подставится '+esc(defaultSitemap()),defaultSitemap(),0);

  /* результат */
  const txt=robotsText(v);
  const warns=(typeof checkRobots!=='undefined')? checkRobots(robotsCfg(v),txt):[];
  h+='<div class="sec"><p class="lbl">Готовый файл — '+txt.split('\n').length+' строк</p>'+
     '<pre class="out">'+esc(txt)+'</pre>';
  if(warns.length) h+='<div class="warns">'+warns.map(w=>'<div class="'+w.t+'">'+esc(w.m)+'</div>').join('')+'</div>';
  h+='<div class="row-btn">'+
     '<button class="btn btn-s" onclick="App.robotsCopy(\''+slug+'\')">Скопировать</button>'+
     '<button class="btn btn-s" onclick="App.robotsDownload(\''+slug+'\')">Скачать robots.txt</button>'+
     '<a class="btn btn-s" href="https://webmaster.yandex.ru/site/tools/robotstxt/" target="_blank" rel="noopener" '+
       'style="text-decoration:none">Проверить в Вебмастере</a>'+
     '</div>'+
     '<p class="plain" style="margin:7px 0 0">После замены файла на сайте проверьте выборочно ключевые адреса '+
     'в инструменте анализа robots.txt — он покажет, разрешён ли обход каждого из них.</p></div>';

  h+='</div>';
  return h;
}

/* ─── шаблоны ТЗ ─── */
function hasTpl(slug){ return typeof TPL!=='undefined' && !!TPL[slug]; }
function tplOf(slug){ return (typeof TPL!=='undefined')? TPL[slug]||null : null; }
function libOf(slug){ return (typeof LIB!=='undefined')? LIB[slug]||null : null; }
function varsHtml(slug,vals){
  const T=tplOf(slug), L=libOf(slug);
  if(!T||!T.vars||!T.vars.length){
    if(T)  return '<p class="plain">Выгрузится готовой задачей. Комментарий попадёт в неё как описание проблемы.</p>';
    if(L)  return '<p class="plain">Выгрузится описанием '+(L.kind==='page'?'страницы':'блока')+'. Комментарий попадёт перед ним.</p>';
    return '<p class="plain">Выгрузится краткой задачей с вашим комментарием.</p>';
  }
  return '<p class="cap">Данные для ТЗ</p><div class="vars">'+T.vars.map(v=>{
    const val=esc(vals[v.k]||''), ph=esc(v.ph||'');
    const set='App.setVar(\''+slug+'\',\''+v.k+'\',this.value)';
    if(v.type==='list')
      return '<label class="wide">'+esc(v.label)+
        '<textarea placeholder="'+ph+'" oninput="'+set+'">'+val+'</textarea></label>';
    return '<label class="'+(v.type==='url'?'wide':'')+'">'+esc(v.label)+
      '<input type="'+(v.type==='num'?'number':'text')+'" value="'+val+'" '+
      'placeholder="'+ph+'" oninput="'+set+'"></label>';
  }).join('')+'</div>';
}
/* подставляет переменные; предложение с незаполненной переменной выбрасывается */
function fillFacts(T,it){
  const v=it.vars||{};
  return (T.facts||[]).map(f=>{
    const need=(f.match(/\{(\w+)\}/g)||[]).map(m=>m.slice(1,-1));
    if(need.some(n=>!v[n]||String(v[n]).trim()==='')) return null;
    return f.replace(/\{(\w+)\}/g,(m,n)=>String(v[n]).split(/\r?\n/).map(x=>x.trim()).filter(Boolean).join(', '));
  }).filter(Boolean);
}
/* ─── сборка ТЗ ─────────────────────────────────────────────
   Содержимое описывается один раз в виде списка узлов,
   а renderNodesHtml и renderNodesMd только переводят его
   в нужный формат. Добавление поля правится в одном месте,
   и версии не могут разойтись.

   Типы узлов:
     h    заголовок задачи
     p    абзац
     kv   «Подпись:» плюс текст в одну строку
     kvl  «Подпись:» плюс список
     a    ссылка: k — подпись, v — адрес
     pre  блок кода
     ph   плейсхолдер скриншота
   ───────────────────────────────────────────────────────── */

function renderNodesHtml(nodes){
  return nodes.filter(Boolean).map(n=>{
    switch(n.t){
      case 'h':   return '<h3>'+esc(n.v)+'</h3>';
      case 'p':   return '<p>'+esc(n.v).replace(/\n/g,'<br>')+'</p>';
      case 'kv':  return '<p><b>'+esc(n.k)+':</b> '+esc(n.v)+'</p>';
      case 'kvl': return '<p><b>'+esc(n.k)+':</b></p><ul>'+n.v.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>';
      case 'ul':  return '<ul>'+n.v.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>';
      case 'a':   return n.v? '<p><b><a href="'+esc(n.v)+'">'+esc(n.k)+'</a></b></p>'
                            : '<p><b>'+esc(n.k)+'</b></p>';
      case 'pre': return '<pre>'+esc(n.v)+'</pre>';
      case 'ph':  return '<p>['+esc(n.v)+']</p>';
      case 'i':   return '<p><i>'+esc(n.v)+'</i></p>';
    }
    return '';
  }).join('');
}
function renderNodesMd(nodes){
  return nodes.filter(Boolean).map(n=>{
    switch(n.t){
      case 'h':   return '### '+n.v+'\n\n';
      case 'p':   return n.v+'\n\n';
      case 'kv':  return '**'+n.k+':** '+n.v+'\n\n';
      case 'kvl': return '**'+n.k+':**\n\n'+n.v.map(x=>'- '+x).join('\n')+'\n\n';
      case 'ul':  return n.v.map(x=>'- '+x).join('\n')+'\n\n';
      case 'a':   return n.v? '**['+n.k+']('+n.v+')**\n\n' : '**'+n.k+'**\n\n';
      case 'pre': return '```\n'+n.v+'```\n\n';
      case 'ph':  return '['+n.v+']\n\n';
      case 'i':   return '*'+n.v+'*\n\n';
    }
    return '';
  }).join('');
}

function hasTpl(slug){ return typeof TPL!=='undefined' && !!TPL[slug]; }
function tplOf(slug){ return (typeof TPL!=='undefined')? TPL[slug]||null : null; }
function libOf(slug){ return (typeof LIB!=='undefined')? LIB[slug]||null : null; }

function varsHtml(slug,vals){
  const T=tplOf(slug), L=libOf(slug);
  if(!T||!T.vars||!T.vars.length){
    if(T)  return '<p class="plain">Выгрузится готовой задачей. Комментарий попадёт в неё как описание проблемы.</p>';
    if(L)  return '<p class="plain">Выгрузится описанием '+(L.kind==='page'?'страницы':'блока')+'. Комментарий попадёт перед ним.</p>';
    return '<p class="plain">Выгрузится краткой задачей с вашим комментарием.</p>';
  }
  return '<p class="cap">Данные для ТЗ</p><div class="vars">'+T.vars.map(v=>{
    const val=esc(vals[v.k]||''), ph=esc(v.ph||'');
    const set='App.setVar(\''+slug+'\',\''+v.k+'\',this.value)';
    if(v.type==='list')
      return '<label class="wide">'+esc(v.label)+
        '<textarea placeholder="'+ph+'" oninput="'+set+'">'+val+'</textarea></label>';
    return '<label class="'+(v.type==='url'?'wide':'')+'">'+esc(v.label)+
      '<input type="'+(v.type==='num'?'number':'text')+'" value="'+val+'" '+
      'placeholder="'+ph+'" oninput="'+set+'"></label>';
  }).join('')+'</div>';
}

/* подставляет переменные; предложение с незаполненной переменной выбрасывается */
function fillFacts(T,it){
  const v=it.vars||{};
  return (T.facts||[]).map(f=>{
    const need=(f.match(/\{(\w+)\}/g)||[]).map(m=>m.slice(1,-1));
    if(need.some(n=>!v[n]||String(v[n]).trim()==='')) return null;
    return f.replace(/\{(\w+)\}/g,(m,n)=>String(v[n]).split(/\r?\n/).map(x=>x.trim()).filter(Boolean).join(', '));
  }).filter(Boolean);
}
function lower1(t){ return t.charAt(0).toLowerCase()+t.slice(1); }

/* ─── узлы одной задачи ─── */
function itemNodes(it,n){
  const T=tplOf(it.slug), L=libOf(it.slug);
  const out=[];
  out.push({t:'h', v:n+'. '+(T? T.title : (L? libTitle(L,it) : it.t))});

  if(T){
    out.push({t:'kv', k:'Задача', v:T.task+'.'});
    const f=fillFacts(T,it);
    const sum=App.sf&&App.sf[it.slug];
    /* Данные импорта точнее ручных переменных, поэтому идут первыми.
       Если импорта нет, работают обычные факты шаблона. */
    if(sum) out.push({t:'p', v:sum.text});
    if(f.length) out.push({t:'p', v:f.join(' ')});
  }
  if(it.note) out.push({t:'p', v:it.note});
  if(L) libNodes(L).forEach(x=>out.push(x));

  if(T){
    if(it.slug==='idx.robots-accessible'){
      const url=(it.vars||{}).link;
      if(url) out.push({t:'a', k:'Файл robots.txt', v:url});
      const txt=robotsText(it.vars||{});
      if(txt) out.push({t:'pre', v:txt});
    }
    if(T.impact&&typeof ARG!=='undefined'&&ARG[T.impact]) out.push({t:'kv', k:'На что влияет', v:ARG[T.impact]});
    if(T.todo&&T.todo.length) out.push({t:'kvl', k:'Что нужно сделать', v:T.todo});
    if(T.table) out.push({t:'a', k:'Таблица: '+T.table, v:(it.vars||{}).table||''});
  }
  if(!T&&!L&&it.hint) out.push({t:'i', v:'Как проверить: '+it.hint});
  out.push({t:'ph', v:'скриншот: '+it.block});
  return out;
}

/* ─── узлы объединённой задачи ─── */
function groupNodes(it,n){
  const G=GROUPS[it.gk];
  const facts=[], notes=[], tables=[];
  it.members.forEach(m=>{
    const T=tplOf(m.slug);
    if(T){
      const f=fillFacts(T,m);
      if(f.length) f.forEach(x=>facts.push(x));
      else facts.push('Не выполнено: '+lower1(m.t)+'.');
      if(m.note) notes.push(m.note);
      if(T.table) tables.push({name:T.table,url:(m.vars||{}).table||''});
    } else {
      facts.push(m.note? m.note : 'Не выполнено: '+lower1(m.t)+'.');
    }
  });
  /* список действий берётся из описания группы: он написан под задачу целиком
     и не собирается склейкой из частных пунктов, иначе разрастается и повторяется */
  const seen=new Set();
  const todo=(G.todo||[]).filter(x=>{const k=x.toLowerCase(); if(seen.has(k))return false; seen.add(k); return true;});

  const out=[{t:'h', v:n+'. '+G.title}, {t:'kv', k:'Задача', v:G.task+'.'}];
  if(facts.length) out.push({t:'kvl', k:'Обнаружено', v:facts});
  notes.forEach(x=>out.push({t:'p', v:x}));
  if(G.impact&&typeof ARG!=='undefined'&&ARG[G.impact]) out.push({t:'kv', k:'На что влияет', v:ARG[G.impact]});
  if(todo.length) out.push({t:'kvl', k:'Что нужно сделать', v:todo});
  tables.forEach(x=>out.push({t:'a', k:'Таблица: '+x.name, v:x.url}));
  out.push({t:'ph', v:'скриншот: '+it.block});
  return out;
}

/* ─── узлы библиотечного описания ─── */
function libTitle(L,it){
  if(L.kind==='page') return 'Создать страницу «'+(L.h2||it.t.split(':')[0])+'»';
  return 'Добавить блок «'+L.h2+'»';
}
function libNodes(L){
  const out=[];
  if(L.kind==='page'){
    if(L.url)      out.push({t:'p',  v:'Адрес: '+L.url});
    if(L.goals)    out.push({t:'kvl',k:'Цель создания', v:L.goals});
    if(L.contains) out.push({t:'kvl',k:'На странице должны быть', v:L.contains});
    if(L.link)     out.push({t:'kv', k:'Размещение ссылки', v:L.link});
  } else {
    if(L.task)      out.push({t:'kv', k:'Задача блока', v:L.task});
    if(L.why)       out.push({t:'kv', k:'Зачем', v:L.why});
    if(L.h2)        out.push({t:'kv', k:'Заголовок H2', v:L.h2});
    if(L.structure) out.push({t:'kvl',k:'Структура блока', v:L.structure});
    if(L.place)     out.push({t:'kv', k:'Размещение', v:L.place});
    if(L.visual)    out.push({t:'kv', k:'Визуальные требования', v:L.visual});
  }
  if(L.note) out.push({t:'i', v:L.note});
  return out;
}


/* ═══════════════════════════════════════════════════════════
   ИМПОРТ ВЫГРУЗОК SCREAMING FROG
   ═══════════════════════════════════════════════════════════ */

/* Разбор CSV с учётом кавычек, переносов внутри значений и метки кодировки.
   Разделитель определяется по первой строке: инструменты и табличные
   редакторы отдают то запятую, то точку с запятой, то табуляцию. */
function sniffDelimiter(text){
  const line=String(text||'').split(/\r?\n/)[0]||'';
  let best=',', n=-1;
  [',',';','\t'].forEach(d=>{
    let c=0,q=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"') q=!q;
      else if(ch===d&&!q) c++;
    }
    if(c>n){ n=c; best=d; }
  });
  return best;
}

/* Кодировку тоже приходится определять: конвертеры сохраняют в cp1251,
   и при чтении как UTF-8 весь текст превращается в мусор. */
function decodeSF(buffer){
  try{
    return new TextDecoder('utf-8',{fatal:true}).decode(buffer);
  }catch(e){
    try{ return new TextDecoder('windows-1251').decode(buffer); }
    catch(e2){ return new TextDecoder('utf-8').decode(buffer); }
  }
}

function parseCSV(text,delim){
  text=String(text||'').replace(/^\uFEFF/,'');
  const D=delim||sniffDelimiter(text);
  const rows=[]; let row=[], val='', q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(q){
      if(c==='"'){ if(text[i+1]==='"'){ val+='"'; i++; } else q=false; }
      else val+=c;
    } else {
      if(c==='"') q=true;
      else if(c===D){ row.push(val); val=''; }
      else if(c==='\n'){ row.push(val); rows.push(row); row=[]; val=''; }
      else if(c!=='\r') val+=c;
    }
  }
  if(val!==''||row.length){ row.push(val); rows.push(row); }
  return rows.filter(r=>r.length>1||String(r[0]||'').trim()!=='');
}

/* Нестрогое сравнение заголовков: регистр, пробелы и знаки не важны */
function normHead(h){ return String(h||'').toLowerCase().replace(/[\s_\-()]+/g,'').replace(/["']/g,''); }

/* Соответствие «поле чекера → номер колонки» */
function mapColumns(header,manual){
  const map={}, norm=header.map(normHead);
  Object.entries(SF_COLS).forEach(([field,names])=>{
    if(manual&&manual[field]!=null){ map[field]=manual[field]; return; }
    for(const n of names){
      const i=norm.indexOf(normHead(n));
      if(i>-1){ map[field]=i; return; }
    }
    /* запасной вариант: заголовок содержит искомое */
    for(const n of names){
      const t=normHead(n);
      const i=norm.findIndex(h=>h.indexOf(t)===0);
      if(i>-1){ map[field]=i; return; }
    }
  });
  return map;
}

function detectKind(map){
  for(const k of SF_KINDS) if(k.need.every(f=>map[f]!=null)) return k;
  return null;
}

/* Файл → массив объектов с полями чекера */
function readSF(text,manual,filename){
  const rows=parseCSV(text);
  if(rows.length<2) return null;
  const header=rows[0], map=mapColumns(header,manual);

  /* Имя файла точнее колонок: у пяти файлов с заголовками безопасности
     колонки совпадают побайтово, различить их иначе нельзя. */
  const byName=(typeof matchFile!=='undefined')? matchFile(filename) : null;
  const kind = byName? {kind:byName.kind==='links'?'issueLinks':'issue',name:byName.file} : detectKind(map);
  if(!kind) return {kind:null,header,map};
  const out=[];
  for(let i=1;i<rows.length;i++){
    const r=rows[i]; if(!r.length) continue;
    const o={};
    Object.entries(map).forEach(([f,idx])=>{ o[f]=(r[idx]!=null? r[idx]:'').trim(); });
    if(o.address||o.to) out.push(o);
  }
  const res={kind:kind.kind,name:kind.name,header,map,rows:out};
  if(byName){ res.slug=byName.slug; res.fileKind=byName.kind; res.note=byName.note; res.unit=byName.unit; }
  return res;
}

/* ─── русские числительные ─── */
function plural(n,one,few,many){
  n=Math.abs(Number(n))%100;
  const d=n%10;
  if(n>10&&n<20) return many;
  if(d>1&&d<5) return few;
  if(d===1) return one;
  return many;
}
function num(n,one,few,many){ return n+' '+plural(n,one,few,many); }
/* «1 ссылка» в тексте читается как черновик, поэтому единица пишется словом */
function num1(n,one,few,many,w1){ return Number(n)===1? w1+' '+one : n+' '+plural(n,one,few,many); }
function verb(n,one,many){ return plural(n,one,many,many); }

/* ─── сводка находок ─── */
/* Ключевой признак сквозного элемента — не расположение, а повторяемость:
   одна и та же ссылка на сотне страниц правится один раз в шаблоне,
   даже если Screaming Frog отнёс её к содержимому страницы. */
function summarize(rule,hits){
  const S={slug:rule.slug, type:rule.summary, rows:hits, total:hits.length};

  if(rule.summary==='links'){
    const uniq=new Map(), sources=new Set();
    hits.forEach(r=>{
      const key=r.to+'\u0001'+(r.linkPosition||'')+'\u0001'+(r.anchor||'');
      const u=uniq.get(key)||{row:r,n:0,pages:new Set()};
      u.n++; if(r.from) u.pages.add(r.from);
      uniq.set(key,u);
      if(r.from) sources.add(r.from);
    });
    S.uniqRows=[...uniq.values()];
    S.unique=S.uniqRows.length;
    S.sources=sources.size;
    S.targets=new Set(hits.map(r=>r.to)).size;
    /* сквозная ссылка — та, что повторяется на пяти и более страницах */
    S.sweep=S.uniqRows.filter(u=>u.pages.size>=5);
    S.single=S.uniqRows.filter(u=>u.pages.size<5);
    S.text=summaryLinks(S);
  } else if(rule.summary==='size'){
    const bytes=hits.reduce((a,r)=>a+(Number(r.sizeBytes)||0),0);
    S.bytes=bytes;
    S.text=verb(hits.length,'Обнаружено','Обнаружено')+' '+num(hits.length,'изображение','изображения','изображений')+
      ' весом более 100 КБ, суммарно '+(bytes/1048576).toFixed(1).replace('.',',')+' МБ.';
  } else if(rule.summary==='count'){
    const u=rule.unit||['адрес','адреса','адресов'];
    S.text=verb(hits.length,'Найден','Найдено')+' '+num1(hits.length,u[0],u[1],u[2],'один')+'.';
  } else {
    S.pages=new Set(hits.map(r=>r.address)).size;
    S.text=verb(S.pages,'Обнаружена','Обнаружено')+' '+num1(S.pages,'страница','страницы','страниц','одна')+'.';
    S.examples=hits.slice(0,3).map(r=>r.address);
  }
  return S;
}

function summaryLinks(S){
  /* Главное число — количество уникальных ссылок: именно столько правок
     предстоит сделать. Число вхождений вводит в заблуждение, когда одна
     ссылка повторяется на сотне страниц, поэтому в текст не выносится. */
  const parts=[verb(S.unique,'Обнаружена','Обнаружено')+' '+
    num1(S.unique,'ссылка','ссылки','ссылок','одна')+', '+
    plural(S.unique,'ведущая','ведущие','ведущих')+' на '+
    num1(S.targets,'адрес','адреса','адресов','один')+'.'];

  /* Расположение называется только для структурных элементов.
     Screaming Frog относит кнопку в шаблоне к содержимому страницы,
     поэтому для Content говорим «в сквозном элементе», не уточняя место. */
  const named={footer:1,header:1,navigation:1,aside:1};
  const where=u=>{
    const p=(u.row.linkPosition||'').toLowerCase();
    return named[p]? SF_POSITION[p] : 'в сквозном элементе шаблона';
  };

  if(S.sweep.length){
    const byPos={};
    S.sweep.forEach(u=>{ const w=where(u); byPos[w]=(byPos[w]||0)+1; });
    const list=Object.entries(byPos).map(([w,n])=>
      num1(n,'ссылка','ссылки','ссылок','одна')+' '+w);

    if(S.unique===1){
      const u=S.sweep[0];
      parts.push('Она размещена '+where(u)+' и повторяется на '+
        num1(u.pages.size,'странице','страницах','страницах','одной')+
        ' — правка выполняется один раз.');
    } else if(S.sweep.length===S.unique){
      parts.push('Все они повторяются на многих страницах: '+list.join(', ')+
        '. Каждая правится один раз в шаблоне.');
    } else {
      parts.push('Из них '+list.join(', ')+
        ' — повторяются на многих страницах и правятся один раз в шаблоне.');
      parts.push('Остальные '+num1(S.single.length,'ссылка','ссылки','ссылок','одна')+
        ' встречаются точечно и правятся по данным таблицы.');
    }
  } else if(S.uniqRows.length>1){
    const byPos={};
    S.uniqRows.forEach(u=>{ const p=(u.row.linkPosition||'').toLowerCase();
      if(!SF_POSITION[p]) return;   /* расположение не указано — не выдумываем */
      byPos[SF_POSITION[p]]=(byPos[SF_POSITION[p]]||0)+1; });
    const keys=Object.keys(byPos);
    if(keys.length>1) parts.push('Расположение: '+keys.map(w=>w+' — '+byPos[w]).join(', ')+'.');
  }
  /* при единственной сквозной ссылке охват уже назван выше */
  const said = S.unique===1 && S.sweep.length===1;
  if(!said&&S.sources) parts.push(verb(S.sources,'Затронута','Затронуто')+' '+
    num1(S.sources,'страница','страницы','страниц','одна')+' сайта.');
  return parts.join(' ');
}

/* ─── применение правил ─── */
function runRules(files){
  const res={}, notes=[];
  const internal=files.filter(f=>f.kind==='internal').flatMap(f=>f.rows);
  const inlinks =files.filter(f=>f.kind==='inlinks').flatMap(f=>f.rows);

  const isHtml=r=>/text\/html/i.test(r.contentType||'');
  const isImg =r=>/^image\//i.test(r.contentType||'');
  /* Код 0 означает, что адрес не запрашивался: закрыт в robots.txt
     или не обойдён. Это не ошибка и не должно попадать в находки. */
  const requested=r=>String(r.statusCode||'').trim()!=='0';

  /* адрес → конечный адрес редиректа, чтобы подрядчику не искать вручную */
  const redirectTo={};
  internal.forEach(r=>{ if(r.redirectUrl) redirectTo[normUrl(r.address)]=r.redirectUrl; });
  inlinks.forEach(r=>{
    r.redirectTo = redirectTo[normUrl(r.to)] || '';
    r.linkPositionRu = SF_POSITION[(r.linkPosition||'').toLowerCase()] || r.linkPosition || '';
  });

  /* Отдельные файлы массового экспорта: строки уже отобраны краулером,
     проверять условие не нужно — берём как есть. */
  const linkRule=slug=>SF_RULES.find(r=>r.slug===slug)||{slug,summary:'links'};
  const pageRule=slug=>SF_RULES.find(r=>r.slug===slug)||{slug,summary:'pages'};
  files.filter(f=>f.kind==='issue'||f.kind==='issueLinks').forEach(f=>{
    if(f.fileKind==='skip'||!f.rows.length) return;
    if(f.fileKind==='note'){
      notes.push(String(f.note||'')
        .replace('{n}',num1(f.rows.length,'адрес','адреса','адресов','один'))
        .replace('{num}',f.rows.length));
      return;
    }
    if(!f.slug) return;
    if(f.fileKind==='links'){
      f.rows.forEach(r=>{
        r.redirectTo=r.redirectTo||'';
        r.linkPositionRu=SF_POSITION[(r.linkPosition||'').toLowerCase()]||r.linkPosition||'';
      });
      const prev=res[f.slug];
      const merged=prev&&prev.rows? prev.rows.concat(f.rows) : f.rows;
      res[f.slug]=summarize(linkRule(f.slug),merged);
    } else {
      if(res[f.slug]&&res[f.slug].type==='links') return; /* данные по ссылкам подробнее */
      const rule=pageRule(f.slug);
      /* В отдельном файле может не быть колонки, нужной для сводки:
         например, список тяжёлых изображений идёт без веса. Тогда сводка
         помечается слабой и уступит расчёту по общему обходу. */
      const needSize = rule.summary==='size';
      const hasSize  = f.rows.some(r=>Number(r.sizeBytes)>0);
      const base=needSize&&!hasSize? Object.assign({},rule,{summary:'count'}) : rule;
      const sum=summarize(f.unit? Object.assign({},base,{unit:f.unit}) : base, f.rows);
      if(needSize&&!hasSize) sum.weak=true;
      res[f.slug]=sum;
    }
  });

  SF_RULES.forEach(rule=>{
    let src = rule.src==='inlinks'? inlinks : internal;
    if(!src.length) return;
    if(rule.src==='internal'){
      src=src.filter(requested);
      if(rule.scope==='html') src=src.filter(isHtml);
      else if(rule.scope==='img') src=src.filter(isImg);
    }
    let hits;
    if(rule.dup){
      const g={};
      src.filter(rule.test).forEach(r=>{ const k=(r[rule.dup]||'').trim(); if(k) (g[k]=g[k]||[]).push(r); });
      hits=Object.values(g).filter(a=>a.length>1).flat();
    } else {
      hits=src.filter(rule.test);
    }
    if(!hits.length) return;
    if(res[rule.slug]&&!res[rule.slug].weak) return; /* данные из отдельного файла точнее */
    res[rule.slug]=summarize(rule,hits);
  });

  /* сводный отчёт Screaming Frog: что он нашёл и сколько */
  const ov=files.find(f=>f.fileKind==='overview'||/issues_overview/i.test(f.file||''));
  if(ov&&ov.rows.length) notes.push('Screaming Frog отметил при обходе '+
    num1(ov.rows.length,'тип проблемы','типа проблем','типов проблем','один')+'.');

  /* полезные наблюдения, не привязанные к пунктам */
  const html=internal.filter(isHtml);
  const canon=html.filter(r=>r.indexStatus==='Canonicalised');
  if(canon.length) notes.push(num(canon.length,'адрес','адреса','адресов')+
    ' с параметрами закрыты каноническим адресом — это нормально, в находки не включены');
  const blocked=internal.filter(r=>!requested(r));
  if(blocked.length) notes.push(num(blocked.length,'адрес','адреса','адресов')+
    ' не запрашивались: закрыты в robots.txt или не обойдены');
  return {res,notes,counts:{internal:internal.length,inlinks:inlinks.length,html:html.length}};
}

/* ─── таблица для Google Таблиц ─── */
function sfTable(slug,summary,mode){
  if(!summary) return '';
  /* У пунктов, пришедших из отдельных файлов, своего правила нет —
     берём набор колонок по типу сводки. */
  const rule=SF_RULES.find(r=>r.slug===slug) || (summary.type==='links'
    ? {table:['to','linkPositionRu','anchor','from','linkPath']}
    : {table:['address','indexStatus','contentType']});
  const link=(typeof SF_LINK_TABLES!=='undefined')&&SF_LINK_TABLES[slug];
  let cols, rows, extra;

  const defLink = !SF_LINK_TABLES[slug] && summary.uniqRows;
  if(defLink){
    const full = mode==='full';
    cols  = full? ['to','linkPositionRu','anchor','from','linkPath']
                : ['to','linkPositionRu','anchor','occurrences','samplePage','linkPath'];
    extra = ['Исправлено'];
    rows  = full? summary.rows : summary.uniqRows.map(u=>Object.assign({},u.row,{
      occurrences:u.pages.size, samplePage:[...u.pages][0]||u.row.from||''}));
  } else if(link&&summary.uniqRows){
    const full = mode==='full';
    cols  = full? link.full : link.unique;
    extra = link.extra||[];
    rows  = full? summary.rows : summary.uniqRows.map(u=>Object.assign({},u.row,{
      occurrences:u.pages.size,
      samplePage:[...u.pages][0]||u.row.from||''
    }));
  } else {
    cols=rule.table||[]; extra=SF_TABLE_EXTRA[slug]||[]; rows=summary.rows;
  }

  const head=cols.map(c=>SF_TABLE_HEADERS[c]||c).concat(extra);
  const cell=(r,c)=>{
    let v=r[c];
    if(c==='sizeKb') v=Math.round((Number(r.sizeBytes)||0)/1024);
    return String(v==null?'':v).replace(/[\t\n\r]+/g,' ');
  };
  return [head.join('\t')].concat(rows.map(r=>
    cols.map(c=>cell(r,c)).concat(extra.map(()=>'')).join('\t'))).join('\n');
}
/* ─── миграции и утилиты ─── */
function migrate(d){
  const s=blank(), orphans=[];
  if(!d||typeof d!=='object') return {state:s,orphans};
  Object.assign(s.meta, d.meta||{});
  Object.assign(s.config, d.config||{});
  s.custom = Array.isArray(d.custom)? d.custom : [];
  s.imports = Array.isArray(d.imports)? d.imports : [];
  const known=new Set(BLOCKS.flatMap(b=>b.items.map(i=>i.slug)).concat(s.custom.map(c=>c.slug)));
  Object.entries(d.items||{}).forEach(([slug,rec])=>{
    if(known.has(slug)) s.items[slug]=rec;
    else { orphans.push({slug,...rec}); }
  });
  s.orphans=(d.orphans||[]).concat(orphans);
  s.schemaVersion=SCHEMA_VERSION; s.dbVersion=DB_VERSION;
  return {state:s,orphans};
}
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function cssId(s){ return String(s).replace(/[^\w-]/g,'_'); }
function copyPlain(t){
  try{ if(navigator.clipboard){ navigator.clipboard.writeText(t); return true; } }catch(e){}
  const ta=document.createElement('textarea');
  ta.value=t; ta.style.position='fixed'; ta.style.opacity='0';
  document.body.appendChild(ta); ta.select();
  let ok=false; try{ ok=document.execCommand('copy'); }catch(e){}
  document.body.removeChild(ta); return ok;
}
function legacyCopyHtml(html){
  const d=document.createElement('div');
  d.contentEditable='true'; d.innerHTML=html;
  d.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';
  document.body.appendChild(d);
  const r=document.createRange(); r.selectNodeContents(d);
  const sel=getSelection(); sel.removeAllRanges(); sel.addRange(r);
  let ok=false; try{ ok=document.execCommand('copy'); }catch(e){}
  sel.removeAllRanges(); document.body.removeChild(d);
  return ok;
}

/* ─── проверка целостности разметки ─── */
/* Ловит случай, когда элемент есть в логике, но отсутствует в checker.html.
   Такие ошибки не видны в тестах: логика верна, а выводить некуда. */
const REQUIRED_NODES = ['bar','stat','spectrum','setup','audit','list','nav','chips','q',
  'printHead','presets','axes','goCount','resume','hp','hpTitle','hpBody','hpActs','hpFollow',
  'ownThemes','toast','modal','mTitle','mText','mActs','fileIn','drop','saveInd',
  'creditSetup','creditAudit','f-client','f-domain','f-author','sfIn','missing'];
function checkNodes(){
  return REQUIRED_NODES.filter(id=>!document.getElementById(id));
}

/* ─── применение переопределений ─── */
function applyOverrides(){
  if(typeof OVERRIDES==='undefined') return {n:0,themes:{}};
  const O=OVERRIDES; let n=0;
  const patch=(target,src)=>{ if(!src) return;
    Object.entries(src).forEach(([k,v])=>{
      if(!target[k]) return;
      Object.assign(target[k],v); n++;
    });
  };
  /* пункты */
  if(O.items){
    const byslug={};
    BLOCKS.forEach(b=>b.items.forEach(i=>byslug[i.slug]=i));
    Object.entries(O.items).forEach(([k,v])=>{ if(byslug[k]){ Object.assign(byslug[k],v); n++; } });
  }
  if(typeof TPL!=='undefined') patch(TPL,O.tpl);
  if(typeof LIB!=='undefined') patch(LIB,O.lib);
  if(typeof HELP!=='undefined') patch(HELP,O.help);
  if(typeof ARG!=='undefined'&&O.arg) Object.entries(O.arg).forEach(([k,v])=>{ ARG[k]=v; n++; });
  /* свои темы: вставляются отдельным блоком стилей */
  const themes=O.themes||{};
  const keys=Object.keys(themes);
  if(keys.length){
    const css=keys.map(k=>'html[data-theme="'+k+'"]{'+
      Object.entries(themes[k].vars||{}).map(([p,val])=>p+':'+val).join(';')+'}').join('\n');
    const el=document.createElement('style'); el.textContent=css; document.head.appendChild(el);
  }
  return {n,themes};
}

/* ─── проверка комплектности файлов ─── */
(function(){
  const need=[
    ['AXES','config.js'],
    ['BLOCKS','db.js']
  ];
  const has=g=>{ try{ return typeof eval(g)!=='undefined'; }catch(e){ return false; } };
  const missing=need.filter(([g])=>!has(g));
  try{
    const cssOk=getComputedStyle(document.documentElement).getPropertyValue('--aeternus-css').trim()==='1';
    if(!cssOk) missing.push(['CSS','styles.css']);
  }catch(e){}
  const helpCount=(typeof HELP!=='undefined')?Object.keys(HELP).length:0;

  if(missing.length){
    document.getElementById('setup').innerHTML=
      '<div class="startup"><h1>Не хватает файлов</h1>'+
      '<p>Чекер состоит из нескольких файлов, и они должны лежать в одной папке рядом с checker.html. '+
      'Сейчас браузер не нашёл: <b>'+missing.map(m=>m[1]).join(', ')+'</b></p></div>'+
      '<div class="card"><div class="eyebrow">Полный комплект</div>'+
      '<ul style="margin:0;padding-left:20px;line-height:1.9">'+
      '<li><code>checker.html</code> — этот файл</li>'+
      '<li><code>styles.css</code> — оформление <b>(обязателен)</b></li>'+
      '<li><code>config.js</code> — конфигуратор <b>(обязателен)</b></li>'+
      '<li><code>db.js</code> — база проверок <b>(обязателен)</b></li>'+
      '<li><code>library.js</code> — описания блоков и страниц</li>'+
      '<li><code>templates.js</code> — шаблоны формулировок ТЗ</li>'+
      '<li><code>robots.js</code> — генератор robots.txt</li>'+
      '<li><code>overrides.js</code> — ваши правки из админки</li>'+
      '<li><code>help-1-index-response.js</code></li>'+
      '<li><code>help-2-meta-url.js</code></li>'+
      '<li><code>help-3-media-speed-markup.js</code></li>'+
      '<li><code>help-4-commerce-analytics.js</code></li>'+
      '<li><code>help-5-pages-blocks.js</code></li>'+
      '<li><code>help-6-trust-industry-legal.js</code></li>'+
      '</ul>'+
      '<p style="color:var(--ink-mute);margin-top:16px">Скачайте недостающие файлы в ту же папку и обновите страницу. '+
      'Имена менять нельзя — они прописаны в checker.html.</p></div>';
    return;
  }

  let ov={n:0,themes:{}};
  try{ ov=applyOverrides(); }catch(e){ console.error('overrides.js:',e); }
  App.customThemes=ov.themes;
  try{ App.init(); }
  catch(e){
    document.getElementById('setup').innerHTML=
      '<div class="startup"><h1>Ошибка при запуске</h1>'+
      '<p>Скорее всего повреждён один из файлов данных. Откройте консоль браузера клавишей F12 — '+
      'там будет имя файла и номер строки.</p>'+
      '<p style="font-family:var(--f-mono);font-size:12.5px;color:var(--bad)">'+String(e)+'</p></div>';
    return;
  }

  /* справка и библиотека необязательны — предупреждаем, но не мешаем работать */
  const warn=[];
  if(helpCount===0) warn.push('файлы справки help-*.js — кнопки «?» не появятся');
  else if(helpCount<345) warn.push('часть файлов справки (загружено записей: '+helpCount+' из 345)');
  if(typeof LIB==='undefined') warn.push('library.js — в ТЗ не будет описаний блоков и страниц');
  if(typeof TPL==='undefined') warn.push('templates.js — в ТЗ не будет готовых формулировок задач');
  if(typeof buildRobots==='undefined') warn.push('robots.js — не будет генератора robots.txt');
  if(typeof SF_RULES==='undefined') warn.push('sf-map.js — не будет импорта выгрузок Screaming Frog');
  if(warn.length){
    const box=document.getElementById('missing');
    if(box) box.innerHTML='<div class="warnbox"><b>Комплект файлов неполный</b>'+
      '<ul>'+warn.map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul>'+
      '<p>Файлы должны лежать в одной папке рядом с checker.html. '+
      'Скачайте комплект заново целиком — отдельные файлы друг без друга не работают.</p></div>';
    setTimeout(()=>App.toast('Не хватает: '+warn.join('; ')),700);
  }
})();
