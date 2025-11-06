/* ===========================================
   🌐 Elevium Real-Time Pharma IoT Dashboard
   Full Workflow + Auto Stage Visibility
=========================================== */

const API_BASE = "https://pharma-iot-monitoring.onrender.com/api";

// ========== DOM Elements ==========
const liveTemp = document.getElementById("liveTemp");
const liveHum = document.getElementById("liveHum");
const iotBadge = document.getElementById("iotBadge");
const ledgerContainer = document.getElementById("fullLedger");
const verifyOutput = document.getElementById("patientVerify");
const chartCtx = document.getElementById("iotChart").getContext("2d");

// ========== Chart.js ==========
let chart = new Chart(chartCtx, {
  type: "line",
  data: {
    labels: [],
    datasets: [
      { label: "Temperature (°C)", data: [], borderColor: "#ff7675", fill: false },
      { label: "Humidity (%)", data: [], borderColor: "#74b9ff", fill: false },
    ],
  },
  options: { responsive: true, scales: { y: { beginAtZero: false } } },
});

// ========== Helper Functions ==========
async function getData(url) {
  const res = await fetch(`${API_BASE}${url}`);
  return res.json();
}
async function postData(url, data) {
  const res = await fetch(`${API_BASE}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}
async function putData(url, data) {
  const res = await fetch(`${API_BASE}${url}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

// ========== Notifications ==========
function showToast(msg, type = "info", time = 2500) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => (t.className = "toast"), time);
}
function showConfirm(msg) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-box">
        <h3>Confirm Action</h3>
        <p>${msg}</p>
        <div class="modal-buttons">
          <button id="confirmYes" class="btn primary">Yes</button>
          <button id="confirmNo" class="btn ghost">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#confirmYes").onclick = () => { overlay.remove(); resolve(true); };
    overlay.querySelector("#confirmNo").onclick = () => { overlay.remove(); resolve(false); };
  });
}

// ========== Tabs ==========
const navButtons = document.querySelectorAll(".nav-btn[data-target]");
const panels = document.querySelectorAll(".panel");
navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.target;
    panels.forEach((p) => p.classList.remove("active"));
    document.getElementById(target).classList.add("active");
    navButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

// ========== SUPPLIER ==========
document.getElementById("frmSupplier").onsubmit = async (e) => {
  e.preventDefault();
  const batchId = supplierBatch.value.trim();
  const notes = supplierNotes.value.trim();

  if (!batchId) return showToast("⚠️ Enter batch ID", "alert");

  const confirm = await showConfirm(`Create new shipment for <b>${batchId}</b>?`);
  if (!confirm) return showToast("Cancelled");

  await postData("/batches", { batchId, drugName: notes || "New Drug" });
  await postData("/events", { batchId, actor: "Supplier", action: "Created Shipment", notes });
  showToast("✅ Shipment Created", "success");
  await refreshLedger();
  await refreshStageLists(); // 🔥 update all stages
};

// ========== MANUFACTURER ==========
document.getElementById("frmManufacturer").onsubmit = async (e) => {
  e.preventDefault();
  const batchId = manufactBatch.value.trim();
  const notes = manufactNotes.value.trim();

  const confirm = await showConfirm(`Produce batch <b>${batchId}</b>?`);
  if (!confirm) return showToast("Cancelled");

  await postData("/events", { batchId, actor: "Manufacturer", action: "Produced", notes });
  await updateStage(batchId, "Repackage", "Manufacturer");
  showToast("🏭 Sent to Repackage", "success");
  await refreshLedger();
  await refreshStageLists();
};

// ========== REPACKAGE ==========
document.getElementById("frmRepackage").onsubmit = async (e) => {
  e.preventDefault();
  const batchId = document.getElementById("repackBatch").value.trim();
  const repackBy = document.getElementById("repackBy").value.trim(); // ✅ fixed here

  const confirm = await showConfirm(`Mark <b>${batchId}</b> as repackaged?`);
  if (!confirm) return showToast("Cancelled");

  await postData("/events", { batchId, actor: "Repackage", action: "Repackaged", notes: repackBy });
  await updateStage(batchId, "Distributor", "Repackage");
  showToast("📦 Sent to Distributor", "success");
  await refreshLedger();
  await refreshStageLists();
};

// ========== DISTRIBUTOR ==========
document.getElementById("frmDistributor").onsubmit = async (e) => {
  e.preventDefault();
  const batchId = distBatch.value.trim();
  const vehicle = distVehicle.value.trim();

  const confirm = await showConfirm(`Dispatch <b>${batchId}</b>?`);
  if (!confirm) return showToast("Cancelled");

  await postData("/events", { batchId, actor: "Distributor", action: "Dispatched", notes: vehicle });
  await updateStage(batchId, "Pharmacy", "Distributor");
  showToast("🚚 Sent to Pharmacy", "success");
  await refreshLedger();
  await refreshStageLists();
};

// ========== PHARMACY ==========
document.getElementById("frmPharmacy").onsubmit = async (e) => {
  e.preventDefault();
  const batchId = document.getElementById("pharmBatch").value.trim();
  const pharmId = document.getElementById("pharmId").value.trim(); // ✅ fixed here

  const confirm = await showConfirm(`Receive <b>${batchId}</b> at ${pharmId}?`);
  if (!confirm) return showToast("Cancelled");

  await postData("/events", { batchId, actor: "Pharmacy", action: "Received", notes: pharmId });
  await updateStage(batchId, "Patient", "Pharmacy");
  showToast("🏥 Pharmacy received shipment", "success");
  await refreshLedger();
  await refreshStageLists();
};


document.getElementById("btnMarkSold").onclick = async () => {
  const batchId = pharmBatch.value.trim();
  const confirm = await showConfirm(`Mark <b>${batchId}</b> as sold?`);
  if (!confirm) return showToast("Cancelled");

  await postData("/events", { batchId, actor: "Pharmacy", action: "Sold" });
  await updateStage(batchId, "Delivered", "Pharmacy");
  showToast("💊 Delivered to Patient", "success");
  await refreshLedger();
  await refreshStageLists();
};

// ========== PATIENT ==========
document.getElementById("frmPatient").onsubmit = async (e) => {
  e.preventDefault();
  const batchId = patientBatch.value.trim();
  const data = await getData(`/events/verify/${batchId}`);

  if (!data.length) {
    verifyOutput.innerHTML = `<div class="alert">❌ No records for ${batchId}</div>`;
    return;
  }

  verifyOutput.innerHTML = `
    <h4>📜 Batch History (${batchId})</h4>
    ${data.map(ev => `
      <div><b>${ev.actor}</b> - ${ev.action}<br>
      <small>${new Date(ev.timestamp).toLocaleString()} | ${ev.notes || ""}</small></div>
    `).join("<hr>")}
  `;
};

// ========== LEDGER + IoT ==========
async function refreshLedger() {
  const data = await getData("/events");
  ledgerContainer.innerHTML = data.map(ev => `
    <div class="ledger-entry">
      <b>${ev.batchId}</b> — ${ev.actor} → ${ev.action}
      <br><small>${new Date(ev.timestamp).toLocaleString()} | ${ev.notes || ""}</small>
    </div>
  `).join("<hr>");
}

async function updateStage(batchId, stage, actor) {
  await putData(`/batches/${batchId}/stage`, { stage, actor });
}

async function updateIoT() {
  const data = await getData("/iot");
  const feeds = data.feeds || [];
  if (!feeds.length) return;

  const temps = feeds.map(f => parseFloat(f.field1));
  const hums = feeds.map(f => parseFloat(f.field2));
  const labels = feeds.map(f => new Date(f.created_at).toLocaleTimeString());

  chart.data.labels = labels;
  chart.data.datasets[0].data = temps;
  chart.data.datasets[1].data = hums;
  chart.update();

  const t = temps.at(-1);
  const h = hums.at(-1);
  liveTemp.textContent = t.toFixed(1);
  liveHum.textContent = h.toFixed(1);
  iotBadge.textContent = t > 30 ? "⚠️ Overheat!" : "✅ Normal";
  iotBadge.className = t > 30 ? "badge alert" : "badge normal";
}

// ========== AUTO STAGE VISIBILITY ==========
async function refreshStageLists() {
  const batches = await getData("/batches");
  const stages = ["Supplier", "Manufacturer", "Repackage", "Distributor", "Pharmacy"];

  stages.forEach(stage => {
    const box = document.getElementById(`${stage.toLowerCase()}List`);
    if (!box) return;
    const content = box.querySelector(".stage-content");
    if (!content) return;

    const list = batches.filter(b => b.stage === stage);
    content.innerHTML = list.length
      ? list.map(b => `<div class="stage-item">${b.batchId} — ${b.drugName}</div>`).join("")
      : "<small>No batches currently in this stage.</small>";
  });
}


// ========== INIT ==========
async function init() {
  await refreshLedger();
  await updateIoT();
  await refreshStageLists();
  setInterval(updateIoT, 20000);
  setInterval(refreshStageLists, 10000);
}

init();
