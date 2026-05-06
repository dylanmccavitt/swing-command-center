export type SeedHolding = {
  symbol: 'AAPL' | 'GOOG' | 'NVDA' | 'IREN'
  name: string
  stackLayer: string
  thesisTag: string
  shares: number | null
  averageCost: number | null
}

export const seedHoldings: SeedHolding[] = [
  {
    symbol: 'AAPL',
    name: 'Apple',
    stackLayer: 'Consumer AI platform',
    thesisTag: 'Large-cap platform exposure with device-cycle optionality.',
    shares: null,
    averageCost: null,
  },
  {
    symbol: 'GOOG',
    name: 'Alphabet',
    stackLayer: 'Hyperscaler and AI services',
    thesisTag: 'Search, cloud, and AI infrastructure exposure.',
    shares: null,
    averageCost: null,
  },
  {
    symbol: 'NVDA',
    name: 'NVIDIA',
    stackLayer: 'GPU and accelerator designer',
    thesisTag: 'Core AI compute supply-chain exposure.',
    shares: null,
    averageCost: null,
  },
  {
    symbol: 'IREN',
    name: 'Iris Energy',
    stackLayer: 'Data center and energy infrastructure',
    thesisTag: 'High-beta infrastructure name for active swing planning.',
    shares: null,
    averageCost: null,
  },
]
