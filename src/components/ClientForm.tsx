import type { Client } from '../types';
import { CollapsibleSection } from './CollapsibleSection';

interface Props {
  client: Client;
  onChange: (client: Client) => void;
}

export function ClientForm({ client, onChange }: Props) {
  const set = (field: keyof Client, value: string) => onChange({ ...client, [field]: value });

  return (
    <CollapsibleSection title="Client details">
      <div className="form-grid">
        <label>
          Client name
          <input value={client.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Smith kitchen" />
        </label>
        <label>
          Job reference
          <input value={client.ref} onChange={(e) => set('ref', e.target.value)} placeholder="e.g. JOB-2026-014" />
        </label>
        <label>
          Phone
          <input value={client.phone} onChange={(e) => set('phone', e.target.value)} placeholder="082 000 0000" />
        </label>
        <label className="span-2">
          Address
          <input value={client.address} onChange={(e) => set('address', e.target.value)} placeholder="Installation address" />
        </label>
        <label className="span-2">
          Notes
          <textarea value={client.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Site notes, delivery instructions…" />
        </label>
      </div>
    </CollapsibleSection>
  );
}
