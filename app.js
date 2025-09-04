// app.js — Uragráfica (Firestore + acciones visibles)
import {
  db, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, updateDoc, doc, deleteDoc
} from "./firebase.js";

const ESTADOS = ["Diseño","Producción","Terminación","Realizado","Entregado"];


// Helpers
const $  = (q) => document.querySelector(q);
const el = (t, c) => { const e = document.createElement(t); if (c) e.className = c; return e; };
const fmtDate = (d) => d?.toDate ? d.toDate().toLocaleString() : (d ? new Date(d).toLocaleString() : "—");
const progreso = (estado) => (Math.max(0, ESTADOS.indexOf(estado)) + 1) * 20;
const escapeHtml = (s="") => s.replace(/[&<>'"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;" }[c]));

// DOM
const board      = $("#board");
const inOrden    = $("#inOrden");
const inCliente  = $("#inCliente");
const inProducto = $("#inProducto");
const inEstado   = $("#inEstado");
const btnAdd     = $("#btnAdd");
const search     = $("#q");
const btnExport  = $("#btnExport");
const fileImport = $("#fileImport");
const btnMigrate = $("#btnMigrate");
const btnClear   = $("#btnClear");

// Llena el selector de estados del formulario
ESTADOS.forEach(e => {
  const opt = document.createElement("option");
  opt.value = e; opt.textContent = e;
  inEstado.appendChild(opt);
});

// Estado local (se alimenta de Firestore realtime)
let ORDERS = [];

// ===== Firestore realtime =====
const ordersCol = collection(db, "orders");
const qOrders   = query(ordersCol, orderBy("createdAt","desc"));

onSnapshot(qOrders, (snap) => {
  ORDERS = [];
  snap.forEach(d => ORDERS.push({ id: d.id, ...d.data() }));
  render();
});

// ===== Render =====
function render(){
  board.innerHTML = "";

  ESTADOS.forEach((estado) => {
    // clase sin acentos para color
    const clsNoAccent = estado.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    const col = el("section", `column c-${clsNoAccent} c-${estado.toLowerCase()}`);

    const h2 = el("h2");
    const title = el("div"); title.textContent = estado;
    const count = el("span","badge-count");

    const items = filtered().filter(o => o.estado === estado);
    count.textContent = items.length;
    h2.appendChild(title); h2.appendChild(count);
    col.appendChild(h2);

    if (items.length === 0) {
      const empty = el("div","empty"); empty.textContent = `Sin pedidos en ${estado}`;
      col.appendChild(empty);
    } else {
      items.forEach(o => col.appendChild(renderCard(o)));
    }

    board.appendChild(col);
  });
}

function filtered(){
  const k = (search?.value || "").trim().toLowerCase();
  if (!k) return ORDERS;
  return ORDERS.filter(o =>
    (o.orden||"").toLowerCase().includes(k) ||
    (o.cliente||"").toLowerCase().includes(k) ||
    (o.producto||"").toLowerCase().includes(k)
  );
}

function renderCard(o){
  const card = el("article","card");

  // Header
  const head = el("div","card-head");
  const tag  = el("span","tag");      tag.textContent  = `#${o.orden}`;
  const prog = el("span","progress"); prog.textContent = `${progreso(o.estado)}%`;
  head.appendChild(tag); head.appendChild(prog);

  // Meta
  const meta = el("div","meta");
  meta.innerHTML = `
    <div><b>Cliente:</b> ${escapeHtml(o.cliente)}</div>
    <div><b>Producto:</b> ${escapeHtml(o.producto)}</div>
    <div>Creado: ${fmtDate(o.createdAt)} · Último cambio: ${fmtDate(o.updatedAt)}</div>
  `;

  // Acciones (←  [estado]  →  🗑) — SIEMPRE visibles
  const act = el("div","card-actions");
  const btnLeft  = el("button","iconbtn");        btnLeft.textContent  = "←";
  const sel      = el("select","state");
  const btnRight = el("button","iconbtn");        btnRight.textContent = "→";
  const btnDel   = el("button","iconbtn danger"); btnDel.textContent   = "🗑";

  // Rellenar selector
  ESTADOS.forEach(s => {
    const opt = el("option"); opt.value = s; opt.textContent = s;
    if (s === o.estado) opt.selected = true;
    sel.appendChild(opt);
  });

  // Acciones
  btnLeft.onclick  = ()   => move(o, -1);
  btnRight.onclick = ()   => move(o, +1);
  sel.onchange     = (ev) => updateState(o, ev.target.value);
  btnDel.onclick   = ()   => confirm("¿Estás seguro de eliminar esta orden? Esta acción no se puede deshacer.") && remove(o);

  act.appendChild(btnLeft);
  act.appendChild(sel);
  act.appendChild(btnRight);
  act.appendChild(btnDel);

  card.appendChild(head);
  card.appendChild(meta);
  card.appendChild(act);
  return card;
}

// ===== CRUD =====
async function add(data){
  await addDoc(ordersCol, {
    orden:    (data.orden||"").trim(),
    cliente:  (data.cliente||"").trim(),
    producto: (data.producto||"").trim(),
    estado:    data.estado || ESTADOS[0],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
async function updateState(o, estado){
  await updateDoc(doc(db,"orders",o.id), { estado, updatedAt: serverTimestamp() });
}
async function move(o, dir){
  const i = ESTADOS.indexOf(o.estado);
  const j = Math.max(0, Math.min(ESTADOS.length - 1, i + dir));
  if (i !== j) await updateState(o, ESTADOS[j]);
}
async function remove(o){
  await deleteDoc(doc(db,"orders", o.id));
}

// ===== Eventos =====
btnAdd?.addEventListener("click", async () => {
  const orden   = inOrden.value.trim();
  const cliente = inCliente.value.trim();
  const producto= inProducto.value.trim();
  const estado  = inEstado.value;
  if (!orden || !cliente || !producto) { alert("Completa Orden, Cliente y Producto."); return; }
  await add({ orden, cliente, producto, estado });
  inOrden.value = inCliente.value = inProducto.value = "";
  inEstado.value = ESTADOS[0];
  inOrden.focus();
});

search?.addEventListener("input", render);

// Respaldo local (exportar)
btnExport?.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(ORDERS, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "uragrafica_backup.json";
  a.click();
  URL.revokeObjectURL(a.href);
});

// Importar (sube a Firestore actual)
fileImport?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) throw new Error("Formato inválido");
    for (const d of data) {
      await add({
        orden: d.orden, cliente: d.cliente, producto: d.producto,
        estado: ESTADOS.includes(d.estado) ? d.estado : ESTADOS[0]
      });
    }
    alert("Importación a Firestore completada.");
  } catch (err) {
    alert("No se pudo importar: " + err.message);
  } finally {
    e.target.value = "";
  }
});

// Migrar: copia JSON al portapapeles
btnMigrate?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(ORDERS));
    alert("Copiado al portapapeles.");
  } catch {
    prompt("Copia el JSON:", JSON.stringify(ORDERS));
  }
});

// Aviso sobre borrado masivo
btnClear?.addEventListener("click", () => {
  alert("Para borrar TODO, usa la consola de Firebase (Firestore → Colección orders).");
});
