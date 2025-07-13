import React, { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

function ZoomToBounds({ bounds, onComplete }) {
  const map = useMap()
  
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds)
      if (onComplete) onComplete()
    }
  }, [bounds, map, onComplete])
  
  return null
}

function MapComponent({ 
  parcels, 
  style, 
  basemap, 
  basemaps, 
  overlays, 
  overlayStates, 
  zoomToBounds, 
  onZoomComplete 
}) {
  const mapRef = useRef()
  
  const selectedBasemap = basemaps.find(b => b.name === basemap) || basemaps[0]
  
  const getParcelStyle = () => ({
    fillColor: style.fill,
    color: style.line,
    weight: style.weight,
    fillOpacity: style.opacity / 100,
    opacity: 1
  })
  
  const onEachParcel = (feature, layer) => {
    const props = feature.properties
    const lotPlan = props.id
    const parcelData = parcels[lotPlan]
    
    if (parcelData) {
      const area = parcelData.area || 0
      const lotType = parcelData.properties?.lottype || parcelData.properties?.PURPOSE || 'n/a'
      
      const popupContent = `
        <div>
          <strong>Lot/Plan:</strong> ${lotPlan}<br>
          <strong>Lot Type:</strong> ${lotType}<br>
          <strong>Area:</strong> ${area.toFixed(2)} ha
        </div>
      `
      
      layer.bindPopup(popupContent)
      layer.bindTooltip(lotPlan)
    }
  }
  
  // Convert parcels to GeoJSON format
  const parcelFeatures = Object.entries(parcels).map(([id, parcel]) => ({
    type: 'Feature',
    properties: { id },
    geometry: parcel.geometry
  }))
  
  const parcelGeoJSON = {
    type: 'FeatureCollection',
    features: parcelFeatures
  }

  return (
    <MapContainer
      ref={mapRef}
      center={[-25, 145]}
      zoom={5}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        url={selectedBasemap.url}
        attribution={selectedBasemap.attr}
      />
      
      {overlays.map(overlay => {
        if (!overlayStates[overlay.name]) return null
        
        if (overlay.type === 'wms') {
          return (
            <TileLayer
              key={overlay.name}
              url={`${overlay.url}?service=WMS&version=1.1.1&request=GetMap&layers=${overlay.layers}&styles=&format=image/png&transparent=true&srs=EPSG:3857&width=256&height=256&bbox={bbox-epsg-3857}`}
              attribution={overlay.attr}
              opacity={0.7}
            />
          )
        } else {
          return (
            <TileLayer
              key={overlay.name}
              url={overlay.url}
              attribution={overlay.attr}
              opacity={0.7}
            />
          )
        }
      })}
      
      {parcelFeatures.length > 0 && (
        <GeoJSON
          key={JSON.stringify(parcelFeatures)}
          data={parcelGeoJSON}
          style={getParcelStyle}
          onEachFeature={onEachParcel}
        />
      )}
      
      {zoomToBounds && (
        <ZoomToBounds bounds={zoomToBounds} onComplete={onZoomComplete} />
      )}
    </MapContainer>
  )
}

export default MapComponent
