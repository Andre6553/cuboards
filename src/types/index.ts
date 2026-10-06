export type BoardThickness = 16 | 18;
export type CutSizeMode = 'final' | 'net';
export type UnitType = 'kitchen_base' | 'wall' | 'bedroom';
export type BottomType = 'solid' | 'masonite';
export type BackingType = 'none' | 'masonite' | 'melamine';
export type CountertopType = 'granite' | 'wooden';
export type MountType = 'floor' | 'wall';
export type KickplateType = 'wood' | 'plastic';
export type KickplateCoverage = 'front' | 'front-one-side' | 'front-both-sides';
export type KickplateSide = 'left' | 'right';
export type EdgingPattern =
  | '1_long'
  | '2_long'
  | '1_long_1_short'
  | '1_long_2_short'
  | '2_long_2_short'
  | 'none';

export interface Material {
  id: string;
  name: string;
  colour: string;
  pricePerSheet: number;
  hasGrain: boolean;
  edgingMaterialId: string;
}

export interface EdgingMaterial {
  id: string;
  name: string;
  thickness: number;
  pricePerMetre: number;
}

export interface MasoniteConfig {
  name: string;
  colour: string;
  thickness: number;
  pricePerSheet: number;
  sheetWidth: number;
  sheetHeight: number;
}

export interface RunnerPrices {
  [presetId: string]: number;
}

export interface HingePrices {
  [presetId: string]: number;
}

export interface ScrewPrices {
  [screwId: string]: number;
}

export interface ConnectingFittingPrices {
  [fittingId: string]: number;
}

/** Installation labour rates — per job, editable in Materials. */
export interface InstallRates {
  enabled: boolean;
  kitchenBasePerCupboard: number;
  wallUnitPerCupboard: number;
  bedroomPerCupboard: number;
  perDoorLeaf: number;
  perDrawer: number;
  /** Extra per cupboard when unit is wall-mounted. */
  wallMountPremium: number;
  minimumJob: number;
  travelFee: number;
}

export interface InstallLine {
  unitName: string;
  unitType: UnitType;
  cupboardQty: number;
  baseSubtotal: number;
  doorLeaves: number;
  doorSubtotal: number;
  drawerCount: number;
  drawerSubtotal: number;
  wallPremium: number;
  subtotal: number;
  detail: string;
}

export interface InstallEstimate {
  lines: InstallLine[];
  laborSubtotal: number;
  minimumJob: number;
  minimumApplied: number;
  /** Labour after minimum job rule — excludes travel. */
  installationTotal: number;
  travelFee: number;
  /** installationTotal + travelFee */
  total: number;
}

export interface ScrewLine {
  screwId: string;
  name: string;
  sku: string;
  totalScrews: number;
  packSize: number;
  packsNeeded: number;
  packPrice: number;
  subtotal: number;
  usageDetail: string;
}

export interface DoorHinge {
  type: 'preset' | 'custom';
  presetId?: string;
  customUnitPrice?: number;
}

export interface Client {
  name: string;
  phone: string;
  address: string;
  ref: string;
  notes: string;
}

export interface JobSettings {
  thickness: BoardThickness;
  sheetWidth: number;
  sheetHeight: number;
  defaultGap: number;
  defaultFillerWidth: number;
  defaultKickplateHeight: number;
  feetPerBaseUnit: number;
  pricePerFoot: number;
  /** final = cut list shows finished sizes; net = deduct edging tape thickness from edged sides */
  cutSizeMode: CutSizeMode;
}

export interface PlasticKickplateConfig {
  name: string;
  /** Strip profile height (mm) — e.g. 120 */
  stripHeight: number;
  /** Strip face width / depth (mm) */
  stripWidth: number;
  pricePerMetre: number;
}

export interface KitchenPlinthConfig {
  kickplateType: KickplateType;
  kickplateCoverage: KickplateCoverage;
  kickplateSide: KickplateSide;
  kickplateMaterialId: string;
  kickplateHeight: number;
  feetPerUnit: number;
  feetRequired: boolean;
}

export interface CarcassConfig {
  leftMaterialId: string;
  rightMaterialId: string;
  leftEdgingMaterialId: string;
  rightEdgingMaterialId: string;
  bottomMaterialId: string;
  bottomEdgingMaterialId: string;
  shelfMaterialId: string;
  shelfEdgingMaterialId: string;
  fillerMaterialId: string;
  fillerEdgingMaterialId: string;
  shelfQty: number;
  fillerWidth: number;
  leftVisible: boolean;
  rightVisible: boolean;
  backingType: BackingType;
  backingMaterialId: string;
  countertopType: CountertopType;
  mountType: MountType;
}

export interface DrawerRunner {
  type: 'preset' | 'custom';
  presetId?: string;
  customSideClearance?: number;
  customDepthDeduction?: number;
}

export interface DoorGaps {
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** Horizontal gap between doors when qty &gt; 1 */
  between: number;
}

export interface DoorConfig {
  id: string;
  qty: number;
  materialId: string;
  edgingPattern: EdgingPattern;
  /** Edging tape for this door — can differ from board default (e.g. thicker door edge). */
  edgingMaterialId: string;
  openingWidth: number;
  openingHeight: number;
  gaps: DoorGaps;
  hinge: DoorHinge;
}

export interface DrawerGaps {
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** Horizontal gap between drawer fronts when frontQty &gt; 1 in one row */
  between: number;
}

export interface DrawerConfig {
  id: string;
  /** How many of this drawer row per cupboard (cut list multiplier). */
  qty: number;
  /** Drawer fronts side by side in this row (default 1). Not the same as qty per cupboard. */
  frontQty?: number;
  /** Drawer box / carcass melamine (sides, box front & back, solid bottom). */
  boxMaterialId: string;
  /** Visible drawer front panel. */
  frontMaterialId: string;
  /** @deprecated use boxMaterialId / frontMaterialId — kept for saved-job migration */
  materialId?: string;
  bottomType: BottomType;
  boxHeight: number;
  /** Finished drawer front is this much taller than the box (default 10 mm). */
  frontOverhangMm: number;
  runner: DrawerRunner;
  /** Visible front opening width (mm) — set per row when unit has doors + drawers. */
  openingWidth: number;
  /** Visible front opening height (mm). */
  openingHeight: number;
  /** Gaps around the visible drawer front (facade). */
  gaps: DrawerGaps;
  /** Edging on the visible drawer front. */
  frontEdgingPattern: EdgingPattern;
  frontEdgingMaterialId: string;
  /** Edging on drawer box front & back (default 1 long + 2 short). */
  boxFrontBackEdgingPattern?: EdgingPattern;
  /** Edging on drawer box sides (default 1 long edge). */
  boxSideEdgingPattern?: EdgingPattern;
  boxEdgingMaterialId: string;
  /** @deprecated use boxSideEdgingPattern / boxFrontBackEdgingPattern */
  boxEdgingPattern?: EdgingPattern;
  /** Gap between this drawer row and the door below (when unit has a door). */
  gapToDoorMm: number;
  /** Gap each side between drawer box and carcass (runner mounting clearance). */
  sideClearance: number;
  frontClearance: number;
  backClearance: number;
}

export interface Unit {
  id: string;
  name: string;
  type: UnitType;
  width: number;
  height: number;
  depth: number;
  unitQty: number;
  carcass: CarcassConfig;
  plinth?: KitchenPlinthConfig;
  doors: DoorConfig[];
  drawers: DrawerConfig[];
}

export interface UnitPreset {
  id: string;
  name: string;
  createdAt: string;
  template: Omit<Unit, 'id' | 'name' | 'unitQty'>;
}

export interface PlasticKickplateLine {
  unitName: string;
  coverageLabel: string;
  lengthMm: number;
  stripHeight: number;
  stripWidth: number;
  cupboardQty: number;
  totalMetres: number;
  pricePerMetre: number;
  subtotal: number;
}

export interface Job {
  id: string;
  createdAt: string;
  updatedAt: string;
  client: Client;
  settings: JobSettings;
  materials: Material[];
  edgingMaterials: EdgingMaterial[];
  masonite: MasoniteConfig;
  plasticKickplate: PlasticKickplateConfig;
  runnerPrices: RunnerPrices;
  hingePrices: HingePrices;
  screwPrices: ScrewPrices;
  connectingFittingPrices: ConnectingFittingPrices;
  installRates: InstallRates;
  units: Unit[];
}

export type CutPieceCategory = 'carcass' | 'door' | 'drawer';

export interface CutPiece {
  category: CutPieceCategory;
  materialId: string;
  materialName: string;
  partName: string;
  unitName: string;
  width: number;
  length: number;
  qty: number;
  grain: 'vertical' | 'horizontal' | 'none';
  notes: string;
  edgingPattern?: EdgingPattern;
  edgingMaterialId?: string;
  bottomType?: BottomType;
}

export interface EdgingLine {
  boardMaterialName: string;
  edgingMaterialId: string;
  edgingMaterialName: string;
  edgingThickness: number;
  partName: string;
  unitName: string;
  pattern: EdgingPattern;
  patternLabel: string;
  edgeSize: string;
  qty: number;
  totalLm: number;
}

export interface HardwareItem {
  description: string;
  qty: number;
  unitName: string;
  detail: string;
  pricePerPair: number;
  subtotal: number;
}

export interface CostLine {
  category: 'board' | 'edging' | 'masonite' | 'hardware' | 'install';
  name: string;
  detail: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface ConsolidatedPiece {
  materialName: string;
  width: number;
  length: number;
  totalQty: number;
  edgingLabel: string;
  /** Board + edging pattern + tape spec — used to merge cut list tables */
  groupKey: string;
}

export interface CutListGroup {
  /** e.g. "White 18mm — 2 long 2 short · PVC white (1 mm)" */
  heading: string;
  items: ConsolidatedPiece[];
}

export interface ConsolidatedEdging {
  edgingMaterialId: string;
  edgingMaterialName: string;
  thickness: number;
  totalLm: number;
  pricePerMetre: number;
  subtotal: number;
}

export interface CutListResult {
  pieces: CutPiece[];
  /** @deprecated use carcassGroups — kept for compatibility */
  consolidated: ConsolidatedPiece[];
  carcassGroups: CutListGroup[];
  /** Doors + drawer melamine — grouped by material and edging */
  facadeGroups: CutListGroup[];
  masoniteGroups: CutListGroup[];
  edging: EdgingLine[];
  consolidatedEdging: ConsolidatedEdging[];
  hardware: HardwareItem[];
  screws: ScrewLine[];
  plasticKickplates: PlasticKickplateLine[];
  plasticKickplateTotalMetres: number;
  costs: CostLine[];
  install: InstallEstimate | null;
  materialsTotal: number;
  installationTotal: number;
  travelTotal: number;
  grandTotal: number;
}
