/* ============ MENÚ (precios y toppings reales de VelvetFrut) ============ */
const MENU = [
  {
    key: "frutosRojos", nombre: "Frutos Rojos", precio: 45, color: "cherry",
    tagline: "Brillante, frutal y delicioso.",
    img: "img/frutos-rojos.jpg",
    gratis: ["Miel de abeja", "Jalea de fresa"],
    pagoPrecio: 5,
    pago: ["Nutella", "Oreo triturada", "Chispas de chocolate"],
  },
  {
    key: "huertoDulce", nombre: "Huerto Dulce", precio: 45, color: "amber",
    tagline: "Un toque suave y acogedor.",
    img: "img/huerto-dulce.jpg",
    gratis: ["Miel de abeja", "Jalea de durazno"],
    pagoPrecio: 5,
    pago: ["Nutella", "Canelitas trituradas", "Chispas de chocolate"],
  },
  {
    key: "zeroCulpas", nombre: "Zero Culpas", precio: 55, color: "leaf",
    tagline: "Energía natural para tu día.",
    img: "img/zero-culpas.jpg",
    gratis: ["Amaranto tostado", "Semillas de chía"],
    pagoPrecio: 7,
    pago: ["Crema de cacahuate 100% natural", "Almendras fileteadas", "Chispas de chocolate oscuro"],
  },
];

const DIAS_VENTA = [1, 3, 5]; // lunes, miércoles, viernes (0=domingo)
const DIA_NOMBRE = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/* ============ WHATSAPP ============ */
const WHATSAPP_NUMBER = "522721498675"; // 52 (México) + 2721498675

/* ============ FIREBASE (mismo proyecto que tu panel de administración) ============
   IMPORTANTE: si Firebase falla por cualquier motivo (sin internet, un
   bloqueador de anuncios, una cuota agotada, un typo en la config...),
   NO debe tumbar el resto de la app. Por eso todo el UI (tarjetas, fechas,
   carrito) se dibuja primero y de forma independiente, y Firebase se
   inicializa aparte, en su propio try/catch. Antes, un solo error aquí
   detenía TODO el script y por eso no aparecían ni las tarjetas. */
let db = null;
try {
  const firebaseConfig = {
    apiKey: "AIzaSyA_sZgyKDalaLFK0mTOo7Xd4lTbg17V6WY",
    authDomain: "velvet-frut.firebaseapp.com",
    projectId: "velvet-frut",
    storageBucket: "velvet-frut.firebasestorage.app",
    messagingSenderId: "795859668940",
    appId: "1:795859668940:web:d176c6a5503ccc47315769"
  };
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
} catch (err) {
  console.error("Firebase no se pudo inicializar (la app sigue funcionando sin guardado en la nube):", err);
  db = null;
}

function saveVenta(data) {
  if (!db) return Promise.reject(new Error("Firebase no disponible"));
  return db.collection("ventas").doc(data.id).set(data);
}

/* ============ HELPERS ============ */
function money(value) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
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
function fechaCorta(iso) {
  const d = parseISO(iso);
  const esHoy = iso === todayISO();
  return `${DIA_NOMBRE[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}${esHoy ? " (hoy)" : ""}`;
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
  const sel = document.getElementById("customer-date");
  sel.innerHTML = "";
  proximosDiasVenta(4).forEach((d) => {
    const opt = document.createElement("option");
    opt.value = isoOf(d);
    const esHoy = isoOf(d) === todayISO();
    opt.textContent = `${DIA_NOMBRE[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}${esHoy ? " (hoy)" : ""}`;
    sel.appendChild(opt);
  });
}

/* ============ ESTADO ============ */
let productoActual = MENU[0].key;
let toppingsSeleccion = {}; // { [key]: { gratis, pago:[] } } — se conserva por producto al cambiar de tarjeta
let carrito = []; // [{ id, key, nombre, precioBase, pagoPrecio, gratis, pago:[], cantidad }]

MENU.forEach((m) => { toppingsSeleccion[m.key] = { gratis: m.gratis[0], pago: [] }; });

const customerInput = document.getElementById("customer-name");
const dateInput = document.getElementById("customer-date");
const form = document.getElementById("order-form");
const message = document.getElementById("form-message");
const submitButton = document.getElementById("submit-order");
const addToCartButton = document.getElementById("add-to-cart");

/* ============ TARJETAS DE PRODUCTO ============ */
function renderChoiceCards() {
  const wrap = document.getElementById("choiceGrid");
  wrap.innerHTML = "";
  MENU.forEach((m) => {
    const card = document.createElement("label");
    card.className = "choice-card relative rounded-2xl bg-[#fffdf8] p-4" + (productoActual === m.key ? " is-selected" : "");
    card.dataset.color = m.color;
    card.innerHTML = `
      <div class="flex justify-between items-start gap-3">
        <div>
          <p class="choice-card__title font-bold" style="color:#000;font-size:16px;">${m.nombre}</p>
          <p class="choice-card__price text-sm font-bold mt-1" style="color:#24322a;font-size:16px;">$${m.precio}</p>
          <p class="choice-card__tagline text-sm mt-1 leading-snug" style="color:#758175;font-size:13px;">${m.tagline}</p>
        </div>
        <span class="choice-dot" aria-hidden="true"></span>
      </div>`;
    card.addEventListener("click", () => {
      productoActual = m.key;
      renderChoiceCards();
      renderToppingPanel();
      updateSummary();
    });
    wrap.appendChild(card);
  });
}

/* ============ PANEL DE TOPPINGS (solo el del producto elegido) ============ */
function renderToppingPanel() {
  const m = MENU.find((x) => x.key === productoActual);
  const sel = toppingsSeleccion[m.key];
  const wrap = document.getElementById("toppingPanels");

  wrap.innerHTML = `
    <section class="topping-panel panel-enter rounded-[24px] bg-[#fffdf8] border border-[#eadfce] p-5 sm:p-6">
      <h3 class="brand-font mb-1" style="color:#24322a;font-size:19px;">${m.nombre}</h3>
      <p class="text-sm mb-5" style="color:#758175;font-size:14px;">Personaliza tu bowl con un topping incluido y extras opcionales.</p>
      <fieldset class="mb-5">
        <legend class="font-bold mb-2" style="color:#24322a;font-size:16px;">2. Elige 1 topping gratis</legend>
        <div class="grid sm:grid-cols-2 gap-2" id="freeToppingGrid"></div>
      </fieldset>
      <fieldset>
        <legend class="font-bold mb-2" style="color:#db5d32;font-size:16px;">Toppings extra · +$${m.pagoPrecio} c/u</legend>
        <div class="grid sm:grid-cols-3 gap-2" id="extraToppingGrid"></div>
      </fieldset>
    </section>`;

  const freeWrap = document.getElementById("freeToppingGrid");
  m.gratis.forEach((nombre) => {
    const label = document.createElement("label");
    label.className = "topping-option rounded-xl p-3 flex gap-3 items-center" + (sel.gratis === nombre ? " is-checked" : "");
    label.innerHTML = `<input type="radio" name="free-topping" ${sel.gratis === nombre ? "checked" : ""}><span class="text-sm font-medium" style="color:#24322a;font-size:16px;">${nombre}</span>`;
    label.querySelector("input").addEventListener("change", () => {
      sel.gratis = nombre;
      renderToppingPanel();
      updateSummary();
    });
    freeWrap.appendChild(label);
  });

  const extraWrap = document.getElementById("extraToppingGrid");
  m.pago.forEach((nombre) => {
    const checked = sel.pago.includes(nombre);
    const label = document.createElement("label");
    label.className = "topping-option rounded-xl p-3 flex gap-2 items-center" + (checked ? " is-checked" : "");
    label.innerHTML = `<input type="checkbox" ${checked ? "checked" : ""}><span class="text-sm font-medium" style="color:#24322a;font-size:16px;">${nombre}</span>`;
    label.querySelector("input").addEventListener("change", (e) => {
      if (e.target.checked) sel.pago.push(nombre);
      else sel.pago = sel.pago.filter((t) => t !== nombre);
      renderToppingPanel();
      updateSummary();
    });
    extraWrap.appendChild(label);
  });
}

/* ============ SELECCIÓN ACTUAL (antes de agregar al carrito) ============ */
function precioUnitarioSeleccionActual() {
  const m = MENU.find((x) => x.key === productoActual);
  const sel = toppingsSeleccion[m.key];
  return m.precio + sel.pago.length * m.pagoPrecio;
}

function updateSummary() {
  const m = MENU.find((x) => x.key === productoActual);
  const sel = toppingsSeleccion[m.key];
  document.getElementById("summary-product").textContent = `${m.nombre} $${m.precio}`;
  document.getElementById("summary-free").textContent = sel.gratis || "Elige tu topping";
  document.getElementById("summary-extras").textContent = sel.pago.length ? sel.pago.join(", ") : "Sin toppings extra";
  document.getElementById("summary-unit-total").textContent = money(precioUnitarioSeleccionActual());
}

/* ============ CARRITO ============ */
function mismosToppings(pagoA, pagoB) {
  const a = [...pagoA].sort().join("|");
  const b = [...pagoB].sort().join("|");
  return a === b;
}

function unitPriceItem(item) {
  return item.precioBase + item.pago.length * item.pagoPrecio;
}
function subtotalItem(item) {
  return unitPriceItem(item) * item.cantidad;
}
function totalCarrito() {
  return carrito.reduce((sum, item) => sum + subtotalItem(item), 0);
}

function agregarAlCarrito() {
  const m = MENU.find((x) => x.key === productoActual);
  const sel = toppingsSeleccion[m.key];

  if (!sel.gratis) {
    message.textContent = "Elige tu topping gratis antes de agregar al carrito.";
    message.className = "mt-4 rounded-xl bg-[#fff0eb] text-[#a53c20] px-4 py-3 text-sm font-semibold";
    message.classList.remove("hidden");
    return;
  }
  message.classList.add("hidden");

  const existente = carrito.find(
    (it) => it.key === m.key && it.gratis === sel.gratis && mismosToppings(it.pago, sel.pago)
  );
  if (existente) {
    existente.cantidad += 1;
  } else {
    carrito.push({
      id: uid(),
      key: m.key,
      nombre: m.nombre,
      precioBase: m.precio,
      pagoPrecio: m.pagoPrecio,
      gratis: sel.gratis,
      pago: [...sel.pago],
      cantidad: 1,
    });
  }
  renderCart();
}

function cambiarCantidad(id, delta) {
  const item = carrito.find((it) => it.id === id);
  if (!item) return;
  item.cantidad += delta;
  if (item.cantidad <= 0) carrito = carrito.filter((it) => it.id !== id);
  renderCart();
}

function quitarDelCarrito(id) {
  carrito = carrito.filter((it) => it.id !== id);
  renderCart();
}

function renderCart() {
  const list = document.getElementById("cartList");
  const empty = document.getElementById("cartEmpty");
  const totalEl = document.getElementById("cart-total");

  list.innerHTML = "";

  if (carrito.length === 0) {
    empty.classList.remove("hidden");
  } else {
    empty.classList.add("hidden");
    carrito.forEach((item) => {
      const row = document.createElement("li");
      row.className = "cart-row rounded-xl border border-[#eadfce] p-3";
      const toppingsTxt = [item.gratis, ...item.pago.map((t) => `${t} (+$${item.pagoPrecio})`)].join(", ");
      row.innerHTML = `
        <div class="flex justify-between items-start gap-2">
          <div class="min-w-0">
            <p class="font-bold truncate" style="color:#24322a;font-size:15px;">${item.nombre}</p>
            <p class="text-xs mt-0.5" style="color:#758175;">${toppingsTxt}</p>
          </div>
          <button type="button" class="cart-remove flex-shrink-0" aria-label="Quitar ${item.nombre}">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
        <div class="flex justify-between items-center mt-3">
          <div class="qty-stepper flex items-center gap-3">
            <button type="button" class="qty-btn" data-action="dec" aria-label="Quitar uno">–</button>
            <span class="font-bold" style="min-width:1.2em; text-align:center;">${item.cantidad}</span>
            <button type="button" class="qty-btn" data-action="inc" aria-label="Agregar uno">+</button>
          </div>
          <span class="font-bold" style="color:#24322a;">${money(subtotalItem(item))}</span>
        </div>`;
      row.querySelector(".cart-remove").addEventListener("click", () => quitarDelCarrito(item.id));
      row.querySelector('[data-action="inc"]').addEventListener("click", () => cambiarCantidad(item.id, 1));
      row.querySelector('[data-action="dec"]').addEventListener("click", () => cambiarCantidad(item.id, -1));
      list.appendChild(row);
    });
  }

  totalEl.textContent = money(totalCarrito());
  submitButton.disabled = carrito.length === 0;
  if (window.lucide) lucide.createIcons();
}

/* ============ WHATSAPP AUTOMÁTICO AL ENVIAR ============
   WhatsApp no permite mandar el mensaje solo: abre el chat con el
   pedido ya escrito, falta que la clienta toque "Enviar" ahí dentro. */
function textoNotificacionPedido(nombre, fechaISO, items, total) {
  const lineas = items.map((item) => {
    const toppingsTxt = [item.gratis, ...item.pago.map((t) => `${t} (+$${item.pagoPrecio})`)].join(", ");
    return `• ${item.cantidad}x ${item.nombre}\n   ${toppingsTxt}`;
  });
  return `🆕 Pedido nuevo — VelvetFrut\nCliente: ${nombre}\nPara el: ${fechaCorta(fechaISO)}\n\n${lineas.join("\n\n")}\n\nTotal: ${money(total)}`;
}

document.getElementById("fabWhatsapp").addEventListener("click", () => {
  const texto = encodeURIComponent("Hola 👋 Tengo una duda sobre el menú de VelvetFrut, ¿me ayudan?");
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${texto}`, "_blank");
});

addToCartButton.addEventListener("click", agregarAlCarrito);

/* ============ ENVIAR PEDIDO ============ */
form.addEventListener("submit", (event) => {
  event.preventDefault();
  message.classList.add("hidden");
  document.getElementById("success-panel").classList.add("hidden");

  const nombre = customerInput.value.trim();
  const fecha = dateInput.value || todayISO();

  if (!nombre) {
    message.textContent = "Escribe tu nombre para continuar.";
    message.className = "mt-4 rounded-xl bg-[#fff0eb] text-[#a53c20] px-4 py-3 text-sm font-semibold";
    message.classList.remove("hidden");
    customerInput.focus();
    return;
  }
  if (carrito.length === 0) {
    message.textContent = "Agrega al menos un producto al carrito antes de enviar.";
    message.className = "mt-4 rounded-xl bg-[#fff0eb] text-[#a53c20] px-4 py-3 text-sm font-semibold";
    message.classList.remove("hidden");
    return;
  }

  const total = totalCarrito();
  const data = {
    id: uid(),
    nombre,
    fecha,
    pedido: {
      items: carrito.map((it) => ({
        key: it.key,
        nombre: it.nombre,
        gratis: it.gratis,
        pago: it.pago,
        cantidad: it.cantidad,
        precioUnitario: unitPriceItem(it),
      })),
    },
    total,
    estado: "pendiente",
    origen: "cliente",
    creadoEn: db ? firebase.firestore.FieldValue.serverTimestamp() : null,
    actualizadoEn: db ? firebase.firestore.FieldValue.serverTimestamp() : null,
  };

  submitButton.disabled = true;

  // No esperamos la confirmación del servidor antes de avisar (con poca
  // señal puede tardar, o Firebase puede no estar disponible); el pedido
  // se manda por WhatsApp de inmediato y, si hay conexión a Firebase,
  // también se guarda en la nube.
  saveVenta(data).catch((err) => console.error("No se pudo guardar el pedido en la nube (igual se envió por WhatsApp):", err));

  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(textoNotificacionPedido(nombre, fecha, carrito, total))}`, "_blank");

  form.reset();
  toppingsSeleccion = {};
  MENU.forEach((x) => { toppingsSeleccion[x.key] = { gratis: x.gratis[0], pago: [] }; });
  productoActual = MENU[0].key;
  carrito = [];
  renderFechas();
  renderChoiceCards();
  renderToppingPanel();
  updateSummary();
  renderCart();

  document.getElementById("success-panel").classList.remove("hidden");
  document.getElementById("success-panel").scrollIntoView({ behavior: "smooth", block: "nearest" });
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

/* ============ INIT ============
   Todo esto corre SIEMPRE, sin importar si Firebase arriba tuvo éxito o no. */
renderFechas();
renderChoiceCards();
renderToppingPanel();
updateSummary();
renderCart();
if (window.lucide) lucide.createIcons();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
