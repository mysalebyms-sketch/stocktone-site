// catalog.js — แสดงสินค้าแบบ Grid Card

document.addEventListener("DOMContentLoaded", () => {
  const cards = document.getElementById("cards");
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");
  const filterCategory = document.getElementById("filterCategory");
  const filterStatus = document.getElementById("filterStatus");
  const clearFilters = document.getElementById("clearFilters");

  loadCatalog();

  // ---------- LOAD CATALOG ----------
  async function loadCatalog(params = {}) {
    cards.innerHTML = `<div class="loading-overlay"><div class="lds-dual-ring"></div></div>`;

    const query = new URLSearchParams();
    query.append("action", "list");
    query.append("limit", "200");

    if (params.q) query.append("q", params.q);
    if (params.category) query.append("category", params.category);
    if (params.status) query.append("status", params.status);

    try {
      const res = await fetch(`${APPS_SCRIPT_URL}?${query.toString()}`);
      const json = await res.json();

      if (!json.ok || !json.data) {
        cards.innerHTML = `<div class='empty-state'>ไม่พบข้อมูลสินค้า</div>`;
        return;
      }

      renderCards(json.data);

    } catch (err) {
      console.error(err);
      cards.innerHTML = `<div class='empty-state'>โหลดข้อมูลล้มเหลว</div>`;
    }
  }

  // ---------- RENDER ----------
  function renderCards(list) {
    cards.innerHTML = "";

    if (!list.length) {
      cards.innerHTML = `<div class="empty-state">ไม่พบสินค้า</div>`;
      return;
    }

    list.forEach(item => {
      const img = item.imageUrl || "";
      const price = Number(item.cost || 0).toLocaleString();
      const qty = Number(item.quantity || 0);

      const card = document.createElement("div");
      card.className = "product-card";

      card.innerHTML = `
        <div class="thumb">
          <img src="${img}" alt="" onerror="this.src='https://via.placeholder.com/400x300?text=No+Image';">
        </div>

        <div class="product-body">
          <h3 class="product-title">${item.name || "-"}</h3>

          <div class="product-price">${price} บาท</div>

          <div class="muted">สถานะ: ${item.status || "-"}</div>
          <div class="muted">คงเหลือ: ${qty}</div>

          <button class="btn-detail" data-sku="${item.sku}">ดูรายละเอียด</button>

          <div class="qty-controls">
            <button class="btn-minus">-</button>
            <span class="qty-value">0</span>
            <button class="btn-plus">+</button>
          </div>
        </div>
      `;

      cards.appendChild(card);
    });
  }

  // ---------- SEARCH ----------
  searchBtn.addEventListener("click", () => {
    loadCatalog({
      q: searchInput.value.trim()
    });
  });

  // ---------- FILTERS ----------
  clearFilters.addEventListener("click", () => {
    filterCategory.value = "";
    filterStatus.value = "";
    searchInput.value = "";
    loadCatalog();
  });

  filterCategory.addEventListener("change", () => {
    loadCatalog({
      category: filterCategory.value
    });
  });

  filterStatus.addEventListener("change", () => {
    loadCatalog({
      status: filterStatus.value
    });
  });
});
