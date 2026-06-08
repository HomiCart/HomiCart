function GenerateRoutesFromColumnA() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const routesSheet = ss.getSheetByName("Routes");
  if (!routesSheet) throw new Error('Sheet "Routes" not found');
    // ✅ Sort Routes sheet by "Visit Order" column (G) A → Z
  // Sort range: from row 2 to last row, columns A to I (adjust if you have more columns)
  const lastRowForSort = routesSheet.getLastRow();
  if (lastRowForSort > 2) {
    routesSheet.getRange(2, 1, lastRowForSort - 1, 9).sort({ column: 7, ascending: true });
  }


  // Read all Location links from Column A (starting row 2)
  const lastRow = routesSheet.getLastRow();
  if (lastRow < 2) throw new Error("No data found in Routes sheet.");

  const links = routesSheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();

  // Extract coordinates from each link and keep order
  const coords = [];
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    if (!link) continue;

    const latLng = extractLatLngFromGoogleMapsLink(link);
    if (latLng) coords.push(latLng);
  }

  if (coords.length === 0) throw new Error("No valid Google Maps links found in column A.");

  // Create / clear output sheet
  const outputName = "RouteLinks";
  let outSheet = ss.getSheetByName(outputName);
  if (!outSheet) outSheet = ss.insertSheet(outputName);
  outSheet.clear();

  // Header
  outSheet.getRange(1, 1, 1, 4).setValues([["Route #", "Stops Count", "Google Maps Route Link", "Notes"]]);

  // ── Start point (depot) from H1 = Start Lat, I1 = Start Lng ──
  const sLat = parseFloat(routesSheet.getRange("H1").getValue());
  const sLng = parseFloat(routesSheet.getRange("I1").getValue());
  const depot = (isFinite(sLat) && isFinite(sLng)) ? `${sLat},${sLng}` : null;

  // Group every 10 locations into one route link.
  // Each group is CONTINUOUS with the previous one: it begins from the last
  // stop of the previous group (and the first group begins from the depot),
  // so the delivery path never resets back to the start after 10 stops.
  const groupSize = 10;
  const output = [];
  let routeNumber = 1;
  let connector = depot;   // first group starts from the depot

  for (let start = 0; start < coords.length; start += groupSize) {
    const group = coords.slice(start, start + groupSize);

    // Prepend the connecting origin so the route is one continuous chain
    const linkCoords = connector ? [connector].concat(group) : group.slice();

    const routeLink = buildGoogleMapsDirectionsLink(linkCoords);
    output.push([
      routeNumber,
      group.length,
      routeLink,
      `Stops ${start + 1} → ${start + group.length}` + (connector === depot ? ' (from start point)' : ' (continues from prev route)')
    ]);

    // Next group continues from the LAST stop of this group
    connector = group[group.length - 1];
    routeNumber++;
  }

  // Write results
  outSheet.getRange(2, 1, output.length, 4).setValues(output);

  // Make the links clickable
  for (let r = 0; r < output.length; r++) {
    const url = output[r][2];
    outSheet.getRange(2 + r, 3).setFormula(`=HYPERLINK("${url}","Open Route ${r + 1}")`);
  }

  outSheet.autoResizeColumns(1, 4);
}

function extractLatLngFromGoogleMapsLink(url) {
  try {
    const s = String(url).trim();

    // Pattern: ?q=LAT,LNG
    const m1 = s.match(/[?&]q=(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)/i);
    if (m1) {
      return `${m1[1]},${m1[3]}`;
    }

    // Pattern: @LAT,LNG,zoom
    const m2 = s.match(/@(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)/i);
    if (m2) {
      return `${m2[1]},${m2[3]}`;
    }

    return null;
  } catch (err) {
    return null;
  }
}

function buildGoogleMapsDirectionsLink(coordArray) {
  const base = "https://www.google.com/maps/dir/";
  const path = coordArray.join("/");
  return base + path;
}
