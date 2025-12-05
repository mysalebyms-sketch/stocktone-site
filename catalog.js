// catalog.js - StockTone catalog (latest)
// Features: load list from APPS_SCRIPT_URL, spinner, modal, responsive cards, filters, qty controls
// Requires: config.js that defines APPS_SCRIPT_URL

(() => {
  const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="480">
      <rect width="100%" height="100%" fill="#f4f4f4"/>
    </svg>`
  );

  // short helpers
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const isVisible = el => el && !el.classList.contains('hidden');

  // spinner helpers (uses #spinnerOverlay and #spinnerStep)
  const spinner = {
    show(msg){
      const el = $('#spinnerOverlay');
      if(!el) return;
      const step = $('#spinnerStep');
      if(step) step.textContent = msg || 'กำลังโหลด...';
      el.classList.remove('hidden');
      el.setAttribute('aria-hidden','false');
    },
    hide(){
      const el = $('#spinnerOverlay');
      if(!el) return;
      el.classList.add('hidden');
      el.setAttribute('aria-hidden','true');
    }
  };

  // toast
  function toast(text, ms=2200){
    let t = $('#__st_toast');
    if(!t){
      t = document.createElement('div');
      t.id = '__st_toast';
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(()=> t.classList.remove('show'), ms);
  }

  // API helpers
  async function apiGet(params){
    if(typeof APPS_SCRIPT_URL === 'undefined' || !APPS_SCRIPT_URL){
      throw new Error('APPS_SCRIPT_URL not set (check config.js)');
    }
    const url = APPS_SCRIPT_URL + '?' + new URLSearchParams(params).toString();
    const r = await fetch(url);
    return r.json();
  }

  // create single card element
  function makeCard(p){
    const card = document.createElement('article');
    card.className = 'product-card card';

    // thumb
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    const img = document.createElement('img');
    img.alt = p.name || '';
    img.src = p.imageUrl || PLACEHOLDER;
    img.onerror = ()=> { img.src = PLACEHOLDER; img.dataset.bad = '1'; };
    thumb.appendChild(img);
    card.appendChild(thumb);

    // body
    const body = document.createElement('div');
    body.className = 'product-body';

    const title = document.createElement('h3');
    title.className = 'product-title';
    title.textContent = p.name || '(no name)';
    body.appendChild(title);

    // price
    const price = document.createElement('div');
    price.className = 'product-price';
    price.textContent = (p.cost !== undefined && p.cost !== null && p.cost !== '') ? `${Number(p.cost)} บาท` : '-';
    body.appendChild(price);

    // status & qty
    const status = document.createElement('div');
    status.className = 'muted';
    status.textContent = 'สถานะ: ' + (p.status || '-');
    body.appendChild(status);

    const qty = document.createElement('div');
    qty.className = 'muted';
    qty.textContent = 'คงเหลือ: ' + (Number(p.quantity) || 0);
    body.appendChild(qty);

    card.appendChild(body);

    // footer
    const foot = document.createElement('div');
    foot.className = 'card-foot';

    const btnDetail = document.createElement('button');
    btnDetail.className = 'btn-primary btn-primary sm';
    btnDetail.textContent = 'ดูรายละเอียด';
    btnDetail.addEventListener('click', ()=> openDetail(p));
    foot.appendChild(btnDetail);

    // qty controls
    const qc = document.createElement('div');
    qc.className = 'qty-controls';
    const minus = document.createElement('button'); minus.className=''; minus.textContent='-';
    const val = document.createElement('span'); val.className='qty-value'; val.textContent = Number(p.quantity) || 0;
    const plus = document.createElement('button'); plus.className=''; plus.textContent='+';
    minus.addEventListener('click', ()=> { let n=Number(val.textContent)||0; if(n>0) val.textContent = --n; });
    plus.addEventListener('click', ()=> { let n=Number(val.textContent)||0; val.textContent = ++n; });
    qc.appendChild(minus); qc.appendChild(val); qc.appendChild(plus);
    foot.appendChild(qc);

    card.appendChild(foot);
    card.tabIndex = 0;
    return card;
  }

  // render list
  function renderCards(list){
    const container = $('#cards');
    if(!container) return;
    container.innerHTML = '';
    if(!list || list.length === 0){
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'ไม่มีสินค้า';
      container.appendChild(empty);
      $('#resultCount').textContent = '0 ผลลัพธ์';
      return;
    }
    const frag = document.createDocumentFragment();
    list.forEach(p => frag.appendChild(makeCard(p)));
    container.appendChild(frag);
    $('#resultCount').textContent = `${list.length} ผลลัพธ์`;
  }

  // detail modal
  function createDetailModal(){
    let modal = $('#catalogDetailModal');
    if(modal) return modal;
    modal = document.createElement('div');
    modal.id = 'catalogDetailModal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
      <div class="modal-panel">
        <button class="modal-close" aria-label="ปิด">✕</button>
        <div class="detail-grid">
          <div class="detail-image"><img src="" alt=""></div>
          <div class="detail-info">
            <h2 class="detail-title"></h2>
            <div class="detail-price"></div>
            <div class="detail-status muted small"></div>
            <p class="detail-desc"></p>
            <div class="detail-actions"><button class="btn btn-primary add-cart">+ เพิ่มในตะกร้า</button></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', ()=> modal.classList.add('hidden'));
    return modal;
  }
  function openDetail(p){
    const modal = createDetailModal();
    modal.classList.remove('hidden');
    modal.querySelector('.detail-image img').src = p.imageUrl || PLACEHOLDER;
    modal.querySelector('.detail-title').textContent = p.name || '';
    modal.querySelector('.detail-price').textContent = (p.cost ? `${p.cost} บาท` : '-');
    modal.querySelector('.detail-status').textContent = 'สถานะ: ' + (p.status || '-');
    modal.querySelector('.detail-desc').textContent = p.description || '';
  }

  // populate filters
  function populateFilters(items){
    const catSel = $('#filterCategory');
    if(!catSel) return;
    const cats = new Set();
    items.forEach(i => { if(i.category) cats.add(i.category); });
    catSel.innerHTML = '<option value="">หมวดหมู่ทั้งหมด</option>';
    Array.from(cats).sort().forEach(c => {
      const o = document.createElement('option'); o.value = c; o.textContent = c; catSel.appendChild(o);
    });
  }

  // load products
  async function loadProducts(q){
    try{
      spinner.show('โหลดรายการสินค้า...');
      const params = { action:'list', limit:500 };
      if(q) params.q = q;
      const res = await apiGet(params);
      if(!res || !res.ok){ toast('โหลดสินค้าล้มเหลว'); renderCards([]); spinner.hide(); return; }
      const data = (res.data||[]).map(d => ({ ...d, quantity: Number(d.quantity)||0, cost: Number(d.cost)||0 }));
      populateFilters(data);
      renderCards(data);
      spinner.hide();
    }catch(err){
      console.error(err);
      spinner.hide();
      toast('ข้อผิดพลาด: ' + (err.message||err));
    }
  }

  // remove any static sample product-cards accidentally left in markup (outside #cards)
  function cleanupStaticCards(){
    $$('.product-card').forEach(el => {
      if(!el.closest('#cards')) el.remove();
    });
  }

  // init wiring
  function init(){
    cleanupStaticCards();

    const searchInput = $('#searchInput');
    const searchBtn = $('#searchBtn');
    const clearBtn = $('#clearFilters');
    const catSel = $('#filterCategory');
    const statusSel = $('#filterStatus');

    if(searchBtn) searchBtn.addEventListener('click', ()=> loadProducts(searchInput && searchInput.value));
    if(searchInput) searchInput.addEventListener('keydown', e => { if(e.key === 'Enter') loadProducts(searchInput.value); });
    if(clearBtn) clearBtn.addEventListener('click', ()=> {
      if(searchInput) searchInput.value = '';
      if(catSel) catSel.value = '';
      if(statusSel) statusSel.value = '';
      loadProducts();
    });

    // optional: filter client-side when category/status changed
    if(catSel) catSel.addEventListener('change', ()=> {
      const q = searchInput && searchInput.value;
      loadProducts(q).then(()=> {
        // if backend supports category/status param later, change to server-side
        const selectedCat = catSel.value;
        const selectedStatus = statusSel.value;
        if(selectedCat || selectedStatus){
          const cards = $$('#cards .product-card');
          cards.forEach(card => {
            const title = (card.querySelector('.product-title')||{}).textContent || '';
            const statusText = (card.querySelector('.muted')||{}).textContent || '';
            let hide = false;
            // crude checks: if selectedStatus not in statusText -> hide
            if(selectedStatus && !statusText.toLowerCase().includes(selectedStatus.toLowerCase())) hide = true;
            // category is not rendered on card to avoid clutter; if you want category visible, backend or card must expose it.
            if(hide) card.style.display='none'; else card.style.display='';
          });
        }
      });
    });

    // initial load
    loadProducts();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
