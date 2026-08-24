let incidents = [];
let map = null;
let markers = [];

const DATA_FILE = "terrorism-data.json";


// --------------------------------------------------
// START
// --------------------------------------------------

document.addEventListener("DOMContentLoaded", loadData);


// --------------------------------------------------
// LOAD DATA
// --------------------------------------------------

async function loadData() {

  try {

    const response = await fetch(DATA_FILE, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        `Could not load ${DATA_FILE} (${response.status})`
      );
    }

    const data = await response.json();

    /*
     * Accept either:
     *
     * [
     *   {...},
     *   {...}
     * ]
     *
     * OR:
     *
     * {
     *   incidents: [...]
     * }
     */

    if (Array.isArray(data)) {

      incidents = data;

    } else if (Array.isArray(data.incidents)) {

      incidents = data.incidents;

    } else {

      throw new Error(
        "terrorism-data.json does not contain an incident array."
      );

    }


    console.log(
      `Loaded ${incidents.length} terrorism incidents.`
    );


    initializePage();

  } catch (error) {

    console.error(error);

    showError(
      "The terrorism dataset could not be loaded.",
      error.message
    );

  }

}


// --------------------------------------------------
// INITIALIZE PAGE
// --------------------------------------------------

function initializePage() {

  initializeMap();

  populateFilters();

  updatePage();

}


// --------------------------------------------------
// MAP
// --------------------------------------------------

function initializeMap() {

  const mapElement =
    document.getElementById("map");

  if (!mapElement) {

    console.error(
      "Map element #map was not found."
    );

    return;
  }


  map = L.map("map").setView(
    [39.8283, -98.5795],
    4
  );


  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
    }
  ).addTo(map);

}


// --------------------------------------------------
// FILTERS
// --------------------------------------------------

function populateFilters() {

  const yearSelect =
    document.getElementById("yearFilter");

  const stateSelect =
    document.getElementById("stateFilter");


  const years = new Set();
  const states = new Set();


  incidents.forEach(incident => {

    const year = getYear(incident);

    if (year) {
      years.add(year);
    }


    const state = getState(incident);

    if (state) {
      states.add(state);
    }

  });


  if (yearSelect) {

    [...years]
      .sort((a, b) => b - a)
      .forEach(year => {

        const option =
          document.createElement("option");

        option.value = year;
        option.textContent = year;

        yearSelect.appendChild(option);

      });


    yearSelect.addEventListener(
      "change",
      updatePage
    );

  }


  if (stateSelect) {

    [...states]
      .sort()
      .forEach(state => {

        const option =
          document.createElement("option");

        option.value = state;
        option.textContent = state;

        stateSelect.appendChild(option);

      });


    stateSelect.addEventListener(
      "change",
      updatePage
    );

  }


  const search =
    document.getElementById("search");


  if (search) {

    search.addEventListener(
      "input",
      updatePage
    );

  }

}


// --------------------------------------------------
// FIELD HELPERS
// --------------------------------------------------

function getYear(incident) {

  const value =
    incident.year ??
    incident.Year ??
    incident.date ??
    incident.Date ??
    incident.incident_date ??
    incident.incidentDate;


  if (value === null || value === undefined) {
    return null;
  }


  const match =
    String(value).match(/\b(19|20)\d{2}\b/);


  return match
    ? Number(match[0])
    : null;

}


function getDate(incident) {

  return (
    incident.date ??
    incident.Date ??
    incident.incident_date ??
    incident.incidentDate ??
    ""
  );

}


function getState(incident) {

  return String(
    incident.state ??
    incident.State ??
    incident.state_name ??
    incident.stateName ??
    ""
  );

}


function getCity(incident) {

  return String(
    incident.city ??
    incident.City ??
    ""
  );

}


function getDescription(incident) {

  return String(
    incident.description ??
    incident.Description ??
    incident.summary ??
    incident.Summary ??
    incident.details ??
    ""
  );

}


function getKilled(incident) {

  return getNumber(
    incident.killed ??
    incident.Killed ??
    incident.deaths ??
    incident.Deaths ??
    incident.fatalities ??
    incident.Fatalities
  );

}


function getInjured(incident) {

  return getNumber(
    incident.injured ??
    incident.Injured ??
    incident.injuries ??
    incident.Injuries ??
    incident.wounded ??
    incident.Wounded
  );

}


function getNumber(value) {

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : 0;

}


// --------------------------------------------------
// COORDINATES
// --------------------------------------------------

function getCoordinates(incident) {

  const latitude =
    Number(
      incident.latitude ??
      incident.Latitude ??
      incident.lat ??
      incident.Lat ??
      incident.y
    );


  const longitude =
    Number(
      incident.longitude ??
      incident.Longitude ??
      incident.lon ??
      incident.lng ??
      incident.Lng ??
      incident.x
    );


  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {

    return null;

  }


  /*
   * Basic geographic sanity check.
   *
   * This keeps obviously broken coordinates
   * from being plotted.
   */

  if (
    latitude < 18 ||
    latitude > 72 ||
    longitude < -180 ||
    longitude > -50
  ) {

    return null;

  }


  return {
    latitude,
    longitude
  };

}


// --------------------------------------------------
// FILTER
// --------------------------------------------------

function getFilteredIncidents() {

  const year =
    document.getElementById("yearFilter")?.value
    || "all";


  const state =
    document.getElementById("stateFilter")?.value
    || "all";


  const search =
    (
      document.getElementById("search")?.value
      || ""
    )
    .toLowerCase()
    .trim();


  return incidents.filter(incident => {

    const incidentYear =
      String(getYear(incident) || "");


    const incidentState =
      getState(incident);


    const searchable =
      JSON.stringify(incident)
        .toLowerCase();


    if (
      year !== "all" &&
      incidentYear !== year
    ) {

      return false;

    }


    if (
      state !== "all" &&
      incidentState !== state
    ) {

      return false;

    }


    if (
      search &&
      !searchable.includes(search)
    ) {

      return false;

    }


    return true;

  });

}


// --------------------------------------------------
// UPDATE PAGE
// --------------------------------------------------

function updatePage() {

  const filtered =
    getFilteredIncidents();


  updateStatistics(filtered);

  updateMap(filtered);

  updateTable(filtered);

}


// --------------------------------------------------
// STATISTICS
// --------------------------------------------------

function updateStatistics(data) {

  const total =
    document.getElementById("totalAttacks");


  const killed =
    document.getElementById("totalKilled");


  const injured =
    document.getElementById("totalInjured");


  if (total) {

    total.textContent =
      data.length.toLocaleString();

  }


  let deaths = 0;
  let injuries = 0;


  data.forEach(incident => {

    deaths += getKilled(incident);

    injuries += getInjured(incident);

  });


  if (killed) {

    killed.textContent =
      deaths.toLocaleString();

  }


  if (injured) {

    injured.textContent =
      injuries.toLocaleString();

  }

}


// --------------------------------------------------
// MAP
// --------------------------------------------------

function updateMap(data) {

  if (!map) {
    return;
  }


  markers.forEach(marker => {

    map.removeLayer(marker);

  });


  markers = [];


  let plotted = 0;


  data.forEach(incident => {

    const coordinates =
      getCoordinates(incident);


    /*
     * If an incident doesn't have coordinates,
     * we keep it in the statistics/table but
     * don't put it on the map.
     */

    if (!coordinates) {

      return;

    }


    plotted++;


    const city =
      getCity(incident);


    const state =
      getState(incident);


    const date =
      getDate(incident);


    const description =
      getDescription(incident);


    const killed =
      getKilled(incident);


    const injured =
      getInjured(incident);


    const location =
      [city, state]
        .filter(Boolean)
        .join(", ");


    const popup = `

      <div style="min-width:220px">

        <strong>
          ${escapeHtml(location || "United States")}
        </strong>

        <br>

        ${escapeHtml(String(date))}

        <br><br>

        ${escapeHtml(
          description ||
          "No description available."
        )}

        <br><br>

        <strong>Killed:</strong>
        ${killed}

        &nbsp;&nbsp;

        <strong>Injured:</strong>
        ${injured}

      </div>

    `;


    const marker =
      L.circleMarker(
        [
          coordinates.latitude,
          coordinates.longitude
        ],
        {
          radius: 7,
          weight: 1,
          fillOpacity: 0.75
        }
      );


    marker
      .bindPopup(popup)
      .addTo(map);


    markers.push(marker);

  });


  console.log(
    `Map plotted ${plotted} of ${data.length} incidents.`
  );

}


// --------------------------------------------------
// TABLE
// --------------------------------------------------

function updateTable(data) {

  const table =
    document.getElementById(
      "incidentTable"
    );


  if (!table) {
    return;
  }


  table.innerHTML = "";


  const sorted =
    data
      .slice()
      .sort((a, b) => {

        const dateA =
          new Date(getDate(a));


        const dateB =
          new Date(getDate(b));


        return dateB - dateA;

      });


  sorted
    .slice(0, 250)
    .forEach(incident => {

      const row =
        document.createElement("tr");


      row.innerHTML = `

        <td>
          ${escapeHtml(
            String(getDate(incident))
          )}
        </td>

        <td>
          ${escapeHtml(
            getCity(incident)
          )}
        </td>

        <td>
          ${escapeHtml(
            getState(incident)
          )}
        </td>

        <td>
          ${escapeHtml(
            getDescription(incident) ||
            "—"
          )}
        </td>

        <td>
          ${getKilled(incident)}
        </td>

        <td>
          ${getInjured(incident)}
        </td>

      `;


      table.appendChild(row);

    });


  if (data.length > 250) {

    const row =
      document.createElement("tr");


    row.innerHTML = `

      <td colspan="6">

        Showing the 250 most recent
        incidents. Use the filters to
        narrow the results.

      </td>

    `;


    table.appendChild(row);

  }

}


// --------------------------------------------------
// ERROR
// --------------------------------------------------

function showError(title, details) {

  const error =
    document.getElementById("error");


  if (!error) {
    return;
  }


  error.innerHTML = `

    <div class="error">

      <strong>
        ${escapeHtml(title)}
      </strong>

      <br><br>

      ${escapeHtml(details)}

    </div>

  `;

}


// --------------------------------------------------
// ESCAPE HTML
// --------------------------------------------------

function escapeHtml(value) {

  return String(value)

    .replaceAll("&", "&amp;")

    .replaceAll("<", "&lt;")

    .replaceAll(">", "&gt;")

    .replaceAll('"', "&quot;")

    .replaceAll("'", "&#039;");

}
