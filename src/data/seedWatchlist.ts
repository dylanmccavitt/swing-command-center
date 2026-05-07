export type SeedWatchlistSymbol = 'AMD' | 'ASML' | 'TSM' | 'AVGO'

export type SeedWatchlistItem = {
  symbol: SeedWatchlistSymbol
  name: string
  stackLayer: string
}

export const seedWatchlist: SeedWatchlistItem[] = [
  {
    symbol: 'AMD',
    name: 'Advanced Micro Devices',
    stackLayer: 'Accelerator challenger',
  },
  {
    symbol: 'ASML',
    name: 'ASML Holding',
    stackLayer: 'Semiconductor equipment',
  },
  {
    symbol: 'TSM',
    name: 'Taiwan Semiconductor',
    stackLayer: 'AI chip foundry',
  },
  {
    symbol: 'AVGO',
    name: 'Broadcom',
    stackLayer: 'AI networking and ASICs',
  },
]
