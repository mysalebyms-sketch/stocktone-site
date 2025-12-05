// admin.js - StockTone Admin (Phase3 UX polish)
// Requires config.js (APPS_SCRIPT_URL)
// Keep admin credentials in sessionStorage only for demo

/* Minimal docs: saveSession(), getSession() used to store adminId/adminPassword */

function esc(s){ return String(s==null?'':s); }
function showMsg(id,msg,isErr){ const el=document.getElementById(id); if(!el) return; el.textContent = msg||''; el.style.color = isErr ? 'red':'green'; }

// Session
function saveSession(adminId, adminPassword){ sessionStorage.setItem('adminId', adminId); sessionStorage.setItem('adminPassword', adminPassword); }
function clearSession(){ sessionStorage.removeItem('adminId'); sessionStorage.removeItem('adminPassword'); }
function getSession(){ return { adminId: sessionStorage.getItem('adminId')||'', adminPassword: sessionStorage.getItem('adminPassword')||'' }; }

// API helpers
async function apiGet(params){ const url = APPS_SCRIPT_URL + '?' + new URLSearchParams(params).toString(); const r = await fetch(url); return r.json(); }
async function apiPost(paramsObj){ const r = await fetch(APPS_SCRIPT_URL, { method:'POST', body: new URLSearchParams(paramsObj) }); const text = await r.text(); try { return JSON.parse(text); } catch(e) { throw new Error('Invalid JSON: '+text); } }

// Spinner / overlay helpers (must match CSS)
function setLoadingOverlay(on, text){
  const ov = document.getElementById('globalLoading');
  if(!ov) return;
  const t = ov.querySelector('.loading-text');
  if(t) t.textContent = text || 'กำลังทำงาน...';
  if(on) ov.classList.remove('hidden'); else ov.classList.add('hidden');
}

// --- Products load & render (table-based) ---
async function loadProducts(q){
  const tbody = document.querySelector('#productTable tbody');
  if(tbody) tbody.innerHTML = '';
  showMsg('listMsg','กำลังโหลด...', false);
  try{
    setLoadingOverlay(true,'กำลังโหลดรายการสินค้า...');
    const params = { action:'list', limit:500 };
    if(q) params.q = q;
    const res = await apiGet(params);
    setLoadingOverlay(false);
    if(!res.ok){ showMsg('listMsg','โหลดรายการล้มเหลว: '+(res.error||''), true); return; }
    const data = res.data || [];
    const fragment = document.createDocumentFragment();
    data.forEach(p=>{
      const tr = document.createElement('tr');
      tr.dataset.sku = p.sku;
      tr.innerHTML = `
        <td class="td-thumb">${p.imageUrl?'<img src="'+esc(p.imageUrl)+'" alt="'+esc(p.name||p.sku)+'" />':'<div class="thumb-empty">--</div>'}</td>
        <td class="td-sku">${esc(p.sku)}</td>
        <td class="td-name">${esc(p.name)}</td>
        <td class="td-qty">${Number(p.quantity)||0}</td>
        <td class="td-cost">${esc(p.cost)}</td>
        <td class="td-status">${esc(p.status)}</td>
        <td class="td-actions">
          <button class="btn-edit btn-small" data-sku="${esc(p.sku)}" aria-label="edit ${esc(p.sku)}">แก้ไข</button>
        </td>
      `;
      fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);
    attachRowEvents();
    showMsg('listMsg','โหลดสำเร็จ ('+ (data.length) +')', false);
  }catch(err){
    setLoadingOverlay(false);
    console.error(err);
    showMsg('listMsg','ข้อผิดพลาด: '+err.message, true);
  }
}
function attachRowEvents(){
  document.querySelectorAll('.btn-edit').forEach(btn=>{
    btn.onclick = async (e)=> {
      const sku = btn.dataset.sku;
      try{
        setLoadingOverlay(true,'ดึงข้อมูลสินค้า...');
        const res = await apiGet({ action:'get', sku: sku });
        setLoadingOverlay(false);
        if(!res.ok) return alert('ไม่พบสินค้า');
        openEditModal(res.data);
      }catch(err){ setLoadingOverlay(false); alert('ข้อผิดพลาด: '+err.message); }
    };
  });
}

// --- Add product (modal) ---
function createAddModal(){
  if(document.getElementById('addModal')) return document.getElementById('addModal');
  const wrap = document.createElement('div'); wrap.id='addModal'; wrap.className='modal hidden';
  wrap.innerHTML = `
    <div class="modal-panel card">
      <button class="modal-close" id="addCancel">&times;</button>
      <h3>เพิ่มสินค้าใหม่</h3>
      <div class="grid-2">
        <label>SKU <input id="add_sku"></label>
        <label>หมวดหมู่ <input id="add_category"></label>
        <label class="full">ชื่อ <input id="add_name"></label>
        <label>จำนวน <input id="add_quantity" type="number" min="0" value="0"></label>
        <label>ต้นทุน <input id="add_cost" type="number" min="0" value="0"></label>
        <label class="full">สถานะ <input id="add_status" value="active"></label>
        <label class="full">รูป <input id="add_file" type="file" accept="image/*"></label>
      </div>
      <div class="modal-actions">
        <button id="addSave" class="btn">เพิ่ม</button>
      </div>
      <div id="addMsg" class="muted small"></div>
    </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('#addCancel').addEventListener('click', ()=> wrap.classList.add('hidden'));
  wrap.querySelector('#addSave').addEventListener('click', performAddProduct);
  return wrap;
}
function openAddModal(){ createAddModal(); document.getElementById('addModal').classList.remove('hidden'); }
async function performAddProduct(){
  const sku = document.getElementById('add_sku').value.trim();
  if(!sku){ showMsg('addMsg','SKU ต้องไม่ว่าง', true); return; }
  const name = document.getElementById('add_name').value||'';
  const q = Number(document.getElementById('add_quantity').value||0);
  const cost = Number(document.getElementById('add_cost').value||0);
  const status = document.getElementById('add_status').value||'';
  const category = document.getElementById('add_category').value||'';
  const file = document.getElementById('add_file').files[0];
  const addMsg = document.getElementById('addMsg');
  addMsg.textContent = ''; addMsg.style.color=''; 
  const addBtn = document.getElementById('addSave');
  addBtn.disabled = true; addBtn.textContent = 'กำลังบันทึก...';
  try{
    let imageUrl = '';
    if(file){
      const up = await uploadImageFile(file, sku);
      if(!up.ok) throw new Error(up.error||'upload failed');
      imageUrl = up.imageUrl;
    }
    const s = getSession();
    const params = { action:'add', adminId:s.adminId, adminPassword:s.adminPassword, sku:sku, name:name, quantity:q, cost:cost, status:status, imageUrl:imageUrl, category:category };
    const res = await apiPost(params);
    if(res.ok){
      addMsg.style.color='green'; addMsg.textContent='เพิ่มเรียบร้อย';
      // clear fields
      document.getElementById('add_sku').value=''; document.getElementById('add_name').value=''; document.getElementById('add_quantity').value='0';
      document.getElementById('add_cost').value='0'; document.getElementById('add_status').value='active'; document.getElementById('add_category').value=''; document.getElementById('add_file').value='';
      // close modal after short delay and reload table
      setTimeout(()=>{ document.getElementById('addModal').classList.add('hidden'); loadProducts(); }, 600);
    } else {
      addMsg.style.color='red'; addMsg.textContent = 'ผิดพลาด: '+(res.error||'unknown');
    }
  }catch(err){
    console.error(err);
    addMsg.style.color='red'; addMsg.textContent = 'ข้อผิดพลาด: '+err.message;
  } finally {
    addBtn.disabled = false; addBtn.textContent = 'เพิ่ม';
  }
}

// helper upload (base64) - reuse from prior code
async function uploadImageFile(file, sku){
  if(!file) return { ok:false, error:'no file' };
  const s = getSession();
  const base64 = await new Promise((res,rej)=>{
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
  try { return JSON.parse(text); } catch(e){ return { ok:false, error:'Invalid response' }; }
}

// --- Edit modal combined (openEditModal & saveEdit) ---
function createEditModal(){
  if(document.getElementById('editModal')) return document.getElementById('editModal');
  const wrap = document.createElement('div'); wrap.id='editModal'; wrap.className='modal hidden';
  wrap.innerHTML = `
     <div class="modal-panel card">
       <button class="modal-close" id="editCancel">&times;</button>
       <h3 id="editTitle">แก้ไขสินค้า</h3>
       <div class="grid-2">
         <label>SKU <input id="edit_sku"></label>
         <label>หมวดหมู่ <input id="edit_category"></label>
         <label class="full">ชื่อ <input id="edit_name"></label>
         <label>จำนวน <input id="edit_quantity" type="number" min="0"></label>
         <label>ต้นทุน <input id="edit_cost" type="number" min="0"></label>
         <label class="full">สถานะ <input id="edit_status"></label>
         <label class="full">รูปใหม่ <input id="edit_file" type="file" accept="image/*"></label>
       </div>
       <div class="modal-actions">
         <label><input id="softDelete" type="checkbox"> Soft delete</label>
         <button id="btnIn" class="btn">รับเข้า</button>
         <button id="btnOut" class="btn btn-outline">ตัดออก</button>
         <button id="btnDelete" class="btn btn-danger">ลบ</button>
         <button id="editSave" class="btn">บันทึก</button>
       </div>
       <div id="editMsg" class="muted small"></div>
     </div>`;
  document.body.appendChild(wrap);

  // basic bindings
  wrap.querySelector('#editCancel').addEventListener('click', ()=> wrap.classList.add('hidden'));
  wrap.querySelector('#editSave').addEventListener('click', async ()=> {
    const orig = wrap.dataset.originalSku;
    await saveEdit(orig);
  });
  wrap.querySelector('#btnIn').addEventListener('click', ()=> openInOutFromEdit('in'));
  wrap.querySelector('#btnOut').addEventListener('click', ()=> openInOutFromEdit('out'));
  // delete
  wrap.querySelector('#btnDelete').addEventListener('click', async ()=>{
    if(!confirm('ยืนยันการลบสินค้านี้?')) return;
    const soft = document.getElementById('softDelete').checked;
    const sku = document.getElementById('edit_sku').value.trim();
    const btn = wrap.querySelector('#btnDelete');
    btn.disabled = true; const prev = btn.textContent; btn.textContent = 'กำลังลบ...';
    try{
      const s = getSession();
      const params = { action:'delete', adminId:s.adminId, adminPassword:s.adminPassword, sku: sku };
      if(!soft) params.hard = 'true';
      const res = await apiPost(params);
      if(res && res.ok){
        alert('ลบเรียบร้อย');
        wrap.classList.add('hidden');
        loadProducts();
      } else {
        alert('ลบไม่สำเร็จ: ' + (res && res.error));
      }
    }catch(err){ console.error('Delete error', err); alert('ข้อผิดพลาด: '+err.message); }
    finally{ btn.disabled=false; btn.textContent = prev; }
  });

  return wrap;
}

function openEditModal(product){
  const modal = createEditModal();
  modal.classList.remove('hidden');
  modal.dataset.originalSku = product.sku;
  document.getElementById('editTitle').textContent = 'แก้ไข — ' + product.sku;
  document.getElementById('edit_sku').value = product.sku;
  document.getElementById('edit_name').value = product.name || '';
  document.getElementById('edit_quantity').value = Number(product.quantity)||0;
  document.getElementById('edit_cost').value = Number(product.cost)||0;
  document.getElementById('edit_status').value = product.status || '';
  document.getElementById('edit_category').value = product.category || '';
  document.getElementById('edit_file').value = '';
  document.getElementById('editMsg').textContent = '';
}

async function saveEdit(originalSku){
  const newSku = document.getElementById('edit_sku').value.trim();
  const name = document.getElementById('edit_name').value || '';
  const quantity = Number(document.getElementById('edit_quantity').value || 0);
  const cost = Number(document.getElementById('edit_cost').value || 0);
  const status = document.getElementById('edit_status').value || '';
  const category = document.getElementById('edit_category').value || '';
  const file = document.getElementById('edit_file').files[0];
  const msgEl = document.getElementById('editMsg'); msgEl.style.color=''; msgEl.textContent='กำลังบันทึก...';
  const saveBtn = document.getElementById('editSave'); saveBtn.disabled=true; const prevTxt = saveBtn.textContent; saveBtn.textContent='กำลังบันทึก...';
  try{
    let imageUrl;
    if(file){
      const up = await uploadImageFile(file, newSku || originalSku);
      if(!up.ok) throw new Error(up.error||'upload failed');
      imageUrl = up.imageUrl;
    }
    const s = getSession();
    const params = { action:'update', adminId:s.adminId, adminPassword:s.adminPassword, sku: originalSku, name: name, quantity: quantity, cost: cost, status: status, category: category };
    if(imageUrl) params.imageUrl = imageUrl;
    if(newSku && newSku !== originalSku) params.skuNew = newSku;
    const res = await apiPost(params);
    if(res && res.ok){ msgEl.style.color='green'; msgEl.textContent='บันทึกสำเร็จ'; setTimeout(()=>{ document.getElementById('editModal').classList.add('hidden'); loadProducts(); }, 500); }
    else { msgEl.style.color='red'; msgEl.textContent = 'ผิดพลาด: ' + (res && res.error); }
  }catch(err){ console.error(err); msgEl.style.color='red'; msgEl.textContent = 'ผิดพลาด: '+err.message; }
  finally{ saveBtn.disabled=false; saveBtn.textContent=prevTxt; }
}

// --- In/Out (history_add) ---
async function performInOut(sku, type, qty, note){
  const s = getSession();
  const params = { action:'history_add', adminId:s.adminId, adminPassword:s.adminPassword, sku: sku, actionType: type, qty: qty, note: note||'' };
  const res = await apiPost(params);
  if(!res || !res.ok) throw new Error(res && res.error || 'in/out failed');
  return res;
}
function openInOutFromEdit(type){
  const sku = document.getElementById('edit_sku').value.trim();
  const qty = prompt((type==='in' ? 'จำนวนที่รับเข้า:' : 'จำนวนที่ตัดออก:'), '1');
  if(qty === null) return;
  const qnum = Number(qty);
  if(!qnum || qnum <= 0){ alert('กรุณากรอกจำนวนเป็นตัวเลขมากกว่า 0'); return; }
  const note = prompt('หมายเหตุ (optional):','') || '';
  performInOut(sku, type, qnum, note).then(r=>{ alert('บันทึกเรียบร้อย'); loadProducts(); }).catch(e=> alert('ผิดพลาด: '+e.message));
}

// --- Init UI ---
function initAdmin(){
  // mount loading overlay element
  if(!document.getElementById('globalLoading')){
    const d = document.createElement('div'); d.id='globalLoading'; d.className='global-loading hidden';
    d.innerHTML = '<div class="loading-panel"><div class="loading-spinner"></div><div class="loading-text">กำลังโหลด...</div></div>';
    document.body.appendChild(d);
  }

  // login
  const loginBtn = document.getElementById('loginBtn');
  if(loginBtn) loginBtn.addEventListener('click', ()=>{
    const id = document.getElementById('adminId').value.trim();
    const pw = document.getElementById('adminPassword').value.trim();
    if(!id || !pw){ showMsg('loginMsg','กรุณากรอก Admin ID และ Password', true); return; }
    saveSession(id,pw);
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('adminArea').style.display = 'block';
    document.getElementById('who').textContent = id;
    loadProducts();
  });

  const logoutBtn = document.getElementById('logoutBtn');
  if(logoutBtn) logoutBtn.addEventListener('click', ()=> { clearSession(); location.reload(); });

  // open add button if present
  const openAdd = document.getElementById('openAddBtn');
  if(openAdd) openAdd.addEventListener('click', openAddModal);

  // bind static actions if exist
  const addForm = document.getElementById('addForm');
  if(addForm){ addForm.style.display='none'; if(!document.getElementById('openAddBtn')){
    const btn = document.createElement('button'); btn.id='openAddBtn'; btn.className='btn'; btn.textContent='เพิ่มสินค้า'; addForm.parentNode.insertBefore(btn, addForm); btn.addEventListener('click', openAddModal);
  }}

  // search
  const sb = document.getElementById('searchBox');
  const rb = document.getElementById('refreshList');
  if(rb) rb.addEventListener('click', ()=> loadProducts(sb && sb.value || ''));
  if(sb) sb.addEventListener('keydown', (e)=> { if(e.key==='Enter') loadProducts(sb.value); });

  // initial
  const session = getSession();
  if(session.adminId && session.adminPassword){
    document.getElementById('loginSection').style.display='none';
    document.getElementById('adminArea').style.display='block';
    document.getElementById('who').textContent = session.adminId;
    loadProducts();
  }
}
document.addEventListener('DOMContentLoaded', initAdmin);
