const STORE_KEY = 'cardvault_cards_v1';
let cards = [];
let activeTab = 'credit';
let openStates = {}; // id -> 'front' | 'back'
let editingId = null;

function load(){
  try{ cards = JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch(e){ cards = []; }
}
function save(){
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(cards)); }
  catch(e){ toast('Storage error — could not save'); }
}
function uid(){ return 'c' + Date.now() + Math.random().toString(36).slice(2,7); }

function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>t.classList.remove('show'), 1400);
}

function maskNumber(n){
  const digits = n.replace(/\D/g,'');
  if(digits.length <= 4) return n;
  const last4 = digits.slice(-4);
  return '•••• •••• •••• ' + last4;
}

function render(){
  const list = document.getElementById('list');
  const items = cards.filter(c => c.type === activeTab);
  list.innerHTML = '';
  if(items.length === 0){
    list.innerHTML = `<div class="empty"><b>No ${activeTab} cards yet</b>Tap the + icon above to add your first card.</div>`;
    return;
  }
  items.forEach(c => {
    const state = openStates[c.id] || 'collapsed';
    const row = document.createElement('div');
    row.className = 'card-row' + (state === 'back' ? ' open' : '');

    const card = document.createElement('div');
    card.className = 'card state-' + state;
    card.style.background = c.color;
    card.dataset.id = c.id;

    let inner = `<div class="top-row"><div class="brand">${c.bank.split(' ')[0]}</div><div class="chip">${c.type}</div></div>`;
    if(state === 'front'){
      inner += `
        <div class="front-info">
          <div class="lbl">Name</div><div class="val">${escapeHtml(c.name)}</div>
          <div class="lbl">Card Number</div>
          <div class="val">${maskNumber(c.number)} <span class="copy-ic" data-copy="${c.number}"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg></span></div>
          <div class="bottom-row">
            <div><div class="lbl">Expiry Date</div><div class="val" style="margin-bottom:0">${c.month}/${c.year.slice(-2)}</div></div>
            <div class="bank-tag">${c.operator}</div>
          </div>
        </div>`;
    }
    card.innerHTML = inner;

    row.appendChild(card);

    if(state === 'back'){
      const panel = document.createElement('div');
      panel.className = 'side-panel';
      panel.innerHTML = `
        <div class="grp">
          <div class="item"><div class="lbl2">CVV</div><div class="v2">${c.cvv} <span class="copy-ic" data-copy="${c.cvv}"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" style="width:13px;height:13px"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg></span></div></div>
          <div class="item"><div class="lbl2">Pin</div><div class="v2">${c.pin}</div></div>
        </div>
        ${c.tpin ? `<div class="item"><div class="lbl2">T Pin</div><div class="v2">${c.tpin}</div></div>` : ''}
        <div class="icon-row">
          <div class="iconbtn edit" data-id="${c.id}"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5.5 16z"/></svg></div>
          <div class="iconbtn del" data-id="${c.id}"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-8 0 1 13a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-13"/></svg></div>
        </div>`;
      row.appendChild(panel);
    }

    list.appendChild(row);
  });
}

function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

document.getElementById('list').addEventListener('click', (e)=>{
  const copyEl = e.target.closest('.copy-ic');
  if(copyEl){
    e.stopPropagation();
    const val = copyEl.dataset.copy;
    navigator.clipboard?.writeText(val).then(()=>toast('Copied')).catch(()=>toast('Copy failed'));
    return;
  }
  const editEl = e.target.closest('.iconbtn.edit');
  if(editEl){ e.stopPropagation(); openEdit(editEl.dataset.id); return; }
  const delEl = e.target.closest('.iconbtn.del');
  if(delEl){ e.stopPropagation(); deleteCard(delEl.dataset.id); return; }

  const cardEl = e.target.closest('.card');
  if(cardEl){
    const id = cardEl.dataset.id;
    const cur = openStates[id] || 'collapsed';
    // collapse all other open cards
    Object.keys(openStates).forEach(k => { if(k !== id) delete openStates[k]; });
    if(cur === 'collapsed') openStates[id] = 'front';
    else if(cur === 'front') openStates[id] = 'back';
    else openStates[id] = 'collapsed';
    render();
  }
});

// simple swipe: swipe left on an open 'front' card reveals back
let touchStartX = null, touchId = null;
document.getElementById('list').addEventListener('touchstart', (e)=>{
  const cardEl = e.target.closest('.card');
  if(!cardEl) return;
  touchStartX = e.touches[0].clientX;
  touchId = cardEl.dataset.id;
}, {passive:true});
document.getElementById('list').addEventListener('touchend', (e)=>{
  if(touchStartX === null) return;
  const dx = (e.changedTouches[0].clientX - touchStartX);
  if(Math.abs(dx) > 55 && touchId){
    const cur = openStates[touchId] || 'collapsed';
    Object.keys(openStates).forEach(k => { if(k !== touchId) delete openStates[k]; });
    if(dx < 0) openStates[touchId] = (cur === 'collapsed') ? 'front' : 'back';
    else openStates[touchId] = 'collapsed';
    render();
  }
  touchStartX = null; touchId = null;
});

function deleteCard(id){
  cards = cards.filter(c => c.id !== id);
  delete openStates[id];
  save(); render();
  toast('Card deleted');
}

document.querySelectorAll('.tab').forEach(tab=>{
  tab.addEventListener('click', ()=>{
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    activeTab = tab.dataset.type;
    render();
  });
});

// ---- Add/Edit sheet ----
const overlay = document.getElementById('overlay');
function populateSelects(){
  const monthSel = document.getElementById('f-month');
  for(let m=1;m<=12;m++){
    const v = String(m).padStart(2,'0');
    monthSel.innerHTML += `<option value="${v}">${v}</option>`;
  }
  const yearSel = document.getElementById('f-year');
  const nowY = new Date().getFullYear();
  for(let y=nowY;y<=2050;y++){
    yearSel.innerHTML += `<option value="${y}">${y}</option>`;
  }
}
populateSelects();

function resetForm(){
  document.getElementById('f-bank').selectedIndex = 0;
  document.getElementById('f-type').value = activeTab;
  document.getElementById('f-operator').selectedIndex = 0;
  document.getElementById('f-name').value = '';
  document.getElementById('f-number').value = '';
  document.getElementById('f-month').value = '01';
  document.getElementById('f-year').value = String(new Date().getFullYear());
  document.getElementById('f-cvv').value = '';
  document.getElementById('f-pin').value = '';
  document.getElementById('f-tpin').value = '';
  document.querySelectorAll('.swatch').forEach((s,i)=>s.classList.toggle('sel', i===0));
}

document.getElementById('openAdd').addEventListener('click', ()=>{
  editingId = null;
  document.getElementById('sheetTitle').textContent = 'Add Card';
  resetForm();
  overlay.classList.add('show');
});
document.getElementById('cancelBtn').addEventListener('click', ()=> overlay.classList.remove('show'));
overlay.addEventListener('click', (e)=>{ if(e.target === overlay) overlay.classList.remove('show'); });

function onlyLetters(e){ e.target.value = e.target.value.replace(/[^a-zA-Z\s]/g, ''); }
function onlyDigits(e){ e.target.value = e.target.value.replace(/\D/g, ''); }
document.getElementById('f-name').addEventListener('input', onlyLetters);
document.getElementById('f-number').addEventListener('input', onlyDigits);
document.getElementById('f-cvv').addEventListener('input', onlyDigits);
document.getElementById('f-pin').addEventListener('input', onlyDigits);
document.getElementById('f-tpin').addEventListener('input', onlyDigits);

document.getElementById('colorPicker').addEventListener('click', (e)=>{
  const sw = e.target.closest('.swatch');
  if(!sw) return;
  document.querySelectorAll('.swatch').forEach(s=>s.classList.remove('sel'));
  sw.classList.add('sel');
});

function openEdit(id){
  const c = cards.find(x=>x.id===id);
  if(!c) return;
  editingId = id;
  document.getElementById('sheetTitle').textContent = 'Edit Card';
  document.getElementById('f-bank').value = c.bank;
  document.getElementById('f-type').value = c.type;
  document.getElementById('f-operator').value = c.operator;
  document.getElementById('f-name').value = c.name;
  document.getElementById('f-number').value = c.number;
  document.getElementById('f-month').value = c.month;
  document.getElementById('f-year').value = c.year;
  document.getElementById('f-cvv').value = c.cvv;
  document.getElementById('f-pin').value = c.pin;
  document.getElementById('f-tpin').value = c.tpin || '';
  document.querySelectorAll('.swatch').forEach(s=>s.classList.toggle('sel', s.dataset.c === c.color));
  overlay.classList.add('show');
}

document.getElementById('saveBtn').addEventListener('click', ()=>{
  const name = document.getElementById('f-name').value.trim();
  const number = document.getElementById('f-number').value.trim();
  const cvv = document.getElementById('f-cvv').value.trim();
  const pin = document.getElementById('f-pin').value.trim();
  if(!name || !number || !cvv || !pin){
    toast('Please fill in required fields');
    return;
  }
  const selectedSwatch = document.querySelector('.swatch.sel');
  const data = {
    bank: document.getElementById('f-bank').value,
    type: document.getElementById('f-type').value,
    operator: document.getElementById('f-operator').value,
    name, number,
    month: document.getElementById('f-month').value,
    year: document.getElementById('f-year').value,
    cvv, pin,
    tpin: document.getElementById('f-tpin').value.trim(),
    color: selectedSwatch ? selectedSwatch.dataset.c : '#00B5EF'
  };
  if(editingId){
    const idx = cards.findIndex(c=>c.id===editingId);
    cards[idx] = {...cards[idx], ...data};
    toast('Card updated');
  } else {
    data.id = uid();
    cards.push(data);
    toast('Card added');
  }
  save();
  overlay.classList.remove('show');
  activeTab = data.type;
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.dataset.type===activeTab));
  render();
});

// ---- security banner dismiss (remembered locally) ----
const SEC_KEY = 'cardvault_sec_dismissed';
const secBanner = document.getElementById('secBanner');
if (secBanner) {
  if (localStorage.getItem(SEC_KEY) === '1') secBanner.style.display = 'none';
  document.getElementById('secClose')?.addEventListener('click', () => {
    secBanner.style.display = 'none';
    try { localStorage.setItem(SEC_KEY, '1'); } catch (e) {}
  });
}

// ---- PWA service worker ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

load();
render();
