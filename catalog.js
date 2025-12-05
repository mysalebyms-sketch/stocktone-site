// catalog.js
// ต้องการ config.js ที่ประกาศ APPS_SCRIPT_URL

(function(){
  // settings
  const LIMIT = 24; // จำนวนต่อหน้า
  let OFFSET = 0;
  let totalLoaded = 0;
  let lastQuery = '';
  let lastFilters = { status:'', category:'' };

  // helpers
  function el(id){ return document.getElementById(id); }
  function show(elem){ elem.classList.remove('hidden'); }
  function hide(elem){ elem.classList.add('hidden'); }
  function setSpinner(text){
    const over = el('spinnerOverlay');
    const txt = el('spinnerText');
    txt && (txt.textContent = text || 'กำลังโหลด...');
    show(over);
  }
  function clearSpinner(){ hide(el('spinnerOverlay')); }

  async function apiGet(params){
    if(typeof APPS_SCRIPT_URL === 'undefined') throw new Error('APPS_SCRIPT_URL not configured (config.js)');
    const url = APPS_SCRIPT_URL + '?' + new URLSearchParams(params).toString();
    const r = await fetch(url);
    if(!r.ok) throw new Error('Network error: ' + r.status);
    return r.json();
  }

  // render single card
  function renderCard(p){
    const div = document.createElement('div');
    div.className = 'card product-card';
    div.dataset.sku = p.sku || '';

    const imgWrap = document.createElement('div');
    imgWrap.className = 'thumb';
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = p.name || p.sku || 'product';
    img.src = (p.imageUrl && p.imageUrl.length) ? p.imageUrl : 'assets/placeholder.png';
    img.onerror = function(){ this.src = 'assets/placeholder.png'; };
    imgWrap.appendChild(img);

    const body = document.createElement('div');
    body.className = 'card-body';
    const title = document.createElement('div');
    title.className = 'prod-title';
    title.textContent = p.name || '-';
    const sku = document.createElement('div');
    sku.className = 'prod-sku';
    sku.textContent = p.sku || '';

    const meta = document.createElement('div');
    meta.className = 'prod-meta';
    const qty = document.createElement('div'); qty.className='meta-item'; qty.textContent = (p.quantity || 0);
    const cost = document.createElement('div'); cost.className='meta-item'; cost.textContent = (p.cost || 0);
    const status = document.createElement('div'); status.className='status'; status.textContent = p.status || '';

    meta.appendChild(qty);
    meta.appendChild(cost);
    meta.appendChild(status);

    const foot = document.createElement('div');
    foot.className = 'card-foot';
    const btnView = document.createElement('button');
    btnView.className = 'btn btn-sm';
    btnView.textContent = 'ดู';
    btnView.addEventListener('click', ()=> openDetail(p.sku));
    foot.appendChild(btnView);

    body.appendChild(title);
    body.appendChild(sku);
    body.appendChild(meta);

    div.appendChild(imgWrap);
    div.appendChild(body);
    div.appendChild(foot);
    return div;
  }

  // open modal detail (fetch get)
  async function openDetail(sku){
    const modal = el('detailModal');
    const content = el('detailContent');
    content.innerHTML = '<div class="detail-loading">กำลังโหลดรายละเอียด...</div>';
    modal.classList.remove('hidden');
    try{
      setSpinner('โหลดรายละเอียด...');
      const res = await apiGet({ action:'get', sku: sku });
      clearSpinner();
      if(!res.ok){ content.innerHTML = '<p>ไม่พบข้อมูล</p>'; return; }
      const p = res.data;
      // render detail
      content.innerHTML = `
        <div class="detail-grid">
          <div class="detail-image"><img src="${p.imageUrl||'assets/placeholder.png'}" onerror="this.src='assets/placeholder.png'"></div>
          <div class="detail-info">
            <h2>${p.name||p.sku}</h2>
            <p><strong>SKU:</strong> ${p.sku||''}</p>
            <p><strong>จำนวน:</strong> ${p.quantity||0}</p>
            <p><strong>ต้นทุน:</strong> ${p.cost||0}</p>
            <p><strong>สถานะ:</strong> ${p.status||''}</p>
            <p><strong>หมวดหมู่:</strong> ${p.category||''}</p>
            <div class="detail-actions">
              <a class="btn" href="product.html?sku=${encodeURIComponent(p.sku)}">ไปหน้ารายละเอียด</a>
            </div>
          </div>
        </div>
      `;
    }catch(err){
      clearSpinner();
      content.innerHTML = `<p class="err">ข้อผิดพลาด: ${err.message}</p>`;
      console.error(err);
    }
  }

  function closeModal(){
    el('detailModal').classList.add('hidden');
  }

  // load products (append)
  async function loadProducts(opts = { reset:true }){
    try{
      if(opts.reset){
        OFFSET = 0;
        totalLoaded = 0;
        el('catalogGrid').innerHTML = '';
        hide(el('btnLoadMore'));
      }
      const q = lastQuery || '';
      const params = { action:'list', limit: LIMIT, page: Math.floor(OFFSET / LIMIT) + 1 };
      if(q) params.q = q;
      if(lastFilters.status) params.status = lastFilters.status;
      if(lastFilters.category) params.category = lastFilters.category;
      setSpinner('กำลังโหลดสินค้า...');
      const res = await apiGet(params);
      clearSpinner();
      if(!res.ok) throw new Error(res.error || 'API error');
      const data = res.data || [];
      if(data.length === 0 && totalLoaded === 0){
        show(el('noResult'));
      } else {
        hide(el('noResult'));
      }
      data.forEach(p=>{
        el('catalogGrid').appendChild(renderCard(p));
      });
      totalLoaded += data.length;
      OFFSET += data.length;
      // show more if we got a full page
      if(data.length === LIMIT){
        show(el('btnLoadMore'));
      } else {
        hide(el('btnLoadMore'));
      }
    }catch(err){
      clearSpinner();
      console.error('loadProducts error', err);
      alert('โหลดรายการล้มเหลว: ' + err.message);
    }
  }

  // search / filters
  function applySearchAndFilters(){
    const q = el('searchBox').value.trim();
    const st = el('filterStatus').value;
    const cat = el('filterCategory').value;
    lastQuery = q;
    lastFilters.status = st;
    lastFilters.category = cat;
    loadProducts({ reset:true });
  }

  // populate categories (from list response)
  function populateCategoriesFrom(data){
    const set = new Set();
    (data||[]).forEach(p=>{ if(p.category) set.add(p.category); });
    const sel = el('filterCategory');
    // only add if empty (avoid duplicates)
    if(sel && sel.options.length <= 1){
      set.forEach(c=>{
        const opt = document.createElement('option'); opt.value = c; opt.textContent = c; sel.appendChild(opt);
      });
    }
  }

  // init bindings
  function init(){
    // events
    el('btnSearch').addEventListener('click', ()=> applySearchAndFilters());
    el('btnReload').addEventListener('click', ()=> { el('searchBox').value=''; el('filterStatus').value=''; el('filterCategory').value=''; lastQuery=''; lastFilters={ status:'', category:'' }; loadProducts({ reset:true }); });
    el('btnLoadMore').addEventListener('click', ()=> loadProducts({ reset:false }));
    el('modalClose').addEventListener('click', closeModal);
    el('detailModal').addEventListener('click', (e)=> { if(e.target === el('detailModal')) closeModal(); });
    el('searchBox').addEventListener('keydown', (ev)=> { if(ev.key === 'Enter') applySearchAndFilters(); });

    // preload: try to load small set to fill categories then load full grid
    (async ()=>{
      try{
        setSpinner('ตรวจสอบหมวดหมู่...');
        const res = await apiGet({ action:'list', limit: 100 }); // short fetch
        clearSpinner();
        if(res && res.ok){
          populateCategoriesFrom(res.data || []);
        }
      }catch(e){ clearSpinner(); /* ignore */ }
      await loadProducts({ reset:true });
    })();
  }

  // wait for DOM
  document.addEventListener('DOMContentLoaded', init);
})();
