// catalog.js
// โหลดรายการสินค้า (list) และแสดงในตาราง พร้อม search + basic loading state
// ต้องมี config.js ที่ประกาศ APPS_SCRIPT_URL อยู่แล้ว (global)

(function(){
  'use strict';

  // Helpers
  function byId(id){ return document.getElementById(id); }
  function el(tag, props){ const e = document.createElement(tag); if(props) Object.assign(e, props); return e; }
  function showMsg(text, isError){
    const msg = byId('listMsg');
    if(!msg) return;
    msg.textContent = text || '';
    msg.style.color = isError ? 'red' : '#333';
  }

  async function apiGet(params){
    if(!window.APPS_SCRIPT_URL) throw new Error('APPS_SCRIPT_URL not set (config.js)');
    const url = APPS_SCRIPT_URL + '?' + new URLSearchParams(params).toString();
    const resp = await fetch(url, { cache: 'no-store' });
    if(!resp.ok) throw new Error('HTTP ' + resp.status);
    return resp.json();
  }

  function clearTable(){
    const tbody = document.querySelector('#catalogTable tbody');
    if(tbody) tbody.innerHTML = '';
  }

  function renderRow(p){
    const tr = el('tr');
    // image
    const tdImg = el('td');
    if(p.imageUrl){
      const img = el('img'); img.src = p.imageUrl; img.alt = p.name || p.sku || '';
      img.style.width = '64px'; img.style.height = '64px'; img.style.objectFit = 'cover';
      tdImg.appendChild(img);
    }
    tr.appendChild(tdImg);

    // sku
    tr.appendChild(el('td', { textContent: p.sku || '' }));

    // name with link to product page
    const nameTd = el('td');
    const a = el('a', { textContent: p.name || '(ไม่มีชื่อ)' });
    a.href = 'product.html?sku=' + encodeURIComponent(p.sku || '');
    nameTd.appendChild(a);
    tr.appendChild(nameTd);

    // qty, cost, status
    tr.appendChild(el('td', { textContent: (Number(p.quantity)||0).toString() }));
    tr.appendChild(el('td', { textContent: (p.cost!=null?p.cost:'') }));
    tr.appendChild(el('td', { textContent: p.status || '' }));

    return tr;
  }

  // main loader
  async function loadCatalog(q){
    clearTable();
    showMsg('กำลังโหลด...');
    try{
      const params = { action: 'list', limit: 500 };
      if(q && q.trim()) params.q = q.trim();
      const r = await apiGet(params);
      if(!r || !r.ok) { showMsg('โหลดรายการล้มเหลว: ' + (r && r.error || 'unknown'), true); return; }
      const data = r.data || [];
      const tbody = document.querySelector('#catalogTable tbody');
      if(!tbody){ showMsg('ไม่พบตารางใน DOM', true); return; }
      if(data.length === 0){
        showMsg('ไม่มีสินค้า', false);
      } else {
        showMsg('โหลดสำเร็จ (' + data.length + ')', false);
      }
      // build rows
      data.forEach(p => {
        const row = renderRow(p);
        tbody.appendChild(row);
      });
    }catch(err){
      console.error('loadCatalog error', err);
      showMsg('ข้อผิดพลาด: ' + (err && err.message || err), true);
    }
  }

  // wire events
  function init(){
    const btn = byId('btnSearch');
    const qInput = byId('q');
    if(btn) btn.addEventListener('click', ()=> loadCatalog(qInput && qInput.value));
    if(qInput) qInput.addEventListener('keydown', (e)=> { if(e.key === 'Enter') loadCatalog(qInput.value); });

    // initial
    loadCatalog();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
