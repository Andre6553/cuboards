import { KICKPLATE_EDGING_CHECKBOXES } from '../lib/constants';
import {
  applyKickplateEdgingToggle,
  isKickplateEdgingChecked,
  type KickplateEdgingCounts,
  type KickplateEdgingToggle,
} from '../lib/kickplateEdging';

export function FillerEdgingCheckboxes({
  counts,
  disabled,
  label,
  onChange,
}: {
  counts: KickplateEdgingCounts;
  disabled?: boolean;
  label?: string;
  onChange: (next: KickplateEdgingCounts) => void;
}) {
  return (
    <div className="kickplate-edging-patterns">
      <span className="field-label">
        {label ?? 'Edging (Long = along filler length · short = along filler width)'}
      </span>
      <div className="checkbox-row">
        {KICKPLATE_EDGING_CHECKBOXES.map(({ key, label: boxLabel }) => (
          <label key={key} className="checkbox-label">
            <input
              type="checkbox"
              disabled={disabled}
              checked={isKickplateEdgingChecked(counts, key)}
              onChange={(e) => onChange(applyKickplateEdgingToggle(counts, key as KickplateEdgingToggle, e.target.checked))}
            />
            {boxLabel}
          </label>
        ))}
      </div>
    </div>
  );
}
