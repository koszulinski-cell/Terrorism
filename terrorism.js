const TERRORISM_DATA_URL = "/terrorism-data.json";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatDate(value) {
  if (!value) return "Unknown";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function incidentPopup(incident) {
  return `
    <div class="popup">
      <h3>${escapeHtml(incident.title || "Terrorism incident")}</h3>

      <p>
        <strong>Date:</strong>
        ${escapeHtml(formatDate(incident.date))}
      </p>

      <p>
        <strong>Location:</strong>
        ${escapeHtml(
          [incident.city, incident.state]
            .filter(Boolean)
            .join(", ")
        )}
      </p>

      <p>
        <strong>Fatalities:</strong>
        ${formatNumber(incident.fatalities)}
      </p>

      <p>
        <strong>Injuries:</strong>
        ${formatNumber(incident.injuries)}
      </p>

      ${
        incident.category
          ? `<p><strong>Category:</strong> ${escapeHtml(incident.category)}</p>`
          : ""
      }

      ${
        incident.description
          ? `<p>${escapeHtml(incident.description)}</p>`
          : ""
      }

      ${
        incident.source
          ? `<p class="source">
              Source: ${escapeHtml(incident.source)}
            </p>`
          : ""
      }
    </div>
  `;
}

async function loadTerrorismData() {
  const response = await fetch(TERRORISM_DATA_URL, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Could not load terrorism-data.json");
  }

  return response.json();
}

function buildPage(data) {
  const incidents = Array.isArray(data.incidents)
    ? data.incidents
    : [];

  document.title = "Domestic Terrorism | Today";

  document.body.innerHTML = `
    <header class="top">
      <div>
        <a class="back" href="/">← Today</a>
        <h1>Domestic Terrorism</h1>
        <p class="subtitle">
          U.S. terrorism incidents represented in the selected dataset
        </p>
      </div>
    </header>

    <main>

      <section class="controls">

        <label for="year">
          Year
        </label>

        <select id="year">
          <option value="all">All years</option>
        </select>

      </section>

      <section class="stats">

        <div class="stat">
          <div class="stat-number" id="incident-count">0</div>
          <div class="stat-label">Incidents</div>
        </div>

        <div class="stat">
          <div class="stat-number" id="fatality-count">0</div>
          <div class="stat-label">Fatalities</div>
        </div>

        <div class="stat">
          <div class="stat-number" id="injury-count">0</div>
          <div class="stat-label">Injuries</div>
        </div>

      </section>

      <section class="map-container">
        <div id="map"></div>
      </section>

      <section class="about">

        <h2>About this map</h2>

        <p>
          This map displays incidents contained in the selected
          terrorism dataset. It should not be interpreted as a
          comprehensive count of every violent incident in the
          United States.
        </p>

        <p>
          Definitions of terrorism vary among datasets and agencies.
          Classification, geographic coverage, and historical coverage
          depend on the underlying source.
        </p>

        <p>
          <strong>Dataset:</strong>
          <a
            href="${escapeHtml(data.sourceUrl || "#")}"
            target="_blank"
            rel="noopener noreferrer"
          >
            ${escapeHtml(data.source || "Source dataset")}
          </a>
        </p>

        ${
          data.updated
            ? `<p>
                <strong>Dataset date:</strong>
                ${escapeHtml(data.updated)}
              </p>`
            : ""
        }

      </section>

    </main>
  `;

  const years = [
    ...new Set(
      incidents
        .map(item => {
          if (!item.date) return null;

          const date = new Date(item.date);

          if (Number.isNaN(date.getTime())) {
            return String(item.date).slice(0, 4);
          }

          return String(date.getFullYear());
        })
        .filter(Boolean)
    )
  ].sort((a, b) => Number(b) - Number(a));

  const yearSelect = document.getElementById("year");

  years.forEach(year => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    yearSelect.appendChild(option);
  });

  const map = L.map("map", {
    scrollWheelZoom: true
  }).setView([39.5, -98.35], 4);

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }
  ).addTo(map);

  const markerLayer = L.layerGroup().addTo(map);

  function updateMap() {
    markerLayer.clearLayers();

    const selectedYear = yearSelect.value;

    const filtered = incidents.filter(incident => {

      if (selectedYear === "all") {
        return true;
      }

      if (!incident.date) {
        return false;
      }

      const date = new Date(incident.date);

      if (!Number.isNaN(date.getTime())) {
        return String(date.getFullYear()) === selectedYear;
      }

      return String(incident.date).startsWith(selectedYear);
    });

    let fatalities = 0;
    let injuries = 0;

    filtered.forEach(incident => {

      fatalities += Number(incident.fatalities || 0);
      injuries += Number(incident.injuries || 0);

      const latitude = Number(incident.latitude);
      const longitude = Number(incident.longitude);

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        return;
      }

      const marker = L.circleMarker(
        [latitude, longitude],
        {
          radius: 6,
          weight: 1,
          fillOpacity: 0.75
        }
      );

      marker.bindPopup(
        incidentPopup(incident),
        {
          maxWidth: 350
        }
      );

      marker.addTo(markerLayer);
    });

    document.getElementById("incident-count").textContent =
      formatNumber(filtered.length);

    document.getElementById("fatality-count").textContent =
      formatNumber(fatalities);

    document.getElementById("injury-count").textContent =
      formatNumber(injuries);
  }

  yearSelect.addEventListener("change", updateMap);

  updateMap();
}

async function start() {

  try {

    const data = await loadTerrorismData();

    buildPage(data);

  } catch (error) {

    document.body.innerHTML = `
      <main style="
        max-width:800px;
        margin:60px auto;
        padding:20px;
        font-family:system-ui;
      ">

        <h1>Domestic Terrorism</h1>

        <p>
          The map data could not be loaded.
        </p>

        <p style="color:#b00020;">
          ${escapeHtml(error.message)}
        </p>

        <p>
          Check that <code>terrorism-data.json</code>
          exists in the website files.
        </p>

        <p>
          <a href="/">← Return to Today</a>
        </p>

      </main>
    `;

  }

}

start();
