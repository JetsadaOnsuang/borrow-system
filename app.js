(function () {
  "use strict";

  const STORAGE_KEY = "it-inventory-v1";
  const initialData = {
    equipment: [
      { id: "eq-laptop", name: "โน้ตบุ๊ก Dell Latitude", category: "คอมพิวเตอร์", quantity: 12 },
      { id: "eq-monitor", name: "จอภาพ Dell 24 นิ้ว", category: "จอภาพ", quantity: 8 },
      { id: "eq-projector", name: "โปรเจกเตอร์ Epson", category: "อุปกรณ์นำเสนอ", quantity: 4 },
      { id: "eq-headset", name: "ชุดหูฟังประชุม", category: "อุปกรณ์เสริม", quantity: 15 },
      { id: "eq-tablet", name: "แท็บเล็ต Samsung", category: "อุปกรณ์พกพา", quantity: 6 }
    ],
    loans: []
  };

  function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
      return structuredClone(initialData);
    }
    const data = JSON.parse(stored);
    if (!data || !Array.isArray(data.equipment) || !Array.isArray(data.loans)) {
      throw new Error("ข้อมูลในเบราว์เซอร์ไม่ถูกต้อง กรุณาล้างข้อมูลเว็บไซต์แล้วโหลดใหม่");
    }
    return data;
  }

  let data;
  try {
    data = loadData();
  } catch (error) {
    document.body.innerHTML = "";
    const message = document.createElement("p");
    message.textContent = "ไม่สามารถเปิดข้อมูลระบบได้: " + error.message;
    message.style.cssText = "margin:32px;font:16px sans-serif;color:#a33";
    document.body.append(message);
    return;
  }

  const byId = (id) => document.getElementById(id);
  const toast = byId("toast");
  const DEMO_ACCOUNTS = {
    User: { password: "User1234", role: "user", roleLabel: "ผู้ยืมอุปกรณ์" },
    Admin: { password: "Admin1234", role: "admin", roleLabel: "ผู้ดูแลระบบ" }
  };
  const SESSION_KEY = "it-inventory-user";
  let toastTimer;

  function setAuthenticated(username) {
    const account = DEMO_ACCOUNTS[username];
    document.body.classList.toggle("authenticated", Boolean(account));
    document.body.classList.toggle("admin-user", account?.role === "admin");
    if (account) {
      sessionStorage.setItem(SESSION_KEY, username);
      byId("current-user").textContent = username;
      byId("current-role").textContent = account.roleLabel;
      byId("borrow-form").elements.borrower.value = username;
      byId("borrow-form").elements.borrower.readOnly = true;
    } else {
      sessionStorage.removeItem(SESSION_KEY);
      byId("login-form").reset();
    }
  }

  const existingUser = sessionStorage.getItem(SESSION_KEY);
  setAuthenticated(DEMO_ACCOUNTS[existingUser] ? existingUser : "");
  byId("login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const username = String(values.get("username"));
    const account = DEMO_ACCOUNTS[username];
    if (account && values.get("password") === account.password) {
      byId("login-error").classList.add("hidden");
      setAuthenticated(username);
    } else {
      byId("login-error").classList.remove("hidden");
    }
  });
  byId("logout-button").addEventListener("click", () => setAuthenticated(""));

  function notify(message, isError) {
    toast.textContent = message;
    toast.classList.toggle("error", Boolean(isError));
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      throw new Error("บันทึกข้อมูลไม่สำเร็จ: " + error.message);
    }
  }

  function availableStock(equipment) {
    const borrowed = data.loans
      .filter((loan) => loan.equipmentId === equipment.id && !loan.returnedAt)
      .reduce((total, loan) => total + loan.quantity, 0);
    return equipment.quantity - borrowed;
  }

  function borrowEquipment({ borrower, equipmentId, quantity, dueDate }) {
    const signedInUser = sessionStorage.getItem(SESSION_KEY);
    if (!DEMO_ACCOUNTS[signedInUser] || !document.body.classList.contains("authenticated")) {
      throw new Error("กรุณาเข้าสู่ระบบก่อนทำรายการยืม");
    }
    if (borrower !== signedInUser) throw new Error("ชื่อผู้ยืมต้องตรงกับบัญชีที่เข้าสู่ระบบ");

    const item = data.equipment.find((equipment) => equipment.id === equipmentId);
    if (!item) throw new Error("ไม่พบอุปกรณ์ที่เลือก");
    if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error("จำนวนที่ยืมต้องเป็นจำนวนเต็มตั้งแต่ 1 ชิ้นขึ้นไป");
    if (quantity > availableStock(item)) throw new Error(`อุปกรณ์ไม่เพียงพอ — คงเหลือ ${availableStock(item)} ชิ้น`);

    const loan = {
      id: globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      borrower,
      equipmentId,
      quantity,
      dueDate,
      borrowedAt: new Date().toISOString(),
      returnedAt: null
    };
    data.loans.unshift(loan);
    try {
      saveData();
    } catch (error) {
      data.loans.shift();
      throw error;
    }
    return loan;
  }

  function returnEquipment(loanId) {
    if (DEMO_ACCOUNTS[sessionStorage.getItem(SESSION_KEY)]?.role !== "admin") {
      throw new Error("เฉพาะผู้ดูแลระบบเท่านั้นที่รับคืนอุปกรณ์ได้");
    }
    const loan = data.loans.find((entry) => entry.id === loanId);
    if (!loan || loan.returnedAt) throw new Error("ไม่พบรายการยืมที่ยังค้างคืน");
    loan.returnedAt = new Date().toISOString();
    try {
      saveData();
    } catch (error) {
      loan.returnedAt = null;
      throw error;
    }
  }

  function make(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function renderStats() {
    const total = data.equipment.reduce((sum, item) => sum + item.quantity, 0);
    const available = data.equipment.reduce((sum, item) => sum + availableStock(item), 0);
    byId("stat-total").textContent = total;
    byId("stat-available").textContent = available;
    byId("stat-borrowed").textContent = total - available;
    byId("stat-open").textContent = data.loans.filter((loan) => !loan.returnedAt).length;
  }

  function renderInventory() {
    const body = byId("inventory-body");
    const query = byId("inventory-search").value.trim().toLocaleLowerCase("th");
    body.replaceChildren();
    const filtered = data.equipment.filter((item) => `${item.name} ${item.category}`.toLocaleLowerCase("th").includes(query));
    byId("inventory-empty").classList.toggle("hidden", filtered.length > 0);

    filtered.forEach((item) => {
      const available = availableStock(item);
      const row = document.createElement("tr");
      const nameCell = document.createElement("td");
      const nameWrap = make("div", "equipment-name");
      nameWrap.append(make("span", "item-icon", "▣"), make("span", "", item.name));
      nameCell.append(nameWrap);
      const category = make("td", "", item.category);
      const quantity = make("td", "", item.quantity);
      const availableCell = make("td", "", available);
      const statusCell = document.createElement("td");
      const statusClass = available === 0 ? "out" : available <= 2 ? "low" : "available";
      const statusLabel = available === 0 ? "หมดชั่วคราว" : available <= 2 ? "เหลือน้อย" : "พร้อมยืม";
      statusCell.append(make("span", `badge ${statusClass}`, statusLabel));
      row.append(nameCell, category, quantity, availableCell, statusCell);
      body.append(row);
    });

    const select = byId("equipment-select");
    const previous = select.value;
    select.replaceChildren();
    data.equipment.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = `${item.name} — เหลือ ${availableStock(item)} ชิ้น`;
      option.disabled = availableStock(item) === 0;
      select.append(option);
    });
    if (data.equipment.some((item) => item.id === previous && availableStock(item) > 0)) select.value = previous;
    if (!data.equipment.some((item) => availableStock(item) > 0)) select.append(new Option("ไม่มีอุปกรณ์พร้อมให้ยืม", "", true, true));
  }

  function renderLoans() {
    const list = byId("loan-list");
    list.replaceChildren();
    byId("loans-empty").classList.toggle("hidden", data.loans.length > 0);

    data.loans.slice(0, 12).forEach((loan) => {
      const item = data.equipment.find((equipment) => equipment.id === loan.equipmentId);
      const row = make("div", "loan-row");
      const main = make("div", "loan-main");
      main.append(make("span", "loan-avatar", "↗"));
      const details = document.createElement("div");
      details.append(make("div", "loan-title", item ? item.name : "อุปกรณ์ที่ไม่ทราบชื่อ"));
      details.append(make("div", "loan-sub", `${loan.borrower} · ${loan.quantity} ชิ้น`));
      main.append(details);
      const meta = make("div", "loan-meta", loan.returnedAt ? "คืนแล้ว" : `กำหนดคืน ${loan.dueDate}`);
      const action = loan.returnedAt
        ? make("span", "returned-label loan-action", "คืนแล้ว")
        : make("button", "return-button loan-action", "รับคืน");
      if (!loan.returnedAt) {
        action.type = "button";
        action.addEventListener("click", () => {
          try {
            returnEquipment(loan.id);
            render();
            notify("บันทึกการคืนอุปกรณ์แล้ว");
          } catch (error) {
            notify(error.message, true);
          }
        });
        if (DEMO_ACCOUNTS[sessionStorage.getItem(SESSION_KEY)]?.role !== "admin") {
          action.disabled = true;
          action.title = "เฉพาะผู้ดูแลระบบเท่านั้นที่รับคืนอุปกรณ์ได้";
          action.classList.add("disabled-action");
        }
      }
      row.append(main, meta, action);
      list.append(row);
    });
  }

  function render() {
    renderStats();
    renderInventory();
    renderLoans();
  }

  byId("borrow-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const borrower = String(values.get("borrower")).trim();
    const dueDate = String(values.get("dueDate"));
    if (!borrower || !dueDate) {
      notify("กรุณากรอกข้อมูลให้ครบถ้วน", true);
      return;
    }
    try {
      borrowEquipment({
        borrower,
        equipmentId: String(values.get("equipmentId")),
        quantity: Number(values.get("quantity")),
        dueDate
      });
      form.reset();
      form.elements.quantity.value = "1";
      render();
      notify("บันทึกรายการยืมเรียบร้อย");
    } catch (error) {
      notify(error.message, true);
    }
  });

  byId("add-item-toggle").addEventListener("click", () => {
    byId("add-item-form").classList.toggle("hidden");
  });

  byId("add-item-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (DEMO_ACCOUNTS[sessionStorage.getItem(SESSION_KEY)]?.role !== "admin") {
      notify("เฉพาะผู้ดูแลระบบเท่านั้นที่เพิ่มอุปกรณ์ได้", true);
      return;
    }
    const form = event.currentTarget;
    const values = new FormData(form);
    const name = String(values.get("name")).trim();
    const category = String(values.get("category")).trim();
    const quantity = Number(values.get("quantity"));
    if (!name || !category || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000) {
      notify("กรุณาตรวจสอบชื่อ หมวดหมู่ และจำนวนอุปกรณ์", true);
      return;
    }
    data.equipment.unshift({
      id: globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      category,
      quantity
    });
    try {
      saveData();
      form.reset();
      form.classList.add("hidden");
      render();
      notify("เพิ่มอุปกรณ์ในคลังแล้ว");
    } catch (error) {
      data.equipment.shift();
      notify(error.message, true);
    }
  });

  byId("inventory-search").addEventListener("input", renderInventory);
  byId("today").textContent = new Intl.DateTimeFormat("th-TH", { dateStyle: "long" }).format(new Date());
  byId("borrow-form").elements.dueDate.min = new Date().toISOString().slice(0, 10);
  render();

  window.ITInventory = { borrowEquipment };
})();
