const CONFIG = {
  API_KEY: "c7711bb63c1d0ec2d36b5652c80c9aac",
  BASE_URL: "https://api.openweathermap.org/data/2.5",
  ICON_URL: "https://openweathermap.org/img/wn",
  HISTORY_KEY: "weatherapp_history",
  MAX_HISTORY: 6,
};

// State aplikasi (di-mutate lewat fungsi, bukan langsung dari DOM)
const state = {
  unit: "metric", // 'metric' = °C, 'imperial' = °F
  lastCity: null,
};

// Elemen-elemen DOM
const els = {
  form: document.getElementById("searchForm"),
  input: document.getElementById("cityInput"),
  resultArea: document.getElementById("resultArea"),
  forecastArea: document.getElementById("forecastArea"),
  historyRow: document.getElementById("historyRow"),
  unitC: document.getElementById("unitC"),
  unitF: document.getElementById("unitF"),
};

// ----------------------------------------------------------
// Utilities (pakai array methods: map, filter, reduce)
// ----------------------------------------------------------

const unitSymbol = () => (state.unit === "metric" ? "°C" : "°F");

const getHistory = () => {
  try {
    const raw = localStorage.getItem(CONFIG.HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveToHistory = (city) => {
  const current = getHistory();
  // filter: buang duplikat kota yang sama (case-insensitive)
  const withoutDupes = current.filter(
    (item) => item.toLowerCase() !== city.toLowerCase()
  );
  const updated = [city, ...withoutDupes].slice(0, CONFIG.MAX_HISTORY);
  localStorage.setItem(CONFIG.HISTORY_KEY, JSON.stringify(updated));
  renderHistory();
};

const renderHistory = () => {
  const history = getHistory();
  els.historyRow.innerHTML = "";
  if (history.length === 0) return;

  // map: ubah tiap kota jadi tombol chip
  const chips = history.map((city) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "history__chip";
    btn.textContent = city;
    btn.addEventListener("click", () => {
      els.input.value = city;
      fetchWeather(city);
    });
    return btn;
  });

  chips.forEach((chip) => els.historyRow.appendChild(chip));
};

// Ambil rata-rata suhu 24 jam ke depan dari data forecast (contoh pakai reduce)
const averageUpcomingTemp = (forecastList) => {
  const next8 = forecastList.slice(0, 8); // 8 x 3 jam = 24 jam
  if (next8.length === 0) return null;
  const total = next8.reduce((sum, item) => sum + item.main.temp, 0);
  return Math.round(total / next8.length);
};

// ----------------------------------------------------------
// Rendering
// ----------------------------------------------------------

const showLoading = () => {
  els.resultArea.innerHTML = `
    <div class="result__loading">
      <span class="spinner"></span>
      <span>Mengambil data cuaca...</span>
    </div>
  `;
  els.forecastArea.innerHTML = "";
};

const showError = (message) => {
  els.resultArea.innerHTML = `
    <div class="result__error">
      <strong>Gagal memuat cuaca</strong>
      <span>${message}</span>
    </div>
  `;
  els.forecastArea.innerHTML = "";
};

const renderWeather = (data) => {
  const { name, sys, main, weather, wind } = data;
  const icon = weather[0].icon;
  const desc = weather[0].description;

  els.resultArea.innerHTML = `
    <div class="weather-card">
      <div class="weather-card__top">
        <div>
          <p class="weather-card__place">${name} <span>${sys.country ?? ""}</span></p>
          <p class="weather-card__desc">${desc}</p>
        </div>
        <div class="weather-card__main">
          <img class="weather-card__icon" src="${CONFIG.ICON_URL}/${icon}@2x.png" alt="${desc}" />
          <span class="weather-card__temp">${Math.round(main.temp)}${unitSymbol()}</span>
        </div>
      </div>
      <div class="weather-card__grid">
        <div class="weather-card__stat">
          <b>${Math.round(main.feels_like)}${unitSymbol()}</b>
          <small>Terasa</small>
        </div>
        <div class="weather-card__stat">
          <b>${main.humidity}%</b>
          <small>Kelembaban</small>
        </div>
        <div class="weather-card__stat">
          <b>${Math.round(wind.speed)} ${state.unit === "metric" ? "m/s" : "mph"}</b>
          <small>Angin</small>
        </div>
      </div>
    </div>
  `;
};

// map: ubah data forecast 3-jam-an jadi 5 kartu harian (siang hari, jam 12:00)
const renderForecast = (forecastList) => {
  const dailyNoon = forecastList.filter((item) => item.dt_txt.includes("12:00:00"));
  const cards = dailyNoon
    .slice(0, 5)
    .map((item) => {
      const date = new Date(item.dt * 1000);
      const dayLabel = date.toLocaleDateString("id-ID", { weekday: "short" });
      const icon = item.weather[0].icon;
      return `
        <div class="forecast__day">
          <p>${dayLabel}</p>
          <img src="${CONFIG.ICON_URL}/${icon}.png" alt="${item.weather[0].description}" />
          <b>${Math.round(item.main.temp)}${unitSymbol()}</b>
        </div>
      `;
    })
    .join("");

  els.forecastArea.innerHTML = cards;
};

// ----------------------------------------------------------
// Fetch data (async/await + error handling)
// ----------------------------------------------------------

const fetchWeather = async (city) => {
  if (!city || !city.trim()) return;
  state.lastCity = city;
  showLoading();

  if (CONFIG.API_KEY === "YOUR_API_KEY_HERE") {
    showError(
      "API key belum diisi. Buka script.js, ganti CONFIG.API_KEY dengan API key OpenWeatherMap kamu."
    );
    return;
  }

  try {
    const weatherUrl = `${CONFIG.BASE_URL}/weather?q=${encodeURIComponent(
      city
    )}&units=${state.unit}&lang=id&appid=${CONFIG.API_KEY}`;

    const weatherRes = await fetch(weatherUrl);

    // Error handling: kota tidak ditemukan (404)
    if (weatherRes.status === 404) {
      showError(`Kota "${city}" tidak ditemukan. Cek ejaannya dan coba lagi.`);
      return;
    }

    if (!weatherRes.ok) {
      showError(`Server mengembalikan error (${weatherRes.status}). Coba lagi nanti.`);
      return;
    }

    const weatherData = await weatherRes.json();
    renderWeather(weatherData);
    saveToHistory(weatherData.name);

    // Ambil forecast 5 hari sekaligus
    const forecastUrl = `${CONFIG.BASE_URL}/forecast?q=${encodeURIComponent(
      city
    )}&units=${state.unit}&lang=id&appid=${CONFIG.API_KEY}`;
    const forecastRes = await fetch(forecastUrl);

    if (forecastRes.ok) {
      const forecastData = await forecastRes.json();
      renderForecast(forecastData.list);
    }
  } catch (err) {
    // Error handling: network error (offline, DNS gagal, dll)
    console.error(err);
    showError("Tidak bisa terhubung ke server. Periksa koneksi internetmu.");
  }
};

// ----------------------------------------------------------
// Event listeners
// ----------------------------------------------------------

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const city = els.input.value.trim();
  fetchWeather(city);
});

const setUnit = (unit) => {
  state.unit = unit;
  els.unitC.classList.toggle("is-active", unit === "metric");
  els.unitF.classList.toggle("is-active", unit === "imperial");
  if (state.lastCity) fetchWeather(state.lastCity);
};

els.unitC.addEventListener("click", () => setUnit("metric"));
els.unitF.addEventListener("click", () => setUnit("imperial"));

// Render riwayat pencarian saat halaman dibuka
renderHistory();
