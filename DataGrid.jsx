import React, { useMemo, useCallback } from 'react'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'

function DataGrid({ data, onSelectionChange }) {
  const columnDefs = useMemo(() => [
    {
      field: 'Lot/Plan',
      headerName: 'Lot/Plan',
      sortable: true,
      filter: true,
      checkboxSelection: true,
      headerCheckboxSelection: true,
      width: 150
    },
    {
      field: 'Lot Type',
      headerName: 'Lot Type',
      sortable: true,
      filter: true,
      width: 120
    },
    {
      field: 'Area (ha)',
      headerName: 'Area (ha)',
      sortable: true,
      filter: true,
      width: 100,
      type: 'numericColumn'
    }
  ], [])

  const defaultColDef = useMemo(() => ({
    resizable: true,
    sortable: true,
    filter: true
  }), [])

  const onSelectionChanged = useCallback((event) => {
    const selectedRows = event.api.getSelectedRows()
    onSelectionChange(selectedRows)
  }, [onSelectionChange])

  return (
    <div className="grid-container ag-theme-alpine-dark">
      <AgGridReact
        rowData={data}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        rowSelection="multiple"
        onSelectionChanged={onSelectionChanged}
        suppressRowClickSelection={true}
        animateRows={true}
      />
    </div>
  )
}

export default DataGrid
