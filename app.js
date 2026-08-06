/* ============ MENÚ (mismos productos que tu panel de administración) ============
   Reemplaza "descripcion" con el texto real de cada producto.
   Para las fotos: sube un archivo con el nombre exacto indicado a la
   carpeta img/ de este mismo repo (junto a icons/). Si no existe, la
   tarjeta muestra un aviso en vez de foto rota. */
const MENU = [
  {
    key: "frutosRojos", nombre: "Frutos Rojos", precio: 45, dot: "#8E2A45",
    descripcion: "Deliciosa combinación de capas con base de galleta crocante, cremoso yogur natural y la frescura de fresas picadas y cerezas. El equilibrio perfecto entre lo crujiente y lo suave.",
    img: "img/frutos-rojos.jpg",
    gratis: ["Miel de abeja", "Jalea de fresa"],
    pagoPrecio: 5,
    pago: ["Nutella", "Oreo triturada", "Chispas de chocolate"],
  },
  {
    key: "huertoDulce", nombre: "Huerto Dulce", precio: 45, dot: "#4F7942",
    descripcion: "Un toque hogareño y una mezcla reconfortante con base de granola tradicional, abundante yogur natural, trozos de manzana fresca y durazno en almíbar.",
    img: "img/huerto-dulce.jpg",
    gratis: ["Miel de abeja", "Jalea de durazno"],
    pagoPrecio: 5,
    pago: ["Nutella", "Canelitas trituradas", "Chispas de chocolate"],
  },
  {
    key: "zeroCulpas", nombre: "Zero Culpas", precio: 55, dot: "#C96A2E",
    descripcion: "Diseñado para cuidarte sin perder el sabor. Una base de granola ligera con yogur griego alto en proteína y sin azúcar, endulzado con un toque de miel. Un mix de fruta fresca y chía. Ligero, nutritivo y 100% libre de culpas.",
    img: "img/zero-culpas.jpg",
    gratis: ["Amaranto tostado", "Semillas de chía"],
    pagoPrecio: 7,
    pago: ["Crema de cacahuate 100% natural", "Almendras fileteadas", "Chispas de chocolate oscuro"],
  },
];

const DIAS_VENTA = [1, 3, 5]; // lunes, miércoles, viernes (0=domingo)
const DIA_NOMBRE = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/* ============ WHATSAPP ============ */
const WHATSAPP_NUMBER = "522721498675"; // 52 (México) + 2721498675, tomado de tu menú. Pruébalo: si al abrir el link no te reconoce el número, agrega un "1" después del 52 (521 2721498675).

/* ============ FIREBASE ============
   Usa EXACTAMENTE el mismo proyecto/config que tu panel de
   administración (VelvetFrut — Control del Negocio), para que los
   pedidos lleguen a la misma base de datos y aparezcan solos allá. */
const firebaseConfig = {
  apiKey: "AIzaSyA_sZgyKDalaLFK0mTOo7Xd4lTbg17V6WY",
  authDomain: "velvet-frut.firebaseapp.com",
  projectId: "velvet-frut",
  storageBucket: "velvet-frut.firebasestorage.app",
  messagingSenderId: "795859668940",
  appId: "1:795859668940:web:d176c6a5503ccc47315769"
}; 
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
db.enablePersistence({ synchronizeTabs: true }).catch(() => {});

function saveVenta(data) {
  return db.collection("ventas").doc(data.id).set(data);
}

/* ============ HELPERS ============ */
function fmt(n) {
  return "$" + (Math.round(n * 100) / 100).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
function isoOf(d) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}
function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/* ============ FECHAS DE VENTA DISPONIBLES ============ */
function proximosDiasVenta(cantidad) {
  const out = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  let vueltas = 0;
  while (out.length < cantidad && vueltas < 30) {
    if (DIAS_VENTA.includes(cursor.getDay())) out.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
    vueltas++;
  }
  return out;
}

function renderFechas() {
  const sel = document.getElementById("inputFecha");
  sel.innerHTML = "";
  proximosDiasVenta(4).forEach((d, i) => {
    const opt = document.createElement("option");
    opt.value = isoOf(d);
    const esHoy = isoOf(d) === todayISO();
    opt.textContent = `${DIA_NOMBRE[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}${esHoy ? " (hoy)" : ""}`;
    sel.appendChild(opt);
  });
}

/* ============ MENÚ ============ */
function renderMenu() {
  const wrap = document.getElementById("menuGrid");
  wrap.innerHTML = "";
  MENU.forEach((m) => {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "menu-grid__item";
    cell.dataset.key = m.key;
    cell.innerHTML = `
      <span class="menu-grid__photo" data-photo-wrap>
        <span class="menu-grid__photo-fallback">📷</span>
      </span>
      <span class="menu-grid__name">${m.nombre}</span>
      <span class="menu-grid__price">$${m.precio}</span>`;

    // intenta cargar la foto real; si no existe, deja el ícono de cámara
    const img = new Image();
    img.onload = () => {
      const ph = cell.querySelector("[data-photo-wrap]");
      ph.style.backgroundImage = `url("${m.img}")`;
      ph.innerHTML = "";
    };
    img.src = m.img;

    cell.addEventListener("click", () => abrirToppingModal(m.key));
    wrap.appendChild(cell);
  });
}

/* ============ CONSTRUCTOR DE PEDIDO ============ */
let modalPedido = []; // [{ key, gratis, pago: [] }] — pedido en construcción
let seleccionActual = null; // item que se está personalizando ahorita

const modalTopping = document.getElementById("modalTopping");

function abrirToppingModal(key) {
  const m = MENU.find((x) => x.key === key);
  seleccionActual = { key, gratis: null, pago: [] };
  document.getElementById("toppingTitle").textContent = `${m.nombre} · $${m.precio}`;
  document.getElementById("toppingDesc").textContent = m.descripcion;
  renderToppingChips();
  modalTopping.hidden = false;
}

function renderToppingChips() {
  const m = MENU.find((x) => x.key === seleccionActual.key);
  const gratisWrap = document.getElementById("toppingBuilderGratis");
  const pagoWrap = document.getElementById("toppingBuilderPago");
  gratisWrap.innerHTML = `<p class="topping-panel__label">Topping gratis (elige 1)</p>`;
  pagoWrap.innerHTML = `<p class="topping-panel__label">Toppings extra (+$${m.pagoPrecio} c/u)</p>`;

  const gratisChips = document.createElement("div");
  gratisChips.className = "chip-group";
  m.gratis.forEach((nombre) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip-toggle chip-toggle--gratis" + (seleccionActual.gratis === nombre ? " is-active" : "");
    chip.textContent = nombre;
    chip.addEventListener("click", () => {
      seleccionActual.gratis = seleccionActual.gratis === nombre ? null : nombre;
      renderToppingChips();
    });
    gratisChips.appendChild(chip);
  });
  gratisWrap.appendChild(gratisChips);

  const pagoChips = document.createElement("div");
  pagoChips.className = "chip-group";
  m.pago.forEach((nombre) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip-toggle chip-toggle--pago" + (seleccionActual.pago.includes(nombre) ? " is-active" : "");
    chip.textContent = `${nombre} +$${m.pagoPrecio}`;
    chip.addEventListener("click", () => {
      const idx = seleccionActual.pago.indexOf(nombre);
      if (idx >= 0) seleccionActual.pago.splice(idx, 1); else seleccionActual.pago.push(nombre);
      renderToppingChips();
    });
    pagoChips.appendChild(chip);
  });
  pagoWrap.appendChild(pagoChips);
}

document.getElementById("btnCancelarTopping").addEventListener("click", () => { modalTopping.hidden = true; });
modalTopping.addEventListener("click", (e) => { if (e.target === modalTopping) modalTopping.hidden = true; });

document.getElementById("btnAddPedidoItem").addEventListener("click", () => {
  modalPedido.push({ key: seleccionActual.key, gratis: seleccionActual.gratis, pago: [...seleccionActual.pago] });
  modalTopping.hidden = true;
  renderPedidoItems();
  actualizarTotal();
});

function renderPedidoItems() {
  const wrap = document.getElementById("pedidoItems");
  wrap.innerHTML = "";
  document.getElementById("pedidoItemsLabel").hidden = modalPedido.length === 0;
  document.getElementById("pedidoItemsCount").textContent = modalPedido.length;
  document.getElementById("totalWrap").hidden = modalPedido.length === 0;

  modalPedido.forEach((item, idx) => {
    const m = MENU.find((x) => x.key === item.key);
    const partes = [];
    if (item.gratis) partes.push(item.gratis);
    item.pago.forEach((t) => partes.push(`${t} (+$${m.pagoPrecio})`));

    const row = document.createElement("div");
    row.className = "pedido-item-row";
    row.style.borderLeftColor = m.dot;
    row.innerHTML = `
      <div class="pedido-item-row__info">
        <span class="pedido-item-row__name">${m.nombre}</span>
        <span class="pedido-item-row__toppings">${partes.length ? partes.join(", ") : "Sin toppings"}</span>
      </div>
      <button type="button" class="pedido-item-row__del" data-idx="${idx}" aria-label="Quitar">×</button>`;
    wrap.appendChild(row);
  });

  wrap.querySelectorAll("[data-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      modalPedido.splice(Number(btn.dataset.idx), 1);
      renderPedidoItems();
      actualizarTotal();
    });
  });
}

function calcularTotalPedido() {
  let total = 0;
  modalPedido.forEach((item) => {
    const m = MENU.find((x) => x.key === item.key);
    if (!m) return;
    total += m.precio + item.pago.length * m.pagoPrecio;
  });
  return total;
}

function actualizarTotal() {
  document.getElementById("modalTotal").textContent = fmt(calcularTotalPedido());
}

/* ============ ENVIAR PEDIDO ============ */
const modalOk = document.getElementById("modalOk");
document.getElementById("btnOkCerrar").addEventListener("click", () => { modalOk.hidden = true; });

document.getElementById("btnEnviar").addEventListener("click", () => {
  const nombre = document.getElementById("inputNombre").value.trim();
  const fecha = document.getElementById("inputFecha").value || todayISO();
  const hint = document.getElementById("enviarHint");
  hint.textContent = "";

  if (!nombre) {
    hint.textContent = "Escribe tu nombre para poder enviar tu pedido.";
    document.getElementById("inputNombre").focus();
    return;
  }
  if (modalPedido.length === 0) {
    hint.textContent = "Agrega al menos un producto a tu pedido.";
    return;
  }

  const pedido = { items: modalPedido.map((it) => ({ key: it.key, gratis: it.gratis, pago: [...it.pago] })) };
  const data = {
    id: uid(),
    nombre,
    fecha,
    pedido,
    estado: "pendiente",
    origen: "cliente", // así lo distingues en tu panel de administración
    creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
    actualizadoEn: firebase.firestore.FieldValue.serverTimestamp(),
  };

  const btnEnviar = document.getElementById("btnEnviar");
  btnEnviar.disabled = true;
  btnEnviar.textContent = "Enviando…";

  // OJO: igual que en el panel de administración, no esperamos a que el
  // servidor confirme para avisar — con poca señal esa confirmación
  // puede tardar. El pedido ya queda guardado localmente y se sincroniza
  // solo en cuanto haya conexión.
  saveVenta(data).catch((err) => {
    console.error("No se pudo enviar el pedido:", err);
  });

  modalPedido = [];
  document.getElementById("inputNombre").value = "";
  renderPedidoItems();
  actualizarTotal();
  renderFechas();

  btnEnviar.disabled = false;
  btnEnviar.textContent = "Enviar pedido";
  modalOk.hidden = false;
});

/* ============ BOTÓN WHATSAPP ============ */
function textoWhatsapp() {
  const nombre = document.getElementById("inputNombre").value.trim();

  if (modalPedido.length === 0) {
    return "Hola 👋 Tengo una duda sobre el menú de VelvetFrut, ¿me ayudan? ¡No dudo en preguntar! 😊";
  }

  const porSabor = {};
  modalPedido.forEach((item) => (porSabor[item.key] = porSabor[item.key] || []).push(item));

  const lineas = MENU.filter((m) => porSabor[m.key]).map((m) => {
    const unidades = porSabor[m.key];
    const detalle = unidades.map((u, i) => {
      const partes = [];
      if (u.gratis) partes.push(u.gratis);
      (u.pago || []).forEach((t) => partes.push(`${t} (+$${m.pagoPrecio})`));
      const txt = partes.length ? partes.join(", ") : "sin toppings";
      return unidades.length > 1 ? `   #${i + 1}: ${txt}` : `   ${txt}`;
    });
    return `• ${unidades.length}x ${m.nombre}\n${detalle.join("\n")}`;
  });

  const fecha = document.getElementById("inputFecha");
  const fechaTxt = fecha.options[fecha.selectedIndex] ? fecha.options[fecha.selectedIndex].textContent : "";
  const total = fmt(calcularTotalPedido());

  return `Hola! Soy ${nombre || "una clienta"} 👋\nMi pedido para el ${fechaTxt}:\n\n${lineas.join("\n\n")}\n\nTotal: ${total}`;
}

document.getElementById("fabWhatsapp").addEventListener("click", () => {
  const texto = encodeURIComponent(textoWhatsapp());
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${texto}`, "_blank");
});

/* ============ INSTALAR APP ============ */
let deferredInstallPrompt = null;
const installBtn = document.getElementById("installBtn");
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  installBtn.hidden = false;
});
installBtn.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installBtn.hidden = true;
});
window.addEventListener("appinstalled", () => { installBtn.hidden = true; });

/* ============ INIT ============ */
renderFechas();
renderMenu();
renderPedidoItems();
actualizarTotal();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
