export type VentureStatus = 'active' | 'closed' | 'planned'

export interface Venture {
  id: string
  name: string
  /** Free-form grouping, e.g. "Retail", "Real Estate", "Manufacturing". */
  category: string
  description: string
  startDate: string // ISO yyyy-mm-dd
  status: VentureStatus
  /** Optional capital the venture is meant to absorb; drives the funding bar. */
  targetAmount?: number
  /** Latest known worth of the stake, used for unrealised gain and XIRR. */
  currentValue?: number
  color: string
  createdAt: string
}

export interface Investment {
  id: string
  ventureId: string
  date: string // ISO yyyy-mm-dd
  amount: number
  /** What the money went into, e.g. "Espresso machine". */
  item: string
  /** Expense bucket, e.g. "Equipment", "Inventory", "Rent". */
  category: string
  paymentMode: string
  notes: string
}

export type ReturnKind = 'profit' | 'dividend' | 'interest' | 'sale' | 'rent' | 'other'

export interface Payout {
  id: string
  ventureId: string
  date: string
  amount: number
  kind: ReturnKind
  notes: string
}

export interface Settings {
  currency: string
  locale: string
  theme: 'light' | 'dark' | 'system'
  ownerName: string
}

export interface AppData {
  version: number
  ventures: Venture[]
  investments: Investment[]
  payouts: Payout[]
  settings: Settings
}

export const RETURN_KINDS: ReturnKind[] = ['profit', 'dividend', 'interest', 'sale', 'rent', 'other']

export const EXPENSE_CATEGORIES = [
  'Capital',
  'Equipment',
  'Inventory',
  'Rent / Lease',
  'Salaries',
  'Marketing',
  'Licenses & Fees',
  'Renovation',
  'Logistics',
  'Other',
]

export const PAYMENT_MODES = ['Bank transfer', 'UPI', 'Cash', 'Cheque', 'Card', 'Other']

/**
 * Categorical slots, assigned in fixed order and never cycled through generated
 * hues. Both columns are the same eight hues stepped for their own surface; the
 * palette is validated for lightness, chroma, CVD separation and contrast.
 */
export const PALETTE = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#4a3aa7',
  '#e34948',
]

export const PALETTE_DARK = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
]

/** Maps a stored (light-column) series colour onto the step for the live theme. */
export function seriesColor(color: string, dark: boolean) {
  if (!dark) return color
  const slot = PALETTE.indexOf(color)
  return slot === -1 ? color : PALETTE_DARK[slot]
}

/** Slot for the next venture, so early ventures never collide. */
export function nextPaletteColor(used: string[]) {
  return PALETTE.find((c) => !used.includes(c)) ?? PALETTE[used.length % PALETTE.length]
}
