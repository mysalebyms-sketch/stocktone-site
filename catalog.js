// catalog.js - mobile-first catalog grid (lazy images, badges, pagination)
// Requires: config.js exposing APPS_SCRIPT_URL
(() => {
  // placeholders
  const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="480">
      <rect width="100%" height="100%" fill="#f6f6f6"/>
    </svg>`
  );

  const qs = s => document.querySelector(s);
  const qsa = s => Array.from(document.querySelectorAll(s));
  const setHidden = (el, yes) => { if(!el) return; el.classList.toggle('hidden', yes); };

  // spinner helpers
  const spinner = {
    show(msg){
      const g = qs('#globalSpinner');
      if(!g) return;
      const text = qs('#spinnerText');
      if(text) text.textContent = msg || 'กำลังโหลด...';
      g.classList.remove('hidden');
    },
    hide(){ const g = qs('#globalSpinner'); if(g) g.classList.add('hidden'); }
  };

  // API GET helper
  async function apiGet(params){
    const base = (typeof APPS_SCRIPT_URL === 'undefined') ? '' : APPS_SCRIPT_URL;
    const url = base + '?' + new URLSearchParams(params).toString();
    const res = await fetch(url);
    return res.json();
  }

  // render single card
  function makeCard(p){
    const article = document.createElement('article');
    article.className = 'card';

    // thumb
    const thumb = document.createElement('div'); thumb.className = 'thumb';
    const img = document.createElement('img');
    img.alt = p.name || '';
    img.loading = 'lazy';
    img.src = p.imageUrl || PLACEHOLDER;
    img.onerror = () => { img.src = PLACEHOLDER; };
    thumb.appendChild(img);
    article.appendChild(thumb);

    // body
    const body = document.createElement('div'); body.className = 'card-body';

    // badge & title row
    const titleRow = document.createElement('div'); titleRow.className = 'title-card';
    const badge = document.createElement('span'); badge.className = 'badge';
    // choose badge label
    if((p.status||'').toLowerCase() === 'พร้อมส่ง') { badge.textContent = 'พร้อมส่ง'; badge.classList.add('badge-ready'); }
    else if((p.popular||'') === true || (p.popular||'') === '1') { badge.textContent = 'ขายดี'; badge.classList.add('badge-hot'); }
    else badge.textContent = '👜';
    titleRow.appendChild(badge);

    const title = document.createElement('div'); title.textContent = ' ' + (p.name || '(no name)');
    titleRow.appendChild(title);
    body.appendChild(titleRow);

    // price
    const price = document.createElement('div'); price.className = 'price'; price.textContent = (p.cost? (p.cost + ' บาท') : '-');
    body.appendChild(price);

    // meta status/qty
    const st = document.createElement('div'); st.className = 'muted small'; st.textContent = 'สถานะ: ' + (p.status||'-');
    const qt = document.createElement('div'); qt.className = 'muted small'; qt.textContent = 'คงเหลือ: ' + (Number(p.quantity)||0);
    body.appendChild(st); body.appendChild(qt);

    article.appendChild(body);

    // footer
    const foot = document.createElement('div'); foot.className = 'card-foot';
    const left = document.createElement('div'); left.className = 'left';
    const btnDetail = document.createElement('button'); btnDetail.className = 'btn-outline'; btnDetail.textContent = 'ดูรายละเอียด';
    btnDetail.addEventListener('click', ()=> openModal(p));
    left.appendChild(btnDetail);
    foot.appendChild(left);

    // right actions area (we removed + / - per requirement)
    article.appendChild(foot);
    return article;
  }

  // render list
  function renderCards(list){
    const container = qs('#cards');
    container.innerHTML = '';
    if(!list || list.length === 0){
      container.innerHTML = '<div class="muted empty-state">ไม่มีสินค้า</div>';
      qs('#resultCount').textContent = '0 ผลลัพธ์';
      return;
    }
    qs('#resultCount').textContent = `${list.length} ผลลัพธ์`;
    const frag = document.createDocumentFragment();
    list.forEach(p => frag.appendChild(makeCard(p)));
    container.appendChild(frag);
    // ensure images lazy load and layout is tidy
    window.requestAnimationFrame(()=> {
      qsa('.cards-grid img').forEach(i => {
        if(!i.complete) i.addEventListener('load', ()=> {});
      });
    });
  }

  // modal
  function openModal(p){
    const modal = qs('#detailModal');
    if(!modal) return;
    qs('#modalImg').src = p.imageUrl || PLACEHOLDER;
    qs('#modalTitle').textContent = p.name || '';
    qs('#modalPrice').textContent = p.cost ? (p.cost + ' บาท') : '-';
    qs('#modalStatus').textContent = 'สถานะ: ' + (p.status || '-');
    qs('#modalDesc').textContent = p.description || '';
    modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false');
  }
  function closeModal(){
    const modal = qs('#detailModal');
    if(!modal) return;
    modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true');
  }

  // pagination state
  let PAGE = 1;
  const PAGE_SIZE = 24;

  async function loadProducts(q){
    try{
      setHidden(qs('#loadingInline'), false);
      spinner.show('กำลังโหลดรายการสินค้า...');
      // call API: action=list with limit & page (server supports limit/page in provided backend)
      const params = { action:'list', limit: PAGE_SIZE, page: PAGE };
      if(q) params.q = q;
      const res = await apiGet(params);
      if(!res || !res.ok){ qs('#catalogMsg').textContent = 'โหลดสินค้าล้มเหลว'; renderCards([]); spinner.hide(); setHidden(qs('#loadingInline'), true); return; }
      const data = res.data || [];
      // populate filters
      populateFilters(data);
      renderCards(data);
      spinner.hide();
      setHidden(qs('#loadingInline'), true);
      updatePageInfo(res.total || data.length);
    } catch(err){
      console.error(err);
      spinner.hide();
      setHidden(qs('#loadingInline'), true);
      qs('#catalogMsg').textContent = 'ข้อผิดพลาด: ' + (err.message||err);
    }
  }

  function updatePageInfo(total){
    const pageInfo = qs('#pageInfo');
    const totalPages = Math.max(1, Math.ceil((total || 0) / PAGE_SIZE));
    pageInfo.textContent = `หน้า ${PAGE} / ${totalPages}`;
    qs('#prevPage').disabled = (PAGE <= 1);
    qs('#nextPage').disabled = (PAGE >= totalPages);
  }

  function populateFilters(items){
    const catSel = qs('#filterCategory');
    if(!catSel) return;
    const cats = new Set();
    items.forEach(i => { if(i.category) cats.add(i.category); });
    const cur = catSel.value || '';
    catSel.innerHTML = '<option value="">หมวดหมู่ทั้งหมด</option>';
    Array.from(cats).sort().forEach(c => {
      const o = document.createElement('option'); o.value = c; o.textContent = c; catSel.appendChild(o);
    });
    if(cur) catSel.value = cur;
  }

  // init UI listeners
  function init(){
    // remove stray static sample cards not inside #cards
    qsa('.card').forEach(el => { if(!el.closest('#cards')) el.remove(); });

    qs('#searchBtn').addEventListener('click', ()=> { PAGE = 1; loadProducts(qs('#searchInput').value); });
    qs('#searchInput').addEventListener('keydown', (e)=> { if(e.key === 'Enter'){ PAGE = 1; loadProducts(qs('#searchInput').value); }});

    qs('#clearFilters').addEventListener('click', ()=> {
      qs('#searchInput').value = '';
      qs('#filterCategory').value = '';
      qs('#filterStatus').value = '';
      PAGE = 1; loadProducts();
    });

    qs('#prevPage').addEventListener('click', ()=> { if(PAGE>1){ PAGE--; loadProducts(qs('#searchInput').value); }});
    qs('#nextPage').addEventListener('click', ()=> { PAGE++; loadProducts(qs('#searchInput').value); });

    // modal close
    qs('#closeModal').addEventListener('click', closeModal);
    qs('#detailModal').addEventListener('click', (e)=> { if(e.target === qs('#detailModal')) closeModal(); });
    document.addEventListener('keydown', (e)=> { if(e.key === 'Escape') closeModal(); });

    // nav buttons (just basic navigation — these call pages you will add later)
    qsa('.nav-btn').forEach(b => b.addEventListener('click', (ev)=>{
      qsa('.nav-btn').forEach(x=>x.classList.remove('active'));
      ev.currentTarget.classList.add('active');
      const view = ev.currentTarget.dataset.view;
      // simple behaviour: if view != catalog, warn (pages to be created)
      if(view !== 'catalog'){
        alert('หน้าที่เลือก: ' + view + '\n(ยังไม่ได้สร้างภายในโปรเจก — จะทำให้ครบเมื่อขอ Phase B/C)');
      }
    }));

    // filter change (client-side naive)
    qs('#filterStatus').addEventListener('change', ()=> {
      const status = qs('#filterStatus').value;
      // in current implementation server-side filtering is preferred; we'll do a reload with q param if needed.
      // For now reload all and then filter client-side
      loadProducts(qs('#searchInput').value).then(()=> {
        if(status){
          const cards = qsa('#cards .card');
          cards.forEach(c => {
            const st = c.querySelector('.muted.small') && c.querySelector('.muted.small').textContent || '';
            if(!st.includes(status)) c.style.display = 'none';
            else c.style.display = '';
          });
        }
      });
    });

    // initial load
    loadProducts();
  }

  // wait DOM
  document.addEventListener('DOMContentLoaded', init);
})();
