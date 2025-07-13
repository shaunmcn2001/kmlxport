import { saveAs } from 'file-saver'
import JSZip from 'jszip'

// Simple KML generation
function generateKML(parcels, style, folderName = 'Parcels') {
  const hexToKMLColor = (hex, opacity) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    const a = Math.round(255 * opacity / 100)
    return `${a.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${r.toString(16).padStart(2, '0')}`
  }

  const fillColor = hexToKMLColor(style.fill, style.opacity)
  const lineColor = hexToKMLColor(style.line, 100)

  let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${folderName}</name>
    <Style id="parcelStyle">
      <LineStyle>
        <color>${lineColor}</color>
        <width>${style.weight}</width>
      </LineStyle>
      <PolyStyle>
        <color>${fillColor}</color>
        <fill>1</fill>
        <outline>1</outline>
      </PolyStyle>
    </Style>
    <Folder>
      <name>${folderName}</name>`

  Object.entries(parcels).forEach(([lotPlan, parcel]) => {
    const coords = parcel.geometry.coordinates[0]
    const coordString = coords.map(([lng, lat]) => `${lng},${lat},0`).join(' ')
    
    kml += `
      <Placemark>
        <name>${lotPlan}</name>
        <styleUrl>#parcelStyle</styleUrl>
        <Polygon>
          <extrude>0</extrude>
          <altitudeMode>clampToGround</altitudeMode>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>${coordString}</coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>
      </Placemark>`
  })

  kml += `
    </Folder>
  </Document>
</kml>`

  return kml
}

// Simple Shapefile generation (creates a basic structure)
function generateShapefileComponents(parcels) {
  // This is a simplified version - in a real implementation you'd use a proper shapefile library
  const features = Object.entries(parcels).map(([lotPlan, parcel]) => ({
    type: 'Feature',
    properties: {
      LOTPLAN: lotPlan,
      LOTTYPE: parcel.properties?.lottype || parcel.properties?.PURPOSE || 'n/a',
      AREA_HA: parcel.area || 0
    },
    geometry: parcel.geometry
  }))

  const geojson = {
    type: 'FeatureCollection',
    features
  }

  return {
    'parcels.geojson': JSON.stringify(geojson, null, 2),
    'README.txt': 'This archive contains parcel data exported from LAWD Parcel Toolkit.\n\nThe data is provided in GeoJSON format which can be imported into most GIS applications.\n\nFor true Shapefile format, please use a GIS application to convert the GeoJSON file.'
  }
}

export async function exportToKML(parcels, style, filename) {
  const kmlContent = generateKML(parcels, style, style.folder)
  const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' })
  saveAs(blob, filename)
}

export async function exportToShapefile(parcels, filename) {
  const components = generateShapefileComponents(parcels)
  const zip = new JSZip()
  
  Object.entries(components).forEach(([name, content]) => {
    zip.file(name, content)
  })
  
  const blob = await zip.generateAsync({ type: 'blob' })
  saveAs(blob, filename)
}
