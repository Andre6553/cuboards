import { useEffect, useState } from 'react';
import { priceInputLabel } from '../lib/currency';
import type { JobSettings, SheetPurchaseUnit } from '../types';
import {
  acceptCommunityMaterialIntoCatalog,
  COMMUNITY_EDGING_SELECT,
  communityEdgingLabel,
  communityOfferToDraft,
  dismissCommunityMaterial,
  NEW_EDGING_SELECT,
  type CommunityMaterialOffer,
} from '../lib/communityMaterials';
import { loadMaterialCatalog } from '../lib/materialCatalog';
import { NumberInput } from './NumberInput';

interface Props {
  queue: CommunityMaterialOffer[];
  settings: JobSettings;
  /** Called after skip or add; parent refetches queue and applies catalog if added. */
  onResolved: (added: boolean) => void;
}

function colourDisplay(colour: string): string {
  const t = colour.trim();
  return t || '—';
}

export function CommunityMaterialPrompt({ queue, settings, onResolved }: Props) {
  const current = queue[0];

  const [pricePerSheet, setPricePerSheet] = useState(0);
  const [hasGrain, setHasGrain] = useState(false);
  const [sheetPurchaseUnit, setSheetPurchaseUnit] = useState<SheetPurchaseUnit>('quarter');
  const [edgingSelect, setEdgingSelect] = useState<string>(COMMUNITY_EDGING_SELECT);
  const [newEdgingName, setNewEdgingName] = useState('');
  const [newEdgingThickness, setNewEdgingThickness] = useState(1);
  const [newEdgingPricePerMetre, setNewEdgingPricePerMetre] = useState(10);
  const [edgingOptions, setEdgingOptions] = useState(() => loadMaterialCatalog()?.edgingMaterials ?? []);

  useEffect(() => {
    if (!current) return;
    const catalog = loadMaterialCatalog();
    setEdgingOptions(catalog?.edgingMaterials ?? []);
    const draft = communityOfferToDraft(current, catalog);
    setPricePerSheet(draft.pricePerSheet);
    setHasGrain(draft.hasGrain);
    setSheetPurchaseUnit(draft.sheetPurchaseUnit);
    const hasInstallerEdging = Boolean(current.edging_name?.trim());
    if (hasInstallerEdging) {
      setEdgingSelect(COMMUNITY_EDGING_SELECT);
    } else if (draft.edgingMaterialId) {
      setEdgingSelect(draft.edgingMaterialId);
    } else {
      setEdgingSelect(catalog?.edgingMaterials[0]?.id ?? COMMUNITY_EDGING_SELECT);
    }
    setNewEdgingName(current.edging_name?.trim() || '');
    setNewEdgingThickness(Number(current.edging_thickness) || 1);
    setNewEdgingPricePerMetre(10);
  }, [current?.community_key]);

  if (!current) return null;

  const installerEdgingLabel = communityEdgingLabel(current);
  const showNewEdgingFields = edgingSelect === NEW_EDGING_SELECT;

  function buildEdgingDraft() {
    if (edgingSelect === COMMUNITY_EDGING_SELECT) {
      return { kind: 'community' as const };
    }
    if (edgingSelect === NEW_EDGING_SELECT) {
      return {
        kind: 'new' as const,
        name: newEdgingName,
        thickness: newEdgingThickness,
        pricePerMetre: newEdgingPricePerMetre,
      };
    }
    return { kind: 'catalog' as const, edgingMaterialId: edgingSelect };
  }

  async function onSkip() {
    await dismissCommunityMaterial(current.community_key);
    onResolved(false);
  }

  async function onAdd() {
    acceptCommunityMaterialIntoCatalog(current, {
      pricePerSheet,
      hasGrain,
      sheetPurchaseUnit,
      edging: buildEdgingDraft(),
    });
    await dismissCommunityMaterial(current.community_key);
    onResolved(true);
  }

  return (
    <div className="community-material-overlay" role="dialog" aria-modal="true" aria-labelledby="community-material-title">
      <div className="community-material-dialog">
        <h2 id="community-material-title" className="community-material-title">
          New board from the community
        </h2>
        <p className="community-material-sub">
          Another installer added <strong>{current.name}</strong> ({colourDisplay(current.colour)}). Add it to your
          shared board catalog with your own price and options?
        </p>
        <p className="hint community-material-queue">
          {queue.length > 1 ? `${queue.length} new boards waiting — showing the first.` : null}
        </p>

        <div className="community-material-fields">
          <label>
            Material
            <input className="table-input" readOnly value={current.name} />
          </label>
          <label>
            Colour
            <input className="table-input" readOnly value={colourDisplay(current.colour)} />
          </label>
          <label>
            {priceInputLabel(settings, 'Price / sheet')}
            <NumberInput value={pricePerSheet} min={0} onChange={setPricePerSheet} />
          </label>
          <label className="checkbox-label community-material-grain">
            <input type="checkbox" checked={hasGrain} onChange={(e) => setHasGrain(e.target.checked)} />
            Grain
          </label>
          <label>
            Buy as
            <select
              className="table-input table-select"
              value={sheetPurchaseUnit}
              onChange={(e) => setSheetPurchaseUnit(e.target.value as SheetPurchaseUnit)}
            >
              <option value="third">⅓ sheet</option>
              <option value="quarter">¼ sheet</option>
              <option value="half">½ sheet</option>
              <option value="full">Full sheet only</option>
            </select>
          </label>
          <label>
            Edging tape
            <select
              className="table-input table-select"
              value={edgingSelect}
              onChange={(e) => setEdgingSelect(e.target.value)}
            >
              <option value={COMMUNITY_EDGING_SELECT}>
                Use installer&apos;s edging — {installerEdgingLabel}
              </option>
              {edgingOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  My catalog — {e.name} ({e.thickness} mm)
                </option>
              ))}
              <option value={NEW_EDGING_SELECT}>Add my own edging…</option>
            </select>
          </label>
          {showNewEdgingFields ? (
            <div className="community-material-new-edging">
              <label>
                Edging name
                <input
                  className="table-input"
                  value={newEdgingName}
                  onChange={(e) => setNewEdgingName(e.target.value)}
                  placeholder="e.g. White PVC edging"
                />
              </label>
              <label>
                Thickness (mm)
                <NumberInput min={0.5} max={5} step={0.5} value={newEdgingThickness} onChange={setNewEdgingThickness} />
              </label>
              <label>
                {priceInputLabel(settings, 'Price / metre')}
                <NumberInput min={0} value={newEdgingPricePerMetre} onChange={setNewEdgingPricePerMetre} />
              </label>
            </div>
          ) : null}
        </div>

        <div className="community-material-actions">
          <button type="button" className="auth-submit" onClick={() => void onAdd()}>
            Add to my boards
          </button>
          <button type="button" className="auth-submit auth-submit--secondary" onClick={() => void onSkip()}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
