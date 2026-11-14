// js/api.js — Módulo de conexión y limpieza de datos de NASA POWER

const NASA_BASE_URL = "https://power.larc.nasa.gov/api/temporal/daily/point";
const OPENTOPO_BASE_URL = "https://api.opentopodata.org/v1/aster30m";
const NASA_PARAMS = [
  "T2M",               // Temperatura promedio a 2m (°C)
  "T2M_MAX",           // Temperatura máxima (°C)
  "T2M_MIN",           // Temperatura mínima (°C)
  "GWETTOP",           // Humedad superficial de la tierra (0 a 1)
  "RH2M",              // Humedad relativa del aire (%)
  "PRECTOTCORR",       // Lluvia corregida (mm/día)
  "WS10M",             // Velocidad del viento a 10m (m/s)
  "ALLSKY_SFC_SW_DWN"  // Radiación solar
].join(",");

function cleanNasaValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number !== -999 ? number : null;
}

/**
 * Convierte un objeto Date de JS al formato YYYYMMDD que exige la NASA
 */
function formatDateNASA(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * Busca de atrás hacia adelante el último día que NO tenga -999 (dato vacío)
 */
function getLatestValidDayKey(paramObject) {
  const dates = Object.keys(paramObject).sort().reverse();
  for (const dateKey of dates) {
    if (cleanNasaValue(paramObject[dateKey]) !== null) {
      return dateKey;
    }
  }
  return null;
}

/**
 * Consulta la API de NASA POWER para una latitud y longitud específicas
 */
async function fetchNasaParcelaData(lat, lon) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
    throw new Error("Las coordenadas de la parcela no son válidas.");
  }

  // Pedimos una ventana de los últimos 12 días para asegurar 5 días válidos sin -999
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 2); // Restamos 2 días base por el retraso satelital

  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 10);

  const startStr = formatDateNASA(startDate);
  const endStr = formatDateNASA(endDate);

  const url = `${NASA_BASE_URL}?parameters=${NASA_PARAMS}&community=AG&longitude=${lon}&latitude=${lat}&start=${startStr}&end=${endStr}&format=JSON`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error al conectar con NASA POWER: ${response.status}`);
  }

  const rawData = await response.json();
  const params = rawData.properties && rawData.properties.parameter;
  if (!params || !params.T2M) {
    throw new Error("NASA POWER devolvió una respuesta sin datos de temperatura.");
  }
  const coordinates = rawData.geometry && rawData.geometry.coordinates;
  const nasaAltitude = Array.isArray(coordinates) && Number.isFinite(coordinates[2])
    ? Math.round(coordinates[2])
    : null;

  // Detectamos cuál es la fecha más reciente con lectura satelital completa
  const latestDateKey = getLatestValidDayKey(params.T2M);
  if (!latestDateKey) {
    throw new Error("NASA POWER no tiene lecturas válidas para estas coordenadas.");
  }

  const read = parameter => cleanNasaValue(
    params[parameter] && params[parameter][latestDateKey]
  );
  const rawSoil = read("GWETTOP");
  const rawWind = read("WS10M");
  const solar = read("ALLSKY_SFC_SW_DWN");
  const rain = read("PRECTOTCORR");

  const current = {
    dateKey: latestDateKey,
    altitude: nasaAltitude,
    temp: read("T2M") === null ? null : Math.round(read("T2M")),
    tempMax: read("T2M_MAX") === null ? null : Math.round(read("T2M_MAX")),
    tempMin: read("T2M_MIN") === null ? null : Math.round(read("T2M_MIN")),
    soilMoisture: rawSoil === null ? null : Math.round(rawSoil * 100),
    airHumidity: read("RH2M") === null ? null : Math.round(read("RH2M")),
    rain: rain === null ? null : Number(rain.toFixed(1)),
    windKmh: rawWind === null ? null : Math.round(rawWind * 3.6),
    solar: solar === null ? null : Number(solar.toFixed(1))
  };

  // Armamos la lista de los últimos 5 días válidos para la sección inferior
  const validDates = Object.keys(params.T2M)
    .filter(d => cleanNasaValue(params.T2M[d]) !== null
      && params.T2M_MAX
      && cleanNasaValue(params.T2M_MAX[d]) !== null
      && params.T2M_MIN
      && cleanNasaValue(params.T2M_MIN[d]) !== null)
    .slice(-5);

  const history5Days = validDates.map(dKey => {
    const dailyRain = params.PRECTOTCORR
      ? cleanNasaValue(params.PRECTOTCORR[dKey])
      : null;
    return {
      dateKey: dKey,
      tempMax: Math.round(cleanNasaValue(params.T2M_MAX[dKey])),
      tempMin: Math.round(cleanNasaValue(params.T2M_MIN[dKey])),
      rain: dailyRain === null ? null : Number(dailyRain.toFixed(1))
    };
  });

  return {
    coordinates: { lat, lon },
    current,
    history5Days
  };
}

/**
 * Obtiene la elevación del punto en metros sobre el nivel del mar.
 */
async function fetchParcelaElevation(lat, lon) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
    throw new Error("Las coordenadas de la parcela no son válidas.");
  }

  const url = `${OPENTOPO_BASE_URL}?locations=${encodeURIComponent(`${lat},${lon}`)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error al consultar Open Topo Data: ${response.status}`);
  }

  const data = await response.json();
  const elevation = data.results && data.results[0] && data.results[0].elevation;
  if (!Number.isFinite(elevation)) {
    throw new Error("Open Topo Data no devolvió una altitud válida.");
  }

  return Math.round(elevation);
}

async function fetchCropsData() {
  if (window.location.protocol === "file:") {
    throw new Error("Abre el proyecto con un servidor local (por ejemplo, Live Server), no directamente como archivo.");
  }

  const response = await fetch("data/cultivos.json");
  if (!response.ok) {
    throw new Error(`No se pudo cargar data/cultivos.json: ${response.status}`);
  }

  const data = await response.json();
  const rawCrops = Array.isArray(data) ? data : data.crops;
  if (!Array.isArray(rawCrops) || rawCrops.length === 0) {
    throw new Error("data/cultivos.json no contiene reglas de cultivos.");
  }

  const crops = rawCrops.map(crop => {
    const ecocrop = crop.ecocrop || {};
    const gaez = crop.gaez || {};
    const temperature = crop.temperatureC || {
      min: ecocrop.tempMin,
      max: ecocrop.tempMax
    };
    const moisture = crop.soilMoisturePct || {
      min: ecocrop.minMoisture,
      max: ecocrop.maxMoisture === undefined ? 100 : ecocrop.maxMoisture
    };
    const altitude = crop.altitudeM || {
      min: ecocrop.minAltitude === undefined ? 0 : ecocrop.minAltitude,
      max: ecocrop.maxAltitude
    };
    const ranges = [temperature, moisture, altitude];
    if (!crop.name || ranges.some(range =>
      !range || !Number.isFinite(range.min) || !Number.isFinite(range.max) || range.min > range.max
    )) {
      throw new Error(`Reglas incompletas o inválidas para el cultivo "${crop.name || "sin nombre"}".`);
    }

    return {
      ...crop,
      current: crop.current === undefined
        ? Boolean(crop.lot && crop.lot.startsWith("Lote"))
        : Boolean(crop.current),
      temperatureC: temperature,
      soilMoisturePct: moisture,
      altitudeM: altitude,
      soilSuitability: crop.soilSuitability || {
        description: gaez.soilType || "Sin información de suelo",
        ph: null,
        textures: []
      },
      rotationTip: crop.rotationTip || gaez.rotationTip || "Validar rotación con asesoría agronómica."
    };
  });

  return { crops };
}