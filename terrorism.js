const DATA_URL =
  "https://services.arcgis.com/OeCRCKr7XFYQNdyJ/arcgis/rest/services/Domestic_Terrorism_Tracker/FeatureServer/1/query";

let map;
let markers;
let allIncidents = [];

function escapeHtml(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getValue(a, names) {
  for (const name of names) {
    if (
      a[name] !== undefined &&
      a[name] !== null &&
      a[name] !== ""
    ) {
      return a[name];
    }
  }

  return "";
}

function formatDate(value) {
  if (!value) return "Date unavailable";

  const d = new Date(value);

  if (isNaN(d.getTime())) {
    return String(value);
  }

  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function getTitle(a) {
  return getValue(a, [
    "Incident_Name",
    "incident_name",
    "Incident",
    "incident",
    "Name",
    "name",
    "Title",
    "title",
    "Attack",
    "attack"
  ]) || "Terrorism incident";
}

function getDate(a) {
  return getValue(a, [
    "Incident_Date",
    "incident_date",
    "Date",
    "DATE",
    "date",
    "Attack_Date",
    "attack_date"
  ]);
}

function getCity(a) {
  return getValue(a, [
    "City",
    "CITY",
    "city",
    "Location",
    "location"
  ]);
}

function getState(a) {
  return getValue(a, [
    "State",
    "STATE",
    "state",
    "State_Name",
    "state_name"
  ]);
}

function getDescription(a) {
  return getValue(a, [
    "Description",
    "description",
    "DESCRIPTION",
    "Details",
    "details",
    "Summary",
    "summary"
  ]);
}

function getFatalities(a) {
  return getValue(a, [
    "Fatalities",
    "fatalities",
    "FATALITIES",
    "Killed",
    "killed",
    "Deaths",
    "deaths"
  ]);
}

function getInjuries(a) {
  return getValue(a, [
    "Injuries",
    "injuries",
    "INJURIES",
    "Wounded",
    "wounded"
  ]);
}

function addIncident(feature) {
  if (!feature || !feature.geometry) return false;

  const a = feature.attributes || {};

  let x = feature.geometry.x;
  let y = feature.geometry.y;

  if (
    typeof x !== "number" ||
    typeof y !== "number"
  ) {
    return false;
  }

  /*
    The ArcGIS service uses Web Mercator (EPSG:3857).
    Convert to normal longitude/latitude.
  */

  if (
    Math.abs(x) > 180 ||
    Math.abs(y) > 90
  ) {
    const R = 6378137;

    x =
      (x / R) *
      (180 / Math.PI);

    y =
      (2 *
        Math.atan(
          Math.exp(y / R)
        ) -
        Math.PI / 2) *
      (180 / Math.PI);
  }

  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y)
  ) {
    return false;
  }

  if (
    x < -180 ||
    x > 180 ||
    y < -90 ||
    y > 90
  ) {
    return false;
  }

  const title = getTitle(a);
  const date = getDate(a);
  const city = getCity(a);
  const state = getState(a);
  const description = getDescription(a);
  const fatalities = getFatalities(a);
  const injuries = getInjuries(a);

  const location =
    [city, state]
      .filter(Boolean)
      .join(", ") ||
    "Location unavailable";

  const popup = `
    <div style="
      max-width:340px;
      font-family:Arial,sans-serif;
      line-height:1.45;
    ">

      <h3 style="
        margin:0 0 10px 0;
        font-size:18px;
      ">
        ${escapeHtml(title)}
      </h3>

      <div>
        <strong>Category:</strong>
        Terrorism / extremist violence
      </div>

      <div>
        <strong>Date:</strong>
        ${escapeHtml(formatDate(date))}
      </div>

      <div>
        <strong>Location:</strong>
        ${escapeHtml(location)}
      </div>

      ${
        fatalities !== ""
          ? `
            <div>
              <strong>Fatalities:</strong>
              ${escapeHtml(fatalities)}
            </div>
          `
          : ""
      }

      ${
        injuries !== ""
          ? `
            <div>
              <strong>Injuries:</strong>
              ${escapeHtml(injuries)}
            </div>
          `
          : ""
      }

      ${
        description
          ? `
            <p>
              ${escapeHtml(description)}
            </p>
          `
          : ""
      }

      <hr>

      <small>
        Source: S2 Underground Incident Response Team,
        Domestic Terrorism Tracker.
      </small>

    </div>
  `;

  const marker = L.circleMarker(
    [y, x],
    {
      radius: 7,
      weight: 2,
      fillOpacity: 0.75
    }
  );

  marker.bindPopup(popup);

  marker.addTo(markers);

  return true;
}

async function requestPage(offset) {
  const params = new URLSearchParams();

  params.set("where", "1=1");
  params.set("outFields", "*");
  params.set("returnGeometry", "true");
  params.set("outSR", "4326");
  params.set("f", "json");

  /*
    ArcGIS permits up to 2,000 records per request.
  */

  params.set("resultOffset", String(offset));
  params.set("resultRecordCount", "2000");

  const response = await fetch(
    DATA_URL + "?" + params.toString()
  );

  if (!response.ok) {
    throw new Error(
      "ArcGIS request failed: HTTP " +
      response.status
    );
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(
      data.error.message ||
      "ArcGIS returned an error."
    );
  }

  return data;
}

async function loadData() {
  const status =
    document.getElementById("status");

  if (status) {
    status.textContent =
      "Loading public terrorism dataset…";
  }

  try {
    let offset = 0;
    let total = 0;

    while (true) {
      const data =
        await requestPage(offset);

      const features =
        data.features || [];

      if (features.length === 0) {
        break;
      }

      allIncidents.push(...features);

      total += features.length;

      if (status) {
        status.textContent =
          "Loading incidents… " +
          total.toLocaleString();
      }

      /*
        Continue if ArcGIS tells us there
        are more records.
      */

      if (
        data.exceededTransferLimit !== true &&
        features.length < 2000
      ) {
        break;
      }

      offset += features.length;

      /*
        Protection against an unexpected
        infinite loop.
      */

      if (offset >= 100000) {
        break;
      }
    }

    markers.clearLayers();

    let mapped = 0;

    for (const incident of allIncidents) {
      if (addIncident(incident)) {
        mapped++;
      }
    }

    if (status) {
      status.innerHTML = `
        <strong>
          ${mapped.toLocaleString()}
        </strong>
        incidents mapped
        &nbsp;•&nbsp;
        ${allIncidents.length.toLocaleString()}
        records retrieved
      `;
    }

    console.log(
      "Terrorism records retrieved:",
      allIncidents.length
    );

    console.log(
      "Terrorism records mapped:",
      mapped
    );

    console.log(
      "First record:",
      allIncidents[0]
    );

  } catch (error) {

    console.error(
      "Terrorism data error:",
      error
    );

    if (status) {
      status.innerHTML = `
        <strong>
          Unable to load the terrorism dataset.
        </strong>
        <br><br>
        ${escapeHtml(error.message)}
      `;
    }
  }
}

function initializeMap() {

  if (
    typeof L === "undefined"
  ) {
    console.error(
      "Leaflet has not loaded."
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
        "&copy; OpenStreetMap contributors"
    }
  ).addTo(map);

  markers =
    L.layerGroup().addTo(map);

  loadData();
}

document.addEventListener(
  "DOMContentLoaded",
  initializeMap
);
