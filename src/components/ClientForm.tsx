import type { Client, InstallerDetails } from '../types';
import { normalizeInstallerDetails } from '../lib/installerDetails';
import { CollapsibleSection } from './CollapsibleSection';

interface Props {
  client: Client;
  installer: InstallerDetails;
  onChange: (client: Client) => void;
  onInstallerChange: (installer: InstallerDetails) => void;
  defaultOpen?: boolean;
}

export function ClientForm({
  client,
  installer,
  onChange,
  onInstallerChange,
  defaultOpen,
}: Props) {
  const set = (field: keyof Client, value: string) => onChange({ ...client, [field]: value });
  const setInstaller = (field: keyof InstallerDetails, value: string) =>
    onInstallerChange(normalizeInstallerDetails({ ...installer, [field]: value }));

  return (
    <CollapsibleSection title="Client details" defaultOpen={defaultOpen}>
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

      <h4 className="subsection-title">Installer / business details</h4>
      <p className="hint">
        Used on the Timbercity cutting list as Customer Name and Phone (your trade account at the cut house).
        Saved with My default prices so new jobs start with these filled in.
      </p>
      <div className="form-grid">
        <label>
          Business name
          <input
            value={installer.businessName}
            onChange={(e) => setInstaller('businessName', e.target.value)}
            placeholder="e.g. Arline Cupboards"
          />
        </label>
        <label>
          Business phone
          <input
            value={installer.phone}
            onChange={(e) => setInstaller('phone', e.target.value)}
            placeholder="082 000 0000"
          />
        </label>
        <label>
          Business email
          <input
            type="email"
            value={installer.email}
            onChange={(e) => setInstaller('email', e.target.value)}
            placeholder="you@example.com"
          />
        </label>
      </div>
    </CollapsibleSection>
  );
}
