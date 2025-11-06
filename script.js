/* ===========================================
   💊 Elevium Real-Time Pharma IoT Dashboard
   Final Updated script.js — Localhost Ready
=========================================== */

const API_BASE = "http://localhost:5000/api"; // change if needed

// ---------------- DOM references ----------------
const liveTemp = document.getElementById("liveTemp");
const liveHum = document.getElementById("liveHum");
const iotBadge = document.getElementById("iotBadge");
const ledgerContainer = document.getElementById("fullLedger");
const verifyOutput = document.getElementById("patientVerify");
const chartElem = document.getElementById("iotChart");
const chartCtx = chartElem ? chartElem.getContext("2d") : null;

// Forms & inputs
const frmSupplier = document.getElementById("frmSupplier");
const supplierBatch = document.getElementById("supplierBatch");
const supplierNotes = document.getElementById("supplierNotes");

const frmManufacturer = document.getElementById("frmManufacturer");
const manufactBatch = document.getElementById("manufactBatch");
const manufactNotes = document.getElementById("manufactNotes");

const frmRepackage = document.getElementById("frmRepackage");
const repackBatch = document.getElementById("repackBatch");
const repackBy = document.getElementById("repackBy");

const frmDistributor = document.getElementById("frmDistributor");
const distBatch = document.getElementById("distBatch");
const distVehicle = document.getElementById("distVehicle");

const frmPharmacy = document.getElementById("frmPharmacy");
const pharmBatch = document.getElementById("pharmBatch");
const pharmId = document.getElementById("pharmId");
const btnMarkSold = document.getElementById("btnMarkSold");

const frmPatient = document.getElementById("frmPatient");
const patientBatch = document.getElementById("patientBatch");

// Stage boxes
const supplierListBox = document.getElementById("supplierList");
const manufacturerListBox = document.getElementById("manufacturerList");
const repackageListBox = document.getElementById("repackageList");
const distributorListBox = document.getElementById("distributorList");
const pharmacyListBox = document.getElementById("pharmacyList");

// Sidebar action buttons
const btnExport = document.getElementById("btnExport");
const btnClear = document.getElementById("btnClear");

// ---------------- Chart setup ----------------
let chart = null;
if (chartCtx) {
  chart = new Chart(chartCtx, {
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
}

// ---------------- Helper fetch functions ----------------
async function safeFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      // Try to parse JSON error
      let errText = `${res.status} ${res.statusText}`;
      try {
        const json = await res.json();
        if (json.message) errText = json.message;
      } catch {}
      console.error("Fetch failed:", url, errText);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("Network error:", url, err);
    return null;
  }
}

async function getData(path) {
  const r = await safeFetch(`${API_BASE}${path}`);
  return r ?? [];
}
async function postData(path, body) {
  const r = await safeFetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r ?? {};
}
async function putData(path, body) {
  const r = await safeFetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r ?? {};
}

// ---------------- UI helpers ----------------
function showToast(msg, type = "info", time = 2000) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.innerHTML = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => (t.className = "toast"), time);
}

function showConfirm(msg) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-box">
        <h3>Confirm</h3>
        <p>${msg}</p>
        <div class="modal-buttons">
          <button id="yesBtn" class="btn primary">Yes</button>
          <button id="noBtn" class="btn ghost">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#yesBtn").onclick = () => {
      overlay.remove();
      resolve(true);
    };
    overlay.querySelector("#noBtn").onclick = () => {
      overlay.remove();
      resolve(false);
    };
  });
}

// ---------------- Tab navigation ----------------
document.querySelectorAll(".nav-btn[data-target]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    document.getElementById(btn.dataset.target).classList.add("active");
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

// ---------------- Form handlers ----------------
// Supplier create/restock
if (frmSupplier) {
  frmSupplier.onsubmit = async (e) => {
    e.preventDefault();
    const batchIdVal = supplierBatch.value.trim();
    const notesVal = supplierNotes.value.trim();
    if (!batchIdVal) return showToast("Enter Batch ID", "alert");

    const ok = await showConfirm(`Create shipment ${batchIdVal}?`);
    if (!ok) return;

    const res = await postData("/batches", { batchId: batchIdVal, drugName: notesVal || "New Drug" });
    await postData("/events", { batchId: batchIdVal, actor: "Supplier", action: "Created Shipment", notes: notesVal });
    showToast((res && res.message) || "Shipment Created", "success");
    await refreshLedger();
    await refreshStageLists();
    await refreshPharmacyList();
  };
}

// ========== MANUFACTURER ACTIONS ==========

// ✅ Accept shipment from Supplier
btnAcceptShipment.onclick = async () => {
  const batchId = manufactBatch.value.trim();
  const notes = manufactNotes.value.trim();

  if (!batchId) return showToast("Enter batch ID", "alert");

  const confirm = await showConfirm(`Accept batch ${batchId} from Supplier?`);
  if (!confirm) return;

  await postData("/events", { batchId, actor: "Manufacturer", action: "Accepted Shipment", notes });
  await updateStage(batchId, "Manufacturer", "Manufacturer");

  showToast("✅ Shipment Accepted from Supplier", "success");
  await refreshLedger();
  await refreshStageLists();
};

// 📦 Send batch to Repackage stage
btnSendRepackage.onclick = async () => {
  const batchId = manufactBatch.value.trim();
  const notes = manufactNotes.value.trim();

  if (!batchId) return showToast("Enter batch ID", "alert");

  const confirm = await showConfirm(`Send batch ${batchId} to Repackage?`);
  if (!confirm) return;

  await postData("/events", { batchId, actor: "Manufacturer", action: "Produced", notes });
  await updateStage(batchId, "Repackage", "Manufacturer");

  showToast("📦 Sent to Repackage", "success");
  await refreshLedger();
  await refreshStageLists();
};


// Repackage
if (frmRepackage) {
  frmRepackage.onsubmit = async (e) => {
    e.preventDefault();
    const batchIdVal = repackBatch.value.trim();
    const repackByVal = repackBy.value.trim();
    if (!batchIdVal) return showToast("Enter Batch ID", "alert");
    const ok = await showConfirm(`Repackage ${batchIdVal}?`);
    if (!ok) return;
    await postData("/events", { batchId: batchIdVal, actor: "Repackage", action: "Repackaged", notes: repackByVal });
    await updateStage(batchIdVal, "Distributor", "Repackage");
    showToast("Sent to Distributor", "success");
    await refreshLedger();
    await refreshStageLists();
    await refreshPharmacyList();
  };
}

// Distributor
if (frmDistributor) {
  frmDistributor.onsubmit = async (e) => {
    e.preventDefault();
    const batchIdVal = distBatch.value.trim();
    const vehicleVal = distVehicle.value.trim();
    if (!batchIdVal) return showToast("Enter Batch ID", "alert");
    const ok = await showConfirm(`Dispatch ${batchIdVal} via ${vehicleVal || "vehicle"}?`);
    if (!ok) return;
    await postData("/events", { batchId: batchIdVal, actor: "Distributor", action: "Dispatched", notes: vehicleVal });
    await updateStage(batchIdVal, "Pharmacy", "Distributor");
    showToast("Sent to Pharmacy", "success");
    await refreshLedger();
    await refreshStageLists();
    await refreshPharmacyList();
  };
}

// Pharmacy — receive
if (frmPharmacy) {
  frmPharmacy.onsubmit = async (e) => {
    e.preventDefault();
    const batchIdVal = pharmBatch.value.trim();
    const pharmIdVal = pharmId.value.trim();
    if (!batchIdVal) return showToast("Enter Batch ID", "alert");
    const ok = await showConfirm(`Receive batch ${batchIdVal} at ${pharmIdVal || "this pharmacy"}?`);
    if (!ok) return;
    await postData("/events", { batchId: batchIdVal, actor: "Pharmacy", action: "Received", notes: pharmIdVal });
    await updateStage(batchIdVal, "Patient", "Pharmacy");
    showToast("Pharmacy received shipment", "success");
    await refreshLedger();
    await refreshStageLists();
    await refreshPharmacyList();
  };
}

// Mark sold
if (btnMarkSold) {
  btnMarkSold.onclick = async () => {
    const batchIdVal = pharmBatch.value.trim();
    if (!batchIdVal) return showToast("Enter Batch ID", "alert");
    const ok = await showConfirm(`Mark ${batchIdVal} as sold?`);
    if (!ok) return;
    await postData("/events", { batchId: batchIdVal, actor: "Pharmacy", action: "Sold" });
    await updateStage(batchIdVal, "Delivered", "Pharmacy");
    showToast("Marked as sold", "success");
    await refreshLedger();
    await refreshStageLists();
    await refreshPharmacyList();
  };
}

// Patient verify
if (frmPatient) {
  frmPatient.onsubmit = async (e) => {
    e.preventDefault();
    const batchIdVal = patientBatch.value.trim();
    if (!batchIdVal) return showToast("Enter Batch ID", "alert");
    const data = await getData(`/events/verify/${batchIdVal}`);
    if (!data || data.length === 0) {
      verifyOutput.innerHTML = `<div class="alert">No records found</div>`;
      return;
    }
    verifyOutput.innerHTML = data
      .map((ev) => `<div><b>${ev.actor}</b> - ${ev.action}<br><small>${new Date(ev.timestamp).toLocaleString()} | ${ev.notes || ""}</small></div>`)
      .join("<hr>");
  };
}

// ---------------- Stage lists + ledger ----------------
async function refreshStageLists() {
  const batches = await getData("/batches");
  if (!Array.isArray(batches)) return;

  const stages = ["Supplier", "Manufacturer", "Repackage", "Distributor", "Pharmacy"];
  stages.forEach((stage) => {
    const box = document.getElementById(`${stage.toLowerCase()}List`);
    if (!box) return;
    const content = box.querySelector(".stage-content");
    if (!content) return;

    let list = [];
    if (stage === "Manufacturer") {
      const supplierBatches = batches.filter((b) => b.stage === "Supplier");
      const manufBatches = batches.filter((b) => b.stage === "Manufacturer");
      list = [
        ...supplierBatches.map((b) => ({ ...b, label: "🕒 Awaiting Acceptance" })),
        ...manufBatches.map((b) => ({ ...b, label: "✅ In Manufacturing" })),
      ];
    } else {
      list = batches.filter((b) => b.stage === stage).map((b) => ({ ...b, label: "" }));
    }

    content.innerHTML = list.length
      ? list.map((b) => `<div class='stage-item'><b>${b.batchId}</b> — ${b.drugName || ""} <div class='small gray'>${b.label || ""}</div></div>`).join("")
      : "<small>No batches</small>";
  });
}

async function refreshLedger() {
  const events = await getData("/events");
  if (!Array.isArray(events)) {
    ledgerContainer.innerHTML = "<small>Unable to load ledger.</small>";
    return;
  }
  ledgerContainer.innerHTML = events
    .map((ev) => `<div class='ledger-entry'><b>${ev.batchId}</b> — ${ev.actor} → ${ev.action}<br><small>${new Date(ev.timestamp).toLocaleString()} | ${ev.notes || ""}</small></div>`)
    .join("<hr>");
}

// ---------------- Update stage helper ----------------
async function updateStage(batchIdVal, stage, actor) {
  return await putData(`/batches/${batchIdVal}/stage`, { stage, actor });
}

// ---------------- IoT ----------------
async function updateIoT() {
  const data = await getData("/iot");
  if (!data?.feeds?.length) return;
  const temps = data.feeds.map((f) => parseFloat(f.field1) || 0);
  const hums = data.feeds.map((f) => parseFloat(f.field2) || 0);
  const labels = data.feeds.map((f) => new Date(f.created_at).toLocaleTimeString());

  if (chart) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = temps;
    chart.data.datasets[1].data = hums;
    chart.update();
  }

  const t = temps.at(-1);
  const h = hums.at(-1);
  liveTemp.textContent = (t !== undefined && !isNaN(t)) ? t.toFixed(1) : "--";
  liveHum.textContent = (h !== undefined && !isNaN(h)) ? h.toFixed(1) : "--";
  if (t !== undefined && !isNaN(t)) {
    iotBadge.textContent = t > 30 ? "⚠️ Overheat!" : "✅ Normal";
    iotBadge.className = t > 30 ? "badge alert" : "badge normal";
  }
}

// ---------------- Pharmacy list (from Distributor) ----------------
async function refreshPharmacyList() {
  const batches = await getData("/batches");
  if (!Array.isArray(batches)) return;
  const distBatches = batches.filter((b) => b.stage === "Pharmacy");
  // build markup
  const box = document.getElementById("pharmacyList") || (() => {
    const el = document.createElement("div");
    el.id = "pharmacyList";
    el.className = "stage-box";
    return el;
  })();

  box.innerHTML = `
    <h4>🏥 Received from Distributor</h4>
    <div class="stage-content">
      ${
        distBatches.length
          ? distBatches.map(b => `<div class="stage-item"><b>${b.batchId}</b> — ${b.drugName || ""}</div>`).join("")
          : "<small>No shipments yet.</small>"
      }
    </div>
  `;
  // ensure it's inside pharmacy panel
  const pharmSection = document.querySelector("#pharmacy");
  if (pharmSection && !pharmSection.querySelector("#pharmacyList")) {
    pharmSection.appendChild(box);
  }
}


// ========== INIT ==========  
async function init() {
  await refreshLedger();
  await refreshStageLists();
  await refreshBatchOverview();
  if (typeof refreshPharmacyList === "function") await refreshPharmacyList();
  await updateIoT();
  setInterval(updateIoT, 20000);
  setInterval(refreshStageLists, 10000);
  setInterval(refreshPharmacyList, 10000);
  setInterval(refreshBatchOverview, 10000); // refresh every 10 sec

}

init();

// ========== EXPORT DATA (NO DELETE) ==========
if (btnExport) {
  btnExport.onclick = async () => {
    const ok = await showConfirm("📥 Do you want to download all data as Excel?");
    if (!ok) return;

    showToast("Preparing Excel file...", "info");
    try {
      const response = await fetch(`${API_BASE}/export`, { method: "GET" });
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Pharma_Export.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      showToast("✅ Excel file downloaded successfully!", "success");
    } catch (err) {
      console.error("Export error:", err);
      showToast("❌ Export failed. Check backend logs.", "alert");
    }
  };
}

// ========== CLEAR DATA (DELETE FROM MONGODB) ==========
if (btnClear) {
  btnClear.onclick = async () => {
    const ok = await showConfirm("⚠️ This will delete all data from MongoDB. Proceed?");
    if (!ok) return;

    showToast("Deleting all data...", "info");
    try {
      const res = await fetch(`${API_BASE}/clear`, { method: "DELETE" });
      const data = await res.json();
      showToast(data.message || "Data cleared", "success");
    } catch (err) {
      console.error("Clear error:", err);
      showToast("❌ Failed to clear data.", "alert");
    }
await refreshLedger();
await refreshStageLists();
await refreshBatchOverview(); // ✅ added

    if (typeof refreshPharmacyList === "function") await refreshPharmacyList();
  };
}


// ========== UPDATE BATCH OVERVIEW ==========
async function refreshBatchOverview() {
  const batches = await getData("/batches");

  if (!batches.length) {
    document.getElementById("uiBatch").textContent = "--";
    document.getElementById("uiStage").textContent = "--";
    document.getElementById("uiStatus").textContent = "No Data";
    document.getElementById("uiDrug").textContent = "--";
    return;
  }

  // 🆕 Get the most recent batch (latest created)
  const latest = batches[0];

  // 💊 Update the overview UI
  document.getElementById("uiDrug").textContent = latest.drugName || "Unknown Drug";
  document.getElementById("uiBatch").textContent = latest.batchId;
  document.getElementById("uiStage").textContent = latest.stage;
  
  const uiStatus = document.getElementById("uiStatus");
  uiStatus.textContent = latest.status || "In Progress";
  uiStatus.className =
    latest.status === "Delivered"
      ? "badge success"
      : latest.status === "Restocked"
      ? "badge info"
      : "badge safe";
}

