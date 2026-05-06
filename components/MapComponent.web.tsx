import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';

export interface Location {
  latitude: number;
  longitude: number;
  name: string;
}

interface MapComponentProps {
  style?: any;
  pickup?: Location | null;
  dropoff?: Location | null;
  routeCoordinates?: { latitude: number; longitude: number }[];
  driverLocation?: Location | null;
}

const MAP_HTML = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
      body { padding: 0; margin: 0; height: 100vh; width: 100vw; background: #e8eef4; }
      #map { width: 100%; height: 100%; position: absolute; top: 0; bottom: 0; left: 0; right: 0; background: #e8eef4; }
      .pin-pickup, .pin-dropoff, .pin-driver { background: transparent !important; border: none !important; }
      .pin-wrap { position: relative; width: 38px; height: 50px; }
      .pin-body {
        width: 38px; height: 38px; border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg); position: absolute; top: 0; left: 0;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.25); border: 3px solid #fff;
      }
      .pin-icon { transform: rotate(45deg); font-size: 16px; color: #fff; font-weight: 900; }
      .pin-pickup .pin-body { background: linear-gradient(135deg, #43a047, #1b5e20); }
      .pin-dropoff .pin-body { background: linear-gradient(135deg, #e53935, #b71c1c); }
      .driver-marker {
        width: 54px; height: 54px; border-radius: 50%;
        background: #fff; display: flex; align-items: center; justify-content: center;
        box-shadow: 0 6px 18px rgba(30,136,229,0.5); border: 3px solid #1E88E5;
        position: relative;
      }
      .driver-marker::before {
        content: ''; position: absolute; top: -6px; left: -6px; right: -6px; bottom: -6px;
        border-radius: 50%; border: 2px solid #1E88E5; opacity: 0.6;
        animation: ripple 1.6s infinite ease-out;
      }
      @keyframes ripple {
        0% { transform: scale(0.9); opacity: 0.7; }
        100% { transform: scale(1.6); opacity: 0; }
      }
      .driver-emoji { font-size: 26px; }
      .leaflet-control-attribution { font-size: 9px; opacity: 0.5; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([28.6139, 77.2090], 12);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
      }).addTo(map);

      var markers = [];
      var polylines = [];

      function clearMap() {
        markers.forEach(function(m){ map.removeLayer(m); });
        polylines.forEach(function(p){ map.removeLayer(p); });
        markers = [];
        polylines = [];
      }

      function pinIcon(kind, glyph) {
        return L.divIcon({
          className: 'pin-' + kind,
          html: '<div class="pin-wrap"><div class="pin-body"><span class="pin-icon">' + glyph + '</span></div></div>',
          iconSize: [38, 50],
          iconAnchor: [19, 50],
          popupAnchor: [0, -45]
        });
      }

      function driverIcon() {
        return L.divIcon({
          className: 'pin-driver',
          html: '<div class="driver-marker"><span class="driver-emoji">\u{1F697}</span></div>',
          iconSize: [54, 54],
          iconAnchor: [27, 27]
        });
      }

      function updateMap(data) {
        if (!data) return;
        clearMap();
        var bounds = L.latLngBounds();
        var hasBounds = false;

        if (data.pickup && data.pickup.latitude) {
          var m = L.marker([data.pickup.latitude, data.pickup.longitude], { icon: pinIcon('pickup', 'A') }).addTo(map);
          if (data.pickup.name) m.bindPopup('<b>Pickup</b><br/>' + data.pickup.name);
          markers.push(m);
          bounds.extend([data.pickup.latitude, data.pickup.longitude]);
          hasBounds = true;
        }

        if (data.dropoff && data.dropoff.latitude) {
          var m = L.marker([data.dropoff.latitude, data.dropoff.longitude], { icon: pinIcon('dropoff', 'B') }).addTo(map);
          if (data.dropoff.name) m.bindPopup('<b>Dropoff</b><br/>' + data.dropoff.name);
          markers.push(m);
          bounds.extend([data.dropoff.latitude, data.dropoff.longitude]);
          hasBounds = true;
        }

        if (data.driverLocation && data.driverLocation.latitude) {
          var m = L.marker([data.driverLocation.latitude, data.driverLocation.longitude], { icon: driverIcon(), zIndexOffset: 1000 }).addTo(map);
          markers.push(m);
          bounds.extend([data.driverLocation.latitude, data.driverLocation.longitude]);
          hasBounds = true;
        }

        if (data.routeCoordinates && data.routeCoordinates.length > 0) {
          var latlngs = data.routeCoordinates.map(function(c){ return [c.latitude, c.longitude]; });
          var shadow = L.polyline(latlngs, { color: '#1E88E5', weight: 9, opacity: 0.18 }).addTo(map);
          var poly = L.polyline(latlngs, { color: '#1E88E5', weight: 5, opacity: 0.95 }).addTo(map);
          polylines.push(shadow); polylines.push(poly);
          bounds.extend(latlngs);
          hasBounds = true;
        }

        if (hasBounds) {
          map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
        }
      }

      window.addEventListener('message', function(event) {
        try {
          var data = event.data;
          if (data && data.type === 'UPDATE_MAP') {
            updateMap(data.payload);
          }
        } catch (e) {}
      });
    </script>
  </body>
</html>
`;

export default function MapComponent({ style, pickup, dropoff, routeCoordinates, driverLocation }: MapComponentProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const mapData = { pickup, dropoff, routeCoordinates, driverLocation };
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'UPDATE_MAP', payload: mapData }, '*');
    }
  }, [pickup, dropoff, routeCoordinates, driverLocation]);

  return (
    <View style={style || styles.container}>
      <iframe
        ref={iframeRef}
        srcDoc={MAP_HTML}
        style={{ width: '100%', height: '100%', border: 'none', backgroundColor: 'transparent' }}
        title="Map"
        onLoad={() => {
          if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
              type: 'UPDATE_MAP',
              payload: { pickup, dropoff, routeCoordinates, driverLocation },
            }, '*');
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
});
