// product.js - load product from ?sku=...
(function(){
  function $id(i){return document.getElementById(i);}
  function getQuery(name){ return new URLSearchParams(location.search).get(name); }
  async function apiGet(p){ const url = APPS_SCRIPT_URL + '?' + new URLSearchParams(p).toString(); const r = await fetch(url); return r.json(); }
  async function load(){
    const sku = getQuery('sku');
    if(!sku){ $id('prodMsg').textContent = 'กรุณาระบุ ?sku=...'; return; }
    $id('prodMsg').textContent = 'กำลังโหลด...';
    try{
      const r = await apiGet({ action:'get', sku: sku });
      if(!r.ok){ $id('prodMsg').textContent = 'ไม่พบสินค้า'; return; }
      const p = r.data;
      $id('prodImage').src = p.imageUrl || 'assets/placeholder.png';
      $id('prodName').textContent = p.name || '';
      $id('prodSku').textContent = p.sku || '';
      $id('prodQty').textContent = p.quantity || 0;
      $id('prodCost').textContent = p.cost || 0;
      $id('prodStatus').textContent = p.status || '';
      $id('prodCategory').textContent = p.category || '';
      $id('prodArea').classList.remove('hidden');
      $id('prodMsg').classList.add('hidden');
    }catch(err){
      console.error(err);
      $id('prodMsg').textContent = 'ข้อผิดพลาด: ' + err.message;
    }
  }
  document.addEventListener('DOMContentLoaded', load);
})();
