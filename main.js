const colorByType = (t)=>({
  "火山地形":"#e97aa6",
  "扇状地":"#ff8fab",
  "三角州":"#f6b26b",
  "海岸段丘":"#c77dff",
  "段丘":"#9b89b3",
  "砂丘":"#ffd166",
  "砂州・砂嘴":"#80ed99",
  "干潟・干拓低地":"#73c0de",
  "リアス・沈水海岸":"#a0d8ef",
  "カルスト":"#7ad3a1",
  "氾濫原・低地":"#cfe8f3",
  "断層地形":"#f4a3b5",
  "台地":"#bde0fe",
  "海食崖・波食台":"#b8b8b8",
  "花崗岩侵食地形":"#e1c4ff",
  "その他":"#666"
}[t]||"#666");

const typeOrder=["火山地形","扇状地","三角州","海岸段丘","段丘","砂丘","砂州・砂嘴","干潟・干拓低地","リアス・沈水海岸","カルスト","氾濫原・低地","断層地形","台地","海食崖・波食台","花崗岩侵食地形","その他"];

const map = L.map('map').setView([35,135],5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'© OpenStreetMap contributors' }).addTo(map);

const state = { type:"", pref:"", veg:"", q:"" };
const els = {
  type: document.getElementById('typeSelect'),
  pref: document.getElementById('prefSelect'),
  veg: document.getElementById('vegSelect'),
  q: document.getElementById('q'),
  clear: document.getElementById('clearBtn'),
  share: document.getElementById('shareBtn'),
  hits: document.getElementById('hits'),
  legend: document.getElementById('legendColors'),
  toggle: document.getElementById('toggleFilters'),
};
const controlsPanel = document.querySelector('.controls');

// build legend
els.legend.innerHTML = typeOrder.map(t=>`<span class="badge"><span class="paint" style="background:${colorByType(t)}"></span>${t}</span>`).join(' ');

let layer;
let dataCache = null;

if (els.toggle && controlsPanel) {
  let filtersOpen = true;
  const isMobile = window.matchMedia('(max-width: 720px)').matches;
  if (isMobile) {
    filtersOpen = false;
    controlsPanel.classList.add('collapsed');
  }
  const updateToggleLabel = ()=>{
    els.toggle.textContent = filtersOpen ? "フィルタを隠す" : "フィルタを表示";
    els.toggle.setAttribute('aria-expanded', filtersOpen);
  };
  updateToggleLabel();
  els.toggle.addEventListener('click', ()=>{
    filtersOpen = !filtersOpen;
    controlsPanel.classList.toggle('collapsed', !filtersOpen);
    updateToggleLabel();
  });
}

fetch('./assets/data.geojson').then(r=>r.json()).then(gj=>{
  dataCache = gj;
  populateFilters(gj);
  render(gj);
});

function populateFilters(gj){
  const prefs = [...new Set(gj.features.map(f=>f.properties["都道府県"]))].sort();
  const vegs = [...new Set(gj.features.map(f=>f.properties["植生"]).filter(Boolean))].sort();
  typeOrder.forEach(t=>{
    const o=document.createElement('option'); o.value=t; o.textContent=t; els.type.appendChild(o);
  });
  prefs.forEach(p=>{
    const o=document.createElement('option'); o.value=p; o.textContent=p; els.pref.appendChild(o);
  });
  vegs.forEach(v=>{
    const o=document.createElement('option'); o.value=v; o.textContent=v; els.veg.appendChild(o);
  });

  // read hash
  const params = new URLSearchParams(location.hash.slice(1));
  state.type = params.get('type')||"";
  state.pref = params.get('pref')||"";
  state.veg = params.get('veg')||"";
  state.q = params.get('q')||"";
  els.type.value=state.type; els.pref.value=state.pref; els.veg.value=state.veg; els.q.value=state.q;

  els.type.addEventListener('change', ()=>{ state.type = els.type.value; update(); });
  els.pref.addEventListener('change', ()=>{ state.pref = els.pref.value; update(); });
  els.veg.addEventListener('change', ()=>{ state.veg = els.veg.value; update(); });
  els.q.addEventListener('input', ()=>{ state.q = els.q.value; update(); });
  els.clear.addEventListener('click', ()=>{
    state.type=""; state.pref=""; state.veg=""; state.q="";
    els.type.value=""; els.pref.value=""; els.veg.value=""; els.q.value="";
    update();
  });
  els.share.addEventListener('click', ()=>{
    const h = new URLSearchParams({type:state.type,pref:state.pref,veg:state.veg,q:state.q}).toString();
    location.hash = h;
    if (navigator.clipboard) navigator.clipboard.writeText(location.href);
    els.share.textContent = "コピーしました";
    setTimeout(()=>els.share.textContent="検索",1500);
  });
}

function matchFilters(f){
  const p = f.properties || {};
  const typeOk = state.type ? p["地形タイプ"]===state.type : true;
  const prefOk = state.pref ? p["都道府県"]===state.pref : true;
  const vegOk = state.veg ? p["植生"]===state.veg : true;
  const q = state.q.trim().toLowerCase();
  const qOk = q ? ((p["名称"]||"")+ (p["地理的特徴・成り立ち"]||"")).toLowerCase().includes(q) : true;
  return typeOk && prefOk && vegOk && qOk;
}

function render(gj){
  if(layer){ layer.remove(); }
  layer = L.geoJSON(gj, {
    filter: matchFilters,
    pointToLayer: (f, latlng) => L.circleMarker(latlng, {
      radius:6, color: colorByType(f.properties["地形タイプ"]), weight:1, fillOpacity:0.85
    }),
    onEachFeature:(f,l)=>{
      const p=f.properties||{};
      l.bindPopup(`<b>${p.名称||""}</b><br>${p["都道府県"]||""} / ${p["地形タイプ"]||""}<br>${p["地理的特徴・成り立ち"]||""}`);
    }
  }).addTo(map);
  try { map.fitBounds(layer.getBounds(), {padding:[16,16]}); } catch(e){}
  els.hits.textContent = `表示: ${layer.getLayers().length} 件`;
}

function update(){
  const h = new URLSearchParams({type:state.type,pref:state.pref,veg:state.veg,q:state.q}).toString();
  location.hash = h;
  render(dataCache);
}
