// app.js — Uragráfica (Firestore + numeración automática + mover/borrar + EDITAR)
import {
  db, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, updateDoc, doc, deleteDoc
} from "./firebase.js";

/* Estados (con “Realizado” en lugar de “Despachado”) */
const ESTADOS = ["Diseño", "Producción", "Terminación", "Realizado", "Entregado"];

/* Helpers */
const $  = (q) => document.querySelector(q);
const el = (t, c) => { const e = document.createElement(t); if (c) e.className = c; return e; };
const fmtDate   = (d) => d?.toDate ? d.toDate().toLocaleString() : (d ? new Date(d).toLocaleString() : "—");
const progreso  = (estado) => (Math.max(0, ESTADOS.indexOf(estado)) + 1) * 20;
const escapeHtml = (s="") => s.replace(/[&<>'"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;" }[c]));

/* DOM */
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

/* Llenar selector de estados (formulario) */
ESTADOS.forEach(e => {
  const opt = document.createElement("option");
  opt.value = e; opt.textContent = e;
  inEstado.appendChild(opt);
});

/* Estado local (alimentado por Firestore en tiempo real) */
let ORDERS = [];

/* ===== Firestore realtime ===== */
const ordersCol = collection(db, "orders");
const qOrders   = query(ordersCol, orderBy("createdAt","desc"));

onSnapshot(qOrders, (snap) => {
  const tmp = [];
  snap.forEach(d => tmp.push({ id: d.id, ...d.data() }));

  // Migración suave: “Despachado” -> “Realizado”
  tmp.forEach(async o => {
    if (o.estado === "Despachado") {
      await updateDoc(doc(db,"orders",o.id), { estado: "Realizado", updatedAt: serverTimestamp() });
      o.estado = "Realizado";
    }
  });

  ORDERS = tmp;
  render();

  // Sugerir el próximo número en el input (solo lectura)
  if (inOrden) inOrden.value = getNextOrderNumber();
});

/* ===== Numeración automática ===== */
function getNextOrderNumber() {
  if (ORDERS.length === 0) return "001";
  const nums = ORDERS
    .map(o => parseInt(String(o.orden ?? "").replace(/\D/g, "")))
    .filter(n => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return String(max + 1).padStart(3, "0"); // 001, 002, ...
}

/* ===== Render ===== */
function render(){
  board.innerHTML = "";

  ESTADOS.forEach((estado) => {
    // clase sin acentos para estilos (.c-realizado, etc.)
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

/* ==== Tarjeta ==== */
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

  /* Fallback visible: link "Editar orden" dentro de la tarjeta */
  const metaEdit = document.createElement("div");
  const editLink = document.createElement("button");
  editLink.textContent = "Editar orden";
  editLink.style.background = "transparent";
  editLink.style.border = "none";
  editLink.style.color = "#1d4ed8";
  editLink.style.textDecoration = "underline";
  editLink.style.cursor = "pointer";
  editLink.onclick = () => editOrder(o);
  metaEdit.appendChild(editLink);
  meta.appendChild(metaEdit);

  // Acciones (←  [estado]  →  🗑  Editar)
  const act = el("div","card-actions");

  const btnLeft  = el("button","iconbtn");        btnLeft.textContent  = "←";
  const sel      = el("select","state");
  const btnRight = el("button","iconbtn");        btnRight.textContent = "→";
  const btnDel   = el("button","iconbtn danger"); btnDel.textContent   = "🗑";
  const btnEdit  = el("button","iconbtn");        btnEdit.textContent  = "Editar";

  // Rellenar selector de estados
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
  btnEdit.onclick  = ()   => editOrder(o);

  act.appendChild(btnLeft);
  act.appendChild(sel);
  act.appendChild(btnRight);
  act.appendChild(btnDel);
  act.appendChild(btnEdit);

  // También permite editar tocando el #orden
  tag.style.cursor = "pointer";
  tag.title = "Editar esta orden";
  tag.onclick = () => editOrder(o);

  card.appendChild(head);
  card.appendChild(meta);
  card.appendChild(act);
  return card;
}

/* ===== CRUD Firestore ===== */
async function add(data){
  await addDoc(collection(db,"orders"), {
    orden:    String(data.orden || "").trim(),
    cliente:  String(data.cliente || "").trim(),
    producto: String(data.producto || "").trim(),
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

/* ===== EDITAR ===== */
async function editOrder(o){
  // Prompts simples para no tocar HTML/CSS
  const nuevoOrden   = prompt("Número de orden:", o.orden ?? "") ?? o.orden;
  const nuevoCliente = prompt("Cliente:", o.cliente ?? "") ?? o.cliente;
  const nuevoProducto= prompt("Producto:", o.producto ?? "") ?? o.producto;

  // Selector de estado con listado
  const estadosStr = ESTADOS.map((e, i) => `${i+1}. ${e}`).join("\n");
  const elegido = prompt(
    `Estado actual: ${o.estado}\nElige nuevo estado (1-${ESTADOS.length}):\n\n${estadosStr}`,
    String(ESTADOS.indexOf(o.estado)+1)
  );
  let nuevoEstado = o.estado;
  const idx = parseInt(elegido, 10);
  if (!isNaN(idx) && idx >= 1 && idx <= ESTADOS.length) {
    nuevoEstado = ESTADOS[idx-1];
  }

  // Normaliza orden a 3 dígitos
  const ordenNum = String(nuevoOrden || "").replace(/\D/g,"");
  const ordenFmt = ordenNum ? String(parseInt(ordenNum,10)).padStart(3,"0") : (o.orden ?? "001");

  await updateDoc(doc(db,"orders", o.id), {
    orden: ordenFmt,
    cliente: String(nuevoCliente || "").trim(),
    producto: String(nuevoProducto || "").trim(),
    estado: nuevoEstado,
    updatedAt: serverTimestamp(),
  });
}

/* ===== Eventos ===== */

/* Alta con número automático (el input de Orden es readonly) */
btnAdd?.addEventListener("click", async () => {
  const cliente  = inCliente.value.trim();
  const producto = inProducto.value.trim();
  const estado   = inEstado.value;

  if (!cliente || !producto) {
    alert("Completa Cliente y Producto.");
    return;
  }

  const orden = getNextOrderNumber(); // genera el siguiente consecutivo
  await add({ orden, cliente, producto, estado });

  // limpiar y preparar siguiente número
  inCliente.value = inProducto.value = "";
  inEstado.value  = ESTADOS[0];
  if (inOrden) inOrden.value = getNextOrderNumber();
});

/* Búsqueda al vuelo */
search?.addEventListener("input", render);

/* Exportar respaldo local */
btnExport?.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(ORDERS, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "uragrafica_backup.json";
  a.click(); URL.revokeObjectURL(a.href);
});

/* Importar (sube a Firestore actual) */
fileImport?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) throw new Error("Formato inválido");
    for (const d of data) {
      await add({
        orden:    d.orden || getNextOrderNumber(),
        cliente:  d.cliente,
        producto: d.producto,
        estado:   ESTADOS.includes(d.estado) ? d.estado : ESTADOS[0]
      });
    }
    alert("Importación a Firestore completada.");
  } catch (err) {
    alert("No se pudo importar: " + err.message);
  } finally {
    e.target.value = "";
  }
});

/* Migrar: copia JSON al portapapeles */
btnMigrate?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(ORDERS));
    alert("Copiado al portapapeles.");
  } catch {
    prompt("Copia el JSON:", JSON.stringify(ORDERS));
  }
});

/* Aviso sobre borrado masivo */
btnClear?.addEventListener("click", () => {
  alert("Para borrar TODO, usa la consola de Firebase (Firestore → Colección orders).");
});

/* Inicializa el campo de orden si la página abre sin datos aún */
if (inOrden && !inOrden.value) inOrden.value = "001";
