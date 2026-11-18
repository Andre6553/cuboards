import type { InstallerDetails } from '../types';

export const EMPTY_INSTALLER: InstallerDetails = {
  businessName: '',
  phone: '',
  email: '',
};

export function normalizeInstallerDetails(
  installer?: Partial<InstallerDetails> | null,
): InstallerDetails {
  return {
    businessName: installer?.businessName?.trim() ? installer.businessName : '',
    phone: installer?.phone?.trim() ? installer.phone : '',
    email: installer?.email?.trim() ? installer.email : '',
  };
}
