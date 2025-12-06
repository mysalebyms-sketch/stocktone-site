// catalog.js
// Mobile-first catalog UI. Expects config.js to set APPS_SCRIPT_URL.
// Replaces previous catalog.js. Copy & paste entire file.

(() => {
  const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="480"><rect width="100%" height="100%" fill="#fff7ee"/><g fill="#f3f3f3"><rect x="24" y="24" width="752" height="432" rx="8"/></g></svg>`
  );

  // DOM helpers
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));

  // spinner helpers (uses #spinnerOverlay element injected by script)
  const spinner = {
    el: null,
    stepEl: null,
    ensure(){
      if(this.el) return;
      // try to reuse existing node in page
      this.el = document.getElementById('spinnerOverlay');
      if(!this.el){
        this.el = document.createElement('div');
        this.el.id = 'spinnerOverlay';
        this.el.className = 'spinner-overlay';
        this.el.innerHTML = `<div class="spinner-dot" aria-hidden="true"></div><div class="muted small" id="spinnerStep">กำลังโหลด...</div>`;
        // insert at top of catalog area if exists, else body
        const container = document.querySelector('.catalog-area') || document.body;
        container.insertBefore(this.el, container.firstChild);
      }
      this.stepEl = this.el.querySelector('#spinnerStep');
    },
    show(msg){
      this.ensure();
      this.stepEl.textContent = msg || 'กำลังโหลด...';
      this.el.style.display = 'flex';
    },
    hide(){
      this.ensure();
      this.el.style.display = 'none';
    }
  };

  // small toast
  function toast(text, ms=2200){
    let t = document.getElementById('_ct_toast');
    if(!t){
      t = document.createElement('div'); t.id = '_ct_toast'; t.className = 'toast';
      Object.assign(t.style, { position:'fixed', right:'18px', bottom:'18px', padding:'10px 14px', background:'#111827', color:'#fff', borderRadius:'8px', zIndex:99999, opacity:0, transition:'all .18s ease' });
      document.body.appendChild(t);
    }
    t.textContent = text;
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(()=> t.style.opacity = '0', ms);
  }

  // API GET (uses APPS_SCRIPT_URL from config.js)
  async function apiGet(params){
    const base = (typeof APPS_SCRIPT_URL === 'undefined') ? '' : APPS_SCRIPT_URL;
    const url = base + '?' + new URLSearchParams(params).toString();
    const r = await fetch(url);
    return r.json();
  }

  // Render one product card (catalog view - no +/−)
  function makeCard(p){
    const article = document.createElement('article');
    article.className = 'product-card';

    // thumb
    const thumb = document.createElement('div'); thumb.className = 'thumb';
    const img = document.createElement('img');
    img.alt = p.name || '';
    img.src = p.imageUrl || PLACEHOLDER;
    img.onerror = ()=> img.src = PLACEHOLDER;
    thumb.appendChild(img);
    article.appendChild(thumb);

    // body
    const body = document.createElement('div'); body.className = 'card-body';
    const titleRow = document.createElement('div'); titleRow.className = 'prod-title';
    // svg bag icon
    const svgBag = document.createElement('span'); svgBag.className = 'icon-bag';
    svgBag.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 7V6a6 6 0 0112 0v1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /><rect x="3" y="7" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>`;
    titleRow.appendChild(svgBag);
    const h = document.createElement('div'); h.textContent = p.name || '(no name)';
    h.style.marginLeft = '8px';
    titleRow.appendChild(h);
    body.appendChild(titleRow);

    // price
    const price = document.createElement('div'); price.className = 'prod-price'; price.textContent = p.cost ? `${p.cost} บาท` : '-';
    body.appendChild(price);

    // meta (status / qty)
    const meta = document.createElement('div'); meta.className = 'prod-meta';
    const status = document.createElement('div'); status.textContent = `สถานะ: ${p.status || '-'}`; meta.appendChild(status);
    const remain = document.createElement('div'); remain.textContent = `คงเหลือ: ${Number(p.quantity)||0}`; remain.style.marginTop='6px'; meta.appendChild(remain);
    body.appendChild(meta);

    article.appendChild(body);

    // footer
    const foot = document.createElement('div'); foot.className = 'card-foot';
    const btn = document.createElement('button'); btn.className = 'btn-detail'; btn.textContent = 'ดูรายละเอียด';
    btn.addEventListener('click', ()=> openDetailModal(p));
    foot.appendChild(btn);

    const statusBadge = document.createElement('div'); statusBadge.className = 'badge-status'; statusBadge.textContent = (p.status || '').toLowerCase() === 'active' ? 'พร้อมขาย' : (p.status || '-');
    foot.appendChild(statusBadge);

    article.appendChild(foot);

    return article;
  }

  // render cards list
  function renderCards(list){
    const container = document.getElementById('cards');
    if(!container) return;
    container.innerHTML = '';
    if(!list || list.length === 0){
      container.appendChild(emptyState('ไม่มีสินค้า'));
      return;
    }
    const frag = document.createDocumentFragment();
    list.forEach(p => frag.appendChild(makeCard(p)));
    container.appendChild(frag);
  }

  function emptyState(text){
    const d = document.createElement('div'); d.className = 'empty-state'; d.textContent = text || '-';
    return d;
  }

  // DETAIL modal: create once + close on overlay or close button
  function createDetailModal(){
    if(document.getElementById('catalogDetailModal')) return document.getElementById('catalogDetailModal');
    const wrap = document.createElement('div'); wrap.id='catalogDetailModal'; wrap.className='modal hidden';
    wrap.innerHTML = `
      <div class="modal-panel">
        <button class="modal-close" aria-label="close">&times;</button>
        <div class="detail-body">
          <div class="detail-image" style="margin-bottom:12px"><img src="" alt=""></div>
          <div class="detail-info">
            <h2 class="muted" style="margin:4px 0 8px 0"></h2>
            <div class="prod-price" style="margin-bottom:8px"></div>
            <div class="prod-meta small" style="margin-bottom:12px"></div>
            <p class="detail-desc small muted"></p>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    const panel = wrap.querySelector('.modal-panel');
    // close button
    wrap.querySelector('.modal-close').addEventListener('click', ()=> wrap.classList.add('hidden'));
    // click outside to close
    wrap.addEventListener('click', (ev)=> { if(ev.target === wrap) wrap.classList.add('hidden'); });
    return wrap;
  }
  function openDetailModal(p){
    const modal = createDetailModal();
    modal.classList.remove('hidden');
    modal.querySelector('.detail-image img').src = p.imageUrl || PLACEHOLDER;
    modal.querySelector('.detail-info h2').textContent = p.name || '';
    modal.querySelector('.prod-price').textContent = p.cost ? `${p.cost} บาท` : '-';
    modal.querySelector('.prod-meta').textContent = `สถานะ: ${p.status || '-'} • คงเหลือ: ${Number(p.quantity)||0}`;
    modal.querySelector('.detail-desc').textContent = p.description || '';
  }

  // load categories (client-side)
  function populateFilters(items){
    const catSel = document.getElementById('filterCategory');
    if(!catSel || !items) return;
    const cats = new Set();
    items.forEach(i => { if(i.category) cats.add(i.category); });
    catSel.innerHTML = '<option value="">หมวดหมู่ทั้งหมด</option>';
    Array.from(cats).sort().forEach(c => {
      const o = document.createElement('option'); o.value = c; o.textContent = c; catSel.appendChild(o);
    });
  }

  // load products (API)
  async function loadProducts(q){
    try{
      spinner.show('กำลังโหลดสินค้า...');
      const params = { action:'list', limit: 500 };
      if(q) params.q = q;
      const res = await apiGet(params);
      if(!res || !res.ok){ toast('โหลดสินค้าล้มเหลว'); renderCards([]); spinner.hide(); return; }
      const data = res.data || [];
      data.forEach(d => { d.quantity = Number(d.quantity)||0; d.cost = Number(d.cost)||0; });
      populateFilters(data);
      // optional: client-side filter by status or category if set
      const cat = document.getElementById('filterCategory') && document.getElementById('filterCategory').value;
      const st = document.getElementById('filterStatus') && document.getElementById('filterStatus').value;
      let list = data;
      if(cat) list = list.filter(x => (x.category||'')===cat);
      if(st) list = list.filter(x => (x.status||'')===st);
      renderCards(list);
      spinner.hide();
    }catch(err){
      console.error(err);
      toast('ข้อผิดพลาด: ' + (err.message||err));
      spinner.hide();
    }
  }

  // init UI wiring
  function init(){
    // ensure #cards exists (if catalog.html missing, create)
    let cards = document.getElementById('cards');
    const catalogArea = document.querySelector('.catalog-area') || document.body;
    if(!cards){
      cards = document.createElement('div'); cards.id='cards'; cards.className='cards-grid';
      catalogArea.appendChild(cards);
    }

    // remove any leftover static sample product-card nodes not inside #cards
    $$('.product-card').forEach(el => {
      if(!el.closest('#cards')) el.remove();
    });

    // wire up search/filter
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const clearBtn = document.getElementById('clearFilters');
    const catSel = document.getElementById('filterCategory');
    const statusSel = document.getElementById('filterStatus');

    if(searchBtn) searchBtn.addEventListener('click', ()=> loadProducts(searchInput && searchInput.value));
    if(searchInput) searchInput.addEventListener('keydown', (e)=> { if(e.key === 'Enter') loadProducts(searchInput.value); });
    if(clearBtn) clearBtn.addEventListener('click', ()=> {
      if(searchInput) searchInput.value='';
      if(catSel) catSel.value='';
      if(statusSel) statusSel.value='';
      loadProducts();
    });
    if(catSel) catSel.addEventListener('change', ()=> loadProducts(searchInput && searchInput.value));
    if(statusSel) statusSel.addEventListener('change', ()=> loadProducts(searchInput && searchInput.value));

    // initial load
    loadProducts();
  }

  // DOM ready
  document.addEventListener('DOMContentLoaded', init);
})();
