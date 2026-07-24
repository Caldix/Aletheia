// ---------- storage (localStorage with in-memory fallback) ----------
const mem = {};
const store = {
  get(k){ try{ return JSON.parse(localStorage.getItem(k)) ?? mem[k] ?? null }catch(e){ return mem[k] ?? null } },
  set(k,v){ mem[k]=v; try{ localStorage.setItem(k, JSON.stringify(v)) }catch(e){} }
};

// ---------- config ----------
const AGES = ["1-2 ani","2-3 ani","3-4 ani","4-5 ani","5-6 ani","6-8 ani"];
const STYLES = [
  {id:"ghibli",  nume:"Pastel Ghibli", desc:"blând, ca în Totoro", sw:"sw-ghibli",
   prompt:"soft Studio Ghibli / My Neighbor Totoro inspired: gentle rounded shapes, lush muted greens, cream skies, soft pastel palette (sage green, cream, dusty gold), cozy natural scenery, small charming details, warm and calm"},
  {id:"acuarela",nume:"Acuarelă", desc:"tonuri difuze, visătoare", sw:"sw-acuarela",
   prompt:"dreamy watercolor: soft blended washes of powder blue, blush pink and lavender, gentle gradients, loose organic edges, airy negative space, delicate and calming"},
  {id:"hartie",  nume:"Hârtie decupată", desc:"forme simple, colaj", sw:"sw-hartie",
   prompt:"paper cut-out collage: bold simple flat shapes with slightly rounded corners, layered like construction paper with subtle drop shadows, warm playful palette (terracotta, mustard, teal, cream), Eric Carle inspired"},
  {id:"creioane",nume:"Creioane colorate", desc:"vesel, ca desenat de copii", sw:"sw-creioane",
   prompt:"cheerful colored-pencil children's book style: soft hand-drawn look, wobbly friendly lines, bright but gentle candy pastels (pink, butter yellow, baby blue), big expressive eyes, playful and warm"}
];
let selAge = AGES[2], selStyle = STYLES[0], current = null;

// ---------- settings ----------
const MODEL_TEXT = "claude-haiku-4-5";     // povestea — rapid și ieftin
const MODEL_ART  = "claude-sonnet-4-6";    // ilustrațiile — calitate
let settings = store.get('settings') || { apiKey:"" };
function initSettings(){
  $('apiKey').value = settings.apiKey||"";
}
$('setBtn').onclick = ()=>{ const s=$('settings'); s.style.display = s.style.display==='none'?'block':'none'; initSettings(); };
$('setSave').onclick = ()=>{ settings.apiKey=$('apiKey').value.trim(); store.set('settings',settings); $('settings').style.display='none'; };
initSettings();

// ---------- UI setup ----------
const $ = id => document.getElementById(id);
AGES.forEach(a=>{
  const b=document.createElement('button'); b.className='chip'+(a===selAge?' on':''); b.textContent=a;
  b.onclick=()=>{ selAge=a; document.querySelectorAll('#ages .chip').forEach(x=>x.classList.toggle('on',x.textContent===a)); };
  $('ages').appendChild(b);
});
STYLES.forEach(s=>{
  const d=document.createElement('div'); d.className='style-opt'+(s.id===selStyle.id?' on':'');
  d.innerHTML=`<div class="sw ${s.sw}"></div><b>${s.nume}</b><span>${s.desc}</span>`;
  d.onclick=()=>{ selStyle=s; document.querySelectorAll('.style-opt').forEach(x=>x.classList.remove('on')); d.classList.add('on'); };
  $('styles').appendChild(d);
});

// ---------- Claude API ----------
async function claude(prompt, maxTokens, model){
  const headers = {"Content-Type":"application/json"};
  if(settings.apiKey){
    headers["x-api-key"] = settings.apiKey;
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";
  }
  const r = await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST", headers,
    body:JSON.stringify({model, max_tokens:maxTokens, messages:[{role:"user",content:prompt}]})
  });
  const d = await r.json();
  if(d.error){
    if((d.error.type||"").includes("authentication")) throw new Error("Cheie API lipsă sau invalidă — deschide ⚙️ Setări și adaug-o.");
    throw new Error(d.error.message||"Eroare API");
  }
  return d.content.filter(c=>c.type==="text").map(c=>c.text).join("\n");
}
const stripFences = t => t.replace(/```(json|svg|xml)?/g,"").trim();

// ---------- robust JSON parsing (fixes: unescaped quotes / newlines in model output) ----------
function safeParseJSON(raw){
  let t = stripFences(raw);
  const m = t.match(/\{[\s\S]*\}/);
  if(m) t = m[0];
  // control chars (raw newlines/tabs inside strings) -> space
  t = t.replace(/[\u0000-\u001F]+/g,' ');
  // normalize smart double quotes so they can't be mistaken for JSON delimiters
  t = t.replace(/[\u201C\u201D\u00AB\u00BB]/g,'\u201E');
  try{ return JSON.parse(t) }catch(e){}
  // repair pass: escape stray " inside string values
  let out='', inStr=false;
  for(let i=0;i<t.length;i++){
    const c=t[i];
    if(c==='"' && t[i-1]!=='\\'){
      if(!inStr){ inStr=true; out+=c; continue; }
      // inside a string: is this a legit closing quote? look ahead for : , } ]
      const rest=t.slice(i+1).match(/^\s*([:,\}\]])/);
      if(rest){ inStr=false; out+=c; } else { out+='\\"'; }
      continue;
    }
    out+=c;
  }
  return JSON.parse(out);
}

// ---------- generation ----------
$('go').onclick = async ()=>{
  const situatie = $('situatie').value.trim();
  if(!situatie){ showErr("Scrie mai întâi ce situație vrei să abordeze povestea."); return; }
  hideErr(); $('go').disabled=true; $('form').style.opacity=.6;
  $('prog').classList.add('show'); $('book').classList.remove('show');
  setProg(5,"Se scrie povestea…");

  try{
    const nume = $('nume').value.trim();
    const directii = $('directii').value.trim();
    const atmosfera = $('atmosfera').value.trim();
    const storyPrompt = `Ești un autor de povești pentru copii, în limba română, cald și priceput.
Scrie o poveste pentru un copil de ${selAge}, care abordează cu blândețe situația: "${situatie}".
${directii ? `Idei importante de integrat natural în poveste: ${directii}` : ""}
${nume ? `Personajul principal se numește ${nume}.` : "Alege un personaj principal simpatic (copil sau animăluț)."}
${atmosfera ? `Personaje, animale sau atmosferă dorite de părinte (integrează-le în poveste și în descrierile de ilustrații): ${atmosfera}` : ""}
Cerințe:
- limbaj și lungime adecvate vârstei ${selAge} (propoziții scurte pentru cei mici, mai bogate pentru cei mari)
- ton pozitiv, fără morală apăsată; lecția reiese din poveste
- 4 scene, fiecare cu 2-5 propoziții
- final liniștitor, potrivit pentru culcare
Răspunde DOAR cu JSON valid pe o singură linie, fără backticks.
FOARTE IMPORTANT pentru JSON valid: în interiorul textelor nu folosi niciodată ghilimele drepte ("). Pentru dialog folosește ghilimele românești („ și ") sau linia de dialog (—). Nu folosi newline în interiorul textelor.
Format: {"titlu":"...","scene":[{"text":"...","ilustratie":"descriere vizuală concretă a scenei în engleză, pentru un ilustrator: personaje, acțiune, decor"}]}`;

    const story = safeParseJSON(await claude(storyPrompt, 2000, MODEL_TEXT));
    setProg(30,"Povestea e gata! Se pictează ilustrațiile…");

    const svgs = [];
    for(let i=0;i<story.scene.length;i++){
      setProg(30 + i*(65/story.scene.length), `Ilustrația ${i+1} din ${story.scene.length}…`);
      svgs.push(await genSvg(story.scene[i].ilustratie, story.scene[0].ilustratie, selStyle.prompt));
    }
    setProg(100,"Gata!");
    current = { id:Date.now(), titlu:story.titlu, varsta:selAge, situatie,
                stil:selStyle.nume, stilId:selStyle.id,
                scene:story.scene.map((s,i)=>({text:s.text, ilustratie:s.ilustratie, svg:svgs[i]})) };
    renderBook(current);
  }catch(e){
    showErr("Nu am reușit să creez povestea: "+e.message+" — încearcă din nou.");
  }finally{
    $('go').disabled=false; $('form').style.opacity=1; $('prog').classList.remove('show');
  }
};

async function genSvg(desc, refDesc, stylePrompt){
  const svgPrompt = `Create a children's book illustration as a single self-contained SVG (viewBox="0 0 800 600", no external refs, no scripts).
Art style: ${stylePrompt}.
Scene to illustrate: ${desc}
Keep character design consistent: ${refDesc}
Use layered shapes, soft gradients (defs), rounded forms. Rich, complete scene with background, midground, characters. No text inside the image.
Respond ONLY with the SVG code, nothing else.`;
  try{
    const svg = stripFences(await claude(svgPrompt, 4000, MODEL_ART));
    const m = svg.match(/<svg[\s\S]*<\/svg>/);
    return m ? m[0] : placeholderSvg();
  }catch(e){ return placeholderSvg(); }
}

async function repaint(i, btn){
  if(!current || !current.scene[i]) return;
  const sc = current.scene[i];
  const stylePrompt = (STYLES.find(s=>s.id===current.stilId) || selStyle).prompt;
  btn.disabled = true; btn.textContent = '🎨 Se repictează…';
  const desc = sc.ilustratie || sc.text; // stories saved before this update lack ilustratie
  sc.svg = await genSvg(desc, (current.scene[0].ilustratie||current.scene[0].text), stylePrompt);
  // persist if this story is already saved
  const list = store.get('stories')||[];
  const idx = list.findIndex(x=>x.id===current.id);
  if(idx>-1){ list[idx]=current; store.set('stories',list); }
  renderBook(current);
}

function placeholderSvg(){
  return `<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="600" fill="#EAF0E4"/><circle cx="640" cy="120" r="60" fill="#F2D49B"/><path d="M0 450 Q200 380 400 450 T800 440 V600 H0 Z" fill="#B8CBB0"/><path d="M0 500 Q250 440 500 500 T800 490 V600 H0 Z" fill="#9AB694"/></svg>`;
}

function setProg(p,t){ $('progBar').style.width=p+'%'; $('progTxt').textContent=t; }
function showErr(t){ $('err').textContent=t; $('err').classList.add('show'); }
function hideErr(){ $('err').classList.remove('show'); }

// ---------- render ----------
function renderBook(st){
  $('bTitle').textContent = st.titlu;
  $('bSub').textContent = `${st.varsta} · ${st.situatie} · stil ${st.stil}`;
  $('spreads').innerHTML = st.scene.map((s,i)=>
    `<div class="spread"><div class="art">${s.svg}<button class="repaint" data-i="${i}" title="Repictează ilustrația">🎨 Repictează</button></div><div class="txt">${esc(s.text)}</div></div>`).join("");
  $('spreads').querySelectorAll('.repaint').forEach(b=> b.onclick=()=> repaint(+b.dataset.i, b));
  $('book').classList.add('show');
  $('book').scrollIntoView({behavior:'smooth'});
}
const esc = t => t.replace(/&/g,"&amp;").replace(/</g,"&lt;");

// ---------- saved stories ----------
function refreshSaved(){
  const list = store.get('stories')||[];
  $('savedCard').style.display = list.length ? 'block':'none';
  $('savedList').innerHTML = list.map(s=>
    `<div class="saved-item"><div><b data-id="${s.id}">${esc(s.titlu)}</b><br><small>${s.varsta} · ${esc(s.situatie)}</small></div>
     <button data-del="${s.id}" title="Șterge">🗑</button></div>`).join("");
  $('savedList').querySelectorAll('b').forEach(b=> b.onclick=()=>{ const st=list.find(x=>x.id==b.dataset.id); if(st){current=st; renderBook(st);} });
  $('savedList').querySelectorAll('[data-del]').forEach(b=> b.onclick=()=>{ store.set('stories', list.filter(x=>x.id!=b.dataset.del)); refreshSaved(); });
}
$('saveBtn').onclick = ()=>{ if(!current) return; const l=store.get('stories')||[]; if(!l.some(x=>x.id===current.id)){ l.unshift(current); store.set('stories',l);} refreshSaved(); };
$('newBtn').onclick = ()=>{ $('book').classList.remove('show'); window.scrollTo({top:0,behavior:'smooth'}); };
$('expBtn').onclick = ()=>{
  const blob = new Blob([JSON.stringify(store.get('stories')||[],null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='aletheia-povesti.json'; a.click();
};
$('impBtn').onclick = ()=> $('impFile').click();
$('impFile').onchange = e=>{
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader(); r.onload=()=>{ try{
    const inc=JSON.parse(r.result); const cur=store.get('stories')||[];
    const merged=[...inc.filter(x=>!cur.some(c=>c.id===x.id)),...cur];
    store.set('stories',merged); refreshSaved();
  }catch(err){ showErr("Fișier JSON invalid."); } }; r.readAsText(f);
};
refreshSaved();

// ---------- service worker ----------
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}
