// product.js
// โหลดข้อมูลสินค้าตัวเดียว (action=get&sku=) แล้วแสดงรายละเอียด
// ต้องมี config.js ที่ประกาศ APPS_SCRIPT_URL อยู่แล้ว

(function(){
  'use strict';

  function byId(id){ return document.getElementById(id); }
  function showMsg(text, isError){
    const el = byId('prodMsg');
    if(!el) return;
    el.textContent = text || '';
    el.style.color = isError ? 'red' : '#333';
  }

  function getQueryParam(name){
    return new URLSearchParams(window.location.search).get(name);
  }

  async function apiGet(params){
    if(!window.APPS_SCRIPT_URL) throw new Error('APPS_SCRIPT_URL not set (config.js)');
    const url = APPS_SCRIPT_URL + '?' + new URLSearchParams(params).toString();
    const resp = await fetch(url, { cache: 'no-store' });
    if(!resp.ok) throw new Error('HTTP ' + resp.status);
    return resp.json();
  }

  async function loadProduct(sku){
    const msgEl = byId('prodMsg');
    const content = byId('prodContent');
    try{
      showMsg('กำลังโหลด...');
      if(!sku) { showMsg('กรุณาระบุ sku ใน query string เช่น ?sku=TEST01', true); return; }
      const r = await apiGet({ action: 'get', sku: sku });
      if(!r || !r.ok){ showMsg('ไม่พบสินค้า: ' + (r && r.error || ''), true); return; }
      const p = r.data || {};
      // render
      const imgEl = byId('prodImage'); if(imgEl) imgEl.src = p.imageUrl || '';
      const nameEl = byId('prodName'); if(nameEl) nameEl.textContent = p.name || '';
      const skuEl = byId('prodSku'); if(skuEl) skuEl.textContent = p.sku || '';
      const qtyEl = byId('prodQty'); if(qtyEl) qtyEl.textContent = (Number(p.quantity)||0).toString();
      const costEl = byId('prodCost'); if(costEl) costEl.textContent = (p.cost!=null?p.cost:'');
      const statusEl = byId('prodStatus'); if(statusEl) statusEl.textContent = p.status || '';
      // show content
      if(content) content.style.display = 'block';
      if(msgEl) msgEl.style.display = 'none';
    }catch(err){
      console.error('loadProduct error', err);
      showMsg('ข้อผิดพลาด: ' + (err && err.message || err), true);
    }
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    const sku = getQueryParam('sku');
    loadProduct(sku);
  });
})();
