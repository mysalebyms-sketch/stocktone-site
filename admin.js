/* admin.js - StockTone Admin Panel (Full) with Edit modal (image/sku/name/cost/status/category) */

/* -------- Utilities -------- */
function esc(s){ return String(s==null?'':s).replace(/[&<>"'`=\\/]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;','=':'&#61;','/':'&#47;','\\':'\\\\'}[c])); }
function showMsg(id, msg, isError){ const el=document.getElementById(id); if(!el) return; el.textContent=msg||''; el.style.color=isError? 'red':'green'; }

/* -------- Config / Session -------- */
if(typeof APPS_SCRIPT_URL === 'undefined') console.warn('APPS_SCRIPT_URL not defined - set config.js');
function saveSession(adminId, adminPassword){ sessionStorage.setItem('adminId', adminId); sessionStorage.setItem('adminPassword', adminPassword); }
function clearSession(){ sessionStorage.removeItem('adminId'); sessionStorage.removeItem('adminPassword'); }
function getSession(){ return { adminId: sessionStorage.getItem('adminId')||'', adminPassword: sessionStorage.getItem('adminPassword')||'' }; }

/* -------- API helpers -------- */
async function apiGet(params){
  const url = APPS_SCRIPT_URL + '?' + new URLSearchParams(params).toString();
  const r = await fetch(url);
  return r.json();
}
async function apiPost(paramsObj){
  const r = await fetch(APPS_SCRIPT_URL, { method:'POST', body: new URLSearchParams(paramsObj) });
  return r.json();
}

/* -------- Upload helper (base64 via URLSearchParams) -------- */
async function uploadImage(file, opts = {}){
  if(!file) throw new Error('No file provided');
  const s = getSession();
  const adminId = opts.adminId || s.adminId;
  const adminPassword = opts.adminPassword || s.adminPassword;
  const sku = opts.sku || '';
  const base64 = await new Promise((res, rej)=>{
    const fr = new FileReader();
    fr.onload = ()=> res(fr.result.split(',')[1]);
    fr.onerror = rej;
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
  const resp = await fetch(APPS_SCRIPT_URL + '?action=upload_image', { method:'POST', body: params });
  const text = await resp.text();
  try { return JSON.parse(text); } catch(e){ throw new Error('Invalid response from upload: ' + text); }
}

/* -------- UI: Login / Logout -------- */
function initLoginUI(){
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const who = document.getElementById('who');
  const loginSection = document.getElementById('loginSection');
  const adminArea = document.getElementById('adminArea');
  function updateState(){
    const s = getSession();
    if(s.adminId && s.adminPassword){ loginSection.style.display='none'; adminArea.style.display='block'; who.textContent = esc(s.adminId); }
    else { loginSection.style.display='block'; adminArea.style.display='none'; who.textContent=''; }
  }
  loginBtn.addEventListener('click', async ()=>{
    const adminId = document.getElementById('adminId').value.trim();
    const adminPassword = document.getElementById('adminPassword').value.trim();
    if(!adminId || !adminPassword){ showMsg('loginMsg','กรุณากรอก Admin ID และ Password', true); return; }
    saveSession(adminId, adminPassword);
    showMsg('loginMsg','เข้าสู่ระบบ...', false);
    updateState();
    await loadProducts();
    showMsg('loginMsg','เข้าสู่ระบบเรียบร้อย', false);
  });
  logoutBtn && logoutBtn.addEventListener('click', ()=>{ clearSession(); updateState(); });
  updateState();
}

/* -------- Products list & events -------- */
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
        <td>${imgUrl ? '<img src="'+imgUrl+'" style="width:70px;height:70px;object-fit:cover;border-radius:6px"/>':''}</td>
        <td>${esc(p.sku)}</td>
        <td>${esc(p.name)}</td>
        <td>${esc(p.quantity)}</td>
        <td>${esc(p.cost)}</td>
        <td>${esc(p.status)}</td>
        <td class="table-action">
          <button class="btn-edit" data-sku="${esc(p.sku)}">แก้ไข</button>
          <button class="btn-in" data-sku="${esc(p.sku)}">รับเข้า</button>
          <button class="btn-out" data-sku="${esc(p.sku)}">ตัดออก</button>
          <button class="btn-delete" data-sku="${esc(p.sku)}">ลบ</button>
        </td>`;
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
  document.querySelectorAll('.btn-in').forEach(b => b.onclick = ()=>openInOutModal(b.dataset.sku, 'in'));
  document.querySelectorAll('.btn-out').forEach(b => b.onclick = ()=>openInOutModal(b.dataset.sku, 'out'));
  document.querySelectorAll('.btn-delete').forEach(b => b.onclick = handleDeleteProduct);
}

/* -------- Add product -------- */
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
    let imageUrl = '';
    if(file){
      const up = await uploadImage(file, { sku: sku });
      if(!up || !up.ok) { showMsg('addMsg','อัปโหลดรูปไม่สำเร็จ', true); return; }
      imageUrl = up.imageUrl || '';
    }
    const s = getSession();
    const params = { action: 'add', adminId: s.adminId, adminPassword: s.adminPassword, sku: sku, name: name, quantity: quantity, cost: cost, status: status, imageUrl: imageUrl, category: category };
    const res = await apiPost(params);
    if(res && res.ok){ showMsg('addMsg','เพิ่มสินค้าเรียบร้อย', false); form.reset(); await loadProducts(); }
    else { showMsg('addMsg','เพิ่มสินค้าไม่สำเร็จ: ' + (res && res.error || 'unknown'), true); }
  } catch(err){ console.error(err); showMsg('addMsg','เพิ่มสินค้าไม่สำเร็จ: ' + err.message, true); }
}

/* -------- Delete product -------- */
async function handleDeleteProduct(e){
  const sku = e.target.dataset.sku;
  if(!confirm('ยืนยันการลบ ' + sku + ' ?')) return;
  const s = getSession();
  const params = { action:'delete', adminId:s.adminId, adminPassword:s.adminPassword, sku: sku };
  const res = await apiPost(params);
  if(res && res.ok){ alert('ลบเรียบร้อย'); loadProducts(); } else alert('ลบไม่สำเร็จ: ' + (res && res.error));
}

/* -------- In/Out modal (existing) -------- */
function createInOutModal(){
  if(document.getElementById('inoutModal')) return document.getElementById('inoutModal');
  const wrap = document.createElement('div');
  wrap.id = 'inoutModal';
  wrap.style = 'position:fixed;left:0;top:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);z-index:9999;';
  wrap.innerHTML = `
    <div style="width:360px;background:#fff;border-radius:6px;padding:16px;box-shadow:0 6px 24px rgba(0,0,0,0.2);">
      <h3 id="inoutTitle" style="margin:0 0 8px 0;font-size:18px"></h3>
      <div style="margin-bottom:8px;">
        <label style="display:block;font-size:13px;margin-bottom:4px">จำนวน</label>
        <input id="inoutQty" type="number" min="1" style="width:100%;padding:8px;font-size:14px" />
      </div>
      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:13px;margin-bottom:4px">หมายเหตุ (optional)</label>
        <input id="inoutNote" type="text" style="width:100%;padding:8px;font-size:14px" />
      </div>
      <div style="text-align:right;">
        <button id="inoutCancel" style="margin-right:8px;padding:8px 12px">ยกเลิก</button>
        <button id="inoutConfirm" style="padding:8px 12px">ยืนยัน</button>
      </div>
      <div id="inoutMsg" style="margin-top:8px;font-size:13px"></div>
    </div>
  `;
  document.body.appendChild(wrap);
  wrap.querySelector('#inoutCancel').addEventListener('click', ()=>{ wrap.style.display='none'; });
  return wrap;
}
function openInOutModal(sku, type){
  const modal = createInOutModal();
  modal.style.display = 'flex';
  document.getElementById('inoutTitle').textContent = (type==='in' ? 'รับเข้าสินค้า' : 'ตัดออกสินค้า') + ' — ' + sku;
  const qtyEl = document.getElementById('inoutQty');
  const noteEl = document.getElementById('inoutNote');
  const msgEl = document.getElementById('inoutMsg');
  qtyEl.value = '';
  noteEl.value = '';
  msgEl.textContent = '';
  const confirmBtn = document.getElementById('inoutConfirm');
  const newConfirm = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
  newConfirm.addEventListener('click', async ()=>{
    const q = Number(qtyEl.value);
    if(!q || q <= 0){ msgEl.style.color='red'; msgEl.textContent = 'กรุณากรอกจำนวนที่ถูกต้อง (>0)'; return; }
    newConfirm.disabled = true; newConfirm.textContent = 'กำลังบันทึก...';
    try {
      await performInOut(sku, type, q, noteEl.value || '');
      msgEl.style.color='green'; msgEl.textContent = 'บันทึกสำเร็จ';
      setTimeout(()=>{ modal.style.display='none'; newConfirm.disabled=false; newConfirm.textContent='ยืนยัน'; loadProducts(); }, 600);
    } catch(err){
      console.error('InOut error', err);
      msgEl.style.color='red'; msgEl.textContent = 'ผิดพลาด: ' + (err.message||err);
      newConfirm.disabled=false; newConfirm.textContent='ยืนยัน';
    }
  });
}
async function performInOut(sku, type, qty, note){
  const s = getSession();
  const params = { action:'history_add', adminId:s.adminId, adminPassword:s.adminPassword, sku: sku, actionType: type, qty: qty, note: note || '' };
  const res = await apiPost(params);
  if(!res || !res.ok) throw new Error(res && res.error ? res.error : 'ไม่สามารถบันทึกได้');
  return res;
}

/* -------- Edit modal (NEW) -------- */
function createEditModal(){
  if(document.getElementById('editModal')) return document.getElementById('editModal');
  const wrap = document.createElement('div');
  wrap.id = 'editModal';
  wrap.style = 'position:fixed;left:0;top:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);z-index:10000;visibility:hidden';
  wrap.innerHTML = `
    <div style="width:420px;background:#fff;border-radius:8px;padding:18px;box-shadow:0 8px 30px rgba(0,0,0,0.25);">
      <h3 id="editTitle" style="margin:0 0 10px 0">แก้ไขสินค้า</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <label>SKU<input id="editSku" style="width:100%"></label>
        <label>หมวดหมู่<input id="editCategory" style="width:100%"></label>
        <label style="grid-column:1 / 3">ชื่อ<input id="editName" style="width:100%"></label>
        <label>จำนวน<input id="editQuantity" type="number" min="0"></label>
        <label>ต้นทุน<input id="editCost" type="number" min="0"></label>
        <label style="grid-column:1 / 2">สถานะ<input id="editStatus" style="width:100%"></label>
        <label style="grid-column:1 / 3">รูปปัจจุบัน<div id="editImagePreview" style="margin-top:6px"></div></label>
        <label style="grid-column:1 / 3">อัปโหลดรูปใหม่<input id="editFile" type="file" accept="image/*"></label>
      </div>
      <div style="text-align:right;margin-top:12px">
        <button id="editCancel" style="margin-right:8px">ยกเลิก</button>
        <button id="editSave" class="btn-success">บันทึก</button>
      </div>
      <div id="editMsg" style="margin-top:8px"></div>
    </div>
  `;
  document.body.appendChild(wrap);
  wrap.querySelector('#editCancel').addEventListener('click', ()=>{ wrap.style.visibility='hidden'; });
  return wrap;
}

/* open edit modal with prefilled values */
function openEditModal(product){
  const modal = createEditModal();
  modal.style.visibility = 'visible';
  document.getElementById('editTitle').textContent = 'แก้ไขสินค้า — ' + product.sku;
  document.getElementById('editSku').value = product.sku;
  document.getElementById('editName').value = product.name || '';
  document.getElementById('editQuantity').value = Number(product.quantity) || 0;
  document.getElementById('editCost').value = Number(product.cost) || 0;
  document.getElementById('editStatus').value = product.status || '';
  document.getElementById('editCategory').value = product.category || '';
  const preview = document.getElementById('editImagePreview');
  preview.innerHTML = product.imageUrl ? `<img src="${esc(product.imageUrl)}" style="width:84px;height:84px;object-fit:cover;border-radius:6px">` : 'ไม่มีรูป';
  document.getElementById('editFile').value = '';
  document.getElementById('editMsg').textContent = '';

  const saveBtn = document.getElementById('editSave');
  const newSave = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newSave, saveBtn);
  newSave.addEventListener('click', async ()=>{
    await performEdit(product.sku);
  });
}

/* perform edit logic: upload image if provided, then update or add/delete when SKU changed */
async function performEdit(originalSku){
  const s = getSession();
  const modal = document.getElementById('editModal');
  const msgEl = document.getElementById('editMsg');
  const newSku = document.getElementById('editSku').value.trim();
  const name = document.getElementById('editName').value.trim();
  const quantity = Number(document.getElementById('editQuantity').value || 0);
  const cost = Number(document.getElementById('editCost').value || 0);
  const status = document.getElementById('editStatus').value.trim();
  const category = document.getElementById('editCategory').value.trim();
  const fileEl = document.getElementById('editFile');
  const file = fileEl && fileEl.files && fileEl.files[0];

  msgEl.style.color = 'black'; msgEl.textContent = 'กำลังบันทึก...';
  document.getElementById('editSave').disabled = true;

  try {
    let imageUrl = null;
    if(file){
      const up = await uploadImage(file, { sku: newSku || originalSku });
      if(!up || !up.ok) throw new Error('อัปโหลดรูปไม่สำเร็จ');
      imageUrl = up.imageUrl;
    }

    if(newSku !== originalSku){
      // check if newSku exists
      const check = await apiGet({ action:'list', q: newSku, limit:1 });
      if(check && check.data && check.data.some(it => (''+it.sku) === newSku)){
        throw new Error('SKU ใหม่ซ้ำอยู่แล้ว โปรดเลือก SKU อื่น');
      }
      // create new row with newSku
      const addParams = {
        action:'add', adminId: s.adminId, adminPassword: s.adminPassword,
        sku: newSku, name: name, quantity: quantity, cost: cost, status: status, category: category
      };
      if(imageUrl) addParams.imageUrl = imageUrl;
      const addRes = await apiPost(addParams);
      if(!addRes || !addRes.ok) throw new Error('ไม่สามารถสร้าง SKU ใหม่: ' + (addRes && addRes.error));
      // delete old sku (soft delete)
      const delRes = await apiPost({ action:'delete', adminId: s.adminId, adminPassword: s.adminPassword, sku: originalSku });
      if(!delRes || !delRes.ok) console.warn('Delete old sku failed:', delRes);
      msgEl.style.color = 'green'; msgEl.textContent = 'บันทึกสำเร็จ (เปลี่ยน SKU)';
      setTimeout(()=>{ modal.style.visibility='hidden'; loadProducts(); }, 700);
    } else {
      // SKU unchanged -> update
      const upd = { action:'update', adminId: s.adminId, adminPassword: s.adminPassword, sku: originalSku };
      if(name !== undefined) upd.name = name;
      if(!Number.isNaN(quantity)) upd.quantity = quantity;
      if(!Number.isNaN(cost)) upd.cost = cost;
      if(status !== undefined) upd.status = status;
      if(category !== undefined) upd.category = category;
      if(imageUrl) upd.imageUrl = imageUrl;
      const res = await apiPost(upd);
      if(!res || !res.ok) throw new Error(res && res.error ? res.error : 'update failed');
      msgEl.style.color = 'green'; msgEl.textContent = 'บันทึกสำเร็จ';
      setTimeout(()=>{ modal.style.visibility='hidden'; loadProducts(); }, 500);
    }
  } catch(err){
    console.error('performEdit error', err);
    msgEl.style.color = 'red'; msgEl.textContent = 'ผิดพลาด: ' + (err.message || err);
  } finally {
    document.getElementById('editSave').disabled = false;
  }
}

/* -------- handleEdit (open modal with product data) -------- */
async function handleEdit(e){
  const sku = e.target.dataset.sku;
  const res = await apiGet({ action:'get', sku: sku });
  if(!res || !res.ok){ alert('ไม่พบข้อมูลสินค้า'); return; }
  const p = res.data;
  openEditModal(p);
}

/* -------- Init / Events -------- */
function initAdmin(){
  initLoginUI();
  document.getElementById('refreshList').addEventListener('click', ()=> loadProducts(document.getElementById('searchBox').value));
  document.getElementById('searchBox').addEventListener('keydown', (ev)=>{ if(ev.key === 'Enter') loadProducts(ev.target.value); });
  document.getElementById('addForm').addEventListener('submit', handleAddProduct);
  if(getSession().adminId) loadProducts();
}
document.addEventListener('DOMContentLoaded', initAdmin);
