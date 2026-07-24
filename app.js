const $ = id => document.getElementById(id);
// ---------- storage (localStorage with in-memory fallback) ----------
const mem = {};
const store = {
  get(k){ try{ return JSON.parse(localStorage.getItem(k)) ?? mem[k] ?? null }catch(e){ return mem[k] ?? null } },
  set(k,v){ mem[k]=v; try{ localStorage.setItem(k, JSON.stringify(v)) }catch(e){} }
};

// ---------- config ----------
const AGES = ["1-2 ani","2-3 ani","3-4 ani","4-5 ani","5-6 ani","6-8 ani"];
const MODEL_TEXT = "claude-sonnet-4-6";
let selAge = AGES[2], current = null;

// ---------- settings ----------
let settings = store.get('settings') || { apiKey:"" };
function initSettings(){ $('apiKey').value = settings.apiKey||""; }
$('setBtn').onclick = ()=>{ const s=$('settings'); s.style.display = s.style.display==='none'?'block':'none'; initSettings(); };
$('setSave').onclick = ()=>{ settings.apiKey=$('apiKey').value.trim(); store.set('settings',settings); $('settings').style.display='none'; };
$('testBtn').onclick = async ()=>{
  const key = $('apiKey').value.trim();
  const out = $('testOut');
  if(!key){ out.textContent = "Pune întâi cheia în câmpul de mai sus."; return; }
  out.textContent = "Se testează…";
  try{
    const r = await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{ "Content-Type":"application/json", "x-api-key":key,
                "anthropic-version":"2023-06-01",
                "anthropic-dangerous-direct-browser-access":"true" },
      body:JSON.stringify({model:MODEL_TEXT, max_tokens:16, messages:[{role:"user",content:"salut"}]})
    });
    const d = await r.json().catch(()=>({}));
    if(r.ok) out.textContent = "✅ Conexiune reușită — cheia funcționează.";
    else out.textContent = `❌ HTTP ${r.status} — ${d.error ? d.error.type+": "+d.error.message : "răspuns neașteptat"}`;
  }catch(e){
    out.textContent = "❌ Cererea nu a ajuns la server ("+e.message+"). Cauze uzuale: extensie de blocare/adblock, VPN, firewall de rețea, sau conexiune fără internet.";
  }
};
initSettings();

// ---------- UI setup ----------
AGES.forEach(a=>{
  const b=document.createElement('button'); b.className='chip'+(a===selAge?' on':''); b.textContent=a;
  b.onclick=()=>{ selAge=a; document.querySelectorAll('#ages .chip').forEach(x=>x.classList.toggle('on',x.textContent===a)); };
  $('ages').appendChild(b);
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

// ---------- robust JSON parsing ----------
function safeParseJSON(raw){
  let t = stripFences(raw);
  const m = t.match(/\{[\s\S]*\}/);
  if(m) t = m[0];
  t = t.replace(/[\u0000-\u001F]+/g,' ');
  t = t.replace(/[\u201C\u201D\u00AB\u00BB]/g,'\u201E');
  try{ return JSON.parse(t) }catch(e){}
  let out='', inStr=false;
  for(let i=0;i<t.length;i++){
    const c=t[i];
    if(c==='"' && t[i-1]!=='\\'){
      if(!inStr){ inStr=true; out+=c; continue; }
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
  if(!settings.apiKey){ showErr("Lipsește cheia API — apasă ⚙️ sus în dreapta, lipește cheia (sk-ant-…) și salvează."); $('settings').style.display='block'; initSettings(); return; }
  hideErr(); $('go').disabled=true; $('form').style.opacity=.6;
  $('prog').classList.add('show'); $('book').classList.remove('show');
  setProg(20,"Se scrie povestea…");

  try{
    const nume = $('nume').value.trim();
    const directii = $('directii').value.trim();
    const atmosfera = $('atmosfera').value.trim();
    const storyPrompt = `Ești un scriitor de povești pentru copii cu decenii de experiență, tradus în multe limbi și iubit deopotrivă de copii și de părinți. Scrii în limba română impecabilă, cu diacritice corecte.

Familia ta spirituală de autori și povestitori — imită felul lor de a gândi, nu personajele lor:
- Sven Nordqvist (Pettson și Findus): cotidianul unei gospodării devine aventură; bătrânul și motanul care vorbește, o poznă care escaladează minunat, tandrețe fără vorbe mari, umor din situație
- Roald Dahl (Uriașul Prietenos): limbaj inventiv și jucăuș, cuvinte stâlcite delicios, copilul e luat în serios ca partener de conspirație, adulții pot fi caraghioși
- Povestea prințesei Kaguya și Song of the Sea: melancolie blândă, mitologie și natură vie, frumusețe în lucruri simple, un dor care nu se explică
- Hayao Miyazaki: fără răufăcători, conflictul e interior; momente de liniște în care nu se întâmplă nimic și tocmai de-aceea contează; hrană, vânt, apă, făcute concrete

Scrie o poveste pentru un copil de ${selAge}, care abordează cu blândețe situația: "${situatie}".
${directii ? `Idei importante de la părinte, de integrat natural: ${directii}` : ""}
${nume ? `Personajul principal se numește ${nume}.` : "Alege un personaj principal simpatic (copil sau animăluț), cu un nume simplu și firesc."}
${atmosfera ? `Personaje, animale sau atmosferă dorite de părinte: ${atmosfera}` : ""}

Cum scrii:
- profunzime accesibilă: povestea atinge ceva adevărat despre a fi mic într-o lume mare, dar spus prin întâmplări concrete pe care un copil de ${selAge} le poate urmări
- un detaliu ciudat și specific care face povestea de neuitat (un obiect, o obișnuință, un nume caraghios) — nu generalități
- senzorial: mirosuri, sunete, texturi, temperaturi — copilul trebuie să simtă scena
- umor blând, din situație și din caracter, nu din glume lipite
- duioșie arătată prin gesturi mici, niciodată declarată
- morala trăită, nu rostită: nu scrie niciodată propoziții de tipul „a înțeles că..." sau „de atunci a știut că..."
- ritm de citit cu voce tare: propoziții de lungimi diferite, câte o repetiție cu haz

INTERZIS (sună robotic, evită complet): „într-o zi însorită", „era odată un/o mic/mică...", „toți au fost foarte fericiți", „a învățat o lecție importantă", „plin de bucurie", „cu un zâmbet mare pe față", morala explicată la final, adjective în lanț („frumoasă, veselă și bună"), personaje fără cusur, propoziții care încep toate la fel.

Cerințe: lungime și complexitate potrivite vârstei ${selAge}; 6-8 paragrafe scurte; final liniștitor, potrivit pentru culcare.

Răspunde DOAR cu JSON valid pe o singură linie, fără backticks.
FOARTE IMPORTANT pentru JSON valid: în interiorul textelor nu folosi niciodată ghilimele drepte ("). Pentru dialog folosește ghilimele românești (\u201E \u201D) sau linia de dialog (—). Fără newline în interiorul textelor.
Format: {"titlu":"...","paragrafe":["...","..."]}`;

    setProg(40,"Se scrie ciorna…");
    const draft = safeParseJSON(await claude(storyPrompt, 3000, MODEL_TEXT));

    setProg(70,"Autorul rescrie și șlefuiește…");
    const editPrompt = `Ești un redactor de carte pentru copii, exigent și cu ureche bună pentru limba română. Primești ciorna unui autor. Rescrie-o, nu doar corecta.

Ciorna:
${JSON.stringify(draft)}

Ce faci la rescriere:
1. Taie orice frază care sună a manual sau a inteligență artificială — formulări generice, explicații de prisos, morală rostită.
2. Înlocuiește verbele slabe și adjectivele leneșe cu unele precise. Adaugă 2-3 cuvinte mai deosebite, dar deductibile din context de un copil de ${selAge}.
3. Verifică fiecare paragraf: dacă nu aduce ceva nou (o imagine, o replică, o cotitură), rescrie-l sau contopește-l.
4. Întărește un singur detaliu specific în așa fel încât să devină semnătura poveștii, revenind discret spre final.
5. Verifică româna: acorduri, cratime, diacritice, dialog cu linie de dialog corectă.
6. Păstrează sensul, personajele și lungimea aproximativă. Nu adăuga morală.

Răspunde DOAR cu JSON valid pe o singură linie, fără backticks, fără ghilimele drepte în interiorul textelor.
Format: {"titlu":"...","paragrafe":["...","..."]}`;

    let story;
    try{ story = safeParseJSON(await claude(editPrompt, 3000, MODEL_TEXT)); }
    catch(e){ story = draft; }  // dacă trecerea editorială eșuează, păstrăm ciorna
    setProg(100,"Gata!");
    current = { id:Date.now(), titlu:story.titlu, varsta:selAge, situatie,
                paragrafe:story.paragrafe };
    renderBook(current);
  }catch(e){
    let msg = e.message;
    if(/failed to fetch|networkerror|load failed/i.test(msg))
      msg = "Conexiunea către api.anthropic.com a fost blocată. Verifică internetul și dezactivează Brave Shields / adblock pentru acest site (iconița leu → Shields Down), apoi încearcă din nou.";
    showErr("Nu am reușit să creez povestea: "+msg);
  }finally{
    $('go').disabled=false; $('form').style.opacity=1; $('prog').classList.remove('show');
  }
};

function setProg(p,t){ $('progBar').style.width=p+'%'; $('progTxt').textContent=t; }
function showErr(t){ $('err').textContent=t; $('err').classList.add('show'); }
function hideErr(){ $('err').classList.remove('show'); }

// ---------- render ----------
function renderBook(st){
  $('bTitle').textContent = st.titlu;
  $('bSub').textContent = `${st.varsta} · ${st.situatie}`;
  const paras = st.paragrafe || (st.scene||[]).map(s=>s.text); // compat: povești vechi cu scene
  $('spreads').innerHTML = `<div class="story-page">` +
    paras.map(p=>`<p>${esc(p)}</p>`).join("") + `</div>`;
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
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='povestar-povesti.json'; a.click();
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
