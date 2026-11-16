import { EDGING_LABELS } from '../lib/constants';
import { defaultCustomExtraPart } from '../lib/customExtrasRules';
import { edgingMaterialIdForPattern, NO_EDGING_MATERIAL_ID } from '../lib/edgingPatternSync';
import { NumberInput } from './NumberInput';
import type {
  CustomExtraPart,
  CustomExtraPartKind,
  EdgingMaterial,
  EdgingPattern,
  Job,
  Material,
  Unit,
} from '../types';

function PatternSelect({
  value,
  disabled,
  onChange,
}: {
  value: EdgingPattern;
  disabled?: boolean;
  onChange: (v: EdgingPattern) => void;
}) {
  return (
    <select disabled={disabled} value={value} onChange={(e) => onChange(e.target.value as EdgingPattern)}>
      {Object.entries(EDGING_LABELS).map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  );
}

function MaterialSelect({
  value,
  materials,
  disabled,
  onChange,
}: {
  value: string;
  materials: Material[];
  disabled?: boolean;
  onChange: (id: string) => void;
}) {
  return (
    <select disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)}>
      {materials.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}

interface Props {
  job: Job;
  unit: Unit;
  parts: CustomExtraPart[];
  materials: Material[];
  edgingMaterials: EdgingMaterial[];
  disabled?: boolean;
  onChange: (parts: CustomExtraPart[]) => void;
}

export function ExtraCustomPartsForm({
  job,
  unit,
  parts,
  materials,
  edgingMaterials,
  disabled = false,
  onChange,
}: Props) {
  const edgeFallback = edgingMaterials[0]?.id ?? '';
  const defaultEdgingForMaterial = (materialId: string) =>
    materials.find((m) => m.id === materialId)?.edgingMaterialId ?? edgeFallback;

  const updatePart = (id: string, patch: Partial<CustomExtraPart>) => {
    onChange(parts.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const setKind = (id: string, kind: CustomExtraPartKind) => {
    const existing = parts.find((p) => p.id === id);
    if (!existing) return;
    const seeded = defaultCustomExtraPart(unit, job, kind);
    updatePart(id, {
      kind,
      length: existing.length > 0 ? existing.length : seeded.length,
      width: existing.width > 0 ? existing.width : seeded.width,
      edgingPattern: seeded.edgingPattern,
    });
  };

  return (
    <fieldset className="extra-custom-fieldset" disabled={disabled}>
      <p className="hint">
        Add loose doors, panels, or filler strips with your own sizes. Each row is multiplied by unit qty on the cut list.
      </p>
      {parts.map((part, i) => (
        <div key={part.id} className="sub-card">
          <div className="sub-card-header">
            <strong>Extra part {i + 1}</strong>
            <button
              type="button"
              className="btn btn-ghost btn-sm danger"
              onClick={() => onChange(parts.filter((p) => p.id !== part.id))}
            >
              Remove
            </button>
          </div>
          <div className="form-grid form-grid-4">
            <label>
              Type
              <select value={part.kind} onChange={(e) => setKind(part.id, e.target.value as CustomExtraPartKind)}>
                <option value="door">Door</option>
                <option value="panel">Panel</option>
                <option value="filler">Filler</option>
              </select>
            </label>
            <label>
              Label (optional)
              <input
                type="text"
                value={part.label}
                placeholder="e.g. LH end"
                onChange={(e) => updatePart(part.id, { label: e.target.value })}
              />
            </label>
            <label>
              Qty
              <NumberInput min={1} integer value={part.qty} onChange={(n) => updatePart(part.id, { qty: Math.max(1, n) })} />
            </label>
            <label>
              Length (mm)
              <NumberInput
                min={1}
                integer
                value={part.length}
                onChange={(n) => updatePart(part.id, { length: Math.max(1, n) })}
              />
              <span className="field-hint">Cut-list length / long edge</span>
            </label>
            <label>
              Width (mm)
              <NumberInput
                min={1}
                integer
                value={part.width}
                onChange={(n) => updatePart(part.id, { width: Math.max(1, n) })}
              />
            </label>
            <label>
              Board
              <MaterialSelect
                value={part.materialId}
                materials={materials}
                onChange={(v) =>
                  updatePart(part.id, {
                    materialId: v,
                    edgingMaterialId: defaultEdgingForMaterial(v),
                  })
                }
              />
            </label>
            <label>
              Edging pattern
              <PatternSelect
                value={part.edgingPattern}
                onChange={(v) =>
                  updatePart(part.id, {
                    edgingPattern: v,
                    edgingMaterialId: edgingMaterialIdForPattern(
                      v,
                      part.edgingMaterialId,
                      defaultEdgingForMaterial(part.materialId),
                    ),
                  })
                }
              />
            </label>
            <label>
              Edging type
              <select
                disabled={part.edgingPattern === 'none'}
                value={
                  part.edgingPattern === 'none' ? NO_EDGING_MATERIAL_ID : part.edgingMaterialId || edgeFallback
                }
                onChange={(e) => updatePart(part.id, { edgingMaterialId: e.target.value })}
              >
                {part.edgingPattern === 'none' ? (
                  <option value={NO_EDGING_MATERIAL_ID}>No edging</option>
                ) : (
                  edgingMaterials.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.thickness} mm)
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={disabled}
        onClick={() => onChange([...parts, defaultCustomExtraPart(unit, job, 'panel')])}
      >
        + Add door / panel / filler
      </button>
    </fieldset>
  );
}