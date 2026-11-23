/* =========================================================
   Inspección Visual PWA — JavaScript Vanilla
   Sin async/await y sin librerías: solo .then() / .catch() / .finally()
   ========================================================= */

/* ---------- 1. Detección de capacidades ---------- */
const capacidesPWA = {
  serviceWorker: "serviceWorker" in navigator,
  cacheAPI: "caches" in window,
  indexedDB: "indexedDB" in window,
  pushNotifications: "PushManager" in window,
  webBluetooth: "bluetooth" in navigator,
  storage: "storage" in navigator,
  camara: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
};
console.log("Capacidades:", capacidesPWA);

/* ---------- 2. Service Worker ---------- */
if (capacidesPWA.serviceWorker) {
  console.log("Service worker disponible");
  navigator.serviceWorker
    .register("./sw.js")
    .then((registro) => {
      console.log("Service worker registrado. Scope:", registro.scope);
    })
    .catch((error) => {
      console.error("No se pudo registrar el service worker:", error);
    });
} else {
  console.log("Service worker no disponible");
}

/* ---------- 3. Referencias al DOM ---------- */
const btnInstalar = document.getElementById("btn-instalar");
const btnPrepararCamara = document.getElementById("btn-preparar-camara");
const btnConfirmarPermiso = document.getElementById("btn-confirmar-permiso");
const btnCancelarPermiso = document.getElementById("btn-cancelar-permiso");
const btnAlternarCamara = document.getElementById("btn-alternar-camara");
const btnApagarCamara = document.getElementById("btn-apagar-camara");
const avisoPermiso = document.getElementById("aviso-permiso");
const controlesActivos = document.getElementById("controles-activos");
const visorVideo = document.getElementById("visor-camara");
const visor = document.querySelector(".visor");
const visorVacio = document.getElementById("visor-vacio");
const mensajeEstado = document.getElementById("mensaje-estado");
const ayudaIOS = document.getElementById("ayuda-ios");

/* ---------- 4. Utilidades de interfaz ---------- */
// tipo: "ok" | "error" | undefined (neutro)
function actualizarMensajeEstado(texto, tipo) {
  mensajeEstado.textContent = texto;
  mensajeEstado.classList.remove("ok", "error");
  if (tipo) mensajeEstado.classList.add(tipo);
}

// Sincroniza la interfaz con el estado real del hardware
function actualizarInterfazCamara() {
  const encendida = streamActual !== null;
  visor.classList.toggle("activo", encendida);
  visorVacio.hidden = encendida;
  controlesActivos.hidden = !encendida;
  btnPrepararCamara.hidden = encendida;
}

/* ---------- 5. Instalabilidad ---------- */
let eventoInstalacionDiferido = null;

window.addEventListener("beforeinstallprompt", (event) => {
  // Evita que el mini-banner automático aparezca antes de tiempo
  event.preventDefault();
  eventoInstalacionDiferido = event;

  // Muestra tu botón personalizado de instalación en la UI
  btnInstalar.hidden = false;
});

btnInstalar.addEventListener("click", () => {
  if (!eventoInstalacionDiferido) return;

  eventoInstalacionDiferido.prompt();

  eventoInstalacionDiferido.userChoice
    .then((resultado) => {
      if (resultado.outcome === "accepted") {
        console.log("El usuario aceptó instalar la app");
      } else {
        console.log("El usuario descartó la instalación");
      }
    })
    .catch((error) => {
      console.error("Error en el flujo de instalación:", error);
    })
    .finally(() => {
      // prompt() solo se puede usar una vez por evento: se descarta siempre
      eventoInstalacionDiferido = null;
      btnInstalar.hidden = true;
    });
});

window.addEventListener("appinstalled", () => {
  console.log("App instalada");
  eventoInstalacionDiferido = null;
  btnInstalar.hidden = true;
});

// Safari en iOS no dispara beforeinstallprompt: mostramos instrucciones manuales
const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const yaInstalada =
  window.matchMedia("(display-mode: standalone)").matches ||
  navigator.standalone === true;

if (esIOS && !yaInstalada) {
  ayudaIOS.hidden = false;
}

/* ---------- 6. Cámara ---------- */
let streamActual = null;
let modoCamaraActual = "environment"; // 'environment' = trasera | 'user' = frontal

function detenerCamaraActiva() {
  if (streamActual) {
    streamActual.getTracks().forEach((track) => {
      track.stop();
    });
    streamActual = null;
  }
}

// Devuelve una promesa que resuelve true si la cámara quedó encendida, false si falló
function iniciarCamara(modo) {
  detenerCamaraActiva();

  if (!capacidesPWA.camara) {
    actualizarMensajeEstado(
      "Este navegador no permite acceder a la cámara (se requiere HTTPS).",
      "error",
    );
    actualizarInterfazCamara();
    return Promise.resolve(false);
  }

  const restricciones = {
    video: { facingMode: modo },
    audio: false,
  };

  return navigator.mediaDevices
    .getUserMedia(restricciones)
    .then((stream) => {
      streamActual = stream;
      visorVideo.srcObject = stream;
      actualizarMensajeEstado(
        `Cámara activa (${modo === "environment" ? "Trasera" : "Frontal"})`,
        "ok",
      );
      return true;
    })
    .catch((error) => {
      if (error.name === "NotAllowedError") {
        actualizarMensajeEstado(
          "Permiso denegado. Habilita el acceso a la cámara en los ajustes de tu navegador.",
          "error",
        );
      } else if (error.name === "NotFoundError") {
        actualizarMensajeEstado(
          "No se detectó el sensor de cámara solicitado en este dispositivo.",
          "error",
        );
      } else {
        actualizarMensajeEstado(
          `Error al acceder al hardware: ${error.message}`,
          "error",
        );
      }
      return false;
    })
    .finally(() => {
      actualizarInterfazCamara();
    });
}

/* ---------- 7. Flujo de consentimiento previo (pre-permiso) ---------- */
// Paso 1: El usuario pulsa "Solicitar Acceso a Cámara" -> Mostramos aviso explicativo
btnPrepararCamara.addEventListener("click", () => {
  avisoPermiso.hidden = false;
  avisoPermiso.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

// Paso 2: El usuario lee el motivo y pulsa "Aceptar y Encender Cámara"
btnConfirmarPermiso.addEventListener("click", () => {
  avisoPermiso.hidden = true;
  iniciarCamara(modoCamaraActual);
});

// Salida digna: el usuario puede rechazar SIN activar el diálogo nativo
btnCancelarPermiso.addEventListener("click", () => {
  avisoPermiso.hidden = true;
  actualizarMensajeEstado("La cámara sigue apagada. Puedes activarla cuando quieras.");
});

/* ---------- 8. Alternar lentes y apagar ---------- */
btnAlternarCamara.addEventListener("click", () => {
  const modoAnterior = modoCamaraActual;
  modoCamaraActual = modoAnterior === "environment" ? "user" : "environment";

  iniciarCamara(modoCamaraActual).then((exito) => {
    // Si el lente solicitado no existe, volvemos al modo anterior para mantener coherencia
    if (!exito) modoCamaraActual = modoAnterior;
  });
});

btnApagarCamara.addEventListener("click", () => {
  detenerCamaraActiva();
  visorVideo.srcObject = null;
  actualizarMensajeEstado("La cámara está apagada.");
  actualizarInterfazCamara();
});

// Buenas prácticas: liberar el sensor si el usuario oculta la app
document.addEventListener("visibilitychange", () => {
  if (document.hidden && streamActual) {
    detenerCamaraActiva();
    visorVideo.srcObject = null;
    actualizarMensajeEstado("Cámara apagada al salir de la app. Vuelve a activarla cuando la necesites.");
    actualizarInterfazCamara();
  }
});

actualizarInterfazCamara();
