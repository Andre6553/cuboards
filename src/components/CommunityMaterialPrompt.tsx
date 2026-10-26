import { useEffect, useMemo, useState } from 'react';
import { priceInputLabel } from '../lib/currency';
import type { JobSettings, SheetPurchaseUnit } from '../types';
import {
  acceptCommunityMaterialIntoCatalog,
  communityOfferToDraft,
  dismissCommunityMaterial,
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

export function CommunityMaterialPrompt({ queue, settings, onResolved }: Props) {
  const current = queue[0];
  const catalog = loadMaterialCatalog();
  const initialDraft = useMemo(
    () => (current ? communityOfferToDraft(current, catalog) : null),
    [current, catalog],
  );

  const [pricePerSheet, setPricePerSheet] = useState(0);
  const [hasGrain, setHasGrain] = useState(false);
  const [sheetPurchaseUnit, setSheetPurchaseUnit] = useState<SheetPurchaseUnit>('quarter');
  const [edgingMaterialId, setEdgingMaterialId] = useState('');

  useEffect(() => {
    if (!initialDraft) return;
    setPricePerSheet(initialDraft.pricePerSheet);
    setHasGrain(initialDraft.hasGrain);
    setSheetPurchaseUnit(initialDraft.sheetPurchaseUnit);
    setEdgingMaterialId(initialDraft.edgingMaterialId);
  }, [initialDraft, current?.community_key]);

  if (!current || !initialDraft) return null;

  const edgingOptions = catalog?.edgingMaterials ?? [];

  async function onSkip() {
    await dismissCommunityMaterial(current.community_key);
    onResolved(false);
  }

  async function onAdd() {
    acceptCommunityMaterialIntoCatalog(current, {
      pricePerSheet,
      hasGrain,
      sheetPurchaseUnit,
      edgingMaterialId,
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
          Another installer added <strong>{current.name}</strong> ({current.colour}). Add it to your shared board
          catalog with your own price and options?
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
            <input className="table-input" readOnly value={current.colour} />
          </label>
          <label>
            {priceInputLabel(settings, 'Price / sheet (R)')}
            <NumberInput value={pricePerSheet} min={0} onChange={setPricePerSheet} />
          </label>
          <label className="community-material-check">
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
              value={edgingMaterialId}
              onChange={(e) => setEdgingMaterialId(e.target.value)}
            >
              {edgingOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.thickness} mm)
                </option>
              ))}
            </select>
          </label>
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
