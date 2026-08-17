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

/* ============ FIREBASE (mismo proyecto que tu panel de administración) ============ */
const firebaseConfig = {
  apiKey: "PON_AQUI_TU_API_KEY",
  authDomain: "PON_AQUI_TU_PROYECTO.firebaseapp.com",
  projectId: "PON_AQUI_TU_PROYECTO",
  storageBucket: "PON_AQUI_TU_PROYECTO.firebasestorage.app",
  messagingSenderId: "PON_AQUI_TU_MESSAGING_ID",
  appId: "PON_AQUI_TU_APP_ID",
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
db.enablePersistence({ synchronizeTabs: true }).catch(() => {});

function saveVenta(data) {
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

MENU.forEach((m) => { toppingsSeleccion[m.key] = { gratis: m.gratis[0], pago: [] }; });

const customerInput = document.getElementById("customer-name");
const dateInput = document.getElementById("customer-date");
const form = document.getElementById("order-form");
const message = document.getElementById("form-message");
const submitButton = document.getElementById("submit-order");

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

/* ============ RESUMEN ============ */
function calcularTotal() {
  const m = MENU.find((x) => x.key === productoActual);
  const sel = toppingsSeleccion[m.key];
  return m.precio + sel.pago.length * m.pagoPrecio;
}

function updateSummary() {
  const m = MENU.find((x) => x.key === productoActual);
  const sel = toppingsSeleccion[m.key];
  document.getElementById("summary-customer").textContent = customerInput.value.trim() || "—";
  document.getElementById("summary-product").textContent = `${m.nombre} $${m.precio}`;
  document.getElementById("summary-free").textContent = sel.gratis || "Elige tu topping";
  document.getElementById("summary-extras").textContent = sel.pago.length ? sel.pago.join(", ") : "Sin toppings extra";
  document.getElementById("summary-total").textContent = money(calcularTotal());
}

customerInput.addEventListener("input", updateSummary);
dateInput.addEventListener("change", updateSummary);

/* ============ WHATSAPP AUTOMÁTICO AL ENVIAR ============
   WhatsApp no permite mandar el mensaje solo: abre el chat con el
   pedido ya escrito, falta que la clienta toque "Enviar" ahí dentro. */
function textoNotificacionPedido(nombre, fechaISO, m, sel, total) {
  const partes = [sel.gratis];
  sel.pago.forEach((t) => partes.push(`${t} (+$${m.pagoPrecio})`));
  const fechaObj = parseISO(fechaISO);
  const fechaTxt = `${DIA_NOMBRE[fechaObj.getDay()]} ${fechaObj.getDate()}/${fechaObj.getMonth() + 1}`;
  return `🆕 Pedido nuevo — VelvetFrut\nCliente: ${nombre}\nPara el: ${fechaTxt}\n\n• 1x ${m.nombre}\n   ${partes.join(", ")}\n\nTotal: ${money(total)}`;
}

document.getElementById("fabWhatsapp").addEventListener("click", () => {
  const texto = encodeURIComponent("Hola 👋 Tengo una duda sobre el menú de VelvetFrut, ¿me ayudan?");
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${texto}`, "_blank");
});

/* ============ ENVIAR PEDIDO ============ */
form.addEventListener("submit", (event) => {
  event.preventDefault();
  message.classList.add("hidden");
  document.getElementById("success-panel").classList.add("hidden");

  const nombre = customerInput.value.trim();
  const fecha = dateInput.value || todayISO();
  const m = MENU.find((x) => x.key === productoActual);
  const sel = toppingsSeleccion[m.key];

  if (!nombre || !sel.gratis) {
    message.textContent = "Escribe tu nombre y elige tu topping gratis para continuar.";
    message.className = "mt-4 rounded-xl bg-[#fff0eb] text-[#a53c20] px-4 py-3 text-sm font-semibold";
    if (!nombre) customerInput.focus();
    return;
  }

  const total = calcularTotal();
  const data = {
    id: uid(),
    nombre,
    fecha,
    pedido: { items: [{ key: m.key, gratis: sel.gratis, pago: [...sel.pago] }] },
    estado: "pendiente",
    origen: "cliente",
    creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
    actualizadoEn: firebase.firestore.FieldValue.serverTimestamp(),
  };

  submitButton.disabled = true;

  // No esperamos la confirmación del servidor antes de avisar (con poca
  // señal puede tardar); el pedido ya queda guardado localmente y se
  // sincroniza solo en cuanto haya conexión.
  saveVenta(data).catch((err) => console.error("No se pudo enviar el pedido:", err));

  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(textoNotificacionPedido(nombre, fecha, m, sel, total))}`, "_blank");

  form.reset();
  toppingsSeleccion = {};
  MENU.forEach((x) => { toppingsSeleccion[x.key] = { gratis: x.gratis[0], pago: [] }; });
  productoActual = MENU[0].key;
  renderFechas();
  renderChoiceCards();
  renderToppingPanel();
  updateSummary();

  submitButton.disabled = false;
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

/* ============ INIT ============ */
renderFechas();
renderChoiceCards();
renderToppingPanel();
updateSummary();
lucide.createIcons();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
