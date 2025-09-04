import { db, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, updateDoc, doc, deleteDoc } from "./firebase.js";

const ESTADOS = ["Diseño","Producción","Terminación","Despachado","Entregado"];
const $ = (q) => document.querySelector(q);
const el = (t, c) => { const e = document.createElement(t); if(c) e.className=c; return e; }
const fmtDate = (d) => d?.toDate ? d.toDate().toLocaleString() : (d ? new Date(d).toLocaleString() : "—");
const progreso = (estado) => (ESTADOS.indexOf(estado) + 1) * 20;

const board = $("#board");
const inOrden = $("#inOrden");
const inCliente = $("#inCliente");
const inProducto = $("#inProducto");
const inEstado = $("#inEstado");
const btnAdd = $("#btnAdd");
const search = $("#q");
const btnExport = $("#btnExport");
const btnClear = $("#btnClear");
const fileImport = $("#fileImport");
const btnMigrate = $("#btnMigrate");

// Llenar select
ESTADOS.forEach(e=>{
  const opt = document.createElement("option");
  opt.value = e; opt.textContent = e;
  inEstado.appendChild(opt);
});

let ORDERS = [];

// ===== Lectura realtime de Firestore =====
const ordersCol = collection(db, "orders");
const q = query(ordersCol, orderBy("createdAt","desc"));
onSnapshot(q, (snap) => {
  ORDERS = [];
  snap.forEach(d => ORDERS.push({ id: d.id, ...d.data() }));
  render();
});

// ===== Render =====
function render(){
  board.innerHTML = "";
  ESTADOS.forEach((estado) => {
    const col = el("section", `column c-${estado.toLowerCase()}`);
    const h2 = el("h2");
    const title = el("div"); title.textContent = estado;
    const count = el("span","badge-count");
    const colOrders = filtered().filter(o => o.estado === estado);
    count.textContent = colOrders.length;
    h2.appendChild(title); h2.appendChild(count);
    col.appendChild(h2);

    if(colOrders.length === 0){
      const empty = el("div","empty");
      empty.textContent = `Sin pedidos en ${estado}`;
      col.appendChild(empty);
    } else {
      colOrders.forEach(o => col.appendChild(renderCard(o)));
    }
    board.appendChild(col);
  });
}

function filtered(){
  const k = (search.value || "").trim().toLowerCase();
  if(!k) return ORDERS;
  return ORDERS.filter(o =>
    (o.orden||"").toLowerCase().includes(k) ||
    (o.cliente||"").toLowerCase().includes(k) ||
    (o.producto||"").toLowerCase().includes(k)
  );
}

function renderCard(o){
  const card = el("article","card");
  const head = el("div","card-head");
  const tag = el("span","tag"); tag.textContent = `#${o.orden}`;
  const prog = el("span","progress"); prog.textContent = `${progreso(o.estado)}%`;
  head.appendChild(tag); head.appendChild(prog);

  const meta = el("div","meta");
  meta.innerHTML = `
    <div><b>Cliente:</b> ${escapeHtml(o.cliente)}</div>
    <div><b>Producto:</b> ${escapeHtml(o.producto)}</div>
    <div>Creado: ${fmtDate(o.createdAt)} · Último cambio: ${fmtDate(o.updatedAt)}</div>
  `;

  const act = el("div","card-actions");
  const btnLeft = el("button","iconbtn"); btnLeft.textContent = "←";
  const btnRight = el("button","iconbtn"); btnRight.textContent = "→";
  const sel = el("select","state");
  ESTADOS.forEach(s => {
    const opt = el("option"); opt.value=s; opt.textContent=s;
    if(s===o.estado) opt.selected=true;
    sel.appendChild(opt);
  });
  const btnDel = el("button","iconbtn danger"); btnDel.textContent="🗑";

  btnLeft.onclick = ()=> move(o, -1);
  btnRight.onclick = ()=> move(o, +1);
  sel.onchange = (e)=> updateState(o, e.target.value);
  btnDel.onclick = ()=> { if(confirm("¿Estás seguro de eliminar esta orden?")) remove(o); };

  card.appendChild(head);
  card.appendChild(meta);
  card.appendChild(act);
  return card;
}

// ===== CRUD Firestore =====
async function add(data){
  await addDoc(ordersCol, {
    orden: (data.orden||"").trim(),
    cliente: (data.cliente||"").trim(),
    producto: (data.producto||"").trim(),
    estado: data.estado || ESTADOS[0],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
async function updateState(o, estado){
  await updateDoc(doc(db,"orders",o.id), { estado, updatedAt: serverTimestamp() });
}
async function move(o, dir){
  const i = ESTADOS.indexOf(o.estado);
  const j = Math.max(0, Math.min(ESTADOS.length-1, i + dir));
  if(i!==j) await updateState(o, ESTADOS[j]);
}
async function remove(o){
  await deleteDoc(doc(db,"orders",o.id));
}

// ===== Eventos UI =====
btnAdd.onclick = async ()=>{
  const orden = inOrden.value.trim();
  const cliente = inCliente.value.trim();
  const producto = inProducto.value.trim();
  const estado = inEstado.value;
  if(!orden || !cliente || !producto){ alert("Completa Orden, Cliente y Producto."); return; }
  await add({orden,cliente,producto,estado});
  inOrden.value = inCliente.value = inProducto.value = "";
  inEstado.value = ESTADOS[0];
  inOrden.focus();
};
search.oninput = ()=> render();

btnExport.onclick = ()=>{
  const blob = new Blob([JSON.stringify(ORDERS, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "uragrafica_backup.json";
  a.click(); URL.revokeObjectURL(a.href);
};
btnClear.onclick = ()=> alert("Con Firestore no se borran todos desde aquí. Borra en la consola.");
function escapeHtml(s=""){ return s.replace(/[&<>'\"]/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;" }[c])); }
