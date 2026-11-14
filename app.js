// js/app.js — Controlador principal: gestiona ubicación (Selector / GPS) y coordina API + UI

document.addEventListener("DOMContentLoaded", () => {
  const selectParcela = document.getElementById("parcela-select");
  const btnDetectGps = document.getElementById("btn-detect-gps");
  const btnNextTip = document.getElementById("btn-next-tip");
  const btnIrrigationTip = document.getElementById("btn-irrigation-tip");
  let cropsData = null;
  let lastDashboardData = null;

  if (window.location.protocol === "file:") {
    const message = "Abre el proyecto desde localhost, no como archivo.";
    setApiStatus(message, true);
    setCropDataStatus("Usa Live Server en VS Code para que el navegador pueda leer cultivos.json.", true);
    return;
  }

  /**
   * Carga los datos de la NASA a partir de latitud y longitud y actualiza la pantalla
   */
  async function loadParcelaByCoords(lat, lon, labelName = "Estación NASA conectada") {
    try {
      setApiStatus("Consultando satélite NASA...", false);
      const [data, elevationResult] = await Promise.all([
        fetchNasaParcelaData(lat, lon),
        fetchParcelaElevation(lat, lon).then(
          elevation => ({ elevation, error: null }),
          error => ({ elevation: null, error })
        )
      ]);
      data.elevation = Number.isFinite(data.current.altitude)
        ? data.current.altitude
        : elevationResult.elevation;
      lastDashboardData = data;
      renderDashboard(data, cropsData);
      if (!Number.isFinite(data.elevation)) {
        console.warn("No se pudo obtener la altitud:", elevationResult.error);
        setApiStatus(`${labelName} · Altitud no disponible`, true);
      } else {
        setApiStatus(labelName, false);
      }
    } catch (error) {
      console.error(error);
      setApiStatus(`Error al consultar NASA POWER: ${error.message}`, true);
    }
  }

  /**
   * Solicita el GPS del navegador al agricultor
   */
  function requestUserGps() {
    if (!("geolocation" in navigator)) {
      alert("Tu navegador no soporta geolocalización. Selecciona una parcela de la lista.");
      return;
    }

    setApiStatus("Detectando tu ubicación GPS...", false);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(4);
        const lon = position.coords.longitude.toFixed(4);
        selectParcela.value = "gps";
        loadParcelaByCoords(lat, lon, "Tu parcela (GPS activo)");
      },
      (err) => {
        console.warn("Permiso GPS denegado o fallido:", err.message);
        // Si rechaza el GPS, volvemos a la parcela por defecto (La Esperanza - Huaral)
        selectParcela.value = "-11.50,-77.20";
        loadParcelaByCoords(-11.50, -77.20, "Parcela por defecto activa");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  // 1. Evento: Cuando el agricultor cambia de parcela en el menú desplegable
  selectParcela.addEventListener("change", (e) => {
    const val = e.target.value;
    if (val === "gps") {
      requestUserGps();
    } else {
      const [lat, lon] = val.split(",").map(Number);
      const selectedText = e.target.options[e.target.selectedIndex].text;
      loadParcelaByCoords(lat, lon, `Conectado: ${selectedText.split("(")[0].trim()}`);
    }
  });

  // 2. Evento: Botón directo "Detectar mi parcela" (GPS)
  btnDetectGps.addEventListener("click", () => {
    requestUserGps();
  });

  // 3. Evento: Rotar consejos en la cápsula "Aprende con tu campo"
  btnNextTip.addEventListener("click", () => {
    rotateDidacticTip();
  });

  // 4. Evento: Botón "¿Cómo regar mejor?" del banner
  btnIrrigationTip.addEventListener("click", () => {
    alert(
      "💡 Guía rápida de riego:\n\n" +
      "1. Riega entre las 6:00 a.m. y 8:00 a.m. o después de las 5:00 p.m.\n" +
      "2. Si la humedad de tu tierra está por debajo del 35%, aplica riego profundo cerca de la raíz, no sobre las hojas.\n" +
      "3. Con vientos mayores a 18 km/h, evita el riego por aspersión porque el viento se lleva el agua."
    );
  });

  function loadInitialParcel() {
    const initialVal = selectParcela.value;
    if (initialVal && initialVal !== "gps") {
      const [initLat, initLon] = initialVal.split(",").map(Number);
      loadParcelaByCoords(initLat, initLon, "Estación NASA conectada");
    }
  }

  fetchCropsData()
    .then(data => {
      cropsData = data;
      if (lastDashboardData) renderCropAssessment(lastDashboardData, cropsData);
      else loadInitialParcel();
    })
    .catch(error => {
      console.error(error);
      setCropDataStatus(error.message, true);
      if (!lastDashboardData) loadInitialParcel();
    });
});