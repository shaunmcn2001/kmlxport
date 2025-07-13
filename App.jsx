import React, { useState, useEffect, useCallback } from 'react'
import { Search, Layers, Download, Trash2, ZoomIn, Package } from 'lucide-react'
import MapComponent from './MapComponent'
import DataGrid from './DataGrid'
import { fetchParcels } from './cadastreService'
import { exportToKML, exportToShapefile } from './exportService'

const DEFAULT_CONFIG = {
  basemaps: [
    {
      name: "OpenStreetMap",
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attr: "© OpenStreetMap contributors"
    },
    {
      name: "Satellite",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attr: "© Esri"
    }
  ],
  overlays: [
    {
      name: "QLD Cadastre",
      type: "wms",
      url: "https://spatial-gis.information.qld.gov.au/arcgis/services/PlanningCadastre/LandParcelPropertyFramework/MapServer/WMSServer",
      layers: "4",
      attr: "© Queensland Government"
    }
  ]
}

function App() {
  const [activeTab, setActiveTab] = useState('query')
  const [parcels, setParcels] = useState({})
  const [tableData, setTableData] = useState([])
  const [selectedRows, setSelectedRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [zoomToBounds, setZoomToBounds] = useState(null)
  
  // Form states
  const [lotPlanIds, setLotPlanIds] = useState('')
  const [style, setStyle] = useState({
    fill: '#ff6600',
    opacity: 70,
    line: '#2e2e2e',
    weight: 1.2,
    folder: 'Parcels'
  })
  
  // Layer states
  const [selectedBasemap, setSelectedBasemap] = useState(DEFAULT_CONFIG.basemaps[0].name)
  const [overlayStates, setOverlayStates] = useState(
    DEFAULT_CONFIG.overlays.reduce((acc, overlay) => {
      acc[overlay.name] = false
      return acc
    }, {})
  )

  const addAlert = useCallback((message, type = 'info') => {
    const id = Date.now()
    setAlerts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setAlerts(prev => prev.filter(alert => alert.id !== id))
    }, 5000)
  }, [])

  const handleSearch = async () => {
    if (!lotPlanIds.trim()) return
    
    const ids = lotPlanIds.split('\n').map(id => id.trim()).filter(Boolean)
    setLoading(true)
    
    try {
      const { parcels: fetchedParcels, missing } = await fetchParcels(ids)
      
      if (missing.length > 0) {
        addAlert(`Not found: ${missing.join(', ')}`, 'warning')
      }
      
      setParcels(fetchedParcels)
      
      // Create table data
      const rows = Object.entries(fetchedParcels).map(([id, data]) => ({
        'Lot/Plan': id,
        'Lot Type': data.properties?.lottype || data.properties?.PURPOSE || 'n/a',
        'Area (ha)': data.area
      }))
      
      setTableData(rows)
      addAlert(`${Object.keys(fetchedParcels).length} parcel${Object.keys(fetchedParcels).length !== 1 ? 's' : ''} loaded.`, 'success')
      
    } catch (error) {
      addAlert('Error fetching parcels: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleZoomToSelection = () => {
    if (selectedRows.length === 0) return
    
    const selectedIds = selectedRows.map(row => row['Lot/Plan'])
    const selectedParcels = selectedIds.map(id => parcels[id]).filter(Boolean)
    
    if (selectedParcels.length > 0) {
      // Calculate bounds from selected parcels
      let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
      
      selectedParcels.forEach(parcel => {
        const coords = parcel.geometry.coordinates[0]
        coords.forEach(([lng, lat]) => {
          minLat = Math.min(minLat, lat)
          maxLat = Math.max(maxLat, lat)
          minLng = Math.min(minLng, lng)
          maxLng = Math.max(maxLng, lng)
        })
      })
      
      setZoomToBounds([[minLat, minLng], [maxLat, maxLng]])
    }
  }

  const handleExportSelection = async (format) => {
    if (selectedRows.length === 0) return
    
    const selectedIds = selectedRows.map(row => row['Lot/Plan'])
    const selectedParcels = selectedIds.reduce((acc, id) => {
      if (parcels[id]) acc[id] = parcels[id]
      return acc
    }, {})
    
    try {
      if (format === 'kml') {
        await exportToKML(selectedParcels, style, 'selection.kml')
      } else if (format === 'shp') {
        await exportToShapefile(selectedParcels, 'selection.zip')
      }
      addAlert(`Selection exported as ${format.toUpperCase()}`, 'success')
    } catch (error) {
      addAlert('Export failed: ' + error.message, 'error')
    }
  }

  const handleExportAll = async (format) => {
    if (Object.keys(parcels).length === 0) return
    
    try {
      if (format === 'kml') {
        await exportToKML(parcels, style, 'parcels.kml')
      } else if (format === 'shp') {
        await exportToShapefile(parcels, 'parcels.zip')
      }
      addAlert(`All parcels exported as ${format.toUpperCase()}`, 'success')
    } catch (error) {
      addAlert('Export failed: ' + error.message, 'error')
    }
  }

  const handleRemoveSelection = () => {
    if (selectedRows.length === 0) return
    
    const selectedIds = selectedRows.map(row => row['Lot/Plan'])
    const newParcels = { ...parcels }
    selectedIds.forEach(id => delete newParcels[id])
    
    setParcels(newParcels)
    setTableData(prev => prev.filter(row => !selectedIds.includes(row['Lot/Plan'])))
    setSelectedRows([])
    setZoomToBounds(null)
  }

  return (
    <div className="app">
      <div className="sidebar">
        <div className="header">
          LAWD – Parcel Toolkit
        </div>
        
        <div className="nav-tabs">
          <button 
            className={`nav-tab ${activeTab === 'query' ? 'active' : ''}`}
            onClick={() => setActiveTab('query')}
          >
            <Search size={16} />
            Query
          </button>
          <button 
            className={`nav-tab ${activeTab === 'layers' ? 'active' : ''}`}
            onClick={() => setActiveTab('layers')}
          >
            <Layers size={16} />
            Layers
          </button>
        </div>

        <div className="sidebar-content">
          {activeTab === 'query' && (
            <>
              <div className="form-group">
                <label className="form-label">Lot/Plan IDs</label>
                <textarea
                  className="form-textarea"
                  value={lotPlanIds}
                  onChange={(e) => setLotPlanIds(e.target.value)}
                  placeholder="6RP702264&#10;5//DP123456"
                />
              </div>

              <div className="expandable">
                <div className="expandable-header">
                  Style & KML Options
                </div>
                <div className="expandable-content">
                  <div className="style-controls">
                    <div>
                      <label className="form-label">Fill</label>
                      <input
                        type="color"
                        className="color-input"
                        value={style.fill}
                        onChange={(e) => setStyle(prev => ({ ...prev, fill: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="form-label">Outline</label>
                      <input
                        type="color"
                        className="color-input"
                        value={style.line}
                        onChange={(e) => setStyle(prev => ({ ...prev, line: e.target.value }))}
                      />
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Opacity: {style.opacity}%</label>
                    <input
                      type="range"
                      className="slider"
                      min="0"
                      max="100"
                      value={style.opacity}
                      onChange={(e) => setStyle(prev => ({ ...prev, opacity: parseInt(e.target.value) }))}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Line Width: {style.weight}px</label>
                    <input
                      type="range"
                      className="slider"
                      min="0.5"
                      max="6"
                      step="0.1"
                      value={style.weight}
                      onChange={(e) => setStyle(prev => ({ ...prev, weight: parseFloat(e.target.value) }))}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">KML Folder</label>
                    <input
                      type="text"
                      className="form-input"
                      value={style.folder}
                      onChange={(e) => setStyle(prev => ({ ...prev, folder: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <button 
                className="btn btn-primary btn-full"
                onClick={handleSearch}
                disabled={loading || !lotPlanIds.trim()}
              >
                {loading ? (
                  <>
                    <div className="spinner" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search size={16} />
                    Search
                  </>
                )}
              </button>
            </>
          )}

          {activeTab === 'layers' && (
            <>
              <div className="form-group">
                <label className="form-label">Basemap</label>
                {DEFAULT_CONFIG.basemaps.map(basemap => (
                  <label key={basemap.name} style={{ display: 'block', marginBottom: '8px' }}>
                    <input
                      type="radio"
                      className="radio"
                      name="basemap"
                      checked={selectedBasemap === basemap.name}
                      onChange={() => setSelectedBasemap(basemap.name)}
                    />
                    {basemap.name}
                  </label>
                ))}
              </div>

              <div className="form-group">
                <label className="form-label">Static Overlays</label>
                {DEFAULT_CONFIG.overlays.map(overlay => (
                  <label key={overlay.name} style={{ display: 'block', marginBottom: '8px' }}>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={overlayStates[overlay.name] || false}
                      onChange={(e) => setOverlayStates(prev => ({
                        ...prev,
                        [overlay.name]: e.target.checked
                      }))}
                    />
                    {overlay.name}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="main-content">
        {alerts.map(alert => (
          <div key={alert.id} className={`alert alert-${alert.type}`}>
            {alert.message}
          </div>
        ))}

        {tableData.length > 0 && (
          <div className="results-section">
            <h2 className="results-header">Query Results</h2>
            
            <div className="action-buttons">
              <button
                className="btn btn-secondary"
                onClick={handleZoomToSelection}
                disabled={selectedRows.length === 0}
              >
                <ZoomIn size={16} />
                Zoom to Selection
              </button>
              
              <button
                className="btn btn-secondary"
                onClick={() => handleExportSelection('kml')}
                disabled={selectedRows.length === 0}
              >
                <Download size={16} />
                Export Selection (KML)
              </button>
              
              <button
                className="btn btn-danger"
                onClick={handleRemoveSelection}
                disabled={selectedRows.length === 0}
              >
                <Trash2 size={16} />
                Remove Selection
              </button>
              
              <button
                className="btn btn-secondary"
                onClick={() => handleExportAll('kml')}
                disabled={tableData.length === 0}
              >
                <Package size={16} />
                Export All (KML)
              </button>
              
              <button
                className="btn btn-secondary"
                onClick={() => handleExportAll('shp')}
                disabled={tableData.length === 0}
              >
                <Package size={16} />
                Export All (SHP)
              </button>
            </div>

            <DataGrid
              data={tableData}
              onSelectionChange={setSelectedRows}
            />
          </div>
        )}

        <div className="map-container">
          <MapComponent
            parcels={parcels}
            style={style}
            basemap={selectedBasemap}
            basemaps={DEFAULT_CONFIG.basemaps}
            overlays={DEFAULT_CONFIG.overlays}
            overlayStates={overlayStates}
            zoomToBounds={zoomToBounds}
            onZoomComplete={() => setZoomToBounds(null)}
          />
        </div>
      </div>
    </div>
  )
}

export default App
