// catalog.js (Phase 2 upgraded)
// - debounce search
// - skeleton cards while loading
// - improved load-more handling & UX
// - modal improvements + related products
// - requires config.js with APPS_SCRIPT_URL

(function(){
  const LIMIT = 24;
  let page = 1;
  let loading = false;
  let lastQuery = '';
  let lastFilters = { status:'', category:'' };

  const ID = {
    grid: 'catalogGrid',
    spinner: 'spinnerOverlay',
    spinnerText: 'spinnerText',
    btnLoadMore: 'btnLoadMore',
    searchBox: 'searchBox',
    btnSearch: 'btnSearch',
    btnReload: 'btnReload',
    filterStatus: 'filterStatus',
    filterCategory: 'filterCategory',
    noResult: 'noResult',
    detailModal: 'detailModal',
    detailContent: 'detailContent',
    modalClose: 'modalClose'
  };

  const el = id => document.getElementById(id);
  const show = e => e && e.classList.remove('hidden');
  const hide = e => e && e.classList.add('hidden');

  // debounce helper
  function debounce(fn, wait=300){
    let t;
    return function(...args){ clearTimeout(t); t = setTimeout(()=> fn.apply(this,args), wait); };
  }

  // API GET
  async function apiGet(params){
    if(typeof APPS_SCRIPT_URL === 'undefined') throw new Error('APPS_SCRIPT_URL not configured');
    const url = APPS_SCRIPT_URL + '?' + new URLSearchParams(params).toString();
    const r = await fetch(url);
    if(!r.ok) throw new Error('Network error: ' + r.status);
    return r.json();
  }

  // util: spinner message
  function setSpinner(text){
    const over = el(ID.spinner);
    const txt = el(ID.spinnerText);
    if(txt) txt.textContent = text || 'กำลังโหลด...';
    show(over);
  }
  function clearSpinner(){ hide(el(ID.spinner)); }

  // skeleton writer
  function appendSkeletons(count=6){
    const grid = el(ID.grid);
    for(let i=0;i<count;i++){
      const s = document.createElement('div');
      s.className = 'card product-card skeleton';
      s.innerHTML = `
        <div class="thumb"><div class="skeleton-rect img"></div></div>
        <div class="card-body">
          <div class="skeleton-rect title"></div>
          <div class="skeleton-rect line"></div>
          <div class="skeleton-rect meta"></div>
        </div>
        <div class="card-foot"><div class="skeleton-rect btn"></div></div>
      `;
      grid.appendChild(s);
    }
  }
  function clearSkeletons(){
    const grid = el(ID.grid);
    grid.querySelectorAll('.skeleton').forEach(n=>n.remove());
  }

  // render card
  function renderCard(p){
    const div = document.createElement('div');
    div.className = 'card product-card';
    div.tabIndex = 0;
    div.dataset.sku = p.sku || '';
    div.setAttribute('role','article');

    const imgWrap = document.createElement('div'); imgWrap.className = 'thumb';
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = p.name || p.sku || 'product';
    img.src = p.imageUrl && p.imageUrl.length ? p.imageUrl : 'assets/placeholder.png';
    img.onerror = function(){ this.src = 'assets/placeholder.png'; };
    imgWrap.appendChild(img);

    const body = document.createElement('div'); body.className = 'card-body';
    const title = document.createElement('div'); title.className = 'prod-title'; title.textContent = p.name || '-';
    const sku = document.createElement('div'); sku.className = 'prod-sku'; sku.textContent = p.sku || '';
    const meta = document.createElement('div'); meta.className = 'prod-meta';
    const qty = document.createElement('div'); qty.className = 'meta-item'; qty.textContent = `จำนวน: ${p.quantity||0}`;
    const cost = document.createElement('div'); cost.className = 'meta-item'; cost.textContent = `ต้นทุน: ${p.cost||0}`;
    const status = document.createElement('div'); status.className = 'status'; status.textContent = p.status || '';
    meta.appendChild(qty); meta.appendChild(cost); meta.appendChild(status);

    const foot = document.createElement('div'); foot.className = 'card-foot';
    const btnView = document.createElement('button'); btnView.className='btn btn-sm'; btnView.textContent='ดู';
    btnView.setAttribute('aria-label','View product '+(p.sku||''));
    btnView.addEventListener('click', ()=> openDetail(p.sku));
    foot.appendChild(btnView);

    body.appendChild(title); body.appendChild(sku); body.appendChild(meta);
    div.appendChild(imgWrap); div.appendChild(body); div.appendChild(foot);

    // keyboard enter to open
    div.addEventListener('keydown', (e)=> { if(e.key === 'Enter') openDetail(p.sku); });

    return div;
  }

  // open modal (improved)
  async function openDetail(sku){
    const modal = el(ID.detailModal);
    const content = el(ID.detailContent);
    content.innerHTML = '<div class="detail-loading">กำลังโหลดรายละเอียด...</div>';
    modal.classList.remove('hidden');
    try{
      setSpinner('โหลดรายละเอียด...');
      const res = await apiGet({ action:'get', sku });
      clearSpinner();
      if(!res.ok){ content.innerHTML = '<p>ไม่พบข้อมูล</p>'; return; }
      const p = res.data;

      // main detail
      content.innerHTML = `
        <div class="detail-grid">
          <div class="detail-image"><img src="${p.imageUrl||'assets/placeholder.png'}" onerror="this.src='assets/placeholder.png'"></div>
          <div class="detail-info">
            <h2>${escapeHtml(p.name||p.sku)}</h2>
            <p><strong>SKU:</strong> ${escapeHtml(p.sku||'')}</p>
            <p><strong>จำนวน:</strong> ${p.quantity||0}</p>
            <p><strong>ต้นทุน:</strong> ${p.cost||0}</p>
            <p><strong>สถานะ:</strong> ${escapeHtml(p.status||'')}</p>
            <p><strong>หมวดหมู่:</strong> ${escapeHtml(p.category||'')}</p>
            <div class="detail-actions">
              <a class="btn" href="product.html?sku=${encodeURIComponent(p.sku)}">ไปหน้ารายละเอียด</a>
            </div>
            <hr>
            <div id="relatedBox"><h4>สินค้าแนะนำ</h4><div id="relatedList" class="related-list"></div></div>
          </div>
        </div>
      `;

      // fetch related products (by category)
      if(p.category){
        loadRelated(p.category, p.sku);
      }
    }catch(err){
      clearSpinner();
      content.innerHTML = `<p class="err">ข้อผิดพลาด: ${err.message}</p>`;
      console.error(err);
    }
  }

  function escapeHtml(s){ return String(s||'').replace(/[&<>"'`]/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;', '`':'&#96;'})[c]); }

  async function loadRelated(category, excludeSku){
    const box = document.getElementById('relatedList');
    if(!box) return;
    box.innerHTML = '<div class="small-loading">กำลังโหลด...</div>';
    try{
      const res = await apiGet({ action:'list', limit:6, category });
      if(!res.ok){ box.innerHTML = '<div class="err">ไม่สามารถโหลดคำแนะนำ</div>'; return; }
      const items = (res.data || []).filter(i => i.sku !== excludeSku).slice(0,4);
      if(items.length === 0) { box.innerHTML = '<div class="muted">ไม่พบสินค้าแนะนำ</div>'; return; }
      box.innerHTML = '';
      items.forEach(it=>{
        const r = document.createElement('div');
        r.className = 'related-item';
        r.innerHTML = `<img src="${it.imageUrl||'assets/placeholder.png'}" onerror="this.src='assets/placeholder.png'"><div class="r-title">${escapeHtml(it.name||it.sku)}</div>`;
        r.addEventListener('click', ()=> openDetail(it.sku));
        box.appendChild(r);
      });
    }catch(e){
      console.error(e);
      box.innerHTML = '<div class="err">โหลดล้มเหลว</div>';
    }
  }

  // close modal (Esc support)
  function closeModal(){
    el(ID.detailModal).classList.add('hidden');
  }
  document.addEventListener('keydown', (ev)=> {
    if(ev.key === 'Escape') closeModal();
  });

  // load products (page-based)
  async function loadProducts({ reset=false } = {}){
    if(loading) return;
    loading = true;
    const grid = el(ID.grid);
    if(reset){
      page = 1;
      grid.innerHTML = '';
      hide(el(ID.btnLoadMore));
    }
    appendSkeletons(6);
    setSpinner('กำลังโหลดสินค้า...');
    try{
      const params = { action:'list', limit: LIMIT };
      params.page = page;
      if(lastQuery) params.q = lastQuery;
      if(lastFilters.status) params.status = lastFilters.status;
      if(lastFilters.category) params.category = lastFilters.category;

      const res = await apiGet(params);
      clearSpinner();
      clearSkeletons();
      if(!res.ok) throw new Error(res.error || 'API error');
      const items = res.data || [];
      if(items.length === 0 && page === 1){
        show(el(ID.noResult));
      } else {
        hide(el(ID.noResult));
      }
      items.forEach(p => grid.appendChild(renderCard(p)));
      if(items.length === LIMIT){
        show(el(ID.btnLoadMore));
      } else {
        hide(el(ID.btnLoadMore));
      }
      page++;
    }catch(err){
      clearSpinner();
      clearSkeletons();
      console.error('loadProducts', err);
      alert('โหลดรายการล้มเหลว: ' + err.message);
    } finally {
      loading = false;
    }
  }

  // search & filters
  const doSearch = debounce(()=>{
    lastQuery = el(ID.searchBox).value.trim();
    lastFilters.status = el(ID.filterStatus).value;
    lastFilters.category = el(ID.filterCategory).value;
    loadProducts({ reset:true });
  }, 350);

  // init UI bindings
  function init(){
    el(ID.btnSearch).addEventListener('click', ()=> doSearch());
    el(ID.searchBox).addEventListener('input', ()=> doSearch());
    el(ID.btnReload).addEventListener('click', ()=> {
      el(ID.searchBox).value = '';
      el(ID.filterStatus).value = '';
      el(ID.filterCategory).value = '';
      lastQuery = ''; lastFilters = { status:'', category:'' };
      loadProducts({ reset:true });
    });
    el(ID.btnLoadMore).addEventListener('click', ()=> loadProducts({ reset:false }));
    el(ID.modalClose).addEventListener('click', closeModal);
    el(ID.detailModal).addEventListener('click', e => { if(e.target === el(ID.detailModal)) closeModal(); });

    // initial populate categories (light fetch)
    (async ()=>{
      try{
        setSpinner('ตรวจสอบหมวดหมู่...');
        const res = await apiGet({ action:'list', limit: 120 });
        clearSpinner();
        if(res && res.ok){
          const set = new Set((res.data||[]).map(p=>p.category).filter(Boolean));
          const sel = el(ID.filterCategory);
          if(sel && sel.options.length <= 1){
            set.forEach(c=>{
              const o = document.createElement('option'); o.value = c; o.text = c; sel.appendChild(o);
            });
          }
        }
      }catch(e){
        clearSpinner();
      } finally {
        // load initial page
        loadProducts({ reset:true });
      }
    })();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
