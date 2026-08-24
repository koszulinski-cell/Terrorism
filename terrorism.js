const map = L.map("map").setView([39.5, -98.35], 4);

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors"
  }
).addTo(map);

const markers = L.layerGroup().addTo(map);

let allIncidents = [];


/*
 * Public GTD-derived CSV.
 *
 * This is a publicly accessible historical derivative containing
 * incident-level GTD fields including date, country, state,
 * city, latitude, longitude, deaths and injuries.
 */
const DATA_URL =
  "https://gist.githubusercontent.com/ScottPanIE/23f2f193dbce67d6c432ff58170b9923/raw/gtd.csv";


function number(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return 0;
  }

  return n;
}


function cleanDate(row) {

  if (row.date_parsed) {
    return row.date_parsed.substring(0, 10);
  }

  const year = row.iyear;
  const month = String(row.imonth || 1).padStart(2, "0");
  const day = String(row.iday || 1).padStart(2, "0");

  if (year) {
    return `${year}-${month}-${day}`;
  }

  return "Unknown";
}


function parseCSV(text) {

  const rows = [];

  let row = [];
  let value = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {

    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      value += '"';
      i++;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {

      if (char === "\r" && next === "\n") {
        i++;
      }

      row.push(value);
      value = "";

      if (row.some(v => v.trim() !== "")) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    value += char;
  }

  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }

  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map(h => h.trim());

  return rows.slice(1).map(values => {

    const obj = {};

    headers.forEach((header, index) => {
      obj[header] = (values[index] || "").trim();
    });

    return obj;
  });
}


function normalize(row) {

  const latitude = number(row.latitude);
  const longitude = number(row.longitude);

  if (!latitude || !longitude) {
    return null;
  }

  if (
    latitude < 24 ||
    latitude > 50 ||
    longitude < -130 ||
    longitude > -60
  ) {
    return null;
  }

  return {

    date: cleanDate(row),

    city:
      row.city ||
      row.location ||
      "Unknown",

    state:
      row.provstate ||
      row.province ||
      "",

    latitude,
    longitude,

    killed:
      number(row.nkill),

    injured:
      number(row.nwound),

    attackType:
      row.attacktype1_txt ||
      "Terrorism",

    target:
      row.targtype1_txt ||
      "",

    perpetrator:
      row.gname ||
      "Unknown",

    summary:
      row.summary ||
      "",

    category: "terrorism",

    source: "Global Terrorism Database-derived data"

  };
}


async function loadData() {

  const status = document.getElementById("status");

  status.textContent =
    "Loading historical terrorism incidents from the public dataset...";

  try {

    const response = await fetch(DATA_URL);

    if (!response.ok) {
      throw new Error(
        `Dataset returned HTTP ${response.status}`
      );
    }

    const text = await response.text();

    const parsed = parseCSV(text);

    const normalized = parsed
      .map(normalize)
      .filter(Boolean);

    /*
     * Only keep United States incidents.
     *
     * The source file contains multiple countries.
     * The geographic bounds above additionally prevent
     * obviously non-U.S. records from appearing.
     */
    allIncidents = normalized;

    populateYears();

    render();

    status.textContent =
      `Loaded ${allIncidents.length.toLocaleString()} mapped U.S. incidents.`;

  } catch (error) {

    console.error(error);

    status.innerHTML =
      `<strong>Unable to load the incident dataset.</strong><br>
       ${error.message}`;

  }

}


function populateYears() {

  const select = document.getElementById("year");

  const years = [
    ...new Set(
      allIncidents
        .map(i => i.date.substring(0, 4))
        .filter(y => /^\d{4}$/.test(y))
    )
  ].sort();

  for (const year of years) {

    const option = document.createElement("option");

    option.value = year;
    option.textContent = year;

    select.appendChild(option);
  }

}


function getFilteredIncidents() {

  const category =
    document.getElementById("category").value;

  const year =
    document.getElementById("year").value;

  return allIncidents.filter(incident => {

    if (
      category !== "all" &&
      incident.category !== category
    ) {
      return false;
    }

    if (
      year !== "all" &&
      !incident.date.startsWith(year)
    ) {
      return false;
    }

    return true;

  });

}


function clearMarkers() {
  markers.clearLayers();
}


function render() {

  clearMarkers();

  const incidents =
    getFilteredIncidents();

  let deaths = 0;
  let injuries = 0;

  const list =
    document.getElementById("incidentList");

  list.innerHTML = "";

  /*
   * Draw map markers.
   */
  incidents.forEach(incident => {

    deaths += incident.killed;
    injuries += incident.injured;

    const marker =
      L.circleMarker(
        [
          incident.latitude,
          incident.longitude
        ],
        {
          radius:
            incident.killed > 0
              ? Math.min(
                  12,
                  5 + Math.sqrt(incident.killed)
                )
              : 5,

          fillOpacity: 0.65,

          weight: 1
        }
      );

    marker.bindPopup(`

      <div style="min-width:220px">

        <strong>
          ${escapeHTML(incident.city)}
          ${incident.state
            ? ", " + escapeHTML(incident.state)
            : ""}
        </strong>

        <br><br>

        <strong>Date:</strong>
        ${escapeHTML(incident.date)}

        <br>

        <strong>Attack type:</strong>
        ${escapeHTML(incident.attackType)}

        <br>

        <strong>Killed:</strong>
        ${incident.killed}

        <br>

        <strong>Injured:</strong>
        ${incident.injured}

        ${
          incident.target
            ? `<br><strong>Target:</strong>
               ${escapeHTML(incident.target)}`
            : ""
        }

        ${
          incident.perpetrator
            ? `<br><strong>Group/Perpetrator:</strong>
               ${escapeHTML(incident.perpetrator)}`
            : ""
        }

        ${
          incident.summary
            ? `<br><br>${escapeHTML(incident.summary)}`
            : ""
        }

        <br><br>

        <small>
          Source: Global Terrorism Database-derived data
        </small>

      </div>

    `);

    marker.addTo(markers);

  });


  /*
   * Statistics.
   */
  document.getElementById(
    "incidentCount"
  ).textContent =
    incidents.length.toLocaleString();

  document.getElementById(
    "deathCount"
  ).textContent =
    deaths.toLocaleString();

  document.getElementById(
    "injuryCount"
  ).textContent =
    injuries.toLocaleString();


  /*
   * Incident list.
   *
   * Limit the displayed list so a large historical
   * dataset does not make the browser sluggish.
   */
  const displayLimit = 500;

  incidents
    .slice()
    .sort((a, b) =>
      b.date.localeCompare(a.date)
    )
    .slice(0, displayLimit)
    .forEach(incident => {

      const div =
        document.createElement("div");

      div.className = "incident";

      div.innerHTML = `

        <strong>
          ${escapeHTML(incident.date)}
          —
          ${escapeHTML(incident.city)}
          ${incident.state
            ? ", " + escapeHTML(incident.state)
            : ""}
        </strong>

        ${escapeHTML(incident.attackType)}

        <br>

        Killed: ${incident.killed}
        &nbsp; | &nbsp;
        Injured: ${incident.injured}

      `;

      div.addEventListener(
        "click",
        () => {

          map.setView(
            [
              incident.latitude,
              incident.longitude
            ],
            10
          );

        }
      );

      list.appendChild(div);

    });

}


function escapeHTML(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


document
  .getElementById("category")
  .addEventListener("change", render);


document
  .getElementById("year")
  .addEventListener("change", render);


document
  .getElementById("reset")
  .addEventListener("click", () => {

    document.getElementById("category").value = "all";

    document.getElementById("year").value = "all";

    render();

  });


loadData();
