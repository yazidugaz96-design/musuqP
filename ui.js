// js/ui.js — Cruza NASA POWER + Altitud SRTM + FAO ECOCROP & GAEZ v5 en la interfaz

const DIDACTIC_TIPS = [
  {
    title: '¿Qué significa "mm de lluvia"?',
    body: "1 mm de lluvia equivale a 1 litro de agua repartido en un metro cuadrado de tu parcela. ¡Así sabes cuánta agua recibió realmente tu tierra!"
  },
  {
    title: "Rotación inteligente (FAO GAEZ)",
    body: "Alternar Maíz con Frijol ayuda a reponer el nitrógeno del suelo de forma natural y reduce el gasto en fertilizantes en la siguiente campaña."
  },
  {
    title: "¿Por qué importa la altitud (SRTM)?",
    body: "A mayor altitud las noches son más frías y cambia la radiación. Validar los msnm evita sembrar variedades sensibles a heladas."
  }
];

let currentTipIndex = 0;

function formatFriendlyDay(dateKey, isLast) {
  if (isLast) return "Reciente";
  const year = Number(dateKey.slice(0, 4));
  const month = Number(dateKey.slice(4, 6)) - 1;
  const day = Number(dateKey.slice(6, 8));
  const d = new Date(year, month, day);
  const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  return `${days[d.getDay()]} ${day}`;
}

function setApiStatus(text, isError = false) {
  const pill = document.getElementById("api-status");
  pill.textContent = text;
  const dot = document.createElement("span");
  dot.className = "dot";
  pill.prepend(dot);
  pill.style.background = isError ? "#fce1c2" : "#e9f2ec";
  pill.style.color = isError ? "#b45309" : "#1f4d36";
}

function setCropDataStatus(text, isError = false) {
  const status = document.getElementById("crop-data-status");
  status.textContent = text;
  status.classList.toggle("badge-warn", isError);
}

function displayValue(value, suffix = "") {
  return Number.isFinite(value) ? `${value}${suffix}` : "--";
}

function renderDashboard(data, cropsData) {
  const { coordinates, current, history5Days } = data;
  const elevation = data.elevation;
  const elevationText = Number.isFinite(elevation) ? `${elevation} msnm` : "Altitud no disponible";

  document.getElementById("coord-badge").textContent =
    `Lat: ${Number(coordinates.lat).toFixed(2)}, Lon: ${Number(coordinates.lon).toFixed(2)}`;
  document.getElementById("elevation-badge").textContent = elevationText;

  const dateKey = current.dateKey || "";
  document.getElementById("current-date").textContent = dateKey.length === 8
    ? `Lectura satelital NASA: ${dateKey.slice(6, 8)}/${dateKey.slice(4, 6)}/${dateKey.slice(0, 4)}`
    : "Fecha de lectura no disponible";

  document.getElementById("val-temp").textContent = displayValue(current.temp, "°");
  document.getElementById("val-temp-minmax").textContent =
    `Máx. ${displayValue(current.tempMax, "°")} / Mín. ${displayValue(current.tempMin, "°")}`;
  document.getElementById("val-solar").textContent =
    `Sol: ${displayValue(current.solar, " kWh/m²")}`;

  const iconWeather = document.getElementById("icon-weather");
  const labelState = document.getElementById("label-weather-state");
  const descAdvice = document.getElementById("desc-weather-advice");
  if (Number.isFinite(current.rain) && current.rain > 1) {
    iconWeather.textContent = "🌧️";
    labelState.textContent = "Día con presencia de lluvia";
    descAdvice.textContent = "Aprovecha la humedad natural y revisa el drenaje de tus lotes.";
  } else if (Number.isFinite(current.temp) && current.temp >= 25) {
    iconWeather.textContent = "☀️";
    labelState.textContent = "Cálido y despejado";
    descAdvice.textContent = `Altitud: ${elevationText}. Evita regar al mediodía.`;
  } else {
    iconWeather.textContent = "⛅";
    labelState.textContent = "Clima parcialmente soleado";
    descAdvice.textContent = Number.isFinite(current.temp)
      ? `Clima templado a ${elevationText}, favorable para labores de campo.`
      : "NASA POWER no reportó una temperatura válida.";
  }

  const soilValue = current.soilMoisture;
  document.getElementById("val-soil").textContent = displayValue(soilValue);
  document.getElementById("bar-soil").style.width =
    `${Number.isFinite(soilValue) ? Math.max(0, Math.min(100, soilValue)) : 0}%`;
  const soilCard = document.getElementById("card-soil");
  const soilTag = document.getElementById("tag-soil");
  if (!Number.isFinite(soilValue)) {
    soilCard.classList.remove("card-alert");
    soilTag.textContent = "Sin dato";
    soilTag.className = "badge-tag badge-warn";
    document.getElementById("desc-soil").textContent = "NASA POWER no reportó humedad válida.";
    document.getElementById("banner-title").textContent = "Sin lectura válida de humedad";
    document.getElementById("banner-text").textContent =
      "No se puede confirmar el estrés hídrico con los datos disponibles.";
  } else if (soilValue < 40) {
    soilCard.classList.add("card-alert");
    soilTag.textContent = "Atención";
    soilTag.className = "badge-tag badge-warn";
    document.getElementById("desc-soil").textContent = "Suelo algo seco · Revisa el riego.";
    document.getElementById("banner-title").textContent = "Tu tierra necesita un poco de agua";
    document.getElementById("banner-text").textContent =
      `La humedad superficial está en ${soilValue} %. Revisa el suelo antes de regar.`;
  } else {
    soilCard.classList.remove("card-alert");
    soilTag.textContent = "En rango";
    soilTag.className = "badge-tag";
    document.getElementById("desc-soil").textContent = "Humedad superficial reportada por NASA POWER.";
    document.getElementById("banner-title").textContent = "Humedad de la tierra en buen nivel";
    document.getElementById("banner-text").textContent =
      `Tu suelo registra ${soilValue} % de humedad. Mantén el monitoreo habitual.`;
  }

  document.getElementById("val-air-hum").textContent = displayValue(current.airHumidity);
  document.getElementById("bar-air-hum").style.width =
    `${Number.isFinite(current.airHumidity) ? Math.max(0, Math.min(100, current.airHumidity)) : 0}%`;
  const airTag = document.getElementById("tag-air-hum");
  if (!Number.isFinite(current.airHumidity)) {
    airTag.textContent = "Sin dato";
    document.getElementById("desc-air-hum").textContent = "NASA POWER no reportó humedad del aire válida.";
  } else if (current.airHumidity > 80) {
    airTag.textContent = "Alta";
    document.getElementById("desc-air-hum").textContent = "Ambiente húmedo · Vigila posibles hongos.";
  } else {
    airTag.textContent = "Adecuada";
    document.getElementById("desc-air-hum").textContent = "Vapor de agua presente en el aire.";
  }

  document.getElementById("val-rain").textContent = displayValue(current.rain);
  const rainTag = document.getElementById("tag-rain");
  const rainDescription = document.getElementById("desc-rain");
  if (!Number.isFinite(current.rain)) {
    rainTag.textContent = "Sin dato";
    rainDescription.textContent = "NASA POWER no reportó una lectura válida de lluvia.";
  } else if (current.rain === 0) {
    rainTag.textContent = "Sin lluvia";
    rainDescription.textContent = "No cayó lluvia · El riego depende de ti.";
  } else if (current.rain < 5) {
    rainTag.textContent = "Ligera";
    rainDescription.textContent = "Lluvia ligera · No sustituye el riego.";
  } else {
    rainTag.textContent = "Moderada";
    rainDescription.textContent = "Buen aporte de agua natural.";
  }

  document.getElementById("val-wind").textContent = displayValue(current.windKmh);
  const windTag = document.getElementById("tag-wind");
  if (!Number.isFinite(current.windKmh)) {
    windTag.textContent = "Sin dato";
    windTag.className = "badge-tag badge-warn";
    document.getElementById("desc-wind").textContent = "NASA POWER no reportó viento válido.";
  } else if (current.windKmh < 18) {
    windTag.textContent = "Suave";
    windTag.className = "badge-tag";
    document.getElementById("desc-wind").textContent = "Brisa suave · Buen momento para labores.";
  } else {
    windTag.textContent = "Fuerte";
    windTag.className = "badge-tag badge-warn";
    document.getElementById("desc-wind").textContent = "Viento alto · Evita pulverizar hoy.";
  }

  document.getElementById("didactic-title").textContent = Number.isFinite(current.rain)
    ? `¿Qué significa "${current.rain} mm de lluvia"?`
    : DIDACTIC_TIPS[0].title;
  document.getElementById("didactic-body").textContent = Number.isFinite(current.rain)
    ? `Son ${current.rain} litros de agua por cada metro cuadrado de tierra.`
    : DIDACTIC_TIPS[0].body;

  document.getElementById("recent-days-container").innerHTML = history5Days.map((day, index) => {
    const isLast = index === history5Days.length - 1;
    const icon = day.rain > 1 ? "🌧️" : day.tempMax >= 25 ? "☀️" : "⛅";
    return `<div class="day-pill ${isLast ? "active" : ""}">
      <div>${formatFriendlyDay(day.dateKey, isLast)}</div>
      <div class="day-icon">${icon}</div>
      <div class="day-temps">${displayValue(day.tempMax, "°")} / ${displayValue(day.tempMin, "°")}</div>
      <div class="day-rain">💧 ${displayValue(day.rain, " mm")}</div>
    </div>`;
  }).join("");

  renderCropAssessment(data, cropsData);
}

function renderCropAssessment(data, cropsData) {
  const tbody = document.getElementById("crops-tbody");
  const recommendations = document.getElementById("crop-recommendations");
  if (!cropsData || !Array.isArray(cropsData.crops)) {
    tbody.innerHTML = "";
    recommendations.innerHTML = "";
    setCropDataStatus("No se pudieron cargar las reglas locales de cultivos.", true);
    return;
  }

  const { current } = data;
  const elevation = data.elevation;
  const currentCrops = cropsData.crops.filter(crop => crop.current);
  const alternatives = cropsData.crops.filter(crop => !crop.current);

  tbody.innerHTML = currentCrops.map(crop => {
    const moistureKnown = Number.isFinite(current.soilMoisture);
    const temperatureKnown = Number.isFinite(current.temp);
    const waterStress = moistureKnown && current.soilMoisture < crop.soilMoisturePct.min;
    const heatStress = Number.isFinite(current.tempMax)
      ? current.tempMax > crop.temperatureC.max
      : temperatureKnown && current.temp > crop.temperatureC.max;
    const coldStress = Number.isFinite(current.tempMin)
      ? current.tempMin < crop.temperatureC.min
      : temperatureKnown && current.temp < crop.temperatureC.min;
    const stress = [];
    if (!moistureKnown) stress.push("Humedad sin dato");
    else if (waterStress) stress.push("Estrés hídrico");
    if (!temperatureKnown) stress.push("Temperatura sin dato");
    else if (heatStress || coldStress) stress.push("Estrés térmico");
    const badge = stress.length ? "badge-tag badge-warn" : "badge-tag";
    const action = waterStress
      ? "Revisar riego"
      : heatStress || coldStress
        ? "Vigilar temperatura"
        : crop.rotationTip;

    return `<tr>
      <td><strong>${crop.icon || ""} ${crop.name}</strong><br/><small>${crop.lot || ""} · ${crop.stage || ""}</small></td>
      <td>${displayValue(current.soilMoisture, "%")} (mín. ${crop.soilMoisturePct.min}%)</td>
      <td>${displayValue(current.temp, "°C")} (rango ${crop.temperatureC.min}–${crop.temperatureC.max}°C)</td>
      <td><span class="${badge}">${stress.length ? stress.join(" · ") : "Sin estrés detectado"}</span></td>
      <td>${action}</td>
    </tr>`;
  }).join("");

  document.querySelector(".crop-count").textContent = `${currentCrops.length} cultivos en tu parcela`;
  recommendations.innerHTML = alternatives.map(crop => {
    const tempKnown = Number.isFinite(current.temp);
    const elevationKnown = Number.isFinite(elevation);
    const moistureKnown = Number.isFinite(current.soilMoisture);
    const tempFits = tempKnown
      && current.temp >= crop.temperatureC.min && current.temp <= crop.temperatureC.max;
    const elevationFits = elevationKnown
      && elevation >= crop.altitudeM.min && elevation <= crop.altitudeM.max;
    const moistureFits = moistureKnown
      && current.soilMoisture >= crop.soilMoisturePct.min
      && current.soilMoisture <= crop.soilMoisturePct.max;
    const knownCount = [tempKnown, elevationKnown, moistureKnown].filter(Boolean).length;
    const score = [tempFits, elevationFits, moistureFits].filter(Boolean).length;
    const verdict = knownCount === 0
      ? "Datos insuficientes"
      : score === knownCount && knownCount === 3
        ? "Candidato preliminar"
        : score === 0
          ? "Fuera de rangos medidos"
          : "Evaluar en campo";
    const checks = [
      `Clima: ${tempKnown ? (tempFits ? "compatible" : "fuera de rango") : "sin dato"}`,
      `Altitud: ${elevationKnown ? (elevationFits ? "compatible" : "fuera de rango") : "sin dato"}`,
      `Humedad: ${moistureKnown ? (moistureFits ? "compatible" : "fuera de rango") : "sin dato"}`,
      `Suelo: ${crop.soilSuitability.description || "confirmar pH y textura"}`
    ];
    return `<article class="recommendation-card">
      <div class="recommendation-heading"><strong>${crop.icon || ""} ${crop.name}</strong><span class="badge-tag">${verdict}</span></div>
      <p>${checks.join(" · ")}</p>
      <p>${crop.rotationTip}</p>
    </article>`;
  }).join("");

  setCropDataStatus(
    "Cruce preliminar. Confirma pH, textura y aptitud del lote antes de decidir una siembra.",
    false
  );
}

function rotateDidacticTip() {
  currentTipIndex = (currentTipIndex + 1) % DIDACTIC_TIPS.length;
  const tip = DIDACTIC_TIPS[currentTipIndex];
  document.getElementById("didactic-title").textContent = tip.title;
  document.getElementById("didactic-body").textContent = tip.body;
}