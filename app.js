// ======= Configuración =======
const ESTADOS = ["Diseño","Producción","Terminación","Despachado","Entregado"];
const STORAGE_KEY = "uragrafica_orders_v2";

// ======= Utils =======
const $ = (q) => document.querySelector(q);
const el = (t, c) => { const e = document.createElement(t); if(c) e.className=c; return e; }
const fmtDate = (d) => d ? new Date(d).toLocaleString() : "—";
const progreso = (estado) => (ESTADOS.indexOf(estado) + 1) * 20; // 20%-100%

// ======= Estado (localStorage) =======
function load(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function save(data){ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
let ORDERS = load();

// ======= DOM Inicial =======
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

// Llenar select de estados
ESTADOS.forEach(e=>{
  const opt = document.createElement("option");
  opt.value = e; opt.textContent = e;
  inEstado.appendChild(opt);
});

// ======= Render =======
function render(){
  board.innerHTML = "";

  ESTADOS.forEach((estado, idx) => {
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
  const q = (search.value || "").trim().toLowerCase();
  if(!q) return ORDERS;
  return ORDERS.filter(o =>
    (o.orden||"").toLowerCase().includes(q) ||
    (o.cliente||"").toLowerCase().includes(q) ||
    (o.producto||"").toLowerCase().includes(q)
  );
}

function renderCard(o){
  const card = el("article","card");

  // header
  const head = el("div","card-head");
  const tag = el("span","tag"); tag.textContent = `#${o.orden}`;
  const prog = el("span","progress"); prog.textContent = `${progreso(o.estado)}%`;
  head.appendChild(tag); head.appendChild(prog);

  // meta
  const meta = el("div","meta");
  meta.innerHTML = `
    <div><b>Cliente:</b> ${escapeHtml(o.cliente)}</div>
    <div><b>Producto:</b> ${escapeHtml(o.producto)}</div>
    <div>Creado: ${fmtDate(o.createdAt)} · Último cambio: ${fmtDate(o.updatedAt)}</div>
  `;

  // acciones
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

  btnLeft.onclick = ()=> move(o.id, -1);
  btnRight.onclick = ()=> move(o.id, +1);
  sel.onchange = (e)=> update(o.id, { estado: e.target.value });
  btnDel.onclick = ()=> {
    if(confirm("¿Estás seguro de eliminar esta orden? Esta acción no se puede deshacer.")){
      remove(o.id);
    }
  };

  act.appendChild(btnLeft);
  act.appendChild(sel);
  act.appendChild(btnRight);
  act.appendChild(btnDel);

  card.appendChild(head);
  card.appendChild(meta);
  card.appendChild(act);
  return card;
}

// ======= CRUD =======
function add(data){
  const now = Date.now();
  const item = {
    id: crypto.randomUUID(),
    orden: (data.orden||"").trim(),
    cliente: (data.cliente||"").trim(),
    producto: (data.producto||"").trim(),
    estado: data.estado || ESTADOS[0],
    createdAt: now,
    updatedAt: now,
  };
  ORDERS.unshift(item);
  save(ORDERS); render();
}

function update(id, patch){
  ORDERS = ORDERS.map(o => o.id===id ? { ...o, ...patch, updatedAt: Date.now() } : o);
  save(ORDERS); render();
}

function move(id, dir){
  const o = ORDERS.find(x=>x.id===id); if(!o) return;
  const i = ESTADOS.indexOf(o.estado);
  const j = Math.max(0, Math.min(ESTADOS.length-1, i + dir));
  if(i!==j) update(id, { estado: ESTADOS[j] });
}

function remove(id){
  ORDERS = ORDERS.filter(o=>o.id!==id);
  save(ORDERS); render();
}

// ======= Eventos =======
btnAdd.onclick = ()=>{
  const orden = inOrden.value.trim();
  const cliente = inCliente.value.trim();
  const producto = inProducto.value.trim();
  const estado = inEstado.value;
  if(!orden || !cliente || !producto){
    alert("Completa Orden, Cliente y Producto.");
    return;
  }
  add({orden,cliente,producto,estado});
  inOrden.value = inCliente.value = inProducto.value = "";
  inEstado.value = ESTADOS[0];
  inOrden.focus();
};

search.oninput = ()=> render();

btnExport.onclick = ()=>{
  const blob = new Blob([JSON.stringify(ORDERS, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "uragrafica_ordenes.json";
  a.click();
  URL.revokeObjectURL(a.href);
};

fileImport.onchange = async (e)=>{
  const file = e.target.files?.[0];
  if(!file) return;
  try{
    const text = await file.text();
    const data = JSON.parse(text);
    if(!Array.isArray(data)) throw new Error("Formato inválido");
    // merge (evita duplicados por id)
    const map = new Map(ORDERS.map(o=>[o.id,o]));
    data.forEach(d=> map.set(d.id||crypto.randomUUID(), d));
    ORDERS = Array.from(map.values());
    save(ORDERS); render();
    alert("Importación completada.");
  }catch(err){
    alert("No se pudo importar: " + err.message);
  }finally{
    e.target.value = "";
  }
};

btnMigrate.onclick = async ()=>{
  const text = JSON.stringify(ORDERS);
  try{
    await navigator.clipboard.writeText(text);
    alert("Copiado al portapapeles. Pega el JSON en el otro navegador y usa 'Importar'.");
  }catch{
    prompt("Copia el JSON:", text);
  }
};

btnClear.onclick = ()=>{
  if(confirm("¿Borrar TODOS los datos guardados en este navegador?")){
    ORDERS = []; save(ORDERS); render();
  }
};

// ======= Helpers =======
function escapeHtml(s=""){
  return s.replace(/[&<>'\"]/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;" }[c]));
}

// ======= Boot =======
render();


