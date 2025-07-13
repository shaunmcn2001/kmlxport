const QLD_URL = "https://spatial-gis.information.qld.gov.au/arcgis/rest/services/PlanningCadastre/LandParcelPropertyFramework/MapServer/4/query"
const NSW_URL = "https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Cadastre/MapServer/9/query"

// Calculate area using the shoelace formula for polygon area
function calculatePolygonArea(coordinates) {
  if (!coordinates || !coordinates[0]) return 0
  
  const coords = coordinates[0] // Exterior ring
  let area = 0
  
  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i]
    const [x2, y2] = coords[i + 1]
    area += (x1 * y2 - x2 * y1)
  }
  
  // Convert to hectares (approximate conversion for lat/lng)
  // This is a rough approximation - for precise calculations, proper projection would be needed
  return Math.abs(area) * 6378137 * 6378137 * Math.PI / 180 / 180 / 10000
}

function isQLDFormat(lotPlan) {
  return /^\d+[A-Z]{1,3}\d+$/i.test(lotPlan)
}

async function fetchParcelData(lotPlan) {
  const isQLD = isQLDFormat(lotPlan)
  const url = isQLD ? QLD_URL : NSW_URL
  const field = isQLD ? "lotplan" : "lotidstring"
  
  try {
    const response = await fetch(`${url}?where=${field}='${lotPlan}'&outFields=*&returnGeometry=true&f=geojson`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (!data.features || data.features.length === 0) {
      return null
    }
    
    const feature = data.features[0]
    const geometry = feature.geometry
    const properties = feature.properties
    
    // Calculate area
    const area = calculatePolygonArea(geometry.coordinates)
    
    return {
      geometry,
      properties,
      area: area
    }
  } catch (error) {
    console.error(`Error fetching parcel ${lotPlan}:`, error)
    return null
  }
}

export async function fetchParcels(lotPlanIds) {
  const parcels = {}
  const missing = []
  
  // Process parcels in parallel with a reasonable limit
  const batchSize = 5
  for (let i = 0; i < lotPlanIds.length; i += batchSize) {
    const batch = lotPlanIds.slice(i, i + batchSize)
    const promises = batch.map(async (lotPlan) => {
      const data = await fetchParcelData(lotPlan)
      return { lotPlan, data }
    })
    
    const results = await Promise.all(promises)
    
    results.forEach(({ lotPlan, data }) => {
      if (data) {
        parcels[lotPlan] = data
      } else {
        missing.push(lotPlan)
      }
    })
  }
  
  return { parcels, missing }
}
