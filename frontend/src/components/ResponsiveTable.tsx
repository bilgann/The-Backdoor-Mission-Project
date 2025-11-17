import React from 'react'
import '../styles/ResponsiveTable.css'

type Column = { key: string; label: string }

interface ResponsiveTableProps {
  columns: Column[]
  rows: Array<any>
  renderCell?: (row: any, columnKey: string) => React.ReactNode
  noDataText?: string
  className?: string
}

const ResponsiveTable: React.FC<ResponsiveTableProps> = ({ columns, rows, renderCell, noDataText = 'No data', className = '' }) => {
  return (
    <div className={`responsive-table-wrapper ${className}`}>
      <table className="recent-table" aria-label="Responsive table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="no-recent-cell" style={{ padding: 12 }}>
                {noDataText}
              </td>
            </tr>
          ) : (
            rows.map((r: any) => (
              <tr key={r.id || JSON.stringify(r)}>
                {columns.map((c) => (
                  <td key={c.key}>
                    {renderCell ? renderCell(r, c.key) : (r[c.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default ResponsiveTable
