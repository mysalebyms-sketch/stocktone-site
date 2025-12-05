// File: admin.js (Full working admin frontend)
// Minimal comments only where necessary (why).
// Requires: config.js providing `APPS_SCRIPT_URL` (set by you).

/* ---------------------------
   Utilities
   --------------------------- */
function $q(sel){ return document.querySelector(sel); }
function $qa(sel){ return Array.from(document.querySelectorAll(sel)); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// session helpers
function setSession(s){ sessionStorage.setItem('st_session', JSON.stringify(s)); }
function getSession(){ try { return JSON.parse(sessionStorage.getItem('st_session')); } catch(e){ return null; } }
function clearSession(){ sessionStorage.removeItem('st_session'); }

/* ---------------------------
   UI elements
   --------------------------- */
const el = {
  loginSection: $q('#loginSection'),
  adminArea: $q('#adminArea'),
  loginBtn: $q('#loginBtn'),
  logoutBtn: $q('#logoutBtn'),
  adminId: $q('#adminId'),
  adminPassword: $q('#adminPassword'),
  who: $q('#who'),
  addForm: $q('#addForm'),
  addMsg: $q('#addMsg'),
  fileInput: $q('#fileInput'),
  refreshList: $q('#refreshList'),
  searchBox: $q('#searchBox'),
  productTableBody: $q('#productTable tbody'),
  listMsg: $q('#listMsg')
};

/* ---------------------------
   Initialization & login flow
   --------------------------- */
(function init(){
  const s = getSession();
  if(s && s.adminId && s.adminPassword){
    showAdmin(s);
    loadProducts(); // initial load
  } else {
    showLogin();
  }
})();

el.loginBtn.addEventListener('click', async ()=>{
  const adminId = (el.adminId.value||'').trim();
  const adminPassword = (el.adminPassword.value||'').trim();
  if(!adminId || !adminPassword){ alert('กรุณากรอก Admin ID และ Password'); return; }
  // Quick test auth by calling list with credentials
  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=list&limit=1&adminId=${encodeURIComponent(adminId)}&adminPassword=${encodeURIComponent(adminPassword)}`);
    const j = await res.json();
    if(j && j.ok){
      setSession({adminId, adminPassword});
      showAdmin({adminId, adminPassword});
      loadProducts();
    } else {
      alert('Login failed: ' + (j && j.error ? j.error : 'unknown'));
    }
  } catch(err){
    console.error(err);
    alert('Network error during login');
  }
});

el.logoutBtn.addEventListener('click', ()=>{
  clearSession();
  location.reload();
});

function showLogin(){
  el.loginSection.style.display = 'block';
  el.adminArea.style.display = 'none';
}
function showAdmin(sess){
  el.loginSection.style.display = 'none';
  el.adminArea.style.display = 'block';
  el.who.textContent = sess.adminId;
}

/* ---------------------------
   Upload image -> Apps Script (base64)
   - returns imageUrl or throws
   Why: centralizes upload logic and error handling.
   --------------------------- */
async function uploadImage(file){
  if(!file) return '';
  // Basic client-side checks
  if(file.size > 8 * 1024 * 1024) throw new Error('File too large (max 8MB)');
  const allowed = ['image/png','image/jpeg','image/webp','image/gif'];
  if(file.type && !allowed.includes(file.type)) {
    // still try, but warn
    console.warn('Unusual contentType', file.type);
  }
  // read as base64
  const base64 = await new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload = ()=> resolve(String(r.result).split(',',2)[1] || '');
    r.onerror = e => reject(e);
    r.readAsDataURL(file);
  });
  if(!base64) throw new Error('Cannot read file');
  const sess = getSession();
  if(!sess) throw new Error('Not authenticated');

  const payload = {
    action: 'upload_image',
    adminId: sess.adminId,
    adminPassword: sess.adminPassword,
    filename: file.name,
    contentType: file.type || 'image/png',
    base64: base64
  };

  const resp = await fetch(APPS_SCRIPT_URL + '?action=upload_image', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  const j = await resp.json();
  if(!j || !j.ok) {
    const err = (j && j.error) ? j.error : 'upload_failed';
    throw new Error(err + (j && j.detail ? (': '+j.detail) : ''));
  }
  return j.imageUrl;
}

/* ---------------------------
   Add product (with optional image upload)
   --------------------------- */
el.addForm.addEventListener('submit', async function(ev){
  ev.preventDefault();
  el.addMsg.textContent = '';
  const fd = new FormData(el.addForm);
  const sku = (fd.get('sku')||'').trim();
  if(!sku){ el.addMsg.textContent = 'SKU required'; return; }
  const session = getSession();
  if(!session){ alert('Not logged in'); return; }

  // Validate numeric fields
  const quantity = Number(fd.get('quantity') || 0);
  const cost = Number(fd.get('cost') || 0);
  if(Number.isNaN(quantity) || quantity < 0){ el.addMsg.textContent='Invalid quantity'; return; }
  if(Number.isNaN(cost) || cost < 0){ el.addMsg.textContent='Invalid cost'; return; }

  // Upload image first if selected
  let imageUrl = '';
  const file = el.fileInput.files[0];
  if(file){
    el.addMsg.textContent = 'กำลังอัปโหลดรูป...';
    try{
      imageUrl = await uploadImage(file);
    } catch(err){
      console.error(err);
      el.addMsg.textContent = 'อัปโหลดรูปไม่สำเร็จ: ' + err.message;
      return;
    }
  }

  // Now call add
  const params = new URLSearchParams();
  params.append('action','add');
  params.append('adminId', session.adminId);
  params.append('adminPassword', session.adminPassword);
  params.append('sku', sku);
  params.append('name', fd.get('name') || '');
  params.append('quantity', String(quantity));
  params.append('cost', String(cost));
  params.append('status', fd.get('status') || '');
  params.append('imageUrl', imageUrl || '');
  params.append('category', fd.get('category') || '');

  try{
    el.addMsg.textContent = 'กำลังเพิ่มสินค้า...';
    const res = await fetch(APPS_SCRIPT_URL + '?' + params.toString());
    const j = await res.json();
    if(j && j.ok){
      el.addMsg.style.color = 'green';
      el.addMsg.textContent = 'เพิ่มสินค้าเรียบร้อย';
      el.addForm.reset();
      loadProducts();
      setTimeout(()=> el.addMsg.textContent = '', 3000);
    } else {
      el.addMsg.style.color = 'red';
      el.addMsg.textContent = 'Add failed: ' + (j && j.error? j.error : 'unknown');
    }
  } catch(err){
    console.error(err);
    el.addMsg.style.color = 'red';
    el.addMsg.textContent = 'Network error';
  }
});

/* ---------------------------
   Load products & render table
   --------------------------- */
el.refreshList.addEventListener('click', ()=> loadProducts());
el.searchBox.addEventListener('keyup', (e)=> {
  if(e.key === 'Enter') loadProducts();
});

async function loadProducts(){
  el.listMsg.textContent = 'Loading...';
  const q = (el.searchBox.value||'').trim();
  const params = new URLSearchParams();
  params.append('action','list');
  params.append('limit','500');
  if(q) params.append('q', q);

  try {
    const res = await fetch(APPS_SCRIPT_URL + '?' + params.toString());
    const j = await res.json();
    if(!j || !j.ok){ el.listMsg.textContent = 'Load failed'; return; }
    renderProducts(j.data || []);
    el.listMsg.textContent = '';
  } catch(err){
    console.error(err);
    el.listMsg.textContent = 'Network error';
  }
}

function renderProducts(items){
  el.productTableBody.innerHTML = '';
  if(!items || items.length === 0){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="7" style="padding:12px">ไม่มีสินค้า</td>`;
    el.productTableBody.appendChild(tr);
    return;
  }
  items.forEach(it=>{
    const tr = document.createElement('tr');
    const imgHtml = it.imageUrl ? `<img src="${esc(it.imageUrl)}" class="thumb" alt="thumb">` : '';
    const sku = esc(it.sku);
    const name = esc(it.name);
    const qty = esc(it.quantity);
    const cost = esc(it.cost);
    const status = esc(it.status);
    tr.innerHTML = `
      <td>${imgHtml}</td>
      <td>${sku}</td>
      <td>${name}</td>
      <td>${qty}</td>
      <td>${cost}</td>
      <td>${status}</td>
      <td>
        <button class="btn-edit" data-sku="${sku}">แก้ไข</button>
        <button class="btn-in" data-sku="${sku}">รับเข้า</button>
        <button class="btn-out" data-sku="${sku}">ตัดออก</button>
        <button class="btn-delete" data-sku="${sku}">ลบ</button>
      </td>
    `;
    el.productTableBody.appendChild(tr);
  });

  // attach event handlers (delegation-style)
  $qa('.btn-edit').forEach(b => b.onclick = () => onEdit(b.dataset.sku));
  $qa('.btn-delete').forEach(b => b.onclick = () => onDelete(b.dataset.sku));
  $qa('.btn-in').forEach(b => b.onclick = () => onInOut(b.dataset.sku, 'in'));
  $qa('.btn-out').forEach(b => b.onclick = () => onInOut(b.dataset.sku, 'out'));
}

/* ---------------------------
   Edit / Delete / In-Out handlers
   --------------------------- */
async function onEdit(sku){
  // simple inline prompt edit (name, cost, status)
  try {
    const newName = prompt('ชื่อใหม่ (leave empty จะไม่เปลี่ยน)', '');
    if(newName === null) return; // cancelled
    const newCost = prompt('ต้นทุน (leave empty จะไม่เปลี่ยน)', '');
    const newStatus = prompt('สถานะ (leave empty จะไม่เปลี่ยน)', '');
    const params = new URLSearchParams();
    params.append('action','update');
    const s = getSession();
    params.append('adminId', s.adminId);
    params.append('adminPassword', s.adminPassword);
    params.append('sku', sku);
    if(newName) params.append('name', newName);
    if(newCost) params.append('cost', newCost);
    if(newStatus) params.append('status', newStatus);
    const res = await fetch(APPS_SCRIPT_URL + '?' + params.toString());
    const j = await res.json();
    if(j && j.ok) loadProducts();
    else alert('Update failed: ' + (j && j.error ? j.error : 'unknown'));
  } catch(err){
    console.error(err); alert('Network error');
  }
}

async function onDelete(sku){
  if(!confirm('ลบสินค้า ' + sku + ' ?')) return;
  const s = getSession();
  const params = new URLSearchParams();
  params.append('action','delete');
  params.append('adminId', s.adminId);
  params.append('adminPassword', s.adminPassword);
  params.append('sku', sku);
  try{
    const res = await fetch(APPS_SCRIPT_URL + '?' + params.toString());
    const j = await res.json();
    if(j && j.ok) loadProducts(); else alert('Delete failed: ' + (j && j.error? j.error : 'unknown'));
  } catch(err){ console.error(err); alert('Network error'); }
}

async function onInOut(sku, type){
  const qtyStr = prompt(`${type === 'in' ? 'จำนวนรับเข้า' : 'จำนวนตัดออก'}:`, '1');
  if(qtyStr === null) return;
  const qty = Number(qtyStr);
  if(Number.isNaN(qty) || qty <= 0){ alert('จำนวนไม่ถูกต้อง'); return; }
  const note = prompt('หมายเหตุ (optional)', '') || '';
  const s = getSession();
  const params = new URLSearchParams();
  params.append('action','history_add');
  params.append('adminId', s.adminId);
  params.append('adminPassword', s.adminPassword);
  params.append('sku', sku);
  params.append('actionType', type);
  params.append('qty', String(qty));
  params.append('note', note);
  try {
    const res = await fetch(APPS_SCRIPT_URL + '?' + params.toString());
    const j = await res.json();
    if(j && j.ok) loadProducts();
    else alert('Operation failed: ' + (j && j.error? j.error : 'unknown'));
  } catch(err){ console.error(err); alert('Network error'); }
}

/* ---------------------------
   Optional: quick debug helper (expose to window)
   --------------------------- */
window.ST = {
  loadProducts,
  uploadImage
};

/* ---------------------------
   End of admin.js
   --------------------------- */

/*
  NOTE about test image available in this session:
  If you want to test upload with a local sample file that was uploaded here,
  the path is: /mnt/data/97f24d84-7019-4ff3-9506-4e0311a4e9e4.png
  (Use the file picker on the page to pick a real file from your computer when testing.)
*/
