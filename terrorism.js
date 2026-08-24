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

const FEATURE_SERVER =
  "https://services2.arcgis.com/yL7v93RXrxlqkeDx/arcgis/rest/services/Terrorism_Final_Project_WFL1/FeatureServer/12/query";


function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


async function loadData() {

  const status =
    document.getElementById("status");

  status.textContent =
    "Loading U.S. terrorism incidents…";


  const params =
    new URLSearchParams({

      where:
        "Country_Name = 'United States'",

      outFields:
        "*",

      returnGeometry:
        "true",

      outSR:
        "4326",

      f:
        "geojson"

    });


  try {

    const response =
      await fetch(
        FEATURE_SERVER +
        "?" +
        params.toString()
      );


    if (!response.ok) {
      throw new Error(
        `Dataset request failed: HTTP ${response.status}`
      );
    }


    const geojson =
      await response.json();


    if (
      !geojson.features ||
      !geojson.features.length
    ) {

      throw new Error(
        "The data service returned zero U.S. incidents."
      );

    }


    incidents =
      geojson.features
        .map(feature => {

          const p =
            feature.properties || {};

          const geometry =
            feature.geometry;


          if (
            !geometry ||
            !geometry.coordinates ||
            geometry.coordinates.length < 2
          ) {
            return null;
          }


          return {

            id:
              p.eventid ||
              p.EVENTID ||
              p.OBJECTID ||
              "",

            year:
              p.Year ||
              p.year ||
              "",

            month:
              p.Month ||
              p.month ||
              "",

            day:
              p.Day ||
              p.day ||
              "",

            country:
              p.Country_Name ||
              "",

            region:
              p.Region ||
              "",

            city:
              p.City ||
              "Unknown",

            latitude:
              Number(
                geometry.coordinates[1]
              ),

            longitude:
              Number(
                geometry.coordinates[0]
              ),

            description:
              p.summary ||
              p.Summary ||
              "",

            killed:
              Number(
                p.nkill ||
                p.Nkill ||
                0
              ),

            injured:
              Number(
                p.nwound ||
                p.Nwound ||
                0
              )

          };

        })
        .filter(Boolean);


    populateYears();

    render();


    status.innerHTML =
      `<strong>${incidents.length.toLocaleString()}</strong>
       U.S. terrorism incidents loaded from the public
       GTD-derived geographic dataset.`;


  } catch (error) {

    console.error(error);

    status.innerHTML =
      `<strong>Unable to load the incident dataset.</strong>
       <br><br>
       ${escapeHTML(error.message)}`;

  }

}


function populateYears() {

  const select =
    document.getElementById("year");


  const years =
    [...new Set(
      incidents
        .map(i => String(i.year))
        .filter(y => /^\d{4}$/.test(y))
    )]
    .sort();


  for (const year of years) {

    const option =
      document.createElement("option");

    option.value = year;

    option.textContent = year;

    select.appendChild(option);

  }

}


function getFilteredIncidents() {

  const year =
    document.getElementById("year").value;


  if (year === "all") {
    return incidents;
  }


  return incidents.filter(
    incident =>
      String(incident.year) === year
  );

}


function render() {

  markers.clearLayers();


  const data =
    getFilteredIncidents();


  let deaths = 0;
  let injuries = 0;


  const list =
    document.getElementById("incidentList");


  list.innerHTML = "";


  data.forEach(incident => {

    deaths +=
      Number.isFinite(incident.killed)
        ? incident.killed
        : 0;


    injuries +=
      Number.isFinite(incident.injured)
        ? incident.injured
        : 0;


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
                  14,
                  5 + Math.sqrt(
                    incident.killed
                  )
                )
              : 5,

          fillOpacity: 0.65,

          weight: 1
        }
      );


    marker.bindPopup(`

      <div style="min-width:230px">

        <h3 style="margin-top:0">
          ${escapeHTML(incident.city)}
          ${incident.region
            ? ", " +
              escapeHTML(incident.region)
            : ""}
        </h3>

        <strong>Date:</strong>
        ${escapeHTML(
          `${incident.year}-${incident.month}-${incident.day}`
        )}

        <br><br>

        <strong>Killed:</strong>
        ${incident.killed}

        <br>

        <strong>Injured:</strong>
        ${incident.injured}

        ${
          incident.description
            ? `<br><br>
               ${escapeHTML(
                 incident.description
               )}`
            : ""
        }

        <br><br>

        <small>
          Source: Global Terrorism Database-derived
          ArcGIS dataset
        </small>

      </div>

    `);


    marker.addTo(markers);


    const item =
      document.createElement("div");


    item.className =
      "incident";


    item.innerHTML = `

      <strong>
        ${escapeHTML(
          `${incident.year}-${incident.month}-${incident.day}`
        )}
        —
        ${escapeHTML(incident.city)}
        ${incident.region
          ? ", " +
            escapeHTML(incident.region)
          : ""}
      </strong>

      Killed: ${incident.killed}
      &nbsp; | &nbsp;
      Injured: ${incident.injured}

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

  });


  document.getElementById(
    "incidentCount"
  ).textContent =
    data.length.toLocaleString();


  document.getElementById(
    "deathCount"
  ).textContent =
    deaths.toLocaleString();


  document.getElementById(
    "injuryCount"
  ).textContent =
    injuries.toLocaleString();

}


document
  .getElementById("year")
  .addEventListener(
    "change",
    render
  );


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


loadData();
