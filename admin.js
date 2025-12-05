// admin.js (Full Version)

let session = {
  adminId: null,
  adminPassword: null
};

// ---------------------------
// LOGIN
// ---------------------------
document.getElementById('loginBtn').addEventListener('click', async () => {
  const id = document.getElementById('adminId').value.trim();
  const pw = document.getElementById('adminPassword').value.trim();
  if (!id || !pw) {
    document.getElementById('loginMsg').textContent = 'กรุณากรอกข้อมูลให้ครบ';
    return;
  }
  session.adminId = id;
  session.adminPassword = pw;
  document.getElementById('loginSection').style.display = 'none';
  document.getElementById('adminArea').style.display = 'block';
  document.getElementById('who').textContent = id;
  loadProducts();
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  session.adminId = null;
  session.adminPassword = null;
  location.reload();
});

// ---------------------------
// ADD PRODUCT
// ---------------------------
document.getElementById('addForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;

  let imageUrl = '';
  const file = document.getElementById('fileInput').files[0];
  if (file) {
    imageUrl = await uploadImage(file);
    if (!imageUrl) {
      document.getElementById('addMsg').textContent = 'อัปโหลดรูปไม่สำเร็จ';
      return;
    }
  }

  const params = new URLSearchParams();
  params.append('action', 'add');
  params.append('adminId', session.adminId);
  params.append('adminPassword', session.adminPassword);
  params.append('sku', f.sku.value);
  params.append('name', f.name.value);
  params.append('quantity', f.quantity.value);
  params.append('cost', f.cost.value);
  params.append('status', f.status.value);
  params.append('category', f.category.value);
  params.append('imageUrl', imageUrl);

  const res = await fetch(APPS_SCRIPT_URL + '?' + params.toString());
  const j = await res.json();

  if (j.ok) {
    document.getElementById('addMsg').textContent = 'เพิ่มสินค้าเรียบร้อย!';
    f.reset();
    loadProducts();
  } else {
    document.getElementById('addMsg').textContent = 'Error: ' + j.error;
  }
});

// ---------------------------
// LOAD PRODUCT LIST
// ---------------------------
document.getElementById('refreshList').addEventListener('click', loadProducts);
document.getElementById('searchBox').addEventListener('input', loadProducts);

async function loadProducts() {
  const q = document.getElementById('searchBox').value.trim();
  const params = new URLSearchParams();
  params.append('action', 'list');
  params.append('limit', '500');
  if (q) params.append('q', q);

  const res = await fetch(APPS_SCRIPT_URL + '?' + params.toString());
  const j = await res.json();

  const tbody = document.querySelector('#productTable tbody');
  tbody.innerHTML = '';

  if (!j.ok) {
    document.getElementById('listMsg').textContent = 'โหลดข้อมูลผิดพลาด';
    return;
  }

  j.data.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><img src="${p.imageUrl || ''}" class="thumb"></td>
      <td>${p.sku}</td>
      <td>${p.name}</td>
      <td>${p.quantity}</td>
      <td>${p.cost}</td>
      <td>${p.status}</td>
      <td><button onclick="editProduct('${p.sku}')">แก้ไข</button></td>
    `;
    tbody.appendChild(tr);
  });
}

// ---------------------------
// EDIT PRODUCT
// ---------------------------
async function editProduct(sku) {
  const newName = prompt('ชื่อสินค้าใหม่:');
  if (!newName) return;

  const params = new URLSearchParams();
  params.append('action', 'update');
  params.append('adminId', session.adminId);
  params.append('adminPassword', session.adminPassword);
  params.append('sku', sku);
  params.append('name', newName);

  const res = await fetch(APPS_SCRIPT_URL + '?' + params.toString());
  const j = await res.json();
  if (j.ok) loadProducts();
  else alert('Error: ' + j.error);
}

// ---------------------------
// UPLOAD IMAGE → APPS SCRIPT
// ---------------------------
async function uploadImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      const payload = {
        action: 'upload_image',
        adminId: session.adminId,
        adminPassword: session.adminPassword,
        filename: file.name,
        contentType: file.type,
        base64: base64
      };

      try {
        const res = await fetch(APPS_SCRIPT_URL + '?action=upload_image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const j = await res.json();
        resolve(j.ok ? j.imageUrl : '');
      } catch (err) {
        resolve('');
      }
    };
    reader.readAsDataURL(file);
  });
}
