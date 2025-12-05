// catalog.js - render catalog grid cards (expects config.js with APPS_SCRIPT_URL)
(function(){
  // helpers
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  function showSpinner(msg){
    const o = $('#spinnerOverlay');
    if(!o) return;
    $('#spinnerStep').textContent = msg || 'กำลังโหลด...';
    o.classList.remove('hidden');
  }
  function hideSpinner(){
    const o = $('#spinnerOverlay');
    if(!o) return;
    o.classList.add('hidden');
  }
  function fmtNumber(n){ return Number(n)||0; }

  // fetch list
  async function fetchList(q=''){
    showSpinner('ดึงรายการจากเซิร์ฟเวอร์...');
    try{
      const params = { action:'list', limit: 500 };
      if(q) params.q = q;
      const url = APPS_SCRIPT_URL + '?' + new URLSearchParams(params).toString();
      const r = await fetch(url);
      const j = await r.json();
      hideSpinner();
      return j;
    }catch(err){
      hideSpinner();
      console.error('fetchList error', err);
      throw err;
    }
  }

  // render a single product card (hybrid style)
  function renderCard(product){
    const div = document.createElement('article');
    div.className = 'card';

    const imgWrap = document.createElement('div');
    imgWrap.className = 'card-image';
    const img = document.createElement('img');
    img.alt = product.name || product.sku || 'image';
    img.src = product.imageUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="100%" height="100%" fill="%23eee"/></svg>';
    imgWrap.appendChild(img);

    const body = document.createElement('div');
    body.className = 'card-body';

    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = product.name || product.sku || '';

    const sku = document.createElement('div'); sku.className='card-sku muted'; sku.textContent = product.sku || '';

    // price (we use cost field as price if that's how you treat it)
    const priceRow = document.createElement('div'); priceRow.className='card-price-row';
    const price = document.createElement('div'); price.className = 'card-price'; price.textContent = (product.cost !== undefined && product.cost !== '') ? String(product.cost) : '-';
    const status = document.createElement('div'); status.className = 'card-status'; status.textContent = product.status || '';
    priceRow.appendChild(price); priceRow.appendChild(status);

    // stock / qty
    const stockRow = document.createElement('div'); stockRow.className='card-stock-row';
    const stockLabel = document.createElement('div'); stockLabel.textContent = 'คงเหลือ';
    const stockQty = document.createElement('div'); stockQty.className='card-stock'; stockQty.textContent = String(product.quantity || 0);
    stockRow.appendChild(stockLabel); stockRow.appendChild(stockQty);

    // actions
    const actions = document.createElement('div'); actions.className='card-actions';
    const detailsBtn = document.createElement('button'); detailsBtn.className='btn btn-primary'; detailsBtn.textContent = 'ดูรายละเอียด';
    detailsBtn.addEventListener('click', ()=> openDetail(product.sku));
    // quick in/out controls
    const plusBtn = document.createElement('button'); plusBtn.className='btn btn-ghost'; plusBtn.textContent = '+';
    const minusBtn = document.createElement('button'); minusBtn.className='btn btn-ghost'; minusBtn.textContent = '−';
    plusBtn.addEventListener('click', ()=> adjustStock(product.sku, 'in', 1));
    minusBtn.addEventListener('click', ()=> adjustStock(product.sku, 'out', 1));
    actions.appendChild(detailsBtn);
    const fast = document.createElement('div'); fast.className='card-fast';
    fast.appendChild(minusBtn); fast.appendChild(plusBtn);
    actions.appendChild(fast);

    body.appendChild(title);
    body.appendChild(sku);
    body.appendChild(priceRow);
    body.appendChild(stockRow);
    body.appendChild(actions);

    div.appendChild(imgWrap);
    div.appendChild(body);

    // data-* for easy updates
    div.dataset.sku = product.sku || '';

    return div;
  }

  // detail: go to product page (product.html?sku=SKU) if exists, otherwise alert
  function openDetail(sku){
    if(!sku) return alert('ไม่มี SKU');
    // try product.html in same site
    const url = `product.html?sku=${encodeURIComponent(sku)}`;
    window.location.href = url;
  }

  // adjust stock (in/out) - will call history_add
  async function adjustStock(sku, type, qty){
    if(!confirm((type==='in'?'ยืนยันรับเข้า ':'ยืนยันตัดออก ') + qty + ' ชิ้น สำหรับ ' + sku + '?')) return;
    showSpinner('บันทึกสต็อก...');
    try{
      const params = new URLSearchParams({
        action: 'history_add',
        adminId: sessionStorage.getItem('adminId') || '',
        adminPassword: sessionStorage.getItem('adminPassword') || '',
        sku: sku,
        actionType: type,
        qty: String(qty),
        note: (type==='in' ? 'รับเข้า (speed adjust)' : 'ตัดออก (speed adjust)')
      });
      const resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body: params });
      const txt = await resp.text();
      const j = JSON.parse(txt);
      hideSpinner();
      if(j && j.ok){
        // update UI qty in-place
        // find card and update qty text
        const c = document.querySelector(`.card[data-sku="${sku}"]`);
        if(c){
          const el = c.querySelector('.card-stock');
          if(el){
            // newQty returned from API maybe j.newQty
            const newQty = (j.newQty !== undefined) ? j.newQty : (Number(el.textContent||0) + (type==='in' ? qty : -qty));
            el.textContent = String(newQty);
          }
        }
        // optional toast
        const msg = $('#catalogMsg');
        if(msg) { msg.textContent = 'บันทึกสต็อกเรียบร้อย'; setTimeout(()=> msg.textContent = '', 2000); }
      } else {
        alert('บันทึกไม่สำเร็จ: ' + (j && j.error));
      }
    } catch(err){
      hideSpinner();
      console.error('adjustStock error', err);
      alert('เกิดข้อผิดพลาด: '+ err.message);
    }
  }

  // main render
  async function renderCatalog(q){
    const container = $('#cards');
    const msg = $('#catalogMsg');
    if(!container) return;
    container.innerHTML = '';
    msg.textContent = '';
    try{
      const res = await fetchList(q || '');
      if(!res || !res.ok) { msg.textContent = 'ไม่สามารถดึงรายการได้'; return; }
      const data = res.data || [];
      if(data.length === 0){ msg.textContent = 'ไม่มีรายการสินค้า'; return; }
      // build category filter options (unique)
      const cats = new Set();
      data.forEach(d => { if(d.category) cats.add(String(d.category)); });
      const catSel = $('#filterCategory');
      if(catSel){
        catSel.innerHTML = '<option value="">หมวดหมู่ทั้งหมด</option>';
        Array.from(cats).sort().forEach(c => {
          const o = document.createElement('option'); o.value = c; o.textContent = c; catSel.appendChild(o);
        });
      }
      // create cards
      data.forEach(p => {
        const card = renderCard(p);
        container.appendChild(card);
      });
    }catch(err){
      console.error(err);
      $('#catalogMsg').textContent = 'ข้อผิดพลาดขณะโหลด: ' + err.message;
    } finally {
      hideSpinner();
    }
  }

  // bind UI
  document.addEventListener('DOMContentLoaded', ()=> {
    const searchInput = $('#searchInput');
    const searchBtn = $('#searchBtn');
    searchBtn.addEventListener('click', ()=> renderCatalog(searchInput.value.trim()));
    searchInput.addEventListener('keydown', (e)=> { if(e.key === 'Enter') renderCatalog(searchInput.value.trim()); });

    $('#filterCategory').addEventListener('change', ()=> {
      const v = $('#filterCategory').value;
      // naive client-side filter: re-fetch and filter (or could filter existing)
      renderCatalog($('#searchInput').value.trim()).then(()=>{
        if(v){
          document.querySelectorAll('.card').forEach(c => {
            const sku = c.dataset.sku;
            // simple: hide cards whose category not equal
            // we need category value stored on card? easier: call API again with category param
          });
        }
      });
    });

    $('#clearFilters').addEventListener('click', ()=> {
      $('#filterCategory').value = '';
      $('#filterStatus').value = '';
      $('#searchInput').value = '';
      renderCatalog();
    });

    // initial load
    renderCatalog();
  });

})();
