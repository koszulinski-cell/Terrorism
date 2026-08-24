/*
  U.S. POLITICAL VIOLENCE & TERRORISM MAP

  Primary public source:
  S2 Underground Incident Response Team
  ArcGIS Domestic Terrorism Tracker

  The source describes this as a master list of high-profile
  terror attacks in the United States that meet its stated
  FBI-based definition.

  This page labels those records "Terrorism / extremist violence"
  rather than presenting them as a complete census of all
  political violence in the United States.
*/

const TERRORISM_URL =
  "https://services.arcgis.com/OeCRCKr7XFYQNdyJ/arcgis/rest/services/Domestic_Terrorism_Tracker/FeatureServer/1/query";

const map = L.map("map").setView([39.8283, -98.5795], 4);

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    attribution:
      '&copy; OpenStreetMap contributors'
  }
).addTo(map);

const markers = L.layerGroup().addTo(map);

const statusElement = document.getElementById("status");

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function firstValue(attributes, possibleNames) {
  for (const name of possibleNames) {
    if (
      attributes &&
      attributes[name] !== undefined &&
      attributes[name] !== null &&
      attributes[name] !== ""
    ) {
      return attributes[name];
    }
  }

  return "";
}

function formatDate(value) {
  if (!value) {
    return "Date not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function createMarker(feature) {
  const attributes = feature.attributes || {};
  const geometry = feature.geometry || {};

  let latitude = geometry.y;
  let longitude = geometry.x;

  /*
    ArcGIS can sometimes return Web Mercator coordinates.
    Convert them to latitude/longitude when necessary.
  */

  if (
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    const earthRadius = 6378137;

    longitude =
      (longitude / earthRadius) * (180 / Math.PI);

    latitude =
      (2 *
        Math.atan(
          Math.exp(latitude / earthRadius)
        ) -
        Math.PI / 2) *
      (180 / Math.PI);
  }

  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return false;
  }

  const date = firstValue(attributes, [
    "Date",
    "DATE",
    "date",
    "Incident_Date",
    "incident_date",
    "Attack_Date",
    "attack_date"
  ]);

  const city = firstValue(attributes, [
    "City",
    "CITY",
    "city",
    "Location",
    "location"
  ]);

  const state = firstValue(attributes, [
    "State",
    "STATE",
    "state",
    "State_Name",
    "state_name"
  ]);

  const title = firstValue(attributes, [
    "Name",
    "NAME",
    "name",
    "Incident",
    "incident",
    "Incident_Name",
    "incident_name",
    "Attack",
    "attack",
    "Title",
    "title"
  ]);

  const description = firstValue(attributes, [
    "Description",
    "DESCRIPTION",
    "description",
    "Details",
    "details",
    "Summary",
    "summary"
  ]);

  const fatalities = firstValue(attributes, [
    "Fatalities",
    "FATALITIES",
    "fatalities",
    "Killed",
    "killed",
    "Deaths",
    "deaths"
  ]);

  const injuries = firstValue(attributes, [
    "Injuries",
    "INJURIES",
    "injuries",
    "Wounded",
    "wounded"
  ]);

  const location =
    [city, state]
      .filter(Boolean)
      .join(", ") ||
    "Location not available";

  const incidentTitle =
    title ||
    "Terrorism / extremist violence incident";

  const popup = `
    <div style="max-width:320px">
      <h3 style="margin-top:0">
        ${escapeHtml(incidentTitle)}
      </h3>

      <p>
        <strong>Category:</strong>
        Terrorism / extremist violence
      </p>

      <p>
        <strong>Date:</strong>
        ${escapeHtml(formatDate(date))}
      </p>

      <p>
        <strong>Location:</strong>
        ${escapeHtml(location)}
      </p>

      ${
        fatalities !== ""
          ? `
            <p>
              <strong>Fatalities:</strong>
              ${escapeHtml(fatalities)}
            </p>
          `
          : ""
      }

      ${
        injuries !== ""
          ? `
            <p>
              <strong>Injuries:</strong>
              ${escapeHtml(injuries)}
            </p>
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
    [latitude, longitude],
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

async function loadTerrorismData() {
  statusElement.textContent =
    "Loading terrorism and political-violence records…";

  try {
    /*
      Ask ArcGIS for every available record.

      resultRecordCount is deliberately below the service's
      maximum record count, and pagination is handled below.
    */

    let allFeatures = [];
    let offset = 0;

    while (true) {
      const params = new URLSearchParams({
        where: "1=1",
        outFields: "*",
        returnGeometry: "true",
        outSR: "4326",
        f: "json",
        resultOffset: String(offset),
        resultRecordCount: "2000"
      });

      const response = await fetch(
        `${TERRORISM_URL}?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(
          data.error.message ||
          "ArcGIS returned an error."
        );
      }

      const features = data.features || [];

      allFeatures.push(...features);

      if (
        features.length < 2000 ||
        data.exceededTransferLimit !== true
      ) {
        break;
      }

      offset += features.length;

      /*
        Safety limit so a future dataset change cannot cause
        an accidental endless request loop.
      */
      if (offset > 50000) {
        break;
      }
    }

    markers.clearLayers();

    let plotted = 0;

    for (const feature of allFeatures) {
      if (createMarker(feature)) {
        plotted++;
      }
    }

    statusElement.innerHTML = `
      <strong>${plotted.toLocaleString()}</strong>
      mapped incidents
      &nbsp;•&nbsp;
      Public terrorism dataset
    `;

    /*
      If records exist but none have coordinates, make that
      obvious rather than silently displaying an empty map.
    */

    if (allFeatures.length > 0 && plotted === 0) {
      statusElement.innerHTML = `
        ${allFeatures.length.toLocaleString()}
        records were returned, but none contained usable
        map coordinates.
      `;
    }

  } catch (error) {
    console.error(error);

    statusElement.innerHTML = `
      <strong>Unable to load the incident data.</strong>
      <br>
      Please refresh the page and try again.
    `;
  }
}

loadTerrorismData();
