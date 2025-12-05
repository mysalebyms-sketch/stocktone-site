// catalog.js - สร้าง catalog จาก API, จัดการ spinner, modal, responsive cards
// Assumes: config.js defines APPS_SCRIPT_URL

(() => {
  const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="480">
      <rect width="100%" height="100%" fill="#f4f4f4"/>
      <g fill="#ddd"><rect x="40" y="40" width="200" height="120" rx="8"/></g>
    </svg>`
  );

  // helper
  function $q(s, root=document){ return root.querySelector(s); }
  function $qa(s, root=document){ return Array.from(root.querySelectorAll(s)); }
  function setVisible(el, yes){ if(!el) return; if(yes) el.classList.remove('hidden'); else el.classList.add('hidden'); }

  // spinner overlay simple helpers
  const spinner = {
    show(msg){
      const el = $q('#spinnerOverlay') || $q('#globalSpinnerOverlay');
      if(!el) return;
      const step = $q('#spinnerStep') || $q('#spinnerTitle') || el.querySelector('.spinner-text');
      if(step) step.textContent = msg || 'กำลังโหลด...';
      el.classList.remove('hidden');
    },
    hide(){
      const el = $q('#spinnerOverlay') || $q('#globalSpinnerOverlay');
      if(!el) return;
      el.classList.add('hidden');
    }
  };

  // small toast
  function toast(text, ms=2500){
    let t = $q('#_ct_toast');
    if(!t){
      t = document.createElement('div'); t.id='_ct_toast'; t.className='toast';
      document.body.appendChild(t);
    }
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(()=> t.classList.remove('show'), ms);
  }

  // API helpers (uses config.js global APPS_SCRIPT_URL)
  async function apiGet(params){
    const url = (typeof APPS_SCRIPT_URL === 'undefined' ? '' : APPS_SCRIPT_URL) + '?' + new URLSearchParams(params).toString();
    const r = await fetch(url);
    return r.json();
  }

  // render one card
  function makeCard(p){
    const card = document.createElement('article');
    card.className = 'product-card card';

    // image wrapper
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    const img = document.createElement('img');
    img.alt = p.name || '';
    img.onload = ()=> img.classList.remove('loading');
    img.onerror = ()=> { img.src = PLACEHOLDER; img.dataset.bad = '1'; };
    img.src = p.imageUrl || PLACEHOLDER;
    thumb.appendChild(img);
    card.appendChild(thumb);

    // body
    const body = document.createElement('div');
    body.className = 'card-body product-body';

    const title = document.createElement('h3');
    title.className = 'product-title';
    title.textContent = p.name || '(no name)';
    body.appendChild(title);

    // SKU optional - user said "ไม่ต้องมีก็ได้" -> hide by default
    // If you ever want SKU displayed, uncomment below
    // const sku = document.createElement('div'); sku.className='prod-sku'; sku.textContent = 'SKU: ' + (p.sku || '');
    // body.appendChild(sku);

    // price
    const price = document.createElement('div');
    price.className = 'product-price card-price';
    const priceText = p.cost ? `${p.cost} บาท` : '-';
    price.textContent = priceText;
    body.appendChild(price);

    // status
    const status = document.createElement('div');
    status.className = 'muted small';
    status.textContent = 'สถานะ: ' + (p.status || '-');
    body.appendChild(status);

    // qty remaining
    const qty = document.createElement('div');
    qty.className = 'muted small';
    qty.textContent = 'คงเหลือ: ' + (Number(p.quantity) || 0);
    body.appendChild(qty);

    // actions row
    const foot = document.createElement('div');
    foot.className = 'card-foot';

    const btnDetail = document.createElement('button');
    btnDetail.className = 'btn-primary btn-detail';
    btnDetail.textContent = 'ดูรายละเอียด';
    btnDetail.addEventListener('click', ()=> openDetail(p));
    foot.appendChild(btnDetail);

    // qty controls (small)
    const qtyControls = document.createElement('div');
    qtyControls.className = 'qty-controls';
    const minus = document.createElement('button'); minus.className='btn-sm btn-outline'; minus.textContent='-';
    const val = document.createElement('span'); val.className='qty-value'; val.textContent = Number(p.quantity) || 0;
    const plus = document.createElement('button'); plus.className='btn-sm btn-outline'; plus.textContent='+';
    // Note: these +/- buttons just change the UI value; actual change should call history_add API or edit modal
    minus.addEventListener('click', ()=> { let n=Number(val.textContent)||0; if(n>0) val.textContent=--n; });
    plus.addEventListener('click', ()=> { let n=Number(val.textContent)||0; val.textContent=++n; });

    qtyControls.appendChild(minus);
    qtyControls.appendChild(val);
    qtyControls.appendChild(plus);
    foot.appendChild(qtyControls);

    card.appendChild(body);
    card.appendChild(foot);

    // accessibility
    card.tabIndex = 0;
    return card;
  }

  // render list into #cards
  function renderCards(list){
    const container = $q('#cards');
    if(!container) return;
    container.innerHTML = '';
    if(!list || list.length === 0){
      const empty = document.createElement('div'); empty.className='empty-state'; empty.textContent='ไม่มีสินค้า';
      container.appendChild(empty);
      return;
    }
    const frag = document.createDocumentFragment();
    list.forEach(p => frag.appendChild(makeCard(p)));
    container.appendChild(frag);
  }

  // detail modal
  function createDetailModal(){
    if($q('#catalogDetailModal')) return $q('#catalogDetailModal');
    const wrap = document.createElement('div'); wrap.id='catalogDetailModal'; wrap.className='modal hidden';
    wrap.innerHTML = `
      <div class="modal-panel">
        <button class="modal-close" aria-label="close">&times;</button>
        <div class="modal-body detail-grid">
          <div class="detail-image"><img src="" alt=""></div>
          <div class="detail-info">
            <h2></h2>
            <div class="detail-price"></div>
            <div class="detail-status muted small"></div>
            <p class="detail-desc"></p>
            <div class="detail-actions">
              <button class="btn btn-primary add-cart">+ เพิ่ม</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    wrap.querySelector('.modal-close').addEventListener('click', ()=> wrap.classList.add('hidden'));
    return wrap;
  }
  function openDetail(p){
    const modal = createDetailModal();
    modal.classList.remove('hidden');
    modal.querySelector('.detail-image img').src = p.imageUrl || PLACEHOLDER;
    modal.querySelector('.detail-info h2').textContent = p.name || '';
    modal.querySelector('.detail-price').textContent = (p.cost ? `${p.cost} บาท` : '-');
    modal.querySelector('.detail-status').textContent = 'สถานะ: ' + (p.status || '-');
    modal.querySelector('.detail-desc').textContent = p.description || '';
  }

  // load categories for filter (simple unique list)
  function populateFilters(items){
    const catSel = $q('#filterCategory');
    if(!catSel) return;
    const cats = new Set();
    items.forEach(i => { if(i.category) cats.add(i.category); });
    // clear and insert default
    catSel.innerHTML = '<option value="">หมวดหมู่ทั้งหมด</option>';
    Array.from(cats).sort().forEach(c => {
      const o = document.createElement('option'); o.value = c; o.textContent = c; catSel.appendChild(o);
    });
  }

  // load products (with spinner)
  async function loadProducts(q){
    try{
      spinner.show('โหลดรายการสินค้า...');
      const params = { action:'list', limit: 500 };
      if(q) params.q = q;
      const res = await apiGet(params);
      if(!res || !res.ok){ toast('โหลดสินค้าล้มเหลว'); renderCards([]); spinner.hide(); return; }
      const data = res.data || [];
      // normalize: ensure quantity & cost numeric
      data.forEach(d => { d.quantity = Number(d.quantity)||0; d.cost = Number(d.cost)||0; });
      populateFilters(data);
      renderCards(data);
      spinner.hide();
    }catch(err){
      console.error(err);
      toast('ข้อผิดพลาด: ' + (err.message||err));
      spinner.hide();
    }
  }

  // wire up UI
  function init(){
    // IMPORTANT: remove any static sample product-card that was left in HTML
    // (the user had copied a sample card into markup) -> remove it to avoid duplicate/static empty card
    $qa('.product-card').forEach((el, idx) => {
      // keep cards inside #cards only; remove product-card nodes that are direct children of main or filters area
      if(!el.closest('#cards')) el.remove();
    });

    const searchInput = $q('#searchInput');
    const searchBtn = $q('#searchBtn');
    const clearBtn = $q('#clearFilters');
    const catSel = $q('#filterCategory');
    const statusSel = $q('#filterStatus');

    if(searchBtn) searchBtn.addEventListener('click', ()=> loadProducts(searchInput && searchInput.value));
    if(searchInput) searchInput.addEventListener('keydown', (e)=> { if(e.key === 'Enter') loadProducts(searchInput.value); });
    if(clearBtn) clearBtn.addEventListener('click', ()=> {
      if(searchInput) searchInput.value='';
      if(catSel) catSel.value='';
      if(statusSel) statusSel.value='';
      loadProducts();
    });
    if(catSel) catSel.addEventListener('change', ()=> {
      const q = searchInput && searchInput.value;
      const cat = catSel.value;
      // naive filter: reload and filter client-side
      loadProducts(q).then(()=> {
        if(cat){
          const cards = $qa('#cards .product-card');
          cards.forEach(card => {
            const title = card.querySelector('.product-title').textContent || '';
            // we used category in product data but we didn't put into DOM; easier to reload and filter on data in future.
            // For now rely on server 'list' filter param if implemented (not in current simple API)
          });
        }
      });
    });

    // initial
    loadProducts();
  }

  // init on DOM ready
  document.addEventListener('DOMContentLoaded', init);
})();
