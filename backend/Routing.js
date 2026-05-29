function nearestNeighborOrder() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Routes");
  if (!sheet) throw new Error('Sheet "Routes" not found');

  // D = Latitude, E = Longitude, G = Visit Order
  const COL_LAT = 4;    // D
  const COL_LNG = 5;    // E
  const COL_ORDER = 7;  // G

  // Start point (H1 = Start Lat, I1 = Start Lng)
  const startLat = parseFloat(sheet.getRange("H1").getValue());
  const startLng = parseFloat(sheet.getRange("I1").getValue());

  if (!isFinite(startLat) || !isFinite(startLng)) {
    throw new Error("Start point missing! Put Start Lat in H1 and Start Lng in I1.");
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  // Read A:G (up to Visit Order col)
  const data = sheet.getRange(2, 1, lastRow - 1, COL_ORDER).getValues();

  // Collect valid points
  const points = [];
  for (let i = 0; i < data.length; i++) {
    const lat = parseFloat(data[i][COL_LAT - 1]);
    const lng = parseFloat(data[i][COL_LNG - 1]);
    if (isFinite(lat) && isFinite(lng)) {
      points.push({ rowIndex: i, lat, lng });
    }
  }

  if (points.length === 0) throw new Error("No valid Lat/Lng found in D & E.");

  // ✅ Step 1: Nearest Neighbor initial order
  let curLat = startLat;
  let curLng = startLng;

  const remaining = points.slice();
  const route = [];

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDist = Infinity;

    for (let j = 0; j < remaining.length; j++) {
      const p = remaining[j];
      const d = haversineKm(curLat, curLng, p.lat, p.lng);
      if (d < bestDist) {
        bestDist = d;
        bestIndex = j;
      }
    }

    const chosen = remaining.splice(bestIndex, 1)[0];
    route.push(chosen);
    curLat = chosen.lat;
    curLng = chosen.lng;
  }

  // ✅ Step 2: Improve using 2-OPT
  const improved = twoOptImprove(route, startLat, startLng);

  // Write Visit Order
  const orderMap = new Map();
  improved.forEach((p, idx) => orderMap.set(p.rowIndex, idx + 1));

  const output = data.map((row, i) => [orderMap.get(i) || ""]);
  sheet.getRange(2, COL_ORDER, output.length, 1).setValues(output);
}


// ✅ 2-OPT optimization (reduces crossing / backtracking)
function twoOptImprove(route, startLat, startLng) {
  let bestRoute = route.slice();
  let improved = true;

  function totalDistance(r) {
    let dist = 0;
    let curLat = startLat;
    let curLng = startLng;

    for (let i = 0; i < r.length; i++) {
      dist += haversineKm(curLat, curLng, r[i].lat, r[i].lng);
      curLat = r[i].lat;
      curLng = r[i].lng;
    }
    return dist;
  }

  let bestDist = totalDistance(bestRoute);

  while (improved) {
    improved = false;

    for (let i = 0; i < bestRoute.length - 1; i++) {
      for (let k = i + 1; k < bestRoute.length; k++) {
        const newRoute = bestRoute.slice();
        const reversed = newRoute.slice(i, k + 1).reverse();
        newRoute.splice(i, k - i + 1, ...reversed);

        const newDist = totalDistance(newRoute);
        if (newDist + 0.00001 < bestDist) {
          bestRoute = newRoute;
          bestDist = newDist;
          improved = true;
        }
      }
    }
  }

  return bestRoute;
}


function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return 2 * R * Math.asin(Math.sqrt(a));
}
