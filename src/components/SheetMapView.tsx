import type { SheetMapGroup, SheetMapSheet } from '../types';

function fitFontSize(label: string, boxW: number, boxH: number): number {
  const base = Math.min(boxW, boxH) * 0.22;
  const lenFactor = Math.max(1, label.length / 14);
  return Math.max(5, Math.min(11, base / lenFactor));
}

function SheetDiagram({ sheet, patternId }: { sheet: SheetMapSheet; patternId: string }) {
  const w = sheet.grainLengthMm;
  const h = sheet.crossLengthMm;
  const pad = 8;
  const viewW = w + pad * 2;
  const viewH = h + pad * 2 + 14;

  return (
    <figure className="sheet-map-figure">
      <figcaption className="sheet-map-caption">
        Sheet {sheet.sheetIndex}
        <span className="sheet-map-dims">
          {w} × {h} mm <span className="sheet-map-grain-hint">(grain →)</span>
        </span>
      </figcaption>
      <svg
        className="sheet-map-svg"
        viewBox={`0 0 ${viewW} ${viewH}`}
        role="img"
        aria-label={`Sheet ${sheet.sheetIndex} layout`}
      >
        <defs>
          <pattern id={patternId} width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M0 8 L8 0" stroke="#93c5fd" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect
          x={pad}
          y={pad}
          width={w}
          height={h}
          className="sheet-map-sheet-outline"
          rx={1}
        />
        {sheet.offcutRects.map((r, i) => (
          <rect
            key={`o-${i}`}
            x={pad + r.xMm}
            y={pad + r.yMm}
            width={r.widthMm}
            height={r.heightMm}
            className="sheet-map-offcut"
          />
        ))}
        {sheet.placements.map((p, i) => {
          const fontSize = fitFontSize(p.label, p.widthMm, p.heightMm);
          const cx = pad + p.xMm + p.widthMm / 2;
          const cy = pad + p.yMm + p.heightMm / 2;
          const lines = p.label.split(' · ');
          const line1 = lines[0] ?? p.label;
          const line2 = lines[1];
          return (
            <g key={`p-${i}`}>
              <rect
                x={pad + p.xMm}
                y={pad + p.yMm}
                width={p.widthMm}
                height={p.heightMm}
                className={p.grainLocked ? 'sheet-map-part sheet-map-part--grain' : 'sheet-map-part'}
                fill={p.grainLocked ? `url(#${patternId})` : undefined}
              />
              {p.widthMm > 55 && p.heightMm > 28 && (
                <>
                  <text
                    x={cx}
                    y={cy - (line2 ? fontSize * 0.45 : 0)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="sheet-map-label"
                    fontSize={fontSize}
                  >
                    {line1}
                  </text>
                  {line2 && p.heightMm > 42 && (
                    <text
                      x={cx}
                      y={cy + fontSize * 0.55}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="sheet-map-label sheet-map-label-sub"
                      fontSize={fontSize * 0.85}
                    >
                      {line2}
                    </text>
                  )}
                </>
              )}
            </g>
          );
        })}
        <text x={pad + w - 4} y={pad + 10} textAnchor="end" className="sheet-map-grain-arrow" fontSize={9}>
          grain →
        </text>
      </svg>
    </figure>
  );
}

interface Props {
  groups: SheetMapGroup[];
}

export function SheetMapView({ groups }: Props) {
  if (groups.length === 0) return null;

  return (
    <div className="sheet-map-view">
      {groups.map((group) => (
        <div key={group.materialId} className="sheet-map-material">
          <h4 className="subsection-title">{group.materialName}</h4>
          <div className="sheet-map-grid">
            {group.sheets.map((sheet) => (
              <SheetDiagram
                key={sheet.sheetIndex}
                sheet={sheet}
                patternId={`grain-${group.materialId}-${sheet.sheetIndex}`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
