const ATTACKS_URL =
  "https://services1.arcgis.com/Ezk9fcjSUkeadg6u/ArcGIS/rest/services/US_Attacks_After_2016_Real/FeatureServer/0/query";

async function getAttacks() {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "*",
    returnGeometry: "true",
    outSR: "4326",
    f: "json",
    resultRecordCount: "2000"
  });

  const response = await fetch(`${ATTACKS_URL}?${params}`);

  if (!response.ok) {
    throw new Error(`ArcGIS request failed: ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || "ArcGIS returned an error");
  }

  return data.features || [];
}


function escapeHtml(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function findField(attributes, possibleNames) {
  for (const name of possibleNames) {
    if (
      Object.prototype.hasOwnProperty.call(attributes, name) &&
      attributes[name] !== null &&
      attributes[name] !== ""
    ) {
      return attributes[name];
    }
  }

  return null;
}


function featureToGeoJSON(feature) {
  const attributes = feature.attributes || {};
  const geometry = feature.geometry || {};

  if (
    typeof geometry.x !== "number" ||
    typeof geometry.y !== "number"
  ) {
    return null;
  }

  const year = findField(attributes, [
    "Year",
    "iyear",
    "year",
    "YEAR"
  ]);

  const month = findField(attributes, [
    "Month",
    "imonth",
    "month",
    "MONTH"
  ]);

  const day = findField(attributes, [
    "Day",
    "iday",
    "day",
    "DAY"
  ]);

  const city = findField(attributes, [
    "City",
    "city",
    "CITY"
  ]);

  const state = findField(attributes, [
    "State",
    "state",
    "STATE",
    "Province"
  ]);

  const country = findField(attributes, [
    "Country",
    "country",
    "COUNTRY"
  ]);

  const attackType = findField(attributes, [
    "AttackType",
    "attacktype1_txt",
    "Attack_Type",
    "attack_type"
  ]);

  const target = findField(attributes, [
    "Target",
    "targtype1_txt",
    "Target_Type",
    "target_type"
  ]);

  const group = findField(attributes, [
    "Group",
    "gname",
    "Perpetrator",
    "perpetrator"
  ]);

  const fatalities = findField(attributes, [
    "Fatalities",
    "nkill",
    "Killed",
    "Killed_Count",
    "fatalities"
  ]);

  const injuries = findField(attributes, [
    "Injuries",
    "nwound",
    "Wounded",
    "Injured",
    "injuries"
  ]);

  const description = findField(attributes, [
    "Description",
    "summary",
    "Summary",
    "description"
  ]);

  const dateParts = [];

  if (year) dateParts.push(year);

  if (month && Number(month) > 0) {
    dateParts.push(String(month).padStart(2, "0"));
  }

  if (day && Number(day) > 0) {
    dateParts.push(String(day).padStart(2, "0"));
  }

  const date = dateParts.length
    ? dateParts.join("-")
    : "";

  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [
        geometry.x,
        geometry.y
      ]
    },
    properties: {
      date,
      year,
      month,
      day,
      city,
      state,
      country,
      attackType,
      target,
      group,
      fatalities: fatalities ?? 0,
      injuries: injuries ?? 0,
      description
    }
  };
}


function createPopup(properties) {
  const location = [
    properties.city,
    properties.state
  ]
    .filter(Boolean)
    .join(", ");

  const date = properties.date || "Date unavailable";

  return `
    <div style="min-width:240px">
      <h3 style="margin-top:0">
        Terrorism incident
      </h3>

      <p>
        <strong>Date:</strong>
        ${escapeHtml(date)}
      </p>

      ${
        location
          ? `
            <p>
              <strong>Location:</strong>
              ${escapeHtml(location)}
            </p>
          `
          : ""
      }

      ${
        properties.attackType
          ? `
            <p>
              <strong>Attack type:</strong>
              ${escapeHtml(properties.attackType)}
            </p>
          `
          : ""
      }

      ${
        properties.target
          ? `
            <p>
              <strong>Target:</strong>
              ${escapeHtml(properties.target)}
            </p>
          `
          : ""
      }

      ${
        properties.group
          ? `
            <p>
              <strong>Attributed group:</strong>
              ${escapeHtml(properties.group)}
            </p>
          `
          : ""
      }

      <p>
        <strong>Fatalities:</strong>
        ${escapeHtml(properties.fatalities)}
      </p>

      <p>
        <strong>Injuries:</strong>
        ${escapeHtml(properties.injuries)}
      </p>

      ${
        properties.description
          ? `
            <p>
              <strong>Description:</strong><br>
              ${escapeHtml(properties.description)}
            </p>
          `
          : ""
      }
    </div>
  `;
}


async function initializeMap() {
  const mapElement = document.getElementById("map");

  if (!mapElement) {
    console.error("No element with id='map' was found.");
    return;
  }

  mapElement.innerHTML = `
    <div style="
      padding:20px;
      font-family:system-ui,sans-serif;
    ">
      Loading terrorism incidents...
    </div>
  `;

  try {
    const features = await getAttacks();

    const incidents = features
      .map(featureToGeoJSON)
      .filter(Boolean);

    mapElement.innerHTML = "";

    const map = L.map("map", {
      zoomControl: true
    }).setView([39.5, -98.35], 4);

    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; OpenStreetMap contributors'
      }
    ).addTo(map);

    const markerLayer = L.layerGroup().addTo(map);

    incidents.forEach((incident) => {
      const coordinates =
        incident.geometry.coordinates;

      const marker = L.circleMarker(
        [
          coordinates[1],
          coordinates[0]
        ],
        {
          radius: 5,
          weight: 1,
          fillOpacity: 0.7
        }
      );

      marker.bindPopup(
        createPopup(incident.properties)
      );

      markerLayer.addLayer(marker);
    });

    const total = incidents.length;

    const fatalities = incidents.reduce(
      (sum, incident) =>
        sum +
        Number(
          incident.properties.fatalities || 0
        ),
      0
    );

    const stats = document.getElementById("stats");

    if (stats) {
      stats.innerHTML = `
        <strong>${total.toLocaleString()}</strong>
        incidents displayed
        &nbsp; | &nbsp;
        <strong>${fatalities.toLocaleString()}</strong>
        reported fatalities
      `;
    }

    const source = document.getElementById("source");

    if (source) {
      source.innerHTML = `
        Source:
        <a
          href="https://www.start.umd.edu/gtd"
          target="_blank"
          rel="noopener noreferrer"
        >
          START / Global Terrorism Database
        </a>
      `;
    }

    console.log(
      `Loaded ${total} terrorism incidents.`
    );

  } catch (error) {
    console.error(error);

    mapElement.innerHTML = `
      <div style="
        padding:20px;
        font-family:system-ui,sans-serif;
      ">
        <h3>Unable to load the map</h3>

        <p>
          The terrorism data source could not be reached.
        </p>

        <p>
          Please try refreshing the page.
        </p>
      </div>
    `;
  }
}


document.addEventListener(
  "DOMContentLoaded",
  initializeMap
);
