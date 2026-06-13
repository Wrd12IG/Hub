import React from 'react';
import { Download, Columns, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowDown } from 'lucide-react';

export const MetricoolTable = ({ 
  title, 
  columns, 
  data, 
  hideToolbar = false,
  searchPlaceholder = "Cerca",
  filename = "data.csv"
}: { 
  title?: string;
  columns: any[]; 
  data: any[]; 
  hideToolbar?: boolean;
  searchPlaceholder?: string;
  filename?: string;
}) => {
  const safeData = Array.isArray(data) ? data : [];

  return (
    <div className="mb-8">
      {title && <h2 className="text-xl font-semibold mb-6 text-foreground">{title}</h2>}
      
      {!hideToolbar && (
        <div className="flex gap-4 mb-4">
          <div className="flex-1 relative">
            <input 
              type="text" 
              placeholder={searchPlaceholder} 
              className="w-full px-4 py-2 rounded-lg border outline-none text-sm bg-background text-foreground"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-background border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors">
            <Download size={14} /> Scarica CSV
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-background border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors">
            <Columns size={14} /> Colonne
          </button>
        </div>
      )}

      <div className="border rounded-xl overflow-hidden bg-background">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {columns.map((col, idx) => (
                  <th key={idx} className="p-4 text-muted-foreground font-semibold whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {col.label}
                      {col.sortable && <ArrowDown size={14} className="text-muted-foreground/50" />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {safeData.map((row, rowIdx) => (
                <tr key={rowIdx} className={`border-b transition-colors ${rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/20'} hover:bg-muted/50`}>
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className={`p-4 ${col.isPrimary ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
              {safeData.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="p-8 text-center text-muted-foreground">
                    Nessun dato disponibile
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="flex items-center justify-end p-4 gap-6 border-t text-muted-foreground text-sm">
          <div className="flex items-center gap-2">
            Elementi per pagina: 
            <select className="border rounded-md px-2 py-1 outline-none bg-background">
              <option>5</option>
              <option>10</option>
              <option>20</option>
            </select>
          </div>
          <div>1-{Math.min(5, safeData.length)} di {safeData.length}</div>
          <div className="flex gap-1">
            <button className="p-1 rounded-full hover:bg-muted text-muted-foreground"><ChevronsLeft size={16} /></button>
            <button className="p-1 rounded-full hover:bg-muted text-muted-foreground"><ChevronLeft size={16} /></button>
            <button className="p-1 rounded-full hover:bg-muted text-foreground"><ChevronRight size={16} /></button>
            <button className="p-1 rounded-full hover:bg-muted text-foreground"><ChevronsRight size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  );
};
