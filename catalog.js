/* catalog.js - Hybrid Grid Catalog (mobile 2 col / desktop 4 col) */
/* Requires config.js which defines APPS_SCRIPT_URL */

const catalogState = {
  items: [],
  categories: new Set(),
  q: '',
  sort: '',
  hideOutOfStock: false,
};

function el(q){ return document.querySelector(q); }
function show(elm){ elm && elm.classList.remove('hidden'); }
function hide(elm){ elm && elm.classList.add('hidden'); }

async function apiGet(params){
  const url = APPS_SCRIPT_URL + '?' + new URLSearchParams(params).toString();
  const res = await fetch(url);
  return res.json();
}

function formatPrice(v){ return (v==null || v==='') ? '-' : (Number(v).toLocaleString('en-US') ); }

function renderCategories(){
  const container = el('#categories');
  if(!container) return;
  container.innerHTML = '';
  const allBtn = document.createElement('button');
  allBtn.className = 'chip active';
  allBtn.textContent = 'ทั้งหมด';
  allBtn.onclick = ()=> { filterByCategory(''); };
  container.appendChild(allBtn);

  Array.from(catalogState.categories).sort().forEach(cat=>{
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = cat || 'ทั่วไป';
    b.dataset.cat = cat;
    b.onclick = ()=> filterByCategory(cat);
    container.appendChild(b);
  });
}

function filterByCategory(cat){
  catalogState.q = '';
  el('#searchInput').value = '';
  document.querySelectorAll('#categories .chip').forEach(x => x.classList.remove('active'));
  document.querySelectorAll(`#categories .chip`).forEach(ch=>{
    if(ch.dataset.cat === cat || (cat === '' && ch.textContent === 'ทั้งหมด')) ch.classList.add('active');
  });
  loadProducts(cat);
}

function renderGrid(items){
  const grid = el('#grid');
  grid.innerHTML = '';
  if(!items || items.length === 0){
    grid.innerHTML = `<div class="empty">ไม่พบสินค้า</div>`;
    el('#resultCount').textContent = '0 รายการ';
    return;
  }
  el('#resultCount').textContent = items.length + ' รายการ';
  items.forEach(p=>{
    const card = document.createElement('article');
    card.className = 'card';
    card.setAttribute('role','listitem');

    const imgWrap = document.createElement('div');
    imgWrap.className = 'card-image';
    if(p.imageUrl){
      const img = document.createElement('img');
      img.src = p.imageUrl;
      img.alt = p.name || p.sku;
      img.loading = 'lazy';
      imgWrap.appendChild(img);
    } else {
      imgWrap.innerHTML = '<div class="placeholder">ไม่มีรูป</div>';
    }

    const body = document.createElement('div');
    body.className = 'card-body';
    const name = document.createElement('h3');
    name.textContent = p.name || '-';
    const sku = document.createElement('div');
    sku.className = 'muted small'; sku.textContent = p.sku;
    const price = document.createElement('div');
    price.className = 'card-price'; price.textContent = formatPrice(p.cost) + ' ฿';
    const footer = document.createElement('div');
    footer.className = 'card-footer';
    const btnView = document.createElement('button');
    btnView.className = 'btn-outline'; btnView.textContent = 'ดู';
    btnView.onclick = ()=> openProductModal(p);
    const btnAdd = document.createElement('button');
    btnAdd.className = 'btn-primary sm'; btnAdd.textContent = '+';
    btnAdd.onclick = ()=> {
      // simple local add action (future: call API/cart)
      btnAdd.disabled = true; btnAdd.textContent = '✓';
      setTimeout(()=>{ btnAdd.disabled=false; btnAdd.textContent='+'; }, 700);
    };

    footer.appendChild(btnView);
    footer.appendChild(btnAdd);

    body.appendChild(name);
    body.appendChild(sku);
    body.appendChild(price);
    body.appendChild(footer);

    card.appendChild(imgWrap);
    card.appendChild(body);
    grid.appendChild(card);

    // category collect
    if(p.category) catalogState.categories.add(p.category);
  });

  renderCategories();
}

function openProductModal(product){
  const modal = el('#productModal');
  show(modal);
  el('#modalTitle').textContent = product.name || product.sku;
  el('#modalSku').textContent = 'SKU: ' + (product.sku||'');
  el('#modalCategory').textContent = 'หมวด: ' + (product.category || '-');
  el('#modalPrice').textContent = 'ราคา: ' + formatPrice(product.cost) + ' ฿';
  el('#modalQty').textContent = 'คงเหลือ: ' + (product.quantity || 0);
  el('#modalDesc').textContent = product.description || '';
  el('#modalImage').innerHTML = '';
  if(product.imageUrl){
    const img = document.createElement('img'); img.src = product.imageUrl; img.alt = product.name || product.sku;
    el('#modalImage').appendChild(img);
  }
  el('#modalClose').onclick = ()=> hide(modal);
  el('#btnOpenProduct').href = 'product.html?sku=' + encodeURIComponent(product.sku || '');
  el('#btnAddToCart').onclick = ()=> {
    const qty = Number(el('#modalQtyInput').value || 1);
    alert('เพิ่ม ' + qty + ' ชิ้น ลงตะกร้า (demo)');
  };
}

function wireUI(){
  el('#btnSearch').addEventListener('click', ()=> {
    const q = el('#searchInput').value.trim();
    catalogState.q = q;
    loadProducts();
  });
  el('#searchInput').addEventListener('keydown', (e)=> { if(e.key === 'Enter'){ catalogState.q = el('#searchInput').value.trim(); loadProducts(); }});
  el('#sortSelect').addEventListener('change', (e)=> { catalogState.sort = e.target.value; loadProducts(); });
  el('#hideOutOfStock').addEventListener('change', (e)=> { catalogState.hideOutOfStock = e.target.checked; loadProducts(); });
  el('#modalClose').addEventListener('click', ()=> hide(el('#productModal')));
}

function setLoading(on){
  if(on) show(el('#loading')); else hide(el('#loading'));
}

async function loadProducts(category=''){
  try{
    setLoading(true);
    const params = { action: 'list', limit: 500 };
    if(catalogState.q) params.q = catalogState.q;
    if(category) params.category = category;
    if(catalogState.hideOutOfStock) params.status = 'active'; // simple
    const r = await apiGet(params);
    if(!r || !r.ok){ renderGrid([]); return; }
    let data = r.data || [];
    // apply simple client-side sort
    if(catalogState.sort === 'price_asc') data = data.sort((a,b) => Number(a.cost||0) - Number(b.cost||0));
    if(catalogState.sort === 'price_desc') data = data.sort((a,b) => Number(b.cost||0) - Number(a.cost||0));
    // apply hide out-of-stock client filter if needed (if quantity <= 0)
    if(catalogState.hideOutOfStock) data = data.filter(i => Number(i.quantity || 0) > 0);
    catalogState.items = data;
    renderGrid(data);
  } catch(err){
    console.error('loadProducts', err);
    renderGrid([]);
  } finally {
    setLoading(false);
  }
}

/* init */
document.addEventListener('DOMContentLoaded', ()=>{
  wireUI();
  // initial load
  loadProducts();
});
