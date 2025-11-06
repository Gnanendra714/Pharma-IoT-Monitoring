// ---------- Configuration ----------
const CHANNEL_ID = 3149172;
const RESULTS = 12;
const POLL_MS = 20000;
const WORKFLOW = ["Supplier","Manufacturer","Repackage","Distributor","Pharmacy","Patient"];
let currentStage = 0;

// ---------- Ledger ----------
const KEY = "elevium_ledger_v1";
const loadLedger = () => JSON.parse(localStorage.getItem(KEY) || "[]");
const saveLedger = arr => localStorage.setItem(KEY, JSON.stringify(arr));
function pushEvent(actor,type,batch,notes){
  const ledger = loadLedger();
  ledger.unshift({ts:new Date().toISOString(),actor,type,batch,notes});
  saveLedger(ledger); renderLedger(); renderFullLedger();
}

// ---------- UI Navigation ----------
document.querySelectorAll(".nav-btn").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const t=btn.dataset.target;
    document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));
    document.getElementById(t).classList.add("active");
    window.scrollTo({top:0,behavior:"smooth"});
  });
});

// ---------- Ledger Render ----------
function renderLedger(){
  const el=document.getElementById("ledgerTable");
  if(!el) return;
  const ledger=loadLedger();
  el.innerHTML=ledger.slice(0,10).map(ev=>`
    <div class="row">
      <div class="time">${new Date(ev.ts).toLocaleString()}</div>
      <div style="flex:1"><strong>${ev.type}</strong> — ${ev.actor}
      <div class="small" style="color:var(--muted)">${ev.batch} · ${ev.notes||""}</div></div>
    </div>`).join("");
}
function renderFullLedger(){
  const el=document.getElementById("fullLedger");
  if(!el) return;
  const ledger=loadLedger();
  el.innerHTML=ledger.map(ev=>`
    <div class="row">
      <div class="time">${new Date(ev.ts).toLocaleString()}</div>
      <div style="flex:1"><strong>${ev.type}</strong>
      <span style="color:var(--muted)">(${ev.actor})</span>
      <div class="small">${ev.batch} · ${ev.notes||""}</div></div>
    </div>`).join("");
}

// ---------- Stage UI ----------
function updateStage(){
  const st=document.getElementById("uiStage");
  st.textContent=WORKFLOW[currentStage];
  const status=document.getElementById("uiStatus");
  if(currentStage===WORKFLOW.length-1){status.textContent="Delivered";status.className="badge safe";}
  else{status.textContent="In Progress";status.className="badge safe";}
}
document.getElementById("btnNextStage").onclick=()=>{
  if(currentStage<WORKFLOW.length-1){
    currentStage++;updateStage();
    pushEvent("System","AdvanceStage",document.getElementById("uiBatch").textContent,"Moved to "+WORKFLOW[currentStage]);
  }
};
document.getElementById("btnAddEvent").onclick=()=>{
  pushEvent("Admin","ManualEvent","PCT01","Manual dashboard event");
};

// ---------- Export / Clear ----------
document.getElementById("btnExport").onclick=()=>{
  const blob=new Blob([localStorage.getItem(KEY)||"[]"],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);
  a.download="ledger.json";a.click();
};
document.getElementById("btnClear").onclick=()=>{
  if(confirm("Clear ledger?")){localStorage.removeItem(KEY);renderLedger();renderFullLedger();}
};

// ---------- Forms ----------
frmSupplier.onsubmit=e=>{e.preventDefault();
  pushEvent("Supplier","ShipmentCreated",supplierBatch.value,supplierNotes.value);
};
frmManufacturer.onsubmit=e=>{e.preventDefault();
  pushEvent("Manufacturer","Manufactured",manufactBatch.value,manufactNotes.value);
};
btnRequestFDA.onclick=()=>{
  pushEvent("Manufacturer","FDARequest",manufactBatch.value,"Requesting approval");
  fdaResult.textContent="Awaiting FDA approval...";
  setTimeout(()=>{
    fdaResult.textContent="✅ Approved (demo)";
    pushEvent("FDA","Approved",manufactBatch.value,"Auto approved");
  },1500);
};
frmRepackage.onsubmit=e=>{e.preventDefault();
  pushEvent("Repackage","Repackaged",repackBatch.value,"Handled by "+repackBy.value);
};
frmDistributor.onsubmit=e=>{e.preventDefault();
  pushEvent("Distributor","Dispatched",distBatch.value,"Vehicle "+distVehicle.value);
};
frmPharmacy.onsubmit=e=>{e.preventDefault();
  pushEvent("Pharmacy","Received",pharmBatch.value,"At "+pharmId.value);
};
btnMarkSold.onclick=()=>pushEvent("Pharmacy","Sold",pharmBatch.value,"Dispensed to patient");
frmPatient.onsubmit=e=>{
  e.preventDefault();
  const batch=patientBatch.value;
  const data=loadLedger().filter(x=>x.batch===batch);
  patientVerify.innerHTML=data.length?`
  <h4>History for ${batch}</h4>
  ${data.map(d=>`<div><strong>${d.type}</strong> - ${d.actor}<div class="small">${new Date(d.ts).toLocaleString()} · ${d.notes||""}</div></div>`).join("")}`:`<div>No records for ${batch}</div>`;
};

// ---------- Chart.js + ThingSpeak ----------
const ctx=document.getElementById("iotChart").getContext("2d");
const chart=new Chart(ctx,{type:"line",data:{labels:[],datasets:[
  {label:"Temperature (°C)",borderColor:"#ff6b6b",data:[],tension:0.2},
  {label:"Humidity (%)",borderColor:"#4da6ff",data:[],tension:0.2}
]},options:{scales:{y:{beginAtZero:false}},plugins:{legend:{labels:{color:"#fff"}}}}});

async function fetchThingSpeak(){
  const url=`https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json?results=${RESULTS}`;
  try{
    const res=await fetch(url); const data=await res.json();
    const f=data.feeds||[]; const labels=f.map(x=>new Date(x.created_at).toLocaleTimeString());
    const t=f.map(x=>+x.field1||0), h=f.map(x=>+x.field2||0);
    chart.data.labels=labels;chart.data.datasets[0].data=t;chart.data.datasets[1].data=h;chart.update();
    const temp=t[t.length-1], hum=h[h.length-1];
    liveTemp.textContent=temp.toFixed(1); liveHum.textContent=hum.toFixed(1);
    const badge=document.getElementById("iotBadge");
    if(temp>30){badge.textContent="High Temp";badge.className="badge alert";pushEvent("IoT","TempAlert","PCT01","Temp "+temp);}
    else{badge.textContent="Normal";badge.className="badge info";}
  }catch(err){console.error(err);}
}

// ---------- Init ----------
(function init(){
  renderLedger();renderFullLedger();updateStage();
  fetchThingSpeak(); setInterval(fetchThingSpeak,POLL_MS);
})();
