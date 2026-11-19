import type { HardwareItem } from '../types';
import { CABINET_HANDLE_DESCRIPTION, nestHandleDetail } from './handleRules';

/** Normalize detail for nesting: handles drop 1/door · 1/front; other items keep detail as-is. */
export function nestHardwareDetail(description: string, detail: string): string {
  if (description === CABINET_HANDLE_DESCRIPTION) return nestHandleDetail(detail);
  return detail.trim();
}

function nestKey(h: HardwareItem): string {
  const detail = nestHardwareDetail(h.description, h.detail);
  return `${h.description}\0${detail}\0${h.pricePerPair}`;
}

/**
 * Nest cut-list hardware rows that share the same item + detail (+ unit price).
 * Qty and subtotal are summed; Unit shows "—" when more than one unit contributed.
 * Order follows first appearance of each group.
 */
export function nestHardwareByDetail(rows: HardwareItem[]): HardwareItem[] {
  const groups = new Map<
    string,
    { item: HardwareItem; firstIndex: number; sourceCount: number; firstUnitName: string }
  >();
  const order: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const h = rows[i];
    const key = nestKey(h);
    const existing = groups.get(key);
    if (existing) {
      existing.item.qty += h.qty;
      existing.item.subtotal += h.subtotal;
      existing.sourceCount += 1;
      continue;
    }
    const detail = nestHardwareDetail(h.description, h.detail);
    groups.set(key, {
      firstIndex: i,
      sourceCount: 1,
      firstUnitName: h.unitName,
      item: {
        description: h.description,
        qty: h.qty,
        unitName: h.unitName,
        detail,
        pricePerPair: h.pricePerPair,
        subtotal: h.subtotal,
      },
    });
    order.push(key);
  }

  const out: HardwareItem[] = [];
  const emitted = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const key = nestKey(rows[i]);
    if (emitted.has(key)) continue;
    const group = groups.get(key);
    if (!group || group.firstIndex !== i) continue;
    emitted.add(key);
    out.push({
      ...group.item,
      unitName: group.sourceCount > 1 ? '—' : group.firstUnitName,
    });
  }
  return out;
}

/** @deprecated use {@link nestHardwareByDetail} */
export function nestCabinetHandleHardware(rows: HardwareItem[]): HardwareItem[] {
  return nestHardwareByDetail(rows);
}
