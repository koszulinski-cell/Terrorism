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

const DATA_URL =
  "https://raw.githubusercontent.com/sdasadia/Global-Terrorism-Database/master/data.csv";


function parseCSV(text) {

  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {

    const c = text[i];

    if (c === '"') {

      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = !quoted;
      }

    } else if (c === "," && !quoted) {

      row.push(field);
      field = "";

    } else if ((c === "\n" || c === "\r") && !quoted) {

      if (c === "\r" && text[i + 1] === "\n") {
        i++;
      }

      row.push(field);
      field = "";

      if (row.length > 1) {
        rows.push(row);
      }

      row = [];

    } else {

      field += c;

    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map(h =>
    h.trim().toLowerCase()
  );

  return rows.slice(1).map(values => {

    const object = {};

    headers.forEach((header, index) => {
      object[header] =
        values[index] === undefined
          ? ""
          : values[index].trim();
    });

    return object;

  });
}


function num(value) {

  const n = Number(value);

  return Number.isFinite(n) ? n : 0;

}


function escapeHTML(value) {

  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


function getDate(row) {

  const year = row.iyear;
  const month = String(row.imonth || 1).padStart(2, "0");
  const day = String(row.iday || 1).padStart(2, "0");

  return `${year}-${month}-${day}`;

}


function normalize(row) {

  /*
   * GTD country code 217 = United States.
   *
   * We use country_txt as an additional check.
   */
  const country =
    row.country_txt ||
    row.country;

  if (
    country !== "United States" &&
    country !== "United States of America"
  ) {
    return null;
  }


  const latitude = num(row.latitude);
  const longitude = num(row.longitude);


  /*
   * Some GTD records don't have usable coordinates.
   * Those cannot be plotted.
   */
  if (
    latitude === 0 ||
    longitude === 0 ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }


  /*
   * Geographic sanity check for the United States.
   */
  if (
    latitude < 24 ||
    latitude > 50 ||
    longitude < -130 ||
    longitude > -60
  ) {
    return null;
  }


  return {

    eventId:
      row.eventid || "",

    date:
      getDate(row),

    city:
      row.city || "Unknown",

    state:
      row.provstate || "",

    latitude,

    longitude,

    killed:
      num(row.nkill),

    injured:
      num(row.nwound),

    attackType:
      row.attacktype1_txt ||
      "Unknown",

    target:
      row.targtype1_txt ||
      "Unknown",

    group:
      row.gname ||
      "Unknown",

    summary:
      row.summary ||
      ""

  };

}


async function loadData() {

  const status =
    document.getElementById("status");

  status.textContent =
    "Downloading the public terrorism dataset…";


  try {

    const response =
      await fetch(DATA_URL);


    if (!response.ok) {

      throw new Error(
        "Dataset returned HTTP " +
        response.status
      );

    }


    const text =
      await response.text();


    status.textContent =
      "Processing terrorism incidents…";


    const rows =
      parseCSV(text);


    console.log(
      "Total rows downloaded:",
      rows.length
    );


    incidents =
      rows
        .map(normalize)
        .filter(Boolean);


    console.log(
      "U.S. incidents with coordinates:",
      incidents.length
    );


    if (!incidents.length) {

      throw new Error(
        "The dataset loaded, but no U.S. incidents with usable coordinates were found."
      );

    }


    buildYearFilter();

    render();


    status.innerHTML =
      `<strong>${incidents.length.toLocaleString()}</strong>
       U.S. incidents loaded from the public GTD-derived dataset.`;


  } catch (error) {

    console.error(error);

    status.innerHTML =
      `<strong>Could not load the terrorism dataset.</strong>
       <br><br>
       ${escapeHTML(error.message)}
       <br><br>
       Open the browser developer console for details.`;

  }

}


function buildYearFilter() {

  const select =
    document.getElementById("year");


  const years =
    [...new Set(
      incidents.map(i =>
        i.date.substring(0, 4)
      )
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


function filtered() {

  const year =
    document.getElementById("year").value;


  if (year === "all") {

    return incidents;

  }


  return incidents.filter(
    incident =>
      incident.date.startsWith(year)
  );

}


function render() {

  markers.clearLayers();


  const data =
    filtered();


  let killed = 0;
  let injured = 0;


  const list =
    document.getElementById("incidentList");


  list.innerHTML = "";


  for (const incident of data) {

    killed += incident.killed;

    injured += incident.injured;


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

      <div style="min-width:240px">

        <h3 style="margin-top:0">
          ${escapeHTML(incident.city)}
          ${incident.state
            ? ", " + escapeHTML(incident.state)
            : ""}
        </h3>

        <strong>Date:</strong>
        ${escapeHTML(incident.date)}

        <br><br>

        <strong>Attack:</strong>
        ${escapeHTML(incident.attackType)}

        <br>

        <strong>Target:</strong>
        ${escapeHTML(incident.target)}

        <br>

        <strong>Killed:</strong>
        ${incident.killed}

        <br>

        <strong>Injured:</strong>
        ${incident.injured}

        <br><br>

        <strong>Group:</strong>
        ${escapeHTML(incident.group)}

        ${
          incident.summary
            ? `<br><br>
               ${escapeHTML(incident.summary)}`
            : ""
        }

        <br><br>

        <small>
          Global Terrorism Database-derived data
        </small>

      </div>

    `);


    marker.addTo(markers);


    /*
     * Incident list
     */
    const item =
      document.createElement("div");


    item.className =
      "incident";


    item.innerHTML = `

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


    item.onclick = () => {

      map.setView(
        [
          incident.latitude,
          incident.longitude
        ],
        10
      );

    };


    list.appendChild(item);

  }


  document.getElementById(
    "incidentCount"
  ).textContent =
    data.length.toLocaleString();


  document.getElementById(
    "deathCount"
  ).textContent =
    killed.toLocaleString();


  document.getElementById(
    "injuryCount"
  ).textContent =
    injured.toLocaleString();

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
