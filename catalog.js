// catalog.js (copy & paste -> วางทับไฟล์เดิม)
(function(){
  // placeholder image (ถ้าต้องการใช้ไฟล์ที่คุณอัปโหลด ใส่ path local ให้ตรง)
  const PLACEHOLDER = '/mnt/data/4d9bcc50-a455-44e4-960b-b8ba79697437.png'; // <-- ถ้ไฟล์ path ต่าง ให้แก้ตรงนี้
  const APPS = (typeof APPS_SCRIPT_URL !== 'undefined') ? APPS_SCRIPT_URL : (window.APPS_SCRIPT_URL || '');

  function el(tag, attrs={}, children=[]){
    const d = document.createElement(tag);
    for(const k in attrs){
      if(k === 'class') d.className = attrs[k];
      else if(k === 'text') d.textContent = attrs[k];
      else d.setAttribute(k, attrs[k]);
    }
    (Array.isArray(children)?children:[children]).forEach(c=> { if(!c) return; if(typeof c === 'string') d.appendChild(document.createTextNode(c)); else d.appendChild(c); });
    return d;
  }

  async function apiList(q){
    try{
      const url = APPS + '?action=list&limit=500' + (q ? '&q=' + encodeURIComponent(q) : '');
      const r = await fetch(url);
      return await r.json();
    }catch(err){
      console.error('apiList', err);
      return { ok:false, error: err.message || 'network' };
    }
  }

  function renderEmpty(container){
    container.innerHTML = '';
    const empty = el('div',{class:'empty-state'}, 'ไม่พบสินค้า');
    container.appendChild(empty);
  }

  function createCard(p){
    const card = el('div',{class:'product-card'});

    // thumb wrapper
    const thumb = el('div',{class:'thumb'});
    const img = el('img',{src: p.imageUrl || PLACEHOLDER, alt: p.name || 'image'});
    // ensure broken image falls back to placeholder
    img.onerror = function(){ this.onerror = null; this.src = PLACEHOLDER; };
    thumb.appendChild(img);
    card.appendChild(thumb);

    // body
    const body = el('div',{class:'product-body'});
    const title = el('div',{class:'product-title'}, p.name || '—');
    body.appendChild(title);

    // optionally show sku (user said can remove), here we skip top SKU display
    // price
    const price = el('div',{class:'product-price'}, (p.cost || p.price ? (Number(p.cost||p.price).toLocaleString()+' บาท') : '-'));
    body.appendChild(price);

    // status and stock
    const status = el('div',{class:'product-status'}, 'สถานะ: ' + (p.status || '-'));
    const stock = el('div',{class:'product-stock'}, 'คงเหลือ: ' + (Number(p.quantity)||0));
    body.appendChild(status);
    body.appendChild(stock);

    // actions
    const actions = el('div',{class:'product-actions'});
    const detail = el('button',{class:'btn-detail'}, 'ดูรายละเอียด');
    detail.addEventListener('click', ()=> openDetailModal(p));
    actions.appendChild(detail);

    // qty control (small)
    const qtyWrap = el('div',{class:'qty-controls'});
    const minus = el('button',{}, '-');
    const val = el('span',{class:'qty-value'}, String(Number(p.quantity)||0));
    const plus = el('button',{}, '+');
    minus.addEventListener('click', ()=> updateQtyLocal(val, -1));
    plus.addEventListener('click', ()=> updateQtyLocal(val, +1));
    qtyWrap.appendChild(minus); qtyWrap.appendChild(val); qtyWrap.appendChild(plus);
    actions.appendChild(qtyWrap);

    body.appendChild(actions);
    card.appendChild(body);
    return card;
  }

  function updateQtyLocal(spanEl, delta){
    let n = Number(spanEl.textContent||0);
    n = Math.max(0, n + delta);
    spanEl.textContent = String(n);
  }

  // simple modal for detail
  function openDetailModal(p){
    // create modal elements
    let modal = document.getElementById('catalogDetailModal');
    if(modal) modal.remove();

    modal = el('div',{class:'modal', id:'catalogDetailModal'});
    const panel = el('div',{class:'modal-panel'});
    const closeBtn = el('button',{class:'modal-close'}, '×');
    closeBtn.addEventListener('click', ()=> modal.remove());
    panel.appendChild(closeBtn);

    const body = el('div',{class:'modal-body'});
    const imgCol = el('div',{class:'detail-image'});
    const img = el('img',{src: p.imageUrl || PLACEHOLDER, alt: p.name || 'image'});
    img.onerror = function(){ this.onerror=null; this.src = PLACEHOLDER; };
    imgCol.appendChild(img);

    const info = el('div',{class:'detail-info'});
    const title = el('h2',{}, p.name || '-');
    const price = el('div',{class:'product-price'}, (p.cost? Number(p.cost).toLocaleString() + ' บาท' : '-'));
    const status = el('div',{}, 'สถานะ: ' + (p.status||'-'));
    const stock = el('div',{}, 'คงเหลือ: ' + (Number(p.quantity)||0));
    info.appendChild(title); info.appendChild(price); info.appendChild(status); info.appendChild(stock);

    // close + add small action
    const actions = el('div',{class:'detail-actions'});
    const inBtn = el('button',{class:'btn btn-outline'}, 'รับเข้า +');
    const outBtn = el('button',{class:'btn btn-outline'}, 'ตัดออก -');
    actions.appendChild(inBtn); actions.appendChild(outBtn);
    info.appendChild(actions);

    body.appendChild(imgCol); body.appendChild(info);
    panel.appendChild(body);
    modal.appendChild(panel);
    document.body.appendChild(modal);

    // bind (demo only): in/out adjust local shown number
    inBtn.addEventListener('click', ()=>{
      const newQty = (Number(p.quantity)||0) + 1;
      p.quantity = newQty;
      // refresh modal info and the cards list
      modal.remove();
      loadAndRender(currentQuery);
    });
    outBtn.addEventListener('click', ()=>{
      const newQty = Math.max(0, (Number(p.quantity)||0) - 1);
      p.quantity = newQty;
      modal.remove();
      loadAndRender(currentQuery);
    });
  }

  // render list
  const container = document.getElementById('cards');
  let currentQuery = '';
  async function loadAndRender(q){
    if(!container) return;
    container.innerHTML = '';
    // show spinner text
    showSpinner(true, 'กำลังโหลดรายการสินค้า...');
    const res = await apiList(q);
    showSpinner(false);
    if(!res || !res.ok){
      renderEmpty(container);
      console.warn('load error', res);
      return;
    }
    const data = res.data || [];
    if(data.length === 0){
      renderEmpty(container);
      return;
    }
    // populate
    data.forEach(p=>{
      // ensure numeric fields
      p.quantity = Number(p.quantity) || 0;
      p.cost = Number(p.cost) || 0;
      const c = createCard(p);
      container.appendChild(c);
    });
  }

  // simple spinner overlay
  function showSpinner(visible, text){
    let s = document.getElementById('catalogSpinnerOverlay');
    if(!s){
      s = el('div',{id:'catalogSpinnerOverlay', class:'spinner-overlay hidden'});
      const box = el('div',{class:'spinner'});
      const dual = document.createElement('div');
      dual.className = 'lds-dual-ring';
      const t = el('div',{class:'spinner-text', id:'catalogSpinnerText'}, text || '');
      box.appendChild(dual); box.appendChild(t);
      s.appendChild(box);
      const catalogWrap = document.querySelector('.catalog-area') || document.body;
      catalogWrap.appendChild(s);
    }
    const txt = document.getElementById('catalogSpinnerText');
    if(txt) txt.textContent = text || '';
    if(visible){
      s.classList.remove('hidden');
    } else {
      s.classList.add('hidden');
    }
  }

  // search bind
  function initActions(){
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    if(searchBtn && searchInput){
      searchBtn.addEventListener('click', ()=>{
        currentQuery = searchInput.value.trim();
        loadAndRender(currentQuery);
      });
      searchInput.addEventListener('keydown', (e)=>{
        if(e.key === 'Enter'){ currentQuery = searchInput.value.trim(); loadAndRender(currentQuery); }
      });
    }
    const clearFilters = document.getElementById('clearFilters');
    if(clearFilters){
      clearFilters.addEventListener('click', ()=>{
        document.getElementById('filterCategory').value = '';
        document.getElementById('filterStatus').value = '';
        currentQuery = '';
        if(searchInput) searchInput.value = '';
        loadAndRender('');
      });
    }
  }

  // init
  document.addEventListener('DOMContentLoaded', ()=>{
    initActions();
    // initial load
    loadAndRender('');
  });

})();
