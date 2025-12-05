/* admin.js - StockTone Admin Panel (Full)
   - ใช้ APPS_SCRIPT_URL จาก config.js
   - ใช้ spinner DOM element ที่สร้างโดย JS แต่ CSS อยู่ใน style.css
*/

/* --- Utilities --- */
function esc(s){ return String(s==null?'':s); }
function showMsg(id, msg, isErr){
  const el = document.getElementById(id);
  if(!el) return;
  el.textContent = msg || '';
  el.style.color = isErr ? 'red' : 'green';
}

/* --- session helpers --- */
function saveSession(adminId, adminPassword){ sessionStorage.setItem('adminId', adminId); sessionStorage.setItem('adminPassword', adminPassword); }
function clearSession(){ sessionStorage.removeItem('adminId'); sessionStorage.removeItem('adminPassword'); }
function getSession(){ return { adminId: sessionStorage.getItem('adminId')||'', adminPassword: sessionStorage.getItem('adminPassword')||'' }; }

/* --- API helpers --- */
async function apiGet(params){
  const url = APPS_SCRIPT_URL + '?' + new URLSearchParams(params).toString();
  const r = await fetch(url);
  return r.json();
}
async function apiPost(paramsObj){
  const r = await fetch(APPS_SCRIPT_URL, { method:'POST', body:new URLSearchParams(paramsObj) });
  const text = await r.text();
  try{ return JSON.parse(text); } catch(e){ throw new Error('Invalid JSON from API: '+text); }
}

/* --- spinner DOM (CSS in style.css) --- */
function ensureSpinner(){
  if(document.getElementById('globalSpinnerOverlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'globalSpinnerOverlay';
  overlay.innerHTML = `
    <div id="globalSpinnerBox">
      <div class="spinner" aria-hidden="true"></div>
      <div id="spinnerTextCol">
        <div id="spinnerTitle">กำลังทำงาน...</div>
        <div id="spinnerSub">โปรดรอสักครู่</div>
        <div id="spinnerProgress"><div class="bar"></div></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}
function showSpinner(title, sub){
  ensureSpinner();
  const overlay = document.getElementById('globalSpinnerOverlay');
  if(!overlay) return;
  if(title) (overlay.querySelector('#spinnerTitle')||{textContent:''}).textContent = title;
  if(sub) (overlay.querySelector('#spinnerSub')||{textContent:''}).textContent = sub;
  overlay.classList.add('visible');
}
function hideSpinner(){
  const overlay = document.getElementById('globalSpinnerOverlay');
  if(!overlay) return;
  overlay.classList.remove('visible');
}

/* --- image upload (base64) --- */
async function uploadImage(file, sku){
  if(!file) throw new Error('no file');
  const s = getSession();
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
    const id = (document.getElementById('adminId')||{}).value || '';
    const pw = (document.getElementById('adminPassword')||{}).value || '';
    if(!id || !pw){ showMsg('loginMsg','กรุณากรอก Admin ID และ Password', true); return;}
    saveSession(id.trim(), pw.trim());
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
    showSpinner('กำลังโหลดรายการ', 'เชื่อมต่อกับ Google Sheets...');
    const params = { action:'list', limit:500 };
    if(q) params.q = q;
    const res = await apiGet(params);
    hideSpinner();
    if(!res.ok){ showMsg('listMsg','โหลดรายการล้มเหลว', true); return; }
    const data = res.data || [];
    if(!tbody){ showMsg('listMsg','ไม่มีตาราง DOM', true); return; }
    data.forEach(p=>{
      const tr = document.createElement('tr');

      const imgTd = document.createElement('td');
      imgTd.style.width = '90px';
      if(p.imageUrl){
        const img = document.createElement('img');
        img.src = p.imageUrl;
        img.style.width = '70px';
        img.style.height = '70px';
        img.style.objectFit = 'cover';
        imgTd.appendChild(img);
      }

      const skuTd = document.createElement('td'); skuTd.textContent = p.sku;
      const nameTd = document.createElement('td'); nameTd.textContent = p.name;
      const qtyTd = document.createElement('td'); qtyTd.textContent = p.quantity;
      const costTd = document.createElement('td'); costTd.textContent = p.cost;
      const statusTd = document.createElement('td'); statusTd.textContent = p.status;

      const actionTd = document.createElement('td');
      const btnEdit = document.createElement('button');
      btnEdit.textContent = 'แก้ไข';
      btnEdit.className = 'btn-edit';
      btnEdit.dataset.sku = p.sku;
      btnEdit.style.marginRight = '8px';
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
  }catch(err){
    hideSpinner();
    console.error(err);
    showMsg('listMsg','ข้อผิดพลาด: '+err.message, true);
  }
}
function attachRowEvents(){
  document.querySelectorAll('.btn-edit').forEach(b=> b.onclick = async (e)=>{
    const sku = e.target.dataset.sku;
    try{
      showSpinner('เปิดข้อมูลสินค้า', 'กำลังดึงข้อมูลจาก API...');
      const res = await apiGet({ action:'get', sku: sku });
      hideSpinner();
      if(!res.ok) return alert('ไม่พบสินค้า');
      openEditModal(res.data);
    }catch(err){
      hideSpinner();
      alert('ข้อผิดพลาด: '+err.message);
    }
  });
}

/* --- Add modal --- */
function createAddModal(){
  if(document.getElementById('addModal')) return document.getElementById('addModal');
  const wrap = document.createElement('div');
  wrap.id = 'addModal';
  wrap.className = 'modal-overlay';
  wrap.innerHTML = `
    <div class="modal">
      <h3>เพิ่มสินค้าใหม่</h3>
      <div class="grid-2">
        <label>SKU<input id="add_sku"></label>
        <label>หมวดหมู่<input id="add_category"></label>
        <label style="grid-column:1 / 3">ชื่อ<input id="add_name"></label>
        <label>จำนวน<input id="add_quantity" type="number" value="0" min="0"></label>
        <label>ต้นทุน<input id="add_cost" type="number" value="0" min="0"></label>
        <label style="grid-column:1 / 3">สถานะ<input id="add_status" value="active"></label>
        <label style="grid-column:1 / 3">รูป<input id="add_file" type="file" accept="image/*"></label>
      </div>
      <div style="text-align:right;margin-top:12px;">
        <button id="addCancel" class="secondary">ยกเลิก</button>
        <button id="addSave">เพิ่มสินค้า</button>
      </div>
      <div id="addMsg" class="msg"></div>
    </div>
  `;
  document.body.appendChild(wrap);

  const cancelBtn = wrap.querySelector('#addCancel');
  const saveBtn = wrap.querySelector('#addSave');

  cancelBtn.addEventListener('click', ()=>{
    wrap.style.visibility = 'hidden';
    // clear fields so next open is fresh
    clearAddFields();
    showMsg('addMsg','', false);
  });

  saveBtn.addEventListener('click', performAddProduct);
  // ensure clicking background closes modal
  wrap.addEventListener('click', (ev)=>{ if(ev.target === wrap){ wrap.style.visibility='hidden'; clearAddFields(); } });

  return wrap;
}
function openAddModal(){ createAddModal().style.visibility = 'visible'; }
function clearAddFields(){
  const ids = ['add_sku','add_category','add_name','add_quantity','add_cost','add_status','add_file'];
  ids.forEach(id=>{ const el = document.getElementById(id); if(!el) return; if(el.type === 'file') el.value = ''; else if(el.type === 'number') el.value = 0; else el.value = (id==='add_status'?'active':''); });
  const msg = document.getElementById('addMsg'); if(msg) msg.textContent = '';
}

async function performAddProduct(){
  const sku = (document.getElementById('add_sku')||{}).value.trim();
  if(!sku){ showMsg('addMsg','SKU ต้องไม่ว่าง', true); return; }
  const name = (document.getElementById('add_name')||{}).value || '';
  const quantity = Number((document.getElementById('add_quantity')||{}).value || 0);
  const cost = Number((document.getElementById('add_cost')||{}).value || 0);
  const status = (document.getElementById('add_status')||{}).value || '';
  const category = (document.getElementById('add_category')||{}).value || '';
  const file = (document.getElementById('add_file')||{}).files && document.getElementById('add_file').files[0];

  showMsg('addMsg','กำลังบันทึก...', false);
  showSpinner('เพิ่มสินค้า', 'กำลังอัปโหลดข้อมูล/รูป โปรดรอสักครู่...');
  try{
    let imageUrl = '';
    if(file){
      const up = await uploadImage(file, sku);
      if(!up.ok) throw new Error('Upload failed: '+(up.error||'unknown'));
      imageUrl = up.imageUrl;
    }
    const s = getSession();
    const params = { action:'add', adminId:s.adminId, adminPassword:s.adminPassword, sku:sku, name:name, quantity:quantity, cost:cost, status:status, imageUrl:imageUrl, category:category };
    const res = await apiPost(params);
    hideSpinner();
    if(res.ok){
      showMsg('addMsg','เพิ่มเรียบร้อย', false);
      const wrap = createAddModal();
      wrap.style.visibility = 'hidden';
      clearAddFields();
      // reload products and indicate success quickly
      await loadProducts();
    } else {
      showMsg('addMsg','ผิดพลาด: '+(res.error||'unknown'), true);
    }
  }catch(err){
    hideSpinner();
    console.error(err);
    showMsg('addMsg','ผิดพลาด: '+err.message, true);
  }
}

/* --- Edit modal (รวมการจัดการทั้งหมด) --- */
function createEditModal(){
  if(document.getElementById('editModal')) return document.getElementById('editModal');
  const wrap = document.createElement('div');
  wrap.id = 'editModal';
  wrap.className = 'modal-overlay';
  wrap.innerHTML = `
    <div class="modal">
      <h3 id="editTitle">แก้ไขสินค้า</h3>
      <div class="grid-2">
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
          <button id="btnIn" class="secondary">รับเข้า</button>
          <button id="btnOut" class="secondary">ตัดออก</button>
        </div>
        <div>
          <label style="margin-right:8px"><input id="softDelete" type="checkbox"> Soft delete</label>
          <button id="btnDelete" class="danger">ลบ</button>
          <button id="editCancel" class="secondary">ยกเลิก</button>
          <button id="editSave">บันทึก</button>
        </div>
      </div>
      <div id="editMsg" class="msg"></div>
    </div>
  `;
  document.body.appendChild(wrap);

  wrap.querySelector('#editCancel').addEventListener('click', ()=> { wrap.style.visibility='hidden'; });
  wrap.querySelector('#editSave').addEventListener('click', async ()=>{
    const originalSku = wrap.dataset.originalSku;
    await saveEdit(originalSku);
  });
  wrap.querySelector('#btnIn').addEventListener('click', ()=> openInOutFromEdit('in'));
  wrap.querySelector('#btnOut').addEventListener('click', ()=> openInOutFromEdit('out'));

  // Delete handler improved with spinner & disable
  wrap.querySelector('#btnDelete').addEventListener('click', async ()=>{
    if(!confirm('ยืนยันการลบสินค้านี้?')) return;
    const btn = wrap.querySelector('#btnDelete');
    const soft = document.getElementById('softDelete').checked;
    const sku = (document.getElementById('edit_sku')||{}).value.trim();
    const s = getSession();
    if(!s.adminId || !s.adminPassword){ alert('session หมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง'); return; }

    btn.disabled = true;
    const prevText = btn.textContent;
    btn.textContent = 'กำลังลบ...';
    showSpinner('ลบสินค้า', 'กำลังประมวลผล...');

    try{
      const params = { action:'delete', adminId:s.adminId, adminPassword:s.adminPassword, sku: sku };
      if(!soft) params.hard = 'true';
      const res = await apiPost(params);
      hideSpinner();
      if(res && res.ok){
        alert('ลบเรียบร้อย');
        wrap.style.visibility = 'hidden';
        await loadProducts();
      } else {
        alert('ลบไม่สำเร็จ: ' + (res && res.error ? res.error : 'Unknown error'));
      }
    }catch(err){
      hideSpinner();
      console.error('Delete error:', err);
      alert('ข้อผิดพลาดในการลบ: ' + (err && err.message ? err.message : err));
    } finally {
      btn.disabled = false;
      btn.textContent = prevText;
    }
  });

  // background click closes modal
  wrap.addEventListener('click', (ev)=>{ if(ev.target === wrap) wrap.style.visibility='hidden'; });

  return wrap;
}

function openEditModal(product){
  const modal = createEditModal();
  modal.style.visibility = 'visible';
  modal.dataset.originalSku = product.sku;
  document.getElementById('editTitle').textContent = 'แก้ไข — ' + product.sku;
  document.getElementById('edit_sku').value = product.sku;
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
    img.style.width = '90px';
    img.style.height = '90px';
    img.style.objectFit = 'cover';
    prev.appendChild(img);
  } else prev.textContent = 'ไม่มีรูป';
  document.getElementById('editMsg').textContent = '';
}

/* Save edit (in-place update, backend needs to support skuNew rename) */
async function saveEdit(originalSku){
  const newSku = (document.getElementById('edit_sku')||{}).value.trim();
  const name = (document.getElementById('edit_name')||{}).value || '';
  const quantity = Number((document.getElementById('edit_quantity')||{}).value || 0);
  const cost = Number((document.getElementById('edit_cost')||{}).value || 0);
  const status = (document.getElementById('edit_status')||{}).value || '';
  const category = (document.getElementById('edit_category')||{}).value || '';
  const file = (document.getElementById('edit_file')||{}).files && document.getElementById('edit_file').files[0];
  const msgEl = document.getElementById('editMsg');
  msgEl.style.color='black'; msgEl.textContent='กำลังบันทึก...';
  showSpinner('บันทึกการแก้ไข', 'กำลังอัปเดตข้อมูล โปรดรอสักครู่...');
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
    hideSpinner();
    if(res && res.ok){
      msgEl.style.color='green'; msgEl.textContent='บันทึกสำเร็จ';
      setTimeout(()=>{ createEditModal().style.visibility='hidden'; loadProducts(); }, 450);
    } else {
      msgEl.style.color='red'; msgEl.textContent='ผิดพลาด: ' + (res && res.error);
    }
  }catch(err){
    hideSpinner();
    console.error(err);
    msgEl.style.color='red';
    msgEl.textContent = 'ผิดพลาด: ' + (err && err.message ? err.message : err);
  }
}

/* In/Out */
function openInOutFromEdit(type){
  const sku = (document.getElementById('edit_sku')||{}).value.trim();
  const qty = prompt((type==='in' ? 'จำนวนที่รับเข้า:' : 'จำนวนที่ตัดออก:'), '1');
  if(qty === null) return;
  const qnum = Number(qty);
  if(!qnum || qnum <= 0){ alert('กรุณากรอกจำนวนเป็นตัวเลขมากกว่า 0'); return; }
  const note = prompt('หมายเหตุ (optional):','') || '';
  showSpinner(type === 'in' ? 'บันทึกรับเข้า' : 'บันทึกตัดออก', 'กำลังบันทึกข้อมูล...');
  performInOut(sku, type, qnum, note).then(r=>{
    hideSpinner();
    alert('บันทึกเรียบร้อย');
    loadProducts();
  }).catch(e=>{ hideSpinner(); alert('ผิดพลาด: '+e.message); });
}
async function performInOut(sku, type, qty, note){
  const s = getSession();
  const params = { action:'history_add', adminId:s.adminId, adminPassword:s.adminPassword, sku: sku, actionType: type, qty: qty, note: note||'' };
  const res = await apiPost(params);
  if(!res || !res.ok) throw new Error(res && res.error || 'in/out failed');
  return res;
}

/* --- Init UI --- */
function initAdmin(){
  initLoginUI();

  const openAddBtn = document.getElementById('openAddBtn');
  if(openAddBtn) openAddBtn.addEventListener('click', openAddModal);

  const addForm = document.getElementById('addForm');
  if(addForm){
    addForm.style.display='none';
    if(!document.getElementById('openAddBtn')){
      const btn = document.createElement('button');
      btn.id='openAddBtn';
      btn.textContent='เพิ่มสินค้า';
      addForm.parentNode.insertBefore(btn, addForm);
      btn.addEventListener('click', openAddModal);
    }
  }

  const searchBox = document.getElementById('searchBox');
  if(document.getElementById('refreshList')) document.getElementById('refreshList').addEventListener('click', ()=> loadProducts(searchBox && searchBox.value || ''));
  if(searchBox) searchBox.addEventListener('keydown', (ev)=> { if(ev.key === 'Enter') loadProducts(searchBox.value); });

  // ensure spinner exists
  ensureSpinner();

  // load if session present
  if(getSession().adminId) loadProducts();
}
document.addEventListener('DOMContentLoaded', initAdmin);
