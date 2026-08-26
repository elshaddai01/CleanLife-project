// Shared between TrackPickupScreen (client watching their collector) and
// ActiveJobScreen (collector watching their own position relative to the
// client's destination). One marker is FIXED (destination — client's
// pickup point), the other MOVES (whoever's GPS is being tracked) and
// updates via window.updateMover(lat, lng) called through WebView's
// injectJavaScript, without reloading the whole map.

export type LatLng = { lat: number; lng: number };

export function buildTrackingMapHtml(destination: LatLng, initialMover: LatLng, moverColor: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div id="map"></div>
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
    var routeLine = L.polyline([moverStart, destination], { color: '#0891b2', weight: 3, dashArray: '6, 8' }).addTo(map);

    map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });

    window.updateMover = function(lat, lng) {
      var newPos = [lat, lng];
      moverMarker.setLatLng(newPos);
      routeLine.setLatLngs([newPos, destination]);
      map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
    };
  </script>
</body>
</html>
  `;
}