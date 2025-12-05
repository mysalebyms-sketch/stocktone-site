// catalog.js - dynamic catalog renderer for StockTone
// expects APPS_SCRIPT_URL from config.js and style.css having .product-card img { object-fit: cover; }

/* small util */
function $(sel, ctx){ return (ctx||document).querySelector(sel); }
function $all(sel, ctx){ return Array.from((ctx||document).querySelectorAll(sel)); }
function show(el){ if(!el) return; el.classList.remove('hidden'); el.style.visibility='visible'; }
function hide(el){ if(!el) return; el.classList.add('hidden'); el.style.visibility='hidden'; }

async function apiGet(params){
  const u = (typeof APPS_SCRIPT_URL === 'string' ? APPS_SCRIPT_URL : '') + '?' + new URLSearchParams(params).toString();
  const r = await fetch(u, { cache:'no-store' });
  return r.json();
}

/* spinner helpers (assumes #spinnerOverlay and #spinnerStep exist) */
function spinner(msg){
  const ov = $('#spinnerOverlay');
  const step = $('#spinnerStep');
  if(!ov) return { start:()=>{}, stop:()=>{} };
  return {
    start(text){
      step && (step.textContent = text || 'กำลังโหลด...');
      show(ov);
    },
    step(text){ step && (step.textContent = text || step.textContent); },
    stop(){ hide(ov); }
  };
}

/* create a card DOM node from product object */
function createCard(p){
  const div = document.createElement('div');
  div.className = 'product-card';

  // image wrapper + img
  const img = document.createElement('img');
  img.alt = p.name || p.sku || '';
  img.src = p.imageUrl || 'https://via.placeholder.com/600x400?text=no+image';
  img.loading = 'lazy';
  div.appendChild(img);

  // body content
  const body = document.createElement('div');
  body.className = 'product-body';
  const title = document.createElement('h3');
  title.className = 'product-title';
  title.textContent = p.name || 'ไม่มีชื่อสินค้า';
  body.appendChild(title);

  const sku = document.createElement('div');
  sku.className = 'product-sku';
  sku.textContent = p.sku || '';
  body.appendChild(sku);

  const price = document.createElement('div');
  price.className = 'product-price';
  // show price (cost) in บาท — if you prefer currency formatting, change here
  price.textContent = (p.cost !== undefined && p.cost !== '') ? `${p.cost} บาท` : '-';
  body.appendChild(price);

  const status = document.createElement('div');
  status.className = 'product-status';
  status.textContent = p.status || '';
  body.appendChild(status);

  const stock = document.createElement('div');
  stock.className = 'product-stock';
  stock.innerHTML = `<small>คงเหลือ</small><div class="stock-value">${Number(p.quantity||0)}</div>`;
  body.appendChild(stock);

  // actions row
  const actions = document.createElement('div');
  actions.className = 'product-actions';

  const btnDetail = document.createElement('button');
  btnDetail.className = 'btn btn-detail';
  btnDetail.textContent = 'ดูรายละเอียด';
  btnDetail.addEventListener('click', ()=> openProductDetail(p));
  actions.appendChild(btnDetail);

  // qty controls (plus/minus) — just UI; if you want to call API, hook performInOut
  const qtyWrap = document.createElement('div');
  qtyWrap.className = 'qty-controls';
  const minus = document.createElement('button'); minus.className='qty-minus'; minus.textContent='−';
  const qtyVal = document.createElement('span'); qtyVal.className='qty-value'; qtyVal.textContent = Number(p.quantity||0);
  const plus = document.createElement('button'); plus.className='qty-plus'; plus.textContent='+';

  minus.addEventListener('click', ()=> {
    const v = Math.max(0, Number(qtyVal.textContent) - 1);
    qtyVal.textContent = v;
    // optionally: call backend to decrease (history_add actionType=out)
  });
  plus.addEventListener('click', ()=>{
    const v = Number(qtyVal.textContent) + 1;
    qtyVal.textContent = v;
    // optionally: call backend to increase (history_add actionType=in)
  });

  qtyWrap.appendChild(minus); qtyWrap.appendChild(qtyVal); qtyWrap.appendChild(plus);
  actions.appendChild(qtyWrap);

  body.appendChild(actions);
  div.appendChild(body);
  return div;
}

/* product detail handler (simple: navigate to product page or modal) */
function openProductDetail(p){
  // example: navigate to product.html?sku=SKU
  const url = `product.html?sku=${encodeURIComponent(p.sku)}`;
  window.location.href = url;
}

/* render list into #cards */
function renderProducts(list){
  const container = $('#cards');
  container.innerHTML = '';
  if(!list || list.length === 0){
    $('#catalogMsg').textContent = 'ไม่พบสินค้า';
    return;
  }
  $('#catalogMsg').textContent = '';
  list.forEach(p=>{
    const node = createCard(p);
    container.appendChild(node);
  });
}

/* load catalog from API */
async function loadCatalog(q, opts){
  const s = spinner();
  s.start('กำลังโหลดรายการสินค้า...');
  try{
    const params = { action:'list', limit:200 };
    if(q) params.q = q;
    if(opts && opts.category) params.category = opts.category;
    if(opts && opts.status) params.status = opts.status;
    s.step('เรียกข้อมูลจากเซิร์ฟเวอร์...');
    const res = await apiGet(params);
    s.step('ประมวลผลข้อมูล...');
    if(res && res.ok){
      renderProducts(res.data || []);
      s.stop();
    } else {
      s.stop();
      $('#catalogMsg').textContent = 'โหลดข้อมูลล้มเหลว';
      console.error('API list error', res);
    }
  }catch(err){
    s.stop();
    $('#catalogMsg').textContent = 'เกิดข้อผิดพลาด: ' + err.message;
    console.error(err);
  }
}

/* populate category filter (simple unique extractor) */
function populateFilters(list){
  const catSel = $('#filterCategory');
  if(!catSel) return;
  const cats = Array.from(new Set((list||[]).map(i=>i.category||'').filter(Boolean))).sort();
  // clear existing except first placeholder
  catSel.innerHTML = '<option value="">หมวดหมู่ทั้งหมด</option>';
  cats.forEach(c=>{
    const o = document.createElement('option');
    o.value = c; o.textContent = c;
    catSel.appendChild(o);
  });
}

/* init UI */
function initCatalog(){
  const searchInput = $('#searchInput');
  const searchBtn = $('#searchBtn');
  const clearBtn = $('#clearFilters');
  const catSel = $('#filterCategory');
  const statusSel = $('#filterStatus');

  async function doLoad(){
    const q = searchInput && searchInput.value.trim();
    const opts = { category: catSel && catSel.value, status: statusSel && statusSel.value };
    await loadCatalog(q, opts);
    // also fetch raw list for filter population (light)
    try{
      const all = await apiGet({ action:'list', limit:1000 });
      if(all && all.ok) populateFilters(all.data || []);
    }catch(e){}
  }

  if(searchBtn) searchBtn.addEventListener('click', ()=> doLoad());
  if(searchInput) searchInput.addEventListener('keydown', (ev)=> { if(ev.key === 'Enter') doLoad(); });
  if(clearBtn) clearBtn.addEventListener('click', ()=>{
    if(searchInput) searchInput.value = '';
    if(catSel) catSel.value = '';
    if(statusSel) statusSel.value = '';
    doLoad();
  });
  if(catSel) catSel.addEventListener('change', ()=> doLoad());
  if(statusSel) statusSel.addEventListener('change', ()=> doLoad());

  // initial load
  doLoad();
}

document.addEventListener('DOMContentLoaded', initCatalog);
