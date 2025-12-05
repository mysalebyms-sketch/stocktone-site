// File: admin.js
/* admin.js - StockTone Admin Panel (Full)
   - In-place update (skuNew)
   - Edit modal combines edit / in / out / delete (hard/soft)
   - Add modal for creating new product
   - Uses APPS_SCRIPT_URL from config.js
*/

/* Utilities (minimal) */
function esc(s){ return String(s==null?'':s); }
function showMsg(id, msg, isErr){ const el=document.getElementById(id); if(!el) return; el.textContent = msg||''; el.style.color = isErr? 'red':'green'; }

/* Session helpers */
function saveSession(adminId, adminPassword){ sessionStorage.setItem('adminId', adminId); sessionStorage.setItem('adminPassword', adminPassword); }
function clearSession(){ sessionStorage.removeItem('adminId'); sessionStorage.removeItem('adminPassword'); }
function getSession(){ return { adminId: sessionStorage.getItem('adminId')||'', adminPassword: sessionStorage.getItem('adminPassword')||'' }; }

/* API helpers */
async function apiGet(params){
  if(typeof APPS_SCRIPT_URL === 'undefined') throw new Error('APPS_SCRIPT_URL not set (config.js)');
  const url = APPS_SCRIPT_URL + '?' + new URLSearchParams(params).toString();
  const r = await fetch(url);
  return r.json();
}
async function apiPost(paramsObj){
  if(typeof APPS_SCRIPT_URL === 'undefined') throw new Error('APPS_SCRIPT_URL not set (config.js)');
  const r = await fetch(APPS_SCRIPT_URL, { method:'POST', body: new URLSearchParams(paramsObj) });
  const text = await r.text();
  try{ return JSON.parse(text); }catch(e){ throw new Error('Invalid JSON from API: '+text); }
}

/* image upload (base64 via URLSearchParams) */
async function uploadImage(file, sku){
  if(!file) throw new Error('no file');
  const s = getSession();
  if(!s.adminId || !s.adminPassword) throw new Error('session missing');
  const base64 = await new Promise((res, rej)=>{
    const fr = new FileReader();
    fr.onload = ()=> res(fr.result.split(',')[1]);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
  const params = new URLSearchParams();
  params.append('action','upload_image');
  params.append('adminId', s.adminId);
  params.append('adminPassword', s.adminPassword);
  params.append('filename', file.name);
  params.append('contentType', file.type || 'image/png');
  params.append('base64', base64);
  if(sku) params.append('sku', sku);
  const resp = await fetch(APPS_SCRIPT_URL + '?action=upload_image', { method:'POST', body: params });
  const text = await resp.text();
  try { return JSON.parse(text); } catch(e){ throw new Error('Upload returned non-JSON: '+text); }
}

/* --- Login UI --- */
function initLoginUI(){
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const who = document.getElementById('who');
  const loginSection = document.getElementById('loginSection');
  const adminArea = document.getElementById('adminArea');
  function updateState(){
    const s = getSession();
    if(s.adminId && s.adminPassword){
      if(loginSection) loginSection.style.display='none';
      if(adminArea) adminArea.style.display='block';
      if(who) who.textContent = esc(s.adminId);
    } else {
      if(loginSection) loginSection.style.display='block';
      if(adminArea) adminArea.style.display='none';
      if(who) who.textContent = '';
    }
  }
  if(loginBtn) loginBtn.addEventListener('click', ()=>{
    const idEl = document.getElementById('adminId');
    const pwEl = document.getElementById('adminPassword');
    const id = idEl ? idEl.value.trim() : '';
    const pw = pwEl ? pwEl.value.trim() : '';
    if(!id||!pw) { showMsg('loginMsg','กรุณากรอก Admin ID และ Password', true); return; }
    saveSession(id,pw);
    updateState();
    loadProducts();
    showMsg('loginMsg','เข้าสู่ระบบแล้ว', false);
  });
  if(logoutBtn) logoutBtn.addEventListener('click', ()=>{ clearSession(); updateState(); });
  updateState();
}

/* --- Product list --- */
async function loadProducts(q){
  const tbody = document.querySelector('#productTable tbody');
  if(tbody) tbody.innerHTML = '';
  showMsg('listMsg','กำลังโหลด...', false);
  try{
    const params = { action:'list', limit:500 };
    if(q) params.q = q;
    const res = await apiGet(params);
    if(!res.ok) { showMsg('listMsg','โหลดรายการล้มเหลว', true); return; }
    const data = res.data || [];
    if(!tbody){ showMsg('listMsg','ไม่มีตาราง DOM', true); return; }
    data.forEach(p=>{
      const tr = document.createElement('tr');
      tr.style.verticalAlign = 'middle';

      const imgTd = document.createElement('td');
      imgTd.style.width = '90px';
      if(p.imageUrl){
        const img = document.createElement('img');
        img.src = p.imageUrl;
        img.style.width='70px'; img.style.height='70px'; img.style.objectFit='cover';
        imgTd.appendChild(img);
      }
      const skuTd = document.createElement('td'); skuTd.textContent = p.sku || '';
      const nameTd = document.createElement('td'); nameTd.textContent = p.name || '';
      const qtyTd = document.createElement('td'); qtyTd.textContent = p.quantity;
      const costTd = document.createElement('td'); costTd.textContent = p.cost;
      const statusTd = document.createElement('td'); statusTd.textContent = p.status || '';
      const actionTd = document.createElement('td');
      actionTd.style.whiteSpace = 'nowrap';

      const btnEdit = document.createElement('button');
      btnEdit.textContent='แก้ไข';
      btnEdit.className='btn-edit';
      btnEdit.dataset.sku = p.sku;

      actionTd.appendChild(btnEdit);
      tr.appendChild(imgTd);
      tr.appendChild(skuTd);
      tr.appendChild(nameTd);
      tr.appendChild(qtyTd);
      tr.appendChild(costTd);
      tr.appendChild(statusTd);
      tr.appendChild(actionTd);
      tbody.appendChild(tr);
    });
    attachRowEvents();
    showMsg('listMsg','โหลดสำเร็จ', false);
  }catch(err){ console.error(err); showMsg('listMsg','ข้อผิดพลาด: '+err.message, true); }
}
function attachRowEvents(){
  document.querySelectorAll('.btn-edit').forEach(b=> b.onclick = async (e)=> {
    const sku = e.target.dataset.sku;
    try{
      const res = await apiGet({ action:'get', sku: sku });
      if(!res || !res.ok) return alert('ไม่พบสินค้า');
      openEditModal(res.data);
    }catch(err){ console.error(err); alert('ข้อผิดพลาด: ' + err.message); }
  });
}

/* ---------- Add modal (improved) ---------- */
function createAddModal(){
  if(document.getElementById('addModal')) return document.getElementById('addModal');
  const wrap = document.createElement('div'); wrap.id='addModal';
  wrap.style = 'position:fixed;left:0;top:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);z-index:9999;visibility:hidden';
  wrap.innerHTML = `
    <div style="width:460px;background:#fff;padding:18px;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,0.2);">
      <h3 style="margin-top:0">เพิ่มสินค้าใหม่</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <label style="font-size:13px">SKU<input id="add_sku" style="width:100%"></label>
        <label style="font-size:13px">หมวดหมู่<input id="add_category" style="width:100%"></label>
        <label style="grid-column:1 / 3;font-size:13px">ชื่อ<input id="add_name" style="width:100%"></label>
        <label style="font-size:13px">จำนวน<input id="add_quantity" type="number" value="0" min="0" style="width:100%"></label>
        <label style="font-size:13px">ต้นทุน<input id="add_cost" type="number" value="0" min="0" style="width:100%"></label>
        <label style="grid-column:1 / 3;font-size:13px">สถานะ<input id="add_status" value="active" style="width:100%"></label>
        <label style="grid-column:1 / 3;font-size:13px">รูป<input id="add_file" type="file" accept="image/*" style="width:100%"></label>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">
        <button id="addCancel" style="padding:8px 12px;border-radius:6px;border:1px solid #ccc;background:#fff;">ยกเลิก</button>
        <button id="addSave" style="padding:8px 14px;border-radius:6px;border:0;background:#2b6ef6;color:#fff;">เพิ่มสินค้า</button>
      </div>
      <div id="addMsg" style="margin-top:10px;min-height:18px;font-size:13px"></div>
    </div>`;
  document.body.appendChild(wrap);

  const btnCancel = wrap.querySelector('#addCancel');
  const btnSave = wrap.querySelector('#addSave');

  btnCancel.addEventListener('click', ()=> {
    wrap.style.visibility='hidden';
    resetAddForm();
  });

  btnSave.addEventListener('click', performAddProduct);

  return wrap;
}
function openAddModal(){
  const modal = createAddModal();
  resetAddForm();
  modal.style.visibility = 'visible';
  setTimeout(()=> { const f = document.getElementById('add_sku'); if(f) f.focus(); }, 60);
}

function resetAddForm(){
  try {
    const elSku = document.getElementById('add_sku');
    if(elSku) elSku.value = '';
    const elCat = document.getElementById('add_category'); if(elCat) elCat.value = '';
    const elName = document.getElementById('add_name'); if(elName) elName.value = '';
    const elQty = document.getElementById('add_quantity'); if(elQty) elQty.value = 0;
    const elCost = document.getElementById('add_cost'); if(elCost) elCost.value = 0;
    const elStatus = document.getElementById('add_status'); if(elStatus) elStatus.value = 'active';
    const f = document.getElementById('add_file'); if(f) f.value = '';
    const msg = document.getElementById('addMsg'); if(msg){ msg.textContent = ''; msg.style.color = ''; }
    const btn = document.querySelector('#addModal #addSave'); if(btn){ btn.disabled = false; btn.textContent = 'เพิ่มสินค้า'; }
  } catch(e){ console.warn('resetAddForm', e); }
}

async function performAddProduct(){
  const btn = document.querySelector('#addModal #addSave');
  const msgEl = document.getElementById('addMsg');
  try{
    const s = getSession();
    if(!s.adminId || !s.adminPassword){ alert('กรุณาเข้าสู่ระบบก่อน'); return; }

    const sku = (document.getElementById('add_sku').value || '').trim();
    if(!sku){ showMsg('addMsg','SKU ต้องไม่ว่าง', true); return; }

    const name = document.getElementById('add_name').value || '';
    const quantity = Number(document.getElementById('add_quantity').value || 0);
    const cost = Number(document.getElementById('add_cost').value || 0);
    const status = document.getElementById('add_status').value || '';
    const category = document.getElementById('add_category').value || '';
    const file = document.getElementById('add_file').files[0];

    if(btn){ btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }
    if(msgEl){ msgEl.style.color = 'black'; msgEl.textContent = 'กำลังอัปโหลดข้อมูล กรุณารอสักครู่...'; }
    await new Promise(res => setTimeout(res, 80));

    let imageUrl = '';
    if(file){
      const up = await uploadImage(file, sku);
      if(!up || !up.ok) throw new Error('อัปโหลดรูปไม่สำเร็จ: ' + (up && up.error ? up.error : 'unknown'));
      imageUrl = up.imageUrl || '';
    }

    const params = {
      action:'add',
      adminId: s.adminId,
      adminPassword: s.adminPassword,
      sku: sku,
      name: name,
      quantity: String(quantity),
      cost: String(cost),
      status: status,
      imageUrl: imageUrl,
      category: category
    };

    const res = await apiPost(params);
    if(res && res.ok){
      if(msgEl){ msgEl.style.color = 'green'; msgEl.textContent = 'เพิ่มสินค้าเรียบร้อย'; }
      resetAddForm();
      setTimeout(()=> {
        const modal = document.getElementById('addModal'); if(modal) modal.style.visibility = 'hidden';
      }, 400);
      await loadProducts();
    } else {
      const err = (res && res.error) ? res.error : 'ไม่ทราบสาเหตุ';
      if(msgEl){ msgEl.style.color = 'red'; msgEl.textContent = 'เพิ่มสินค้าไม่สำเร็จ: ' + err; }
      console.warn('add product failed', res);
    }
  }catch(err){
    console.error('performAddProduct error', err);
    if(msgEl){ msgEl.style.color = 'red'; msgEl.textContent = 'ข้อผิดพลาด: ' + (err && err.message ? err.message : err); }
  } finally {
    const btn2 = document.querySelector('#addModal #addSave');
    if(btn2){ btn2.disabled = false; btn2.textContent = 'เพิ่มสินค้า'; }
  }
}

/* --- Edit modal (รวมการจัดการทั้งหมด) --- */
function createEditModal(){
  if(document.getElementById('editModal')) return document.getElementById('editModal');
  const wrap = document.createElement('div'); wrap.id='editModal';
  wrap.style = 'position:fixed;left:0;top:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);z-index:10000;visibility:hidden';
  wrap.innerHTML = `
  <div style="width:520px;background:#fff;padding:16px;border-radius:8px;">
    <h3 id="editTitle">แก้ไขสินค้า</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <label>SKU<input id="edit_sku"></label>
      <label>หมวดหมู่<input id="edit_category"></label>
      <label style="grid-column:1 / 3">ชื่อ<input id="edit_name"></label>
      <label>จำนวน<input id="edit_quantity" type="number" min="0"></label>
      <label>ต้นทุน<input id="edit_cost" type="number" min="0"></label>
      <label style="grid-column:1 / 3">สถานะ<input id="edit_status"></label>
      <div id="edit_preview" style="grid-column:1 / 3"></div>
      <label style="grid-column:1 / 3">อัปโหลดรูปใหม่<input id="edit_file" type="file" accept="image/*"></label>
    </div>
    <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <button id="btnIn">รับเข้า</button>
        <button id="btnOut">ตัดออก</button>
      </div>
      <div>
        <label style="margin-right:8px"><input id="softDelete" type="checkbox"> Soft delete</label>
        <button id="btnDelete">ลบ</button>
        <button id="editCancel">ยกเลิก</button>
        <button id="editSave">บันทึก</button>
      </div>
    </div>
    <div id="editMsg" style="margin-top:8px"></div>
  </div>`;
  document.body.appendChild(wrap);

  wrap.querySelector('#editCancel').addEventListener('click', ()=> wrap.style.visibility='hidden');
  wrap.querySelector('#editSave').addEventListener('click', async ()=> {
    const originalSku = wrap.dataset.originalSku;
    await saveEdit(originalSku);
  });
  wrap.querySelector('#btnIn').addEventListener('click', ()=> openInOutFromEdit('in'));
  wrap.querySelector('#btnOut').addEventListener('click', ()=> openInOutFromEdit('out'));

  // delete handler (soft/hard)
  wrap.querySelector('#btnDelete').addEventListener('click', async ()=>{
    if(!confirm('ยืนยันการลบสินค้านี้?')) return;
    const btn = wrap.querySelector('#btnDelete');
    const soft = document.getElementById('softDelete').checked;
    const sku = document.getElementById('edit_sku').value.trim();
    const s = getSession();
    if(!s.adminId || !s.adminPassword){ alert('session หมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง'); return; }

    // disable UI
    btn.disabled = true;
    const prevText = btn.textContent;
    btn.textContent = 'กำลังลบ...';

    try{
      const params = { action:'delete', adminId:s.adminId, adminPassword:s.adminPassword, sku: sku };
      if(!soft) params.hard = 'true';
      const res = await apiPost(params);
      if(res && res.ok){
        alert('ลบเรียบร้อย');
        createEditModal().style.visibility = 'hidden';
        await loadProducts();
      } else {
        console.warn('Delete response:', res);
        alert('ลบไม่สำเร็จ: ' + (res && res.error ? res.error : 'Unknown error'));
      }
    } catch(err){
      console.error('Delete error:', err);
      alert('ข้อผิดพลาดในการลบ: ' + (err && err.message ? err.message : err));
    } finally {
      btn.disabled = false;
      btn.textContent = prevText;
    }
  });

  return wrap;
}

function openEditModal(product){
  const modal = createEditModal();
  modal.style.visibility='visible';
  modal.dataset.originalSku = product.sku;
  document.getElementById('editTitle').textContent = 'แก้ไข — ' + product.sku;
  document.getElementById('edit_sku').value = product.sku || '';
  document.getElementById('edit_name').value = product.name || '';
  document.getElementById('edit_quantity').value = Number(product.quantity)||0;
  document.getElementById('edit_cost').value = Number(product.cost)||0;
  document.getElementById('edit_status').value = product.status || '';
  document.getElementById('edit_category').value = product.category || '';
  document.getElementById('edit_file').value = '';
  const prev = document.getElementById('edit_preview'); prev.innerHTML = '';
  if(product.imageUrl){
    const img = document.createElement('img');
    img.src = product.imageUrl;
    img.style.width='90px'; img.style.height='90px'; img.style.objectFit='cover';
    prev.appendChild(img);
  } else prev.textContent = 'ไม่มีรูป';
  document.getElementById('editMsg').textContent = '';
}

/* Save edit: in-place update using skuNew if SKU changed */
async function saveEdit(originalSku){
  const newSku = document.getElementById('edit_sku').value.trim();
  const name = document.getElementById('edit_name').value || '';
  const quantity = Number(document.getElementById('edit_quantity').value || 0);
  const cost = Number(document.getElementById('edit_cost').value || 0);
  const status = document.getElementById('edit_status').value || '';
  const category = document.getElementById('edit_category').value || '';
  const file = document.getElementById('edit_file').files[0];
  const msgEl = document.getElementById('editMsg'); if(msgEl){ msgEl.style.color='black'; msgEl.textContent='กำลังบันทึก...'; }
  try{
    let imageUrl;
    if(file){
      const up = await uploadImage(file, newSku || originalSku);
      if(!up.ok) throw new Error('อัปโหลดรูปไม่สำเร็จ');
      imageUrl = up.imageUrl;
    }
    const s = getSession();
    const params = { action:'update', adminId:s.adminId, adminPassword:s.adminPassword, sku: originalSku, name: name, quantity: quantity, cost: cost, status: status, category: category };
    if(imageUrl) params.imageUrl = imageUrl;
    if(newSku && newSku !== originalSku) params.skuNew = newSku;
    const res = await apiPost(params);
    if(res && res.ok){
      if(msgEl){ msgEl.style.color='green'; msgEl.textContent='บันทึกสำเร็จ'; }
      setTimeout(()=>{ createEditModal().style.visibility='hidden'; loadProducts(); }, 500);
    } else {
      if(msgEl){ msgEl.style.color='red'; msgEl.textContent = 'ผิดพลาด: ' + (res && res.error); }
    }
  }catch(err){
    console.error(err);
    if(msgEl){ msgEl.style.color='red'; msgEl.textContent = 'ผิดพลาด: '+err.message; }
  }
}

/* --- In/Out flow invoked from Edit modal --- */
function openInOutFromEdit(type){
  const sku = document.getElementById('edit_sku').value.trim();
  const qty = prompt((type==='in' ? 'จำนวนที่รับเข้า:' : 'จำนวนที่ตัดออก:'), '1');
  if(qty === null) return;
  const qnum = Number(qty);
  if(!qnum || qnum <= 0){ alert('กรุณากรอกจำนวนเป็นตัวเลขมากกว่า 0'); return; }
  const note = prompt('หมายเหตุ (optional):','') || '';
  performInOut(sku, type, qnum, note).then(r=>{ alert('บันทึกเรียบร้อย'); loadProducts(); }).catch(e=> alert('ผิดพลาด: '+e.message));
}
async function performInOut(sku, type, qty, note){
  const s = getSession();
  const params = { action:'history_add', adminId:s.adminId, adminPassword:s.adminPassword, sku: sku, actionType: type, qty: qty, note: note||'' };
  const res = await apiPost(params);
  if(!res || !res.ok) throw new Error(res && res.error || 'in/out failed');
  return res;
}

/* --- Init UI bindings --- */
function initAdmin(){
  initLoginUI();

  // Add button (if exists) -> open add modal
  const openAddBtn = document.getElementById('openAddBtn');
  if(openAddBtn) openAddBtn.addEventListener('click', openAddModal);

  // Back-compat: if add form exists id=addForm then hide it and create button
  const addForm = document.getElementById('addForm');
  if(addForm){
    addForm.style.display='none';
    if(!document.getElementById('openAddBtn')){
      const btn = document.createElement('button'); btn.id='openAddBtn'; btn.textContent='เพิ่มสินค้า';
      addForm.parentNode.insertBefore(btn, addForm);
      btn.addEventListener('click', openAddModal);
    }
  }

  // search and refresh
  const searchBox = document.getElementById('searchBox');
  const refreshBtn = document.getElementById('refreshList');
  if(refreshBtn) refreshBtn.addEventListener('click', ()=> loadProducts(searchBox && searchBox.value || ''));
  if(searchBox) searchBox.addEventListener('keydown', (ev)=> { if(ev.key === 'Enter') loadProducts(searchBox.value); });

  // load products initially if session exists
  if(getSession().adminId) loadProducts();
}
document.addEventListener('DOMContentLoaded', initAdmin);
