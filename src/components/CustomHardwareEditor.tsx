import type { CustomHardwareItem, CustomHardwarePriceUnit, HardwarePricing } from '../types';
import { newCustomHardwareItem } from '../lib/hardwarePricing';
import { NumberInput } from './NumberInput';

type Category = keyof HardwarePricing['customCatalog'];

interface Props {
  category: Category;
  categoryLabel: string;
  useGelmar: boolean;
  onUseGelmarChange: (useGelmar: boolean) => void;
  items: CustomHardwareItem[];
  onItemsChange: (items: CustomHardwareItem[]) => void;
  gelmarPanel: React.ReactNode;
  /** Show pack size + job qty columns (screws, connecting fittings). */
  packMode?: boolean;
  defaultPriceUnit?: CustomHardwarePriceUnit;
  currencySymbol?: string;
}

function patchItem(items: CustomHardwareItem[], id: string, patch: Partial<CustomHardwareItem>) {
  return items.map((x) => (x.id === id ? { ...x, ...patch } : x));
}

export function CustomHardwareEditor({
  categoryLabel,
  useGelmar,
  onUseGelmarChange,
  items,
  onItemsChange,
  gelmarPanel,
  packMode,
  defaultPriceUnit = 'each',
  currencySymbol = 'R',
}: Props) {
  const addItem = () => {
    onItemsChange([
      ...items,
      newCustomHardwareItem({
        priceUnit: packMode ? 'pack' : defaultPriceUnit,
        packSize: packMode ? 100 : undefined,
        quoteQty: 0,
      }),
    ]);
  };

  return (
    <>
      <label className="checkbox-label hardware-source-toggle">
        <input type="checkbox" checked={useGelmar} onChange={(e) => onUseGelmarChange(e.target.checked)} />
        Use Gelmar catalog &amp; live price refresh for {categoryLabel.toLowerCase()}
      </label>
      <p className="hint">
        {useGelmar
          ? 'Prices from Gelmar (refresh) or overrides in the table below. Saved with the job and in My default prices.'
          : 'Add your own supplier products (description + price). Saved with the job and in My default prices.'}
      </p>

      {useGelmar ? (
        gelmarPanel
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table materials-price-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>{packMode ? `Price / pack (${currencySymbol})` : `Price (${currencySymbol})`}</th>
                  {packMode && <th>Pack size</th>}
                  {packMode && <th>Qty (packs) this job</th>}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={packMode ? 5 : 3}>
                      <span className="hint">No products yet — add one below.</span>
                    </td>
                  </tr>
                )}
                {items.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Description">
                      <input
                        className="table-input"
                        value={item.description}
                        placeholder="e.g. Ball bearing runner 500 mm"
                        onChange={(e) => onItemsChange(patchItem(items, item.id, { description: e.target.value }))}
                      />
                    </td>
                    <td data-label="Price">
                      <NumberInput
                        className="table-input"
                        
                        min={0}
                        step={0.01}
                        value={item.unitPrice}
                        onChange={(n) => onItemsChange(patchItem(items, item.id, { unitPrice: n }))}
                      />
                    </td>
                    {packMode && (
                      <td data-label="Pack size">
                        <NumberInput
                          className="table-input"
                          
                          min={1}
                          value={item.packSize ?? 1}
                          onChange={(n) => onItemsChange(patchItem(items, item.id, { packSize: n }))}
                        />
                      </td>
                    )}
                    {packMode && (
                      <td data-label="Qty packs">
                        <NumberInput
                          className="table-input"
                          
                          min={0}
                          value={item.quoteQty ?? 0}
                          onChange={(n) => onItemsChange(patchItem(items, item.id, { quoteQty: n }))}
                        />
                      </td>
                    )}
                    <td data-label="">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm danger"
                        onClick={() => onItemsChange(items.filter((x) => x.id !== item.id))}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>
            + Add product
          </button>
          {packMode && (
            <p className="hint">
              Enter how many <strong>packs</strong> you expect to buy for this job. Cut-list screw counts are skipped in custom mode — you control qty here.
            </p>
          )}
          {!packMode && (
            <p className="hint">
              Pick these products on each unit (runner / hinge dropdown). Quantities follow doors and drawers on the cut list.
            </p>
          )}
        </>
      )}
    </>
  );
}
