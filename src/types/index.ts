export type BoardThickness = 16 | 18;
export type CutSizeMode = 'final' | 'net';
export type UnitType = 'kitchen_base' | 'wall' | 'bedroom';
export type BottomType = 'solid' | 'masonite';
export type BackingType = 'none' | 'masonite' | 'melamine';
export type CountertopType = 'granite' | 'wooden';
export type MountType = 'floor' | 'floor_corner' | 'tall_floor' | 'wall' | 'wall_corner' | 'spice';
export type KickplateType = 'wood' | 'plastic' | 'none';
export type KickplateCoverage = 'front' | 'front-one-side' | 'front-both-sides';
export type KickplateSide = 'left' | 'right';
/** Smallest board size you can buy from the supplier for that melamine. */
export type SheetPurchaseUnit = 'full' | 'half' | 'third' | 'quarter';

export type EdgingPattern =
  | '1_long'
  | '2_long'
  | '1_short'
  | '2_short'
  | '1_long_1_short'
  | '1_long_2_short'
  | '2_long_1_short'
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
  /** Small sheet colour (also fallback when large colour unset). */
  colour: string;
  /** Small sheet thickness mm (also fallback when large thickness unset). */
  thickness: number;
  /** Small sheet price (default 2440×1220). */
  pricePerSheet: number;
  /** Small sheet width (mm). */
  sheetWidth: number;
  /** Small sheet height (mm). */
  sheetHeight: number;
  /**
   * Large sheet price (default 2750×1830 @ R475).
   * Quote auto-picks large when area or panel height needs it.
   */
  largePricePerSheet?: number;
  /** Large sheet width (mm). */
  largeSheetWidth?: number;
  /** Large sheet height (mm). */
  largeSheetHeight?: number;
  /** Large sheet colour; falls back to `colour` when omitted. */
  largeColour?: string;
  /** Large sheet thickness mm; falls back to `thickness` when omitted. */
  largeThickness?: number;
  /** Large sheet buy-as; falls back to `sheetPurchaseUnit` when omitted. */
  largeSheetPurchaseUnit?: SheetPurchaseUnit;
  /** Large sheet cut house; falls back to `orderFromSupplier` when omitted. */
  largeOrderFromSupplier?: string;
  /** Smallest sheet size supplier sells (small sheet); defaults to quarter if omitted (old jobs). */
  sheetPurchaseUnit?: SheetPurchaseUnit;
  /** Cut house for small masonite backs / drawer bottoms (optional). */
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

/** Installer / trade business — used on Timbercity cut-list header (not the client). */
export interface InstallerDetails {
  businessName: string;
  phone: string;
  email: string;
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
  /**
   * Per-job defaults for **new** units / doors / drawers only (not account price list).
   * Existing units are never rewritten when these change.
   */
  defaultVisibleSideMaterialId?: string;
  defaultCarcassMaterialId?: string;
  defaultCarcassEdgingMaterialId?: string;
  defaultDoorMaterialId?: string;
  defaultDoorEdgingMaterialId?: string;
  defaultDrawerFrontMaterialId?: string;
  defaultDrawerFrontEdgingMaterialId?: string;
}

/** Mossel Bay–style cut-house extras on the client quote (boards, edging order, drill). */
export interface CutHouseChargeSettings {
  /** SMEL — per melamine sheet sent for cutting (0 = off). */
  melamineCutPricePerSheet?: number;
  /** SHB — R per masonite sheet cut when masonite is ordered from cut house. */
  hardboardCutPricePerSheet?: number;
  /** BOOR — per hinge cup hole drilled at factory. */
  factoryDrillPricePerHole?: number;
  /** Extra edging length on quote only (cut-house order waste). */
  edgingOrderWastagePercent?: number;
  /** Round billable edging up to whole metres after wastage. */
  edgingOrderRoundUpMetre?: boolean;
  /** When true (default), only charge when Order from is set on that material. */
  onlyWhenOrderFromSet?: boolean;
  /**
   * When masonite backs are ordered from the cut house, bill **1 full HB sheet** on the quote
   * (matches Mossel Bay HB001 line) instead of fractional sheet math.
   */
  masoniteOneFullSheetFromCutHouse?: boolean;
  /** Set when user ticks HB001 match — avoids legacy saved `true` from an old app default. */
  masoniteHb001Explicit?: boolean;
}

/** Client quotation footer — editable per job. */
export interface QuoteTerms {
  validityDays: number;
  depositPercent: number;
  paymentNote: string;
  extraNotes: string;
}

export interface PlasticKickplateProduct {
  id: string;
  name: string;
  stripHeight: number;
  stripWidth: number;
  pricePerMetre: number;
}

export interface PlasticKickplateConfig {
  useGelmarCatalog?: boolean;
  customProducts?: PlasticKickplateProduct[];
  /**
   * Gelmar R/m by strip height (100 / 150). Used when pricing a unit’s plastic
   * kickplate from plinth height while Gelmar catalog is on.
   */
  gelmarPricePerMetreByHeight?: { 100?: number; 150?: number };
  /**
   * Flexible aluminium plinth corner R each by height (100 / 150).
   * Used when plastic kickplate coverage includes side returns.
   */
  gelmarCornerPriceEachByHeight?: { 100?: number; 150?: number };
  name: string;
  /** Strip profile height (mm) — e.g. 120 */
  stripHeight: number;
  /** Strip face width / depth (mm) */
  stripWidth: number;
  pricePerMetre: number;
}

export interface KitchenPlinthConfig {
  kickplateType: KickplateType;
  plasticKickplateProductId?: string;
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
  /** Wood kickplate — long-edge run for the front strip (mm). Empty = cupboard width. */
  kickplateFrontRunMm?: number;
  /** Wood kickplate — long-edge run for each side return (mm). Empty = cupboard depth. */
  kickplateSideRunMm?: number;
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
  /** Side edging pattern (floor corner / when set). Empty = 1 long. */
  leftEdgingPattern?: EdgingPattern;
  rightEdgingPattern?: EdgingPattern;
  bottomMaterialId: string;
  bottomEdgingMaterialId: string;
  /** Top panel board (wall units + corner units). Empty = same as bottom. */
  topMaterialId?: string;
  /** Top panel edging tape. Empty = match top/bottom board default. */
  topEdgingMaterialId?: string;
  shelfMaterialId: string;
  shelfEdgingMaterialId: string;
  /**
   * Top/side filler board. On wall / tall floor with melamine backing may be
   * `NO_FILLER_MATERIAL_ID` (`__no_filler__`) to omit top fillers from the cut list.
   */
  fillerMaterialId: string;
  fillerEdgingMaterialId: string;
  /** Floor/wall-corner fillers. Empty = 1 long. */
  fillerEdgingPattern?: EdgingPattern;
  /** Wall corner filler 1 strip width (mm). Empty = 70. Length = H − 2T. */
  wallCornerFiller1WidthMm?: number;
  shelfQty: number;
  fillerWidth: number;
  /** External finished face — affects corner block count (defaults from materials). */
  leftVisible?: boolean;
  /** External finished face — affects corner block count (defaults from materials). */
  rightVisible?: boolean;
  /**
   * Bedroom wall mount only. Two strips (left and right), filler width × carcass height.
   */
  sideFillers?: boolean;
  /** Bedroom wall side filler strip width (mm). Empty = `fillerWidth`. */
  sideFillerWidth?: number;
  /** Bedroom wall side filler strip height (mm). Empty = carcass height. */
  sideFillerHeight?: number;
  /** Bedroom wall side filler quantity. Empty = 2. */
  sideFillerQty?: number;
  /** Side filler long edges (along height). Empty = 1. */
  sideFillerEdgingLongCount?: 0 | 1 | 2;
  /** Side filler short edges (along width). Empty = 0. */
  sideFillerEdgingShortCount?: 0 | 1 | 2;
  /**
   * Bedroom wall mount only. Two strips (front and back), filler width × carcass width.
   */
  topFillers?: boolean;
  /** Bedroom wall top filler strip width (mm). Empty = `fillerWidth`. */
  topFillerWidth?: number;
  /** Bedroom wall top filler strip length (mm). Empty = carcass width. */
  topFillerHeight?: number;
  /** Bedroom wall top filler quantity. Empty = 2. */
  topFillerQty?: number;
  /** Top filler long edges (along carcass width). Empty = 1. */
  topFillerEdgingLongCount?: 0 | 1 | 2;
  /** Top filler short edges (along filler width). Empty = 0. */
  topFillerEdgingShortCount?: 0 | 1 | 2;
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
  /**
   * Finished door panel height (mm) when `Unit.customDoorSizes` is on.
   * Width still comes from opening − L/R gaps. Grain runs top → bottom.
   */
  doorHeightMm?: number;
  gaps: DoorGaps;
  hinge: DoorHinge;
  /** Factory cut list: drill hinge holes (default yes). */
  factoryHingeHoles?: boolean;
  /**
   * Hinge cups per door leaf. Unset = default from finished height
   * (2 up to 1200 mm, 4 above). Also the hinge qty on the quote.
   */
  hingeHoleCount?: number;
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
  /**
   * Finished drawer front height (mm) when `Unit.customDrawerSizes` is on.
   * Width still comes from opening − L/R gaps. Grain runs top → bottom (vertical).
   */
  frontHeightMm?: number;
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

/** Spice mount (`carcass.mountType === 'spice'`) — pull-out interior panels. */
export interface SpiceCupboardConfig {
  frontHeightMm: number;
  runnerSideClearanceMm?: number;
}

/** Kitchen base / wall unit — manual extra cuts (doors, panels, fillers). */
export type CustomExtraPartKind = 'door' | 'panel' | 'filler';

export interface CustomExtraPart {
  id: string;
  kind: CustomExtraPartKind;
  /** Optional note on the cut list (e.g. “LH end”). */
  label: string;
  /** Cut-list length (mm). */
  length: number;
  /** Cut-list width (mm). */
  width: number;
  qty: number;
  materialId: string;
  edgingPattern: EdgingPattern;
  edgingMaterialId: string;
}

/**
 * Inner box built inside a bedroom cupboard (Extras section).
 * Shelf and division sizes are user-typed, not derived from the outer carcass.
 */
export interface BedroomWallExtra {
  id: string;
  width: number;
  height: number;
  depth: number;
  includeTop: boolean;
  topQty: number;
  /** Front run (cut-list length; edging long edge along length unless pattern says otherwise). */
  topLength: number;
  /** Front to back (cut-list width). */
  topDepth: number;
  topMaterialId: string;
  topEdgingPattern: EdgingPattern;
  topEdgingMaterialId: string;
  sideFillers: boolean;
  sideFillerWidth: number;
  /** Long side of the strip (cut-list length; 1 Long edging). */
  sideFillerHeight: number;
  sideFillerQty: number;
  sideFillerEdgingLongCount: 0 | 1 | 2;
  sideFillerEdgingShortCount: 0 | 1 | 2;
  topFillers: boolean;
  topFillerWidth: number;
  /** Long side of the strip (cut-list length; 1 Long edging). */
  topFillerHeight: number;
  topFillerQty: number;
  topFillerEdgingLongCount: 0 | 1 | 2;
  topFillerEdgingShortCount: 0 | 1 | 2;
  shelvesEnabled: boolean;
  shelfQty: number;
  /** Front run (cut-list length; 1 Long edging). */
  shelfWidth: number;
  /** Front to back (cut-list width). */
  shelfHeight: number;
  shelfEdgingPattern: EdgingPattern;
  shelfEdgingMaterialId: string;
  divisionEnabled: boolean;
  divisionQty: number;
  divisionWidth: number;
  divisionHeight: number;
  divisionEdgingPattern: EdgingPattern;
  divisionEdgingMaterialId: string;
  drawersEnabled: boolean;
  drawers: DrawerConfig[];
  /** Drawer stack carcass (floor-unit logic). Drawers sit inside this box; extra W×H×D is the outer inner carcass. */
  drawerCarcassWidth: number;
  drawerCarcassHeight: number;
  drawerCarcassDepth: number;
  /** Identical drawer carcass boxes in this extra (multiplies drawer box cuts, runners, hardware). */
  drawerCarcassQty: number;
  /** Board for inner sides and bottom. */
  boxMaterialId: string;
  /** Board for shelves (when enabled). */
  shelfMaterialId: string;
  /** Board for division panel(s) (when enabled). */
  divisionMaterialId: string;
  /** Board for side/top filler strips (when enabled). */
  fillerMaterialId: string;
  /** Edging on inner sides / top / bottom. */
  edgingPattern: EdgingPattern;
  edgingMaterialId: string;
  fillerEdgingPattern: EdgingPattern;
  fillerEdgingMaterialId: string;
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
  /** When mount is spice cupboard. */
  spice?: SpiceCupboardConfig;
  doors: DoorConfig[];
  drawers: DrawerConfig[];
  /**
   * When on: front height is manual per drawer row; opening height is calculated for display.
   * No auto carcass split. Warn if drawer openings + door openings exceed carcass height.
   */
  customDrawerSizes?: boolean;
  /**
   * When on: door panel height is manual; opening height = height + top/bottom gaps.
   * Width still from cupboard − L/R. Layout keeps these openings when drawers are added.
   */
  customDoorSizes?: boolean;
  /** Off = extras form disabled and cut-list logic skipped. */
  extrasEnabled?: boolean;
  /** Bedroom — inner boxes, shelves, division, drawer stacks. */
  extras?: BedroomWallExtra[];
  /** Kitchen base / wall — custom doors, panels, and fillers. */
  customExtras?: CustomExtraPart[];
}

export interface UnitPreset {
  id: string;
  name: string;
  createdAt: string;
  template: Omit<Unit, 'id' | 'name' | 'unitQty'>;
}

export interface PlasticKickplateLine {
  productName: string;
  unitName: string;
  coverageLabel: string;
  lengthMm: number;
  stripHeight: number;
  stripWidth: number;
  cupboardQty: number;
  /** Installed / cut run needed (m) — not rounded to buy length. */
  totalMetres: number;
  pricePerMetre: number;
  /**
   * Money for this unit row. Quote / cost totals use job-level 3 m strip rounding
   * (see `summarizePlasticKickplatePurchases`); unit subtotals stay needed×R/m for display.
   */
  subtotal: number;
}

/** One buy-group after summing same product/height/price runs and rounding up to 3 m strips. */
export interface PlasticKickplatePurchase {
  productName: string;
  stripHeight: number;
  stripWidth: number;
  pricePerMetre: number;
  neededMetres: number;
  stripsToBuy: number;
  billableMetres: number;
  subtotal: number;
}

export interface Job {
  id: string;
  createdAt: string;
  updatedAt: string;
  client: Client;
  /** Installer business — Timbercity form Customer Name / Phone use these. */
  installer?: InstallerDetails;
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
  /** Job unit row id — used to group per-unit breakdown (not by unit type / material). */
  unitId: string;
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
  /** Hinge cups per door leaf when the factory drills them. */
  factoryHingeHoleCount?: number;
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
  /** e.g. "Offcut 1 · 1200 × 450" */
  label?: string;
}

export interface SheetMapPaidRegion {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  /** 0–1 of full sheet area billed for this sheet (Buy as step). */
  billedFraction: number;
  /** e.g. "Paying · ¼ sheet" */
  label: string;
}

export interface SheetMapSheet {
  sheetIndex: number;
  grainLengthMm: number;
  crossLengthMm: number;
  placements: SheetMapPlacement[];
  offcutRects: SheetMapOffcutRect[];
  /** Area you pay for on this sheet (Buy as ¼ / ⅓ / ½ / full). */
  paidRegion?: SheetMapPaidRegion;
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
  /** Needed run metres (sum of unit lines, before 3 m strip rounding). */
  plasticKickplateTotalMetres: number;
  /** Buy list: same product/height grouped, rounded up to whole 3 m strips. */
  plasticKickplatePurchases: PlasticKickplatePurchase[];
  costs: CostLine[];
  /** Grain-locked parts that don't fit the sheet in the required direction. */
  sheetWarnings: string[];
  /** Suggested keeper offcuts from nesting panels on sheet sizes (not from wastage %). */
  boardOffcuts: BoardOffcut[];
  /** Per-sheet nesting diagrams (factory / full cut list). */
  sheetMaps: SheetMapGroup[];
  install: InstallEstimate | null;
  materialsTotal: number;
  /** Boards, edging, masonite, cut-house SMEL/SHB/BOOR (Cut and Edge style). */
  woodMaterialTotal: number;
  /** Gelmar / catalog hardware + screws & fittings summary lines. */
  hardwareTotal: number;
  installationTotal: number;
  travelTotal: number;
  grandTotal: number;
}
