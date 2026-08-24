const SERVICE_URL =
  "https://services1.arcgis.com/Ezk9fcjSUkeadg6u/ArcGIS/rest/services/Lab9_WFL1/FeatureServer/0";

const QUERY_URL = SERVICE_URL + "/query";

const map = L.map("map").setView([39.5, -98.35], 4);

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 18
  }
).addTo(map);

const markers = L.layerGroup().addTo(map);

let incidents = [];

const PAGE_SIZE = 2000;


/*
 * Safely read a property even if the
 * ArcGIS field uses different capitalization.
 */
function getProperty(properties, names, fallback = "") {

  for (const name of names) {

    if (
      properties[name] !== undefined &&
      properties[name] !== null
    ) {
      return properties[name];
    }

  }

  return fallback;
}


/*
 * Escape text before putting it into HTML.
 */
function escapeHTML(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/*
 * Get all records from ArcGIS.
 *
 * The service allows 2,000 records per request,
 * so we retrieve them in pages.
 */
async function loadAllRecords() {

  const status =
    document.getElementById("status");

  status.textContent =
    "Connecting to the public terrorism dataset…";


  let allFeatures = [];

  let offset = 0;


  while (true) {

    status.textContent =
      `Loading terrorism incidents… ${
        allFeatures.length.toLocaleString()
      } records retrieved`;


    const params =
      new URLSearchParams({

        where: "1=1",

        outFields: "*",

        returnGeometry: "true",

        outSR: "4326",

        resultOffset: String(offset),

        resultRecordCount: String(PAGE_SIZE),

        orderByFields: "OBJECTID ASC",

        f: "json"

      });


    const response =
      await fetch(
        QUERY_URL +
        "?" +
        params.toString()
      );


    if (!response.ok) {

      throw new Error(
        `ArcGIS returned HTTP ${response.status}`
      );

    }


    const data =
      await response.json();


    if (data.error) {

      throw new Error(
        data.error.message ||
        "ArcGIS returned an error."
      );

    }


    const features =
      data.features || [];


    allFeatures =
      allFeatures.concat(features);


    /*
     * If fewer than 2,000 came back,
     * we have reached the end.
     */
    if (
      features.length < PAGE_SIZE
    ) {
      break;
    }


    offset += PAGE_SIZE;


    /*
     * Safety limit so a broken service
     * cannot create an infinite loop.
     */
    if (offset > 100000) {
      break;
    }

  }


  return allFeatures;

}


/*
 * Convert ArcGIS records into the
 * simpler structure used by the page.
 */
function normalizeFeatures(features) {

  return features
    .map(feature => {

      const p =
        feature.attributes || {};

      const geometry =
        feature.geometry || {};


      let longitude =
        geometry.x;

      let latitude =
        geometry.y;


      /*
       * Some ArcGIS services may return
       * coordinates in the geometry object.
       */
      if (
        longitude === undefined ||
        latitude === undefined
      ) {

        if (
          geometry.coordinates &&
          geometry.coordinates.length >= 2
        ) {

          longitude =
            geometry.coordinates[0];

          latitude =
            geometry.coordinates[1];

        }

      }


      if (
        longitude === undefined ||
        latitude === undefined ||
        longitude === null ||
        latitude === null
      ) {

        return null;

      }


      const year =
        getProperty(
          p,
          [
            "Year",
            "YEAR",
            "iyear",
            "IYEAR"
          ]
        );


      const month =
        getProperty(
          p,
          [
            "Month",
            "MONTH",
            "imonth",
            "IMONTH"
          ]
        );


      const day =
        getProperty(
          p,
          [
            "Day",
            "DAY",
            "iday",
            "IDAY"
          ]
        );


      const city =
        getProperty(
          p,
          [
            "City",
            "CITY",
            "city"
          ],
          "Unknown"
        );


      const state =
        getProperty(
          p,
          [
            "State",
            "STATE",
            "state"
          ],
          ""
        );


      const killedRaw =
        getProperty(
          p,
          [
            "Killed",
            "KILLED",
            "nkill",
            "NKILL"
          ],
          0
        );


      const injuredRaw =
        getProperty(
          p,
          [
            "Injured",
            "INJURED",
            "nwound",
            "NWOUND"
          ],
          0
        );


      const description =
        getProperty(
          p,
          [
            "Description",
            "DESCRIPTION",
            "summary",
            "SUMMARY",
            "Summary"
          ],
          ""
        );


      const id =
        getProperty(
          p,
          [
            "OBJECTID",
            "eventid",
            "EVENTID"
          ],
          ""
        );


      return {

        id,

        year,

        month,

        day,

        city,

        state,

        latitude: Number(latitude),

        longitude: Number(longitude),

        killed:
          Number(killedRaw) || 0,

        injured:
          Number(injuredRaw) || 0,

        description

      };

    })
    .filter(Boolean);

}


/*
 * Fill the year selector.
 */
function populateYears() {

  const select =
    document.getElementById("year");


  const years =
    [
      ...new Set(
        incidents
          .map(
            incident =>
              String(incident.year)
          )
          .filter(
            year =>
              /^\d{4}$/.test(year)
          )
      )
    ]
    .sort();


  for (const year of years) {

    const option =
      document.createElement("option");

    option.value = year;

    option.textContent = year;

    select.appendChild(option);

  }

}


/*
 * Apply the year filter.
 */
function getFilteredIncidents() {

  const selectedYear =
    document.getElementById("year").value;


  if (
    selectedYear === "all"
  ) {

    return incidents;

  }


  return incidents.filter(
    incident =>
      String(incident.year) ===
      selectedYear
  );

}


/*
 * Draw the map and incident list.
 */
function render() {

  markers.clearLayers();


  const data =
    getFilteredIncidents();


  const list =
    document.getElementById(
      "incidentList"
    );


  list.innerHTML = "";


  let totalKilled = 0;

  let totalInjured = 0;


  for (const incident of data) {

    totalKilled +=
      incident.killed;


    totalInjured +=
      incident.injured;


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
                  15,
                  5 +
                  Math.sqrt(
                    incident.killed
                  )
                )
              : 5,

          fillOpacity: 0.65,

          weight: 1
        }
      );


    const date =
      [
        incident.year,
        incident.month,
        incident.day
      ]
      .filter(
        value =>
          value !== "" &&
          value !== null &&
          value !== undefined
      )
      .join("-");


    marker.bindPopup(`

      <div style="min-width:230px">

        <h3 style="margin-top:0">

          ${escapeHTML(
            incident.city
          )}

          ${
            incident.state
              ? ", " +
                escapeHTML(
                  incident.state
                )
              : ""
          }

        </h3>

        <strong>Date:</strong>
        ${escapeHTML(date)}

        <br><br>

        <strong>Killed:</strong>
        ${incident.killed}

        <br>

        <strong>Injured:</strong>
        ${incident.injured}

        ${
          incident.description
            ? `
              <br><br>
              ${escapeHTML(
                incident.description
              )}
            `
            : ""
        }

        <br><br>

        <small>
          Source: START / Global Terrorism Database
          derived public geographic dataset.
        </small>

      </div>

    `);


    marker.addTo(markers);


    const item =
      document.createElement(
        "div"
      );


    item.className =
      "incident";


    item.innerHTML = `

      <strong>

        ${escapeHTML(date)}

        —

        ${escapeHTML(
          incident.city
        )}

        ${
          incident.state
            ? ", " +
              escapeHTML(
                incident.state
              )
            : ""
        }

      </strong>

      <br>

      Killed:
      ${incident.killed}

      &nbsp; | &nbsp;

      Injured:
      ${incident.injured}

    `;


    item.addEventListener(
      "click",
      () => {

        map.setView(
          [
            incident.latitude,
            incident.longitude
          ],
          10
        );

        marker.openPopup();

      }
    );


    list.appendChild(item);

  }


  document.getElementById(
    "incidentCount"
  ).textContent =
    data.length.toLocaleString();


  document.getElementById(
    "deathCount"
  ).textContent =
    totalKilled.toLocaleString();


  document.getElementById(
    "injuryCount"
  ).textContent =
    totalInjured.toLocaleString();

}


/*
 * Reset button.
 */
document
  .getElementById("reset")
  .addEventListener(
    "click",
    () => {

      document.getElementById(
        "year"
      ).value = "all";

      render();

    }
  );


/*
 * Year filter.
 */
document
  .getElementById("year")
  .addEventListener(
    "change",
    render
  );


/*
 * Start everything.
 */
async function start() {

  try {

    const features =
      await loadAllRecords();


    incidents =
      normalizeFeatures(
        features
      );


    if (!incidents.length) {

      throw new Error(
        "The public dataset returned records, but none contained usable map coordinates."
      );

    }


    populateYears();

    render();


    document.getElementById(
      "status"
    ).innerHTML = `

      <strong>
        ${incidents.length.toLocaleString()}
        incidents loaded.
      </strong>

      <br>

      Source: University of Maryland START /
      Global Terrorism Database-derived
      public geographic dataset.

    `;

  } catch (error) {

    console.error(error);


    document.getElementById(
      "status"
    ).innerHTML = `

      <strong>
        The incident dataset could not be loaded.
      </strong>

      <br><br>

      ${escapeHTML(
        error.message
      )}

      <br><br>

      Open your browser's developer console
      if you need the technical error.

    `;

  }

}


start();
