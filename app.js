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
const ART_STYLES = [
  {id:"miyazaki", nume:"Ghibli / Miyazaki",
   prompt:"Hand-painted Studio Ghibli animation art in the tradition of Hayao Miyazaki. Soft gouache and watercolour on board, luminous naturalistic daylight, lush layered greenery and big cumulus skies, warm lived-in interiors full of small objects, characters with simple rounded features and calm faces, no hard outlines, cinematic depth. Palette: sage and emerald greens, sky blue, cream, warm ochre."},
  {id:"andronic", nume:"Ilustrație românească",
   prompt:"Contemporary Romanian folk-art children's illustration, in the spirit of Mădălina Andronic. FLAT graphic shapes with NO perspective depth and NO photographic realism — everything is decorative and stylised, like a hand-printed poster. Visible screen-print grain, thick matte gouache, embroidery-inspired motifs and geometric borders, stylised plants and animals arranged symmetrically, elongated naive figures with tiny simple faces. Palette strictly: ochre, brick red, deep forest green, indigo, cream. Absolutely no soft cinematic lighting."},
  {id:"acuarela", nume:"Acuarelă clasică",
   prompt:"Classic English children's-book WATERCOLOUR on white paper, in the tradition of Beatrix Potter and Quentin Blake. Loose wet-on-wet washes with visible paper grain and blooming edges, scratchy fine ink linework over the paint, LOTS of untouched white paper as background — no full-bleed colour, no dense backgrounds. Delicate, airy, muted natural palette. Looks painted by hand with a real brush, slightly imperfect."},
  {id:"papercut", nume:"Colaj de hârtie",
   prompt:"Handmade PAPER COLLAGE illustration, in the tradition of Eric Carle and Leo Lionni. Every element is a piece of torn or cut painted paper with visible fibres, brush texture and rough edges, layered flat with small shadows between layers. Bold simple silhouettes, no gradients, no painted lighting, no fine detail — shapes only. Bright warm palette on a plain paper background. Must clearly look like cut paper, not like a painting."},
  {id:"findus", nume:"Findus (Nordqvist)",
   prompt:"Detailed pen-and-watercolour illustration in the exact style of Sven Nordqvist's Pettson and Findus books. Busy, richly detailed scenes crammed with tiny funny background events, ramshackle Swedish farmhouse and garden, wobbly organic ink linework, warm muted watercolour washes, lots of little creatures and objects hidden everywhere, cosy and humorous. Characters include Pettson (a tall lanky old farmer with a bushy grey beard, bald head with tufts of hair, round nose, dungarees and a floppy hat) and Findus (a small striped green-and-white cat wearing tiny red-and-green striped trousers, very expressive and mischievous)."}
];
const ART_COUNTS = [2,3,4,5];
let settings = Object.assign({ apiKey:"", gemKey:"", artStyle:"miyazaki", artCount:2 }, store.get('settings')||{});
function initSettings(){
  $('apiKey').value = settings.apiKey||"";
  $('gemKey').value = settings.gemKey||"";
  $('artStyles').innerHTML=""; 
  ART_STYLES.forEach(s=>{
    const b=document.createElement('button'); b.className='chip'+(s.id===settings.artStyle?' on':''); b.textContent=s.nume;
    b.onclick=()=>{ settings.artStyle=s.id; store.set('settings',settings); initSettings(); };
    $('artStyles').appendChild(b);
  });
  $('artCounts').innerHTML="";
  ART_COUNTS.forEach(n=>{
    const b=document.createElement('button'); b.className='chip'+(n===settings.artCount?' on':''); b.textContent=n;
    b.onclick=()=>{ settings.artCount=n; store.set('settings',settings); initSettings(); };
    $('artCounts').appendChild(b);
  });
}
$('setBtn').onclick = ()=>{ const s=$('settings'); s.style.display = s.style.display==='none'?'block':'none'; initSettings(); };
$('setSave').onclick = ()=>{
  settings.apiKey=$('apiKey').value.trim();
  settings.gemKey=$('gemKey').value.trim();
  store.set('settings',settings); $('settings').style.display='none';
};
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

// ---------- IndexedDB pentru imagini (prea mari pentru localStorage) ----------
function idb(){
  return new Promise((res,rej)=>{
    const r = indexedDB.open('povestar',1);
    r.onupgradeneeded = ()=> r.result.createObjectStore('images');
    r.onsuccess = ()=> res(r.result);
    r.onerror = ()=> rej(r.error);
  });
}
async function imgSave(key, dataUrl){
  try{ const db=await idb(); const tx=db.transaction('images','readwrite'); tx.objectStore('images').put(dataUrl,key); }catch(e){}
}
async function imgLoad(key){
  try{
    const db=await idb();
    return await new Promise(res=>{
      const rq=db.transaction('images','readonly').objectStore('images').get(key);
      rq.onsuccess=()=>res(rq.result||null); rq.onerror=()=>res(null);
    });
  }catch(e){ return null }
}

// ---------- persoane (poze de referință) ----------
function compressImage(file, max=640){
  return new Promise((res,rej)=>{
    const fr=new FileReader();
    fr.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        const sc=Math.min(1, max/Math.max(img.width,img.height));
        const c=document.createElement('canvas');
        c.width=Math.round(img.width*sc); c.height=Math.round(img.height*sc);
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);
        res(c.toDataURL('image/jpeg',0.85));
      };
      img.onerror=()=>rej(new Error("Poza nu a putut fi citită"));
      img.src=fr.result;
    };
    fr.onerror=()=>rej(new Error("Fișierul nu a putut fi citit"));
    fr.readAsDataURL(file);
  });
}

let chars = store.get('chars') || [];   // biblioteca: [{id, nume, rol, detalii, key}]
let chosen = new Set();                  // id-urile bifate pentru povestea curentă

async function renderChars(){
  const box=$('charChosen'); box.innerHTML="";
  if(!chars.length){ box.innerHTML=`<p class="hint">Niciun personaj salvat încă.</p>`; return; }
  for(const c of chars){
    const url = await imgLoad(c.key);
    const on = chosen.has(c.id);
    const d=document.createElement('div'); d.className='person'+(on?' chosen':'');
    d.innerHTML = `${url?`<img src="${url}" alt="">`:''}
      <span><b>${esc(c.nume)}</b> <small>${esc(c.rol)}</small>${c.detalii?`<br><small>${esc(c.detalii)}</small>`:''}</span>
      <button class="pick" data-pick="${c.id}">${on?'✓ inclus':'+ include'}</button>
      <button data-del="${c.id}" title="Șterge">🗑</button>`;
    d.querySelector('[data-pick]').onclick=()=>{ on?chosen.delete(c.id):chosen.add(c.id); renderChars(); };
    d.querySelector('[data-del]').onclick=()=>{ chars=chars.filter(x=>x.id!==c.id); chosen.delete(c.id); store.set('chars',chars); renderChars(); };
    box.appendChild(d);
  }
}
$('cFile').onchange = async e=>{
  const f=e.target.files[0]; if(!f) return;
  const msg=$('cMsg'); msg.textContent="Se salvează personajul…";
  try{
    const dataUrl = await compressImage(f);
    const rol=$('cRole').value;
    const nume=$('cName').value.trim() || rol.charAt(0).toUpperCase()+rol.slice(1);
    const id='c'+Date.now(), key='char-'+id;
    await imgSave(key, dataUrl);
    chars.push({id, nume, rol, detalii:$('cDetails').value.trim(), key});
    chosen.add(id);
    store.set('chars',chars);
    $('cName').value=""; $('cDetails').value=""; e.target.value="";
    msg.textContent=`${nume} a fost salvat și inclus în poveste.`;
    renderChars();
  }catch(err){ msg.textContent="Poza nu a putut fi încărcată: "+err.message; }
};
renderChars();

// personajele efectiv folosite în povestea curentă
function activeChars(){ return chars.filter(c=>chosen.has(c.id)); }

// ---------- Gemini: generare ilustrații ----------
async function geminiImage(prompt, refs){
  const parts = [{text: prompt}];
  for(const url of (refs||[]).filter(Boolean)){
    const [meta,b64] = url.split(',');
    parts.push({inline_data:{mime_type: meta.includes('png')?'image/png':'image/jpeg', data: b64}});
  }
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent",{
    method:"POST",
    headers:{"Content-Type":"application/json","x-goog-api-key":settings.gemKey},
    body:JSON.stringify({contents:[{parts}]})
  });
  const d = await r.json();
  if(d.error) throw new Error(d.error.message||"Eroare Gemini");
  const part = (((d.candidates||[])[0]||{}).content||{}).parts?.find(p=>p.inlineData||p.inline_data);
  if(!part) throw new Error("Gemini nu a returnat imagine");
  const inline = part.inlineData||part.inline_data;
  return `data:${inline.mimeType||inline.mime_type||'image/png'};base64,${inline.data}`;
}

async function makeIllustrations(story, storyId){
  const style = ART_STYLES.find(s=>s.id===settings.artStyle)||ART_STYLES[0];
  const n = settings.artCount||3;
  // 1. Claude alege momentele și scrie brief-urile vizuale
  const briefPrompt = `Read this Romanian children's story and pick the ${n} most visually beautiful moments to illustrate.
Story: ${JSON.stringify(story)}
${activeChars().length ? `IMPORTANT: these characters are real people drawn from photographs — ${activeChars().map(p=>`${p.nume} (${p.rol})`).join(', ')}. NEVER describe their face, hair, skin or age; only describe their clothing, posture, action and expression. Their appearance comes from the photos, not from you.` : ""}
For each moment, write an art brief in English describing exactly what is drawn: who is present, their action and expression, the setting, time of day, and mood. Be concrete and specific. No text or lettering in the images.
Also give a shared character sheet so characters look consistent — but for the real people above, list only their name, role and clothing.
Respond ONLY with valid single-line JSON: {"personaje":"character sheet...","imagini":[{"paragraf":<index of the paragraph it illustrates, 0-based>,"brief":"..."}]}`;
  const plan = safeParseJSON(await claude(briefPrompt, 1500, MODEL_TEXT));

  // pozele de referință pentru asemănare
  const photos = [], photoNotes = [];
  for(const p of activeChars()){
    const url = await imgLoad(p.key);
    if(url){ photos.push(url); photoNotes.push(`reference photo ${photos.length}: ${p.nume}, ${p.rol}`); }
  }
  const likeness = photos.length
    ? `LIKENESS IS THE TOP PRIORITY: the attached reference photos show the real people in this story — ${photoNotes.join('; ')}. Each character MUST be recognisably that person: same face shape, same hair colour and cut, same skin tone, same approximate age, glasses or other distinctive features kept. Redraw them completely in the art style below — a painted picture-book character, never a photograph or photorealistic render. If the scene description conflicts with a photo, the photo wins.`
    : "";

  const images = [];
  let ref = null;
  for(let i=0;i<plan.imagini.length;i++){
    setProg(70 + (i+1)*(28/plan.imagini.length), `Se pictează ilustrația ${i+1} din ${plan.imagini.length}…`);
    const p = `Children's picture-book illustration. No text or lettering anywhere in the image.

${likeness}

ART STYLE — follow this exactly and let it dominate the whole image:
${style.prompt}

Characters: ${plan.personaje}
Scene: ${plan.imagini[i].brief}

Full-bleed painterly illustration, 4:3 landscape, rich background, characters as focal point, gentle storybook atmosphere.`;
    try{
      const url = await geminiImage(p, [...photos, ref]);
      if(!ref) ref = url;                       // prima imagine devine referință de consistență
      const key = `${storyId}-${i}`;
      await imgSave(key, url);
      images.push({key, paragraf: plan.imagini[i].paragraf});
    }catch(e){ /* sărim peste ilustrația eșuată */ }
    if(i < plan.imagini.length-1) await new Promise(r=>setTimeout(r,1200)); // răgaz anti-rate-limit
  }
  return images;
}


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
${activeChars().length ? `Personaje reale care trebuie să apară în poveste: ${activeChars().map(p=>`${p.nume} (${p.rol})${p.detalii?` — ${p.detalii}`:''}`).join('; ')}. Folosește-le firesc, ține cont de detalii, dar nu le descrie fizic.` : ""}
${settings.artStyle==='findus' ? `Această poveste este în lumea lui Pettson și Findus (Sven Nordqvist). Include-i pe bătrânul Pettson și pe motanul vorbăreț și poznaș Findus ca personaje — cu umorul, tandrețea și micile pozne caracteristice lor. Gospodăria, grădina și in, invențiile trăsnite ale lui Pettson fac parte din atmosferă.` : ""}

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

    setProg(55,"Autorul rescrie și șlefuiește…");
    const editPrompt = `Ești un redactor de carte pentru copii, exigent, cu ureche fină pentru limba română literară. Primești ciorna unui autor. Rescrie-o cu adevărat, nu doar corecta — trebuie să sune ca proză de carte publicată, artistică și îngrijită.

Ciorna:
${JSON.stringify(draft)}

Reguli de rescriere:
1. Limbă română impecabilă și literară: acorduri, cratime, diacritice, topică firească. Elimină orice construcție stângace, calc după engleză, sau formulare de robot.
2. Ritm și muzicalitate: variază lungimea propozițiilor, folosește imagini concrete și verbe puternice. Fiecare paragraf trebuie să sune frumos citit cu voce tare.
3. Taie clișeele și explicațiile de prisos. Nu rosti niciodată morala.
4. Adaugă 2-3 cuvinte alese, mai deosebite, dar deductibile din context de un copil de ${selAge}.
5. Întărește un detaliu specific care devine semnătura poveștii.
6. Păstrează sensul, personajele și lungimea aproximativă.

Apoi tradu povestea rescrisă în engleză, cu aceeași grijă literară — proză naturală și frumoasă de carte pentru copii, nu traducere cuvânt cu cuvânt.

Răspunde DOAR cu JSON valid pe o singură linie, fără backticks, fără ghilimele drepte în interiorul textelor (folosește \u201E \u201D sau —).
Format: {"titlu":"...","paragrafe":["..."],"titlu_en":"...","paragrafe_en":["..."]}`;

    let story;
    try{ story = safeParseJSON(await claude(editPrompt, 4000, MODEL_TEXT)); }
    catch(e){ story = draft; }  // dacă trecerea editorială eșuează, păstrăm ciorna

    const storyId = Date.now();
    let imagini = [];
    if(settings.gemKey){
      try{
        imagini = await makeIllustrations(story, storyId);
        if(imagini.length===0) showErr("Ilustrațiile nu au putut fi generate (verifică cheia Gemini și facturarea Google).");
        else if(imagini.length < (settings.artCount||2)) showErr(`Au ieșit doar ${imagini.length} din ${settings.artCount} ilustrații — restul au eșuat, poate din limită de rată Google. Poți încerca din nou.`);
      }
      catch(e){ showErr("Povestea e gata, dar ilustrațiile nu au putut fi generate: "+e.message); }
    }
    setProg(100,"Gata!");
    current = { id:storyId, titlu:story.titlu, varsta:selAge, situatie,
                paragrafe:story.paragrafe, imagini,
                titlu_en:story.titlu_en||null, paragrafe_en:story.paragrafe_en||null };
    lang = 'ro';
    await renderBook(current);
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
let lang = 'ro';
async function ensureEnglish(st){
  if(st.paragrafe_en && st.paragrafe_en.length) return true;
  const p = `Translate this Romanian children's story into beautiful, natural English children's-book prose — literary, not word-for-word. Keep the same paragraphs.
Story: ${JSON.stringify({titlu:st.titlu, paragrafe:st.paragrafe})}
Respond ONLY with valid single-line JSON, no straight double quotes inside texts: {"titlu_en":"...","paragrafe_en":["..."]}`;
  try{
    const t = safeParseJSON(await claude(p, 3000, MODEL_TEXT));
    st.titlu_en = t.titlu_en; st.paragrafe_en = t.paragrafe_en;
    // persistă dacă e salvată
    const list=store.get('stories')||[]; const idx=list.findIndex(x=>x.id===st.id);
    if(idx>-1){ list[idx]=st; store.set('stories',list); }
    return true;
  }catch(e){ return false; }
}

async function renderBook(st){
  const hasEn = (st.paragrafe_en && st.paragrafe_en.length);
  const useEn = (lang==='en');
  const titlu = useEn && hasEn ? (st.titlu_en||st.titlu) : st.titlu;
  $('bTitle').textContent = titlu;
  $('bSub').innerHTML = `${st.varsta} · ${esc(st.situatie)}
    <span class="langtog"><button data-l="ro" class="${lang==='ro'?'on':''}">RO</button><button data-l="en" class="${lang==='en'?'on':''}">EN</button></span>`;
  $('bSub').querySelectorAll('.langtog button').forEach(b=> b.onclick=async()=>{
    if(b.dataset.l===lang) return;
    if(b.dataset.l==='en'){ b.textContent='…'; if(!await ensureEnglish(st)){ showErr("Traducerea nu a reușit."); b.textContent='EN'; return; } }
    lang=b.dataset.l; renderBook(st);
  });

  const paras = (useEn && hasEn ? st.paragrafe_en : (st.paragrafe || (st.scene||[]).map(s=>s.text)));
  const byPara = {};
  for(const im of (st.imagini||[])){
    const url = await imgLoad(im.key);
    if(url) (byPara[im.paragraf] = byPara[im.paragraf] || []).push(url);
  }
  let html = `<div class="story-page">`;
  paras.forEach((p,i)=>{
    (byPara[i]||[]).forEach(url=>{ html += `<img class="illus" src="${url}" alt="">`; });
    html += `<p>${esc(p)}</p>`;
  });
  Object.keys(byPara).filter(k=>k>=paras.length).forEach(k=>{
    byPara[k].forEach(url=>{ html += `<img class="illus" src="${url}" alt="">`; });
  });
  $('spreads').innerHTML = html + `</div>`;
  $('book').classList.add('show');
  $('book').scrollIntoView({behavior:'smooth'});
}
const esc = t => t.replace(/&/g,"&amp;").replace(/</g,"&lt;");

// ---------- PDF (pagini desenate pe canvas → diacritice corecte) ----------
const PW = 1000, PH = 1414, MARGIN = 90;

function newPage(){
  const c=document.createElement('canvas'); c.width=PW; c.height=PH;
  const x=c.getContext('2d');
  x.fillStyle='#FBF6EC'; x.fillRect(0,0,PW,PH);
  return {c,x,y:MARGIN};
}
function wrapText(ctx, text, maxW){
  const words=text.split(' '), lines=[]; let line='';
  for(const w of words){
    const t = line ? line+' '+w : w;
    if(ctx.measureText(t).width > maxW && line){ lines.push(line); line=w; }
    else line=t;
  }
  if(line) lines.push(line);
  return lines;
}
async function buildPdfBlob(st){
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({unit:'px', format:[PW,PH], orientation:'portrait'});
  const pages=[]; let pg=newPage(); let first=true;
  const maxW = PW - MARGIN*2;

  const useEn = (lang==='en' && st.paragrafe_en && st.paragrafe_en.length);
  const titlu = useEn ? (st.titlu_en||st.titlu) : st.titlu;
  // titlu
  pg.x.fillStyle='#3E5940'; pg.x.textBaseline='top';
  pg.x.font='bold 58px Georgia, serif';
  for(const line of wrapText(pg.x, titlu, maxW)){ pg.x.fillText(line, MARGIN, pg.y); pg.y+=68; }
  pg.y += 10;
  pg.x.fillStyle='#8A7F70'; pg.x.font='24px Georgia, serif';
  pg.x.fillText(`${st.varsta} · ${st.situatie}`, MARGIN, pg.y); pg.y+=54;

  const byPara={};
  for(const im of (st.imagini||[])){
    const url=await imgLoad(im.key);
    if(url) (byPara[im.paragraf]=byPara[im.paragraf]||[]).push(url);
  }
  const paras = useEn ? st.paragrafe_en : (st.paragrafe || (st.scene||[]).map(s=>s.text));

  const pushPage=()=>{ pages.push(pg.c); pg=newPage(); };

  for(let i=0;i<paras.length;i++){
    // ilustrații
    for(const url of (byPara[i]||[])){
      const img = await new Promise(r=>{ const im=new Image(); im.onload=()=>r(im); im.onerror=()=>r(null); im.src=url; });
      if(img){
        const w=maxW, h=Math.round(w*img.height/img.width);
        if(pg.y + h > PH - MARGIN) pushPage();
        pg.x.drawImage(img, MARGIN, pg.y, w, h);
        pg.y += h + 34;
      }
    }
    // text
    pg.x.fillStyle='#4A4238'; pg.x.font='30px Georgia, serif'; pg.x.textBaseline='top';
    for(const line of wrapText(pg.x, paras[i], maxW)){
      if(pg.y + 46 > PH - MARGIN){ pushPage(); pg.x.fillStyle='#4A4238'; pg.x.font='30px Georgia, serif'; pg.x.textBaseline='top'; }
      pg.x.fillText(line, MARGIN, pg.y); pg.y+=46;
    }
    pg.y += 26;
  }
  // subsol pe ultima pagină
  pg.x.fillStyle='#8A7F70'; pg.x.font='20px Georgia, serif';
  pg.x.fillText('Poveștar', MARGIN, PH-MARGIN+10);
  pages.push(pg.c);

  pages.forEach((c,i)=>{
    if(i) pdf.addPage([PW,PH],'portrait');
    pdf.addImage(c.toDataURL('image/jpeg',0.9), 'JPEG', 0, 0, PW, PH);
  });
  return pdf.output('blob');
}

$('pdfBtn').onclick = async ()=>{
  if(!current) return;
  const btn=$('pdfBtn'), label=btn.textContent;
  btn.disabled=true; btn.textContent='📄 Se pregătește…';
  try{
    const blob = await buildPdfBlob(current);
    const name = (current.titlu||'poveste').replace(/[^\p{L}\d ]/gu,'').slice(0,40)+'.pdf';
    const file = new File([blob], name, {type:'application/pdf'});
    if(navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({files:[file], title:current.titlu});
    }else{
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click();
    }
  }catch(e){
    if(e.name!=='AbortError') showErr("PDF-ul nu a putut fi creat: "+e.message);
  }finally{ btn.disabled=false; btn.textContent=label; }
};

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
