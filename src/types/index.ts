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
/** Smallest board size you can buy from the supplier for that melamine. */
export type SheetPurchaseUnit = 'full' | 'half' | 'third' | 'quarter';

export type EdgingPattern =
  | '1_long'
  | '2_long'
  | '1_long_1_short'
  | '1_long_2_short'
  | '2_long_2_short'
  | 'none';

/** Optional supplier quote for the same board type (name/colour). */
export interface MaterialSupplierPrice {
  id: string;
  supplierName: string;
  pricePerSheet: number;
}

export interface Material {
  id: string;
  name: string;
  colour: string;
  /** Price used on quotes and costing for this board. */
  pricePerSheet: number;
  hasGrain: boolean;
  /** How sheet count is rounded for costing; defaults to quarter if omitted (old jobs). */
  sheetPurchaseUnit?: SheetPurchaseUnit;
  edgingMaterialId: string;
  /** Cut house / supplier to send factory cut list for this board (optional). */
  orderFromSupplier?: string;
  /** Other suppliers’ sheet prices for comparison; one can drive {@link pricePerSheet}. */
  supplierPrices?: MaterialSupplierPrice[];
  /** `manual` = quote price edited directly; otherwise id of {@link MaterialSupplierPrice}. */
  quotePriceSource?: 'manual' | string;
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
  /** Smallest sheet size supplier sells; defaults to quarter if omitted (old jobs). */
  sheetPurchaseUnit?: SheetPurchaseUnit;
  /** Cut house for masonite backs / drawer bottoms (optional). */
  orderFromSupplier?: string;
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

export type CustomHardwarePriceUnit = 'pair' | 'each' | 'pack';

/** Installer-owned product line when not using Gelmar catalog pricing. */
export interface CustomHardwareItem {
  id: string;
  description: string;
  unitPrice: number;
  priceUnit: CustomHardwarePriceUnit;
  /** Pack size when priceUnit is pack (screws, fittings). */
  packSize?: number;
  /** Manual pack/qty count for this job (screws & fittings in custom mode). */
  quoteQty?: number;
}

export interface HardwarePricing {
  useGelmarCatalog: {
    runners: boolean;
    hinges: boolean;
    screws: boolean;
    connectingFittings: boolean;
  };
  customCatalog: {
    runners: CustomHardwareItem[];
    hinges: CustomHardwareItem[];
    screws: CustomHardwareItem[];
    connectingFittings: CustomHardwareItem[];
  };
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
  /** ISO-style code for quote display (default ZAR). See `QUOTE_CURRENCIES` in `currency.ts`. */
  quoteCurrency?: string;
  /** SA VAT rate for quotes (default 15). */
  vatRatePercent?: number;
  /** When true, board/hardware/install prices are entered incl VAT; quotes split out VAT. Default false (ex VAT). */
  pricesEnterAsInclVat?: boolean;
  /** Show ex VAT + VAT + incl VAT on cut list and client PDF. */
  showVatOnQuote?: boolean;
  /** Extra board area allowance when estimating sheets (e.g. 10 = +10%). */
  boardWastagePercent?: number;
  /** Saw kerf between cuts on sheet nesting / offcuts (default 4 mm). */
  sawKerfMm?: number;
  /** Default cut house for new boards and masonite when not set per material. */
  defaultOrderSupplier?: string;
  /** Cut-house line items on quotes (SMEL / SHB / BOOR, edging order waste) — not Gelmar hardware. */
  cutHouseCharges?: CutHouseChargeSettings;
}

/** Mossel Bay–style cut-house extras on the client quote (boards, edging order, drill). */
export interface CutHouseChargeSettings {
  /** SMEL — per melamine sheet sent for cutting (0 = off). */
  melamineCutPricePerSheet?: number;
  /** SHB — one charge per job when masonite backs are ordered from cut house. */
  hardboardCutPricePerSheet?: number;
  /** BOOR — per hinge cup hole drilled at factory. */
  factoryDrillPricePerHole?: number;
  /** Extra edging length on quote only (cut-house order waste). */
  edgingOrderWastagePercent?: number;
  /** Round billable edging up to whole metres after wastage. */
  edgingOrderRoundUpMetre?: boolean;
  /** When true (default), only charge when Order from is set on that material. */
  onlyWhenOrderFromSet?: boolean;
}

/** Client quotation footer — editable per job. */
export interface QuoteTerms {
  validityDays: number;
  depositPercent: number;
  paymentNote: string;
  extraNotes: string;
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
  /** Wood kickplate — long edges to tape (0–2). Default 1. */
  kickplateEdgingLongCount?: 0 | 1 | 2;
  /** Wood kickplate — short edges to tape (0–2). */
  kickplateEdgingShortCount?: 0 | 1 | 2;
  /** @deprecated migrated to long/short counts */
  kickplateEdgingPattern?: EdgingPattern;
  kickplateEdgingMaterialId?: string;
  kickplateHeight: number;
  feetPerUnit: number;
  feetRequired: boolean;
}

export interface VisibleBackPanelConfig {
  enabled: boolean;
  widthMm: number;
  heightMm: number;
  /** Empty = match first door or drawer front material. */
  materialId?: string;
  edgingPattern?: EdgingPattern;
  /** Empty = match door/drawer front edging. */
  edgingMaterialId?: string;
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
  /** External finished face — affects corner block count (defaults from materials). */
  leftVisible?: boolean;
  /** External finished face — affects corner block count (defaults from materials). */
  rightVisible?: boolean;
  backingType: BackingType;
  backingMaterialId: string;
  /** External visible back when `backingType` is `none` (not inside carcass). */
  visibleBackPanel?: VisibleBackPanelConfig;
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
  /** Factory cut list: drill hinge holes (default yes). */
  factoryHingeHoles?: boolean;
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
  /** @deprecated Ignored — box height is set on `boxHeight`. Kept for old saved jobs. */
  frontOverhangMm?: number;
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
  hardwarePricing?: HardwarePricing;
  installRates: InstallRates;
  quoteTerms?: QuoteTerms;
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
  /** Which axis carries the long edging run — controls cut-list dimension order. */
  longAlong?: 'width' | 'length';
  /** Wood kickplate — long = along run, short = along height (see kickplateEdging.ts). */
  kickplateEdgingCounts?: { long: 0 | 1 | 2; short: 0 | 1 | 2 };
  /** Doors only — factory Holes column. */
  factoryHingeHoles?: boolean;
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
  category: 'board' | 'edging' | 'masonite' | 'hardware' | 'install' | 'cutHouse';
  name: string;
  detail: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface ConsolidatedPiece {
  partName: string;
  materialName: string;
  width: number;
  length: number;
  /** Grain runs along `length` when not 'none'. */
  grain: CutPiece['grain'];
  totalQty: number;
  edgingLabel: string;
  /** Edging pattern only, e.g. "2 long 2 short" */
  patternLabel: string;
  /** Board + edging pattern + tape spec — used to merge cut list tables */
  groupKey: string;
  longAlong?: 'width' | 'length';
}

export interface CutListGroup {
  /** e.g. "White 18mm — PVC white (1 mm)" */
  heading: string;
  items: ConsolidatedPiece[];
}

export interface SheetMapPlacement {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  label: string;
  grainLocked: boolean;
}

export interface SheetMapOffcutRect {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

export interface SheetMapSheet {
  sheetIndex: number;
  grainLengthMm: number;
  crossLengthMm: number;
  placements: SheetMapPlacement[];
  offcutRects: SheetMapOffcutRect[];
}

export interface SheetMapGroup {
  materialId: string;
  materialName: string;
  sheets: SheetMapSheet[];
}

/** Usable leftover from sheet nesting (full / factory cut list). */
export interface BoardOffcut {
  materialId: string;
  materialName: string;
  sheetIndex: number;
  widthMm: number;
  lengthMm: number;
  areaMm2: number;
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
  consolidated: ConsolidatedPiece[];
  /** Carcass, doors and drawer parts — one group per board material + edging tape */
  boardGroups: CutListGroup[];
  masoniteGroups: CutListGroup[];
  edging: EdgingLine[];
  consolidatedEdging: ConsolidatedEdging[];
  hardware: HardwareItem[];
  screws: ScrewLine[];
  plasticKickplates: PlasticKickplateLine[];
  plasticKickplateTotalMetres: number;
  costs: CostLine[];
  /** Grain-locked parts that don't fit the sheet in the required direction. */
  sheetWarnings: string[];
  /** Suggested keeper offcuts from nesting panels on sheet sizes (not from wastage %). */
  boardOffcuts: BoardOffcut[];
  /** Per-sheet nesting diagrams (factory / full cut list). */
  sheetMaps: SheetMapGroup[];
  install: InstallEstimate | null;
  materialsTotal: number;
  installationTotal: number;
  travelTotal: number;
  grandTotal: number;
}
