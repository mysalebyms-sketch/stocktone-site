/*
 admin.js - StockTone Admin Panel (Full)
 Assumes: admin.html structure + config.js (APPS_SCRIPT_URL)
 Minimal, readable, maintainable. (Thai UI)
*/

// ---------- Utilities ----------
function esc(s){ return String(s==null?'':s).replace(/[&<>"'`=\\/]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;','=':'&#61;','/':'&#47;','\\':'\\\\'}[c]; }); }

function showMsg(id, msg, isError){
  const el = document.getElementById(id);
  if(!el) return;
  el.textContent = msg || '';
  el.style.color = isError ? 'red' : 'green';
}

// ---------- Config / Session ----------
if(typeof APPS_SCRIPT_URL === 'undefined') console.warn('APPS_SCRIPT_URL not defined - set config.js');

function saveSession(adminId, adminPassword){
  sessionStorage.setItem('adminId', adminId);
  sessionStorage.setItem('adminPassword', adminPassword);
}
function clearSession(){
  sessionStorage.removeItem('adminId');
  sessionStorage.removeItem('adminPassword');
}
function getSession(){
  return {
    adminId: sessionStorage.getItem('adminId') || '',
    adminPassword: sessionStorage.getItem('adminPassword') || ''
  };
}

// ---------- Upload helper (no custom Content-Type -> avoid preflight) ----------
async function uploadImage(file, opts = {}){
  if(!file) throw new Error('No file provided');
  const adminId = opts.adminId || getSession().adminId || '';
  const adminPassword = opts.adminPassword || getSession().adminPassword || '';
  const sku = opts.sku || '';

  // Read file as base64
  const base64 = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result.split(',')[1]);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });

  const params = new URLSearchParams();
  params.append('action','upload_image');
  params.append('adminId', adminId);
  params.append('adminPassword', adminPassword);
  params.append('filename', file.name);
  params.append('contentType', file.type || 'image/png');
  params.append('base64', base64);
  if(sku) params.append('sku', sku);

  const resp = await fetch(APPS_SCRIPT_URL + '?action=upload_image', {
    method: 'POST',
    body: params
  });

  const text = await resp.text();
  try { return JSON.parse(text); } catch(e){ throw new Error('Invalid response: ' + text); }
}

// ---------- API helpers ----------
async function apiGet(params){
  const url = APPS_SCRIPT_URL + '?' + new URLSearchParams(params).toString();
  const r = await fetch(url);
  return r.json();
}
async function apiPost(paramsObj){
  const url = APPS_SCRIPT_URL + '?' + (paramsObj.action ? 'action=' + encodeURIComponent(paramsObj.action) : '');
  // For add/update/delete we use GET-like query (works) or POST simple
  const r = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
    body: new URLSearchParams(paramsObj)
  });
  return r.json();
}

// ---------- UI: Login / Logout ----------
function initLoginUI(){
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const who = document.getElementById('who');
  const loginSection = document.getElementById('loginSection');
  const adminArea = document.getElementById('adminArea');

  function updateState(){
    const s = getSession();
    if(s.adminId && s.adminPassword){
      loginSection.style.display = 'none';
      adminArea.style.display = 'block';
      who.textContent = esc(s.adminId);
    } else {
      loginSection.style.display = 'block';
      adminArea.style.display = 'none';
      who.textContent = '';
    }
  }

  loginBtn.addEventListener('click', async ()=>{
    const adminId = document.getElementById('adminId').value.trim();
    const adminPassword = document.getElementById('adminPassword').value.trim();
    if(!adminId || !adminPassword){ showMsg('loginMsg','กรุณากรอก Admin ID และ Password', true); return; }
    // quick check by calling list with credentials (server validates on write ops; we just store)
    saveSession(adminId, adminPassword);
    showMsg('loginMsg','เข้าสู่ระบบ...', false);
    updateState();
    await loadProducts();
    showMsg('loginMsg','เข้าสู่ระบบเรียบร้อย', false);
  });

  logoutBtn.addEventListener('click', ()=>{
    clearSession();
    updateState();
  });

  updateState();
}

// ---------- UI: Products list ----------
async function loadProducts(q){
  const tbody = document.querySelector('#productTable tbody');
  tbody.innerHTML = '';
  showMsg('listMsg','กำลังโหลด...', false);
  try {
    const params = { action:'list', limit:500 };
    if(q) params.q = q;
    const res = await apiGet(params);
    if(!res.ok){ showMsg('listMsg','โหลดรายการผิดพลาด', true); return; }
    const data = res.data || [];
    if(data.length === 0){ showMsg('listMsg','ไม่มีสินค้า', true); return; }
    data.forEach(p => {
      const tr = document.createElement('tr');
      const imgUrl = p.imageUrl ? esc(p.imageUrl) : '';
      tr.innerHTML = `
        <td>${imgUrl ? '<img src="'+imgUrl+'" style="width:80px;height:80px;object-fit:contain"/>':''}</td>
        <td>${esc(p.sku)}</td>
        <td>${esc(p.name)}</td>
        <td>${esc(p.quantity)}</td>
        <td>${esc(p.cost)}</td>
        <td>${esc(p.status)}</td>
        <td>
          <button class="btn-edit" data-sku="${esc(p.sku)}">แก้ไข</button>
          <button class="btn-in" data-sku="${esc(p.sku)}">รับเข้า</button>
          <button class="btn-out" data-sku="${esc(p.sku)}">ตัดออก</button>
          <button class="btn-delete" data-sku="${esc(p.sku)}">ลบ</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    attachRowEvents();
    showMsg('listMsg','โหลดสำเร็จ', false);
  } catch(err){
    console.error('loadProducts error', err);
    showMsg('listMsg','โหลดรายการผิดพลาด: ' + err.message, true);
  }
}

function attachRowEvents(){
  document.querySelectorAll('.btn-edit').forEach(b => b.onclick = handleEdit);
  document.querySelectorAll('.btn-in').forEach(b => b.onclick = ()=>handleInOut(b.dataset.sku, 'in'));
  document.querySelectorAll('.btn-out').forEach(b => b.onclick = ()=>handleInOut(b.dataset.sku, 'out'));
  document.querySelectorAll('.btn-delete').forEach(b => b.onclick = handleDeleteProduct);
}

// ---------- Add product ----------
async function handleAddProduct(evt){
  evt.preventDefault();
  const form = document.getElementById('addForm');
  const fd = new FormData(form);
  const sku = (fd.get('sku')||'').trim();
  if(!sku){ showMsg('addMsg','SKU ต้องไม่ว่าง', true); return; }
  const name = fd.get('name')||'';
  const quantity = Number(fd.get('quantity')||0);
  const cost = Number(fd.get('cost')||0);
  const status = fd.get('status') || '';
  const category = fd.get('category') || '';
  const fileInput = document.getElementById('fileInput');
  const file = fileInput && fileInput.files && fileInput.files[0];

  showMsg('addMsg','กำลังเพิ่มสินค้า...', false);
  try {
    // If file present, upload first to get imageUrl
    let imageUrl = '';
    if(file){
      const up = await uploadImage(file, { sku: sku }); // uses session credentials
      if(!up || !up.ok) { showMsg('addMsg','อัปโหลดรูปไม่สำเร็จ', true); return; }
      imageUrl = up.imageUrl || '';
    }

    // call add
    const s = getSession();
    const params = {
      action: 'add',
      adminId: s.adminId,
      adminPassword: s.adminPassword,
      sku: sku, name: name, quantity: quantity, cost: cost,
      status: status, imageUrl: imageUrl, category: category
    };
    const res = await apiPost(params);
    if(res && res.ok){
      showMsg('addMsg','เพิ่มสินค้าเรียบร้อย', false);
      form.reset();
      await loadProducts();
    } else {
      showMsg('addMsg','เพิ่มสินค้าไม่สำเร็จ: ' + (res && res.error || 'unknown'), true);
    }
  } catch(err){
    console.error(err);
    showMsg('addMsg','เพิ่มสินค้าไม่สำเร็จ: ' + err.message, true);
  }
}

// ---------- Edit / In/Out / Delete ----------
async function handleEdit(e){
  const sku = e.target.dataset.sku;
  // simple prompt-based edit for brevity
  const name = prompt('ชื่อสินค้าใหม่ (ปล่อยว่าง = ไม่เปลี่ยน):');
  const cost = prompt('ต้นทุน (ปล่อยว่าง = ไม่เปลี่ยน):');
  const status = prompt('สถานะ (ปล่อยว่าง = ไม่เปลี่ยน):');
  const qty = prompt('จำนวน (ปล่อยว่าง = ไม่เปลี่ยน):');
  const s = getSession();
  const payload = { action:'update', adminId:s.adminId, adminPassword:s.adminPassword, sku: sku };
  if(name) payload.name = name;
  if(cost) payload.cost = Number(cost);
  if(status) payload.status = status;
  if(qty) payload.quantity = Number(qty);
  const res = await apiPost(payload);
  if(res && res.ok){ alert('แก้ไขเรียบร้อย'); loadProducts(); } else alert('แก้ไขไม่สำเร็จ: ' + (res && res.error));
}

async function handleInOut(sku, type){
  const q = prompt('จำนวนที่ต้องการ ' + (type==='in'?'รับเข้า':'ตัดออก') + ' (จำนวนเต็ม):');
  if(!q) return;
  const qty = Number(q);
  if(Number.isNaN(qty) || qty <= 0){ alert('จำนวนไม่ถูกต้อง'); return; }
  const s = getSession();
  const params = { action:'history_add', adminId:s.adminId, adminPassword:s.adminPassword, sku: sku, actionType: type, qty: qty, note: (type==='in'?'รับเข้า':'ตัดออก') };
  const res = await apiPost(params);
  if(res && res.ok){ alert('บันทึกสำเร็จ'); loadProducts(); } else alert('ผิดพลาด: ' + (res && res.error));
}

async function handleDeleteProduct(e){
  const sku = e.target.dataset.sku;
  if(!confirm('ยืนยันการลบ ' + sku + ' ?')) return;
  const s = getSession();
  const params = { action:'delete', adminId:s.adminId, adminPassword:s.adminPassword, sku: sku };
  const res = await apiPost(params);
  if(res && res.ok){ alert('ลบเรียบร้อย'); loadProducts(); } else alert('ลบไม่สำเร็จ: ' + (res && res.error));
}

// ---------- Init / Events ----------
function initAdmin(){
  initLoginUI();
  // load products when logged in
  document.getElementById('refreshList').addEventListener('click', ()=> loadProducts(document.getElementById('searchBox').value));
  document.getElementById('searchBox').addEventListener('keydown', (e)=> { if(e.key === 'Enter') loadProducts(e.target.value); });
  document.getElementById('addForm').addEventListener('submit', handleAddProduct);
  // attempt auto-load if session exists
  if(getSession().adminId) loadProducts();
}

document.addEventListener('DOMContentLoaded', initAdmin);
