// Shared between TrackPickupScreen (client watching their collector) and
// ActiveJobScreen (collector watching their own position relative to the
// client's destination). One marker is FIXED (destination — client's
// pickup point), the other MOVES (whoever's GPS is being tracked) and
// updates via window.updateMover(lat, lng) called through WebView's
// injectJavaScript, without reloading the whole map.

export type LatLng = { lat: number; lng: number };

// [BIN-19] Single-marker map for AddBinScreen: user starts at their current
// GPS location, can drag the pin to nudge it, and the RN side reads back
// the current pin position via WebView's onMessage (window.ReactNativeWebView
// .postMessage) — the first postMessage/injectJavaScript pattern in this
// codebase to go WebView -> RN rather than only RN -> WebView.
export function buildDraggablePinMapHtml(initialPosition: LatLng, markerColor: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
    .hint {
      position: fixed; bottom: 16px; left: 16px; right: 16px;
      background: rgba(15,23,42,0.85); color: #fff; border-radius: 12px;
      padding: 10px 14px; font-family: -apple-system, Roboto, sans-serif;
      font-size: 13px; text-align: center; z-index: 1000;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="hint">Drag the pin to the exact bin location</div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var pos = [${initialPosition.lat}, ${initialPosition.lng}];
    var map = L.map('map', { zoomControl: false, attributionControl: false }).setView(pos, 18);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    var pinIcon = L.divIcon({
      className: '',
      html: '<div style="background:${markerColor};width:22px;height:22px;border-radius:11px 11px 11px 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 22],
    });

    var marker = L.marker(pos, { icon: pinIcon, draggable: true }).addTo(map);

    function reportPosition() {
      var p = marker.getLatLng();
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ lat: p.lat, lng: p.lng }));
      }
    }

    marker.on('dragend', reportPosition);
    reportPosition();
  </script>
</body>
</html>
  `;
}

export type MapOptions = {
  // [NAV-01] Real turn-by-turn directions for the collector, sourced from
  // OSRM's free public routing API (router.project-osrm.org) — no API key
  // needed, CORS-open, returns real road geometry + maneuver steps (turn
  // left/right, road names) rather than a straight line "as the crow
  // flies". Off by default so the client's existing tracking map (already
  // shipped, no need to touch its behavior) is unaffected.
  showDirections?: boolean;
};

export function buildTrackingMapHtml(destination: LatLng, initialMover: LatLng, moverColor: string, options: MapOptions = {}) {
  const showDirections = !!options.showDirections;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
    .direction-banner {
      position: fixed; top: 10px; left: 10px; right: 10px;
      background: #0f172a; color: #fff; border-radius: 14px; padding: 12px 16px;
      font-family: -apple-system, Roboto, sans-serif; box-shadow: 0 2px 10px rgba(0,0,0,0.35);
      display: none; z-index: 1000; align-items: center;
    }
    .direction-banner.visible { display: flex; }
    .direction-icon { font-size: 24px; margin-right: 12px; }
    .direction-text { font-size: 15px; font-weight: 700; line-height: 1.3; }
    .direction-distance { font-size: 12px; color: #94a3b8; margin-top: 2px; }
  </style>
</head>
<body>
  <div id="map"></div>
  ${showDirections ? `
  <div id="direction-banner" class="direction-banner">
    <span id="direction-icon" class="direction-icon">⬆️</span>
    <div>
      <div id="direction-text" class="direction-text">Getting directions…</div>
      <div id="direction-distance" class="direction-distance"></div>
    </div>
  </div>` : ''}
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var destination = [${destination.lat}, ${destination.lng}];
    var moverStart = [${initialMover.lat}, ${initialMover.lng}];

    var map = L.map('map', { zoomControl: false, attributionControl: false });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    var destinationIcon = L.divIcon({
      className: '',
      html: '<div style="background:#dc2626;width:16px;height:16px;border-radius:8px 8px 8px 0;transform:rotate(45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>',
      iconSize: [16, 16],
    });

    var moverIcon = L.divIcon({
      className: '',
      html: '<div style="background:${moverColor};width:18px;height:18px;border-radius:9px;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>',
      iconSize: [18, 18],
    });

    var destinationMarker = L.marker(destination, { icon: destinationIcon }).addTo(map);
    var moverMarker = L.marker(moverStart, { icon: moverIcon }).addTo(map);
    var straightLine = L.polyline([moverStart, destination], { color: '#0891b2', weight: 3, dashArray: '6, 8' }).addTo(map);

    map.fitBounds(straightLine.getBounds(), { padding: [50, 50] });

    ${showDirections ? `
    var routedLine = null;
    var directionsInFlight = false;

    function iconFor(type, modifier) {
      if (type === 'arrive') return '🏁';
      if (type === 'depart') return '⬆️';
      if (type === 'roundabout' || type === 'rotary') return '🔄';
      if (modifier && modifier.indexOf('left') !== -1) return '⬅️';
      if (modifier && modifier.indexOf('right') !== -1) return '➡️';
      return '⬆️';
    }

    function textFor(step) {
      var m = step.maneuver, type = m.type, modifier = m.modifier, name = step.name;
      var road = name ? (' onto ' + name) : '';
      if (type === 'arrive') return "You've reached the client's location";
      if (type === 'depart') return 'Head out' + road;
      if (type === 'roundabout' || type === 'rotary') return 'Enter the roundabout' + road;
      if (type === 'end of road') {
        if (modifier === 'left') return 'Turn left at the end of the road' + road;
        if (modifier === 'right') return 'Turn right at the end of the road' + road;
      }
      if (type === 'fork') {
        if (modifier && modifier.indexOf('left') !== -1) return 'Keep left' + road;
        if (modifier && modifier.indexOf('right') !== -1) return 'Keep right' + road;
      }
      if (modifier === 'straight') return 'Continue straight' + road;
      if (modifier === 'slight left') return 'Slight left' + road;
      if (modifier === 'slight right') return 'Slight right' + road;
      if (modifier === 'sharp left') return 'Sharp left' + road;
      if (modifier === 'sharp right') return 'Sharp right' + road;
      if (modifier === 'left') return 'Turn left' + road;
      if (modifier === 'right') return 'Turn right' + road;
      if (modifier === 'uturn') return 'Make a U-turn';
      return 'Continue' + road;
    }

    function formatDistance(meters) {
      if (meters < 1000) return (Math.round(meters / 10) * 10) + ' m';
      return (meters / 1000).toFixed(1) + ' km';
    }

    function fetchDirections(from) {
      if (directionsInFlight) return;
      directionsInFlight = true;
      var url = 'https://router.project-osrm.org/route/v1/driving/'
        + from[1] + ',' + from[0] + ';' + destination[1] + ',' + destination[0]
        + '?overview=full&geometries=geojson&steps=true';
      fetch(url).then(function (r) { return r.json(); }).then(function (data) {
        directionsInFlight = false;
        if (data.code !== 'Ok' || !data.routes || !data.routes[0]) return;
        var route = data.routes[0];
        var coords = route.geometry.coordinates.map(function (c) { return [c[1], c[0]]; });

        if (routedLine) map.removeLayer(routedLine);
        routedLine = L.polyline(coords, { color: '#0891b2', weight: 5 }).addTo(map);
        if (map.hasLayer(straightLine)) map.removeLayer(straightLine);
        map.fitBounds(routedLine.getBounds(), { padding: [60, 120] });

        var step = route.legs[0].steps[0];
        document.getElementById('direction-icon').textContent = iconFor(step.maneuver.type, step.maneuver.modifier);
        document.getElementById('direction-text').textContent = textFor(step);
        document.getElementById('direction-distance').textContent =
          formatDistance(step.distance) + ' · ' + formatDistance(route.distance) + ' remaining total';
        document.getElementById('direction-banner').className = 'direction-banner visible';
      }).catch(function () {
        directionsInFlight = false;
      });
    }

    fetchDirections(moverStart);
    ` : ''}

    window.updateMover = function(lat, lng) {
      var newPos = [lat, lng];
      moverMarker.setLatLng(newPos);
      ${showDirections ? `
      fetchDirections(newPos);
      ` : `
      straightLine.setLatLngs([newPos, destination]);
      map.fitBounds(straightLine.getBounds(), { padding: [50, 50] });
      `}
    };
  </script>
</body>
</html>
  `;
}
