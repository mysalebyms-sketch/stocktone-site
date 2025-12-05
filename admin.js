// admin.js - Admin panel: add / edit / delete with modal, image upload, spinner, toast
// Requires: config.js defining APPS_SCRIPT_URL

(() => {
  const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="100%" height="100%" fill="#f4f4f4"/></svg>`
  );

  // DOM helpers
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  // Spinner / toast (reuse style.css classes .global-spinner and .toast)
  function ensureSpinner(){
    if($('#globalSpinner')) return;
    const g = document.createElement('div'); g.id='globalSpinner'; g.className='global-spinner';
    g.innerHTML = `<div class="loading-panel"><div class="loading-spinner" aria-hidden="true"></div><div><div class="loading-text">Working</div><div class="muted small" id="globalSpinnerText"></div></div></div>`;
    document.body.appendChild(g);
  }
  function showSpinner(text='กำลังทำงาน...'){ ensureSpinner(); $('#globalSpinnerText').textContent = text; $('#globalSpinner').classList.add('show'); }
  function hideSpinner(){ const g = $('#globalSpinner'); if(g) g.classList.remove('show'); }

  function toast(msg, ms=2400){
    let t = document.getElementById('_ct_toast');
    if(!t){ t = document.createElement('div'); t.id='_ct_toast'; t.className='toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._timer); t._timer = setTimeout(()=> t.classList.remove('show'), ms);
  }

  // API helpers (POST + GET)
  const APPS = (typeof APPS_SCRIPT_URL === 'undefined' ? '' : APPS_SCRIPT_URL);

  async function apiGet(params){
    const url = APPS + '?' + new URLSearchParams(params).toString();
    const res = await fetch(url);
    return res.json();
  }

  // Post JSON
  async function apiPostJson(payload){
    const res = await fetch(APPS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  // Post form-encoded (URLSearchParams)
  async function apiPostForm(obj){
    const body = new URLSearchParams();
    Object.keys(obj).forEach(k => { if(obj[k] !== undefined && obj[k] !== null) body.append(k, obj[k]); });
    const res = await fetch(APPS, { method:'POST', body });
    return res.json();
  }

  // ========== Modal builders (Add / Edit / Confirm) ==========
  function createModalAddEdit(){
    if($('#admModal')) return $('#admModal');
    const m = document.createElement('div'); m.id='admModal'; m.className='modal';
    m.innerHTML = `
      <div class="modal-panel">
        <button class="modal-close" title="close">&times;</button>
        <h3 id="modalTitle">เพิ่มสินค้า</h3>
        <form id="productForm" style="margin-top:12px; display:grid; gap:10px;">
          <div class="grid-2">
            <label>SKU<input name="sku" required class="input"></label>
            <label>หมวดหมู่<input name="category" class="input"></label>
          </div>
          <label>ชื่อสินค้า<input name="name" class="input"></label>
          <div class="grid-2">
            <label>จำนวน<input name="quantity" type="number" min="0" class="input"></label>
            <label>ต้นทุน<input name="cost" type="number" min="0" class="input"></label>
          </div>
          <label>สถานะ
            <select name="status" class="select">
              <option value="active">active</option>
              <option value="พร้อมส่ง">พร้อมส่ง</option>
              <option value="deleted">deleted</option>
            </select>
          </label>
          <label>คำอธิบาย<textarea name="description" rows="3" class="input"></textarea></label>
          <label>รูปภาพ (ไฟล์)
            <input type="file" name="file" accept="image/*" />
          </label>

          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;">
            <button type="button" id="saveBtn" class="btn">บันทึก</button>
            <button type="button" id="cancelBtn" class="btn-ghost">ยกเลิก</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(m);
    m.querySelector('.modal-close').addEventListener('click', ()=> m.classList.remove('show'));
    m.querySelector('#cancelBtn').addEventListener('click', ()=> m.classList.remove('show'));
    return m;
  }

  function openAddModal(prefill){
    const m = createModalAddEdit(); m.classList.add('show');
    $('#modalTitle').textContent = prefill ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า';
    const form = $('#productForm');
    form.reset();
    // remove any existing dataset
    form.dataset.sku = '';
    if(prefill){
      form.sku.value = prefill.sku || '';
      form.name.value = prefill.name || '';
      form.category.value = prefill.category || '';
      form.quantity.value = prefill.quantity || 0;
      form.cost.value = prefill.cost || 0;
      form.status.value = prefill.status || 'active';
      form.description.value = prefill.description || '';
      form.dataset.sku = prefill.sku || '';
    }
    $('#saveBtn').onclick = onSaveProduct;
  }

  function createConfirm(){
    if($('#confirmBox')) return $('#confirmBox');
    const c = document.createElement('div'); c.id='confirmBox'; c.className='modal';
    c.innerHTML = `<div class="modal-panel"><div style="padding:6px 0;"><strong id="confirmTitle">ยืนยัน</strong><p id="confirmMsg" class="muted small"></p></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px"><button id="confirmYes" class="btn">ตกลง</button><button id="confirmNo" class="btn-ghost">ยกเลิก</button></div></div>`;
    document.body.appendChild(c);
    c.querySelector('#confirmNo').addEventListener('click', ()=> c.classList.remove('show'));
    return c;
  }

  // ========== Image upload utility (reads file, sends base64 to Apps Script upload_image) ==========
  async function uploadImageFile(file, sku){
    if(!file) return null;
    // read file => base64
    const base64 = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => {
        // fr.result is "data:...;base64,XXXX"
        const parts = fr.result.split(',');
        res(parts[1]);
      };
      fr.onerror = (e) => rej(e);
      fr.readAsDataURL(file);
    });
    // call upload_image endpoint (POST JSON)
    const payload = { action:'upload_image', adminId: sessionStorage.getItem('adminId') || '', adminPassword: sessionStorage.getItem('adminPassword') || '', base64: base64, filename: file.name, contentType: file.type || 'image/png', sku: sku || '' };
    try{
      showSpinner('กำลังอัปโหลดรูป...');
      const r = await apiPostJson(payload);
      hideSpinner();
      if(r && r.ok && r.imageUrl) return r.imageUrl;
      console.warn('uploadImageFile response:', r);
      return null;
    }catch(err){ hideSpinner(); console.error(err); return null; }
  }

  // ========== Save (add/edit) handler ==========
  async function onSaveProduct(){
    const form = $('#productForm');
    // disable save
    const saveBtn = $('#saveBtn'); saveBtn.disabled = true;
    const data = {};
    data.sku = form.sku.value && form.sku.value.trim();
    data.name = form.name.value && form.name.value.trim();
    data.category = form.category.value && form.category.value.trim();
    data.quantity = Number(form.quantity.value) || 0;
    data.cost = Number(form.cost.value) || 0;
    data.status = form.status.value || 'active';
    data.description = form.description.value || '';

    if(!data.sku){ toast('โปรดระบุ SKU'); saveBtn.disabled=false; return; }
    if(!data.name){ toast('โปรดระบุชื่อสินค้า'); saveBtn.disabled=false; return; }

    // check if editing (dataset.sku present)
    const editingSku = form.dataset.sku || '';
    try{
      showSpinner(editingSku ? 'กำลังอัพเดต...' : 'กำลังเพิ่มสินค้า...');
      // image upload if provided
      const fileInput = form.querySelector('input[type=file]');
      let uploadedUrl = null;
      if(fileInput && fileInput.files && fileInput.files.length){
        uploadedUrl = await uploadImageFile(fileInput.files[0], data.sku);
      }

      if(editingSku){
        // update existing -> call action=update (supports sku rename with skuNew)
        const payload = {
          action: 'update',
          adminId: sessionStorage.getItem('adminId') || '',
          adminPassword: sessionStorage.getItem('adminPassword') || '',
          sku: editingSku,
          name: data.name,
          quantity: data.quantity,
          cost: data.cost,
          status: data.status,
          category: data.category,
          description: data.description
        };
        // if user changed SKU value, instruct rename via skuNew
        if(editingSku !== data.sku) payload.skuNew = data.sku;
        if(uploadedUrl) payload.imageUrl = uploadedUrl;
        const res = await apiPostForm(payload);
        hideSpinner();
        if(!res || !res.ok){ toast('อัปเดตสินค้าล้มเหลว'); console.warn(res); saveBtn.disabled=false; return; }
        toast('อัปเดตสำเร็จ');
      } else {
        // add new
        const payload = {
          action: 'add',
          adminId: sessionStorage.getItem('adminId') || '',
          adminPassword: sessionStorage.getItem('adminPassword') || '',
          sku: data.sku, name: data.name, quantity: data.quantity, cost: data.cost, status: data.status, category: data.category, description: data.description
        };
        if(uploadedUrl) payload.imageUrl = uploadedUrl;
        const res = await apiPostForm(payload);
        hideSpinner();
        if(!res || !res.ok){ toast('เพิ่มสินค้าล้มเหลว'); console.warn(res); saveBtn.disabled=false; return; }
        toast('เพิ่มสินค้าสำเร็จ');
      }
      $('#admModal').classList.remove('show');
      refreshList();
    }catch(err){
      hideSpinner(); console.error(err); toast('ข้อผิดพลาด'); 
    } finally {
      saveBtn.disabled = false;
    }
  }

  // ========== Delete ==========
  async function onDeleteSku(sku, hard=false){
    const conf = createConfirm(); conf.classList.add('show');
    $('#confirmTitle').textContent = 'ยืนยันการลบ';
    $('#confirmMsg').textContent = `คุณต้องการลบสินค้า SKU: ${sku} ? (hard=${hard ? 'true' : 'false'})`;
    $('#confirmYes').onclick = async () => {
      conf.classList.remove('show');
      try{
        showSpinner('กำลังลบ...');
        const res = await apiPostForm({ action:'delete', adminId: sessionStorage.getItem('adminId')||'', adminPassword: sessionStorage.getItem('adminPassword')||'', sku: sku, hard: hard ? 'true' : 'false' });
        hideSpinner();
        if(!res || !res.ok){ toast('ลบล้มเหลว'); console.warn(res); return; }
        toast('ลบสำเร็จ');
        refreshList();
      }catch(err){ hideSpinner(); console.error(err); toast('ข้อผิดพลาด'); }
    };
  }

  // ========== Table rendering & actions ==========
  async function refreshList(){
    try{
      showSpinner('โหลดรายการสินค้า...');
      const res = await apiGet({ action:'list', limit: 1000 });
      hideSpinner();
      if(!res || !res.ok){ toast('โหลดรายการล้มเหลว'); return; }
      const rows = res.data || [];
      renderAdminTable(rows);
    }catch(err){ hideSpinner(); console.error(err); toast('ข้อผิดพลาด'); }
  }

  function renderAdminTable(rows){
    const tbody = document.querySelector('#productTable tbody');
    tbody.innerHTML = '';
    rows.forEach(p => {
      const tr = document.createElement('tr');
      const imgCell = document.createElement('td');
      const img = document.createElement('img'); img.src = p.imageUrl || PLACEHOLDER; img.style.width='100px'; img.style.height='100px'; img.style.objectFit='cover'; img.style.borderRadius='8px';
      imgCell.appendChild(img);

      const infoCell = document.createElement('td');
      infoCell.innerHTML = `<div style="font-weight:700">${p.sku || ''}</div>
        <div style="margin-top:6px"><strong>${p.name||''}</strong></div>
        <div style="margin-top:6px" class="muted small">จำนวน: ${Number(p.quantity)||0} &nbsp; ต้นทุน: ${Number(p.cost)||0} &nbsp; สถานะ: ${p.status||''}</div>`;

      const actionCell = document.createElement('td');
      actionCell.style.textAlign='right';
      const editBtn = document.createElement('button'); editBtn.className='btn-outline btn-small'; editBtn.textContent='แก้ไข';
      const delBtn = document.createElement('button'); delBtn.className='btn-danger btn-small'; delBtn.textContent='ลบ';

      editBtn.addEventListener('click', ()=> {
        // open edit modal with prefill
        openAddModal({
          sku: p.sku, name: p.name, category: p.category, quantity: p.quantity, cost: p.cost, status: p.status, description: p.description
        });
      });
      delBtn.addEventListener('click', ()=> onDeleteSku(p.sku, false));

      actionCell.appendChild(editBtn); actionCell.appendChild(document.createTextNode(' ')); actionCell.appendChild(delBtn);

      tr.appendChild(imgCell); tr.appendChild(infoCell); tr.appendChild(actionCell);
      tbody.appendChild(tr);
    });
  }

  // ========== init UI bindings ==========
  function bindUI(){
    $('#openAddBtn').addEventListener('click', ()=> openAddModal(null));
    $('#refreshList').addEventListener('click', ()=> refreshList());

    // search box quick filter (client-side)
    $('#searchBox').addEventListener('input', (e)=> {
      const q = (e.target.value||'').toLowerCase().trim();
      const rows = Array.from(document.querySelectorAll('#productTable tbody tr'));
      rows.forEach(r=>{
        const text = r.textContent.toLowerCase();
        r.style.display = text.includes(q) ? '' : 'none';
      });
    });
  }

  // createConfirm() already referenced above
  function createConfirm(){ if($('#confirmBox')) return $('#confirmBox'); return (function(){ const c = document.createElement('div'); c.id='confirmBox'; c.className='modal'; c.innerHTML = `<div class="modal-panel"><div style="padding:6px 0;"><strong id="confirmTitle">ยืนยัน</strong><p id="confirmMsg" class="muted small"></p></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px"><button id="confirmYes" class="btn">ตกลง</button><button id="confirmNo" class="btn-ghost">ยกเลิก</button></div></div>`; document.body.appendChild(c); c.querySelector('#confirmNo').addEventListener('click', ()=> c.classList.remove('show')); return c; })(); }

  // ========== boot ==========
  document.addEventListener('DOMContentLoaded', ()=>{
    // show admin name if saved in sessionStorage (admin login in your app may set this)
    try{ const id = sessionStorage.getItem('adminId') || ''; if(id) $('#adminName').textContent = id; }catch(e){}
    bindUI();
    refreshList();
  });

})();
