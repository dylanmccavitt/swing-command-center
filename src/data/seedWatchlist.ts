export const AI_STACK_LAYERS = [
  { id: 'hyperscalers', label: 'Hyperscalers' },
  { id: 'gpu_chip_designers', label: 'GPU/chip designers' },
  { id: 'foundries', label: 'Foundries' },
  { id: 'memory', label: 'Memory' },
  { id: 'semiconductor_equipment', label: 'Semiconductor equipment' },
  { id: 'eda_ip', label: 'EDA/IP' },
  { id: 'networking', label: 'Networking' },
  { id: 'power_cooling', label: 'Power/cooling' },
  { id: 'data_centers', label: 'Data centers' },
  { id: 'energy', label: 'Energy' },
] as const

export type AiStackLayerId = (typeof AI_STACK_LAYERS)[number]['id']

export type ResearchFields = {
  thesis: string
  catalyst: string
  invalidation: string
  riskNotes: string
  sourceNotes: string
  plannedEntry: string
  stop: string
  target: string
  reviewDate: string
}

export type TradeSetupFields = {
  entryTrigger: string
  stopLevel: string
  target: string
  maxLoss: string
  plannedScaleOut: string
  invalidation: string
  timeHorizon: string
}

export type SeedWatchlistItem = {
  symbol: string
  name: string
  stackLayer: AiStackLayerId
  seedType: 'current_holding' | 'placeholder'
  research: ResearchFields
  tradeSetup: TradeSetupFields
}

export const EMPTY_TRADE_SETUP: TradeSetupFields = {
  entryTrigger: '',
  stopLevel: '',
  target: '',
  maxLoss: '',
  plannedScaleOut: '',
  invalidation: '',
  timeHorizon: '',
}

export const seedWatchlist: SeedWatchlistItem[] = [
  {
    symbol: 'AAPL',
    name: 'Apple',
    stackLayer: 'hyperscalers',
    seedType: 'current_holding',
    research: buildResearchSeed({
      thesis: 'Current holding to review as a large-cap AI platform exposure.',
      catalyst: 'Product-cycle, on-device AI, and services updates.',
      invalidation: 'AI feature cycle fails to change growth or multiple support.',
      riskNotes: 'Consumer hardware demand and valuation compression.',
    }),
    tradeSetup: { ...EMPTY_TRADE_SETUP },
  },
  {
    symbol: 'GOOG',
    name: 'Alphabet',
    stackLayer: 'hyperscalers',
    seedType: 'current_holding',
    research: buildResearchSeed({
      thesis: 'Current holding for search, cloud, and AI infrastructure exposure.',
      catalyst: 'Cloud growth, AI product adoption, and margin durability.',
      invalidation: 'Cloud growth weakens or AI spend does not translate to earnings.',
      riskNotes: 'Search disruption, regulatory pressure, and capex intensity.',
    }),
    tradeSetup: { ...EMPTY_TRADE_SETUP },
  },
  {
    symbol: 'NVDA',
    name: 'NVIDIA',
    stackLayer: 'gpu_chip_designers',
    seedType: 'current_holding',
    research: buildResearchSeed({
      thesis: 'Current holding and core AI accelerator supply-chain exposure.',
      catalyst: 'Data-center demand, product cadence, and margin resilience.',
      invalidation: 'AI accelerator demand slows or competition pressures margins.',
      riskNotes: 'Crowded positioning, export controls, and cyclic hardware spend.',
    }),
    tradeSetup: { ...EMPTY_TRADE_SETUP },
  },
  {
    symbol: 'IREN',
    name: 'Iris Energy',
    stackLayer: 'data_centers',
    seedType: 'current_holding',
    research: buildResearchSeed({
      thesis: 'Current high-beta data-center and power infrastructure holding.',
      catalyst: 'AI cloud expansion, power availability, and execution updates.',
      invalidation: 'Funding, power economics, or utilization assumptions break down.',
      riskNotes: 'High volatility, financing risk, and infrastructure execution risk.',
    }),
    tradeSetup: { ...EMPTY_TRADE_SETUP },
  },
  {
    symbol: 'AMD',
    name: 'Advanced Micro Devices',
    stackLayer: 'gpu_chip_designers',
    seedType: 'placeholder',
    research: buildResearchSeed({
      thesis: 'Placeholder for accelerator challenger exposure.',
      catalyst: 'AI GPU traction, server CPU share, and margin expansion.',
      invalidation: 'AI accelerator ramp misses or competitive gap widens.',
      riskNotes: 'Execution risk against larger incumbent platforms.',
    }),
    tradeSetup: { ...EMPTY_TRADE_SETUP },
  },
  {
    symbol: 'TSM',
    name: 'Taiwan Semiconductor',
    stackLayer: 'foundries',
    seedType: 'placeholder',
    research: buildResearchSeed({
      thesis: 'Placeholder for leading-edge foundry exposure.',
      catalyst: 'Advanced-node demand and AI chip manufacturing backlog.',
      invalidation: 'Foundry utilization or geopolitical risk overwhelms the thesis.',
      riskNotes: 'Geopolitical concentration and semiconductor cycle risk.',
    }),
    tradeSetup: { ...EMPTY_TRADE_SETUP },
  },
  {
    symbol: 'MU',
    name: 'Micron',
    stackLayer: 'memory',
    seedType: 'placeholder',
    research: buildResearchSeed({
      thesis: 'Placeholder for HBM and memory-cycle exposure.',
      catalyst: 'HBM demand, pricing recovery, and AI server memory intensity.',
      invalidation: 'Memory pricing rolls over or HBM share disappoints.',
      riskNotes: 'Deep cyclical earnings swings and capex timing.',
    }),
    tradeSetup: { ...EMPTY_TRADE_SETUP },
  },
  {
    symbol: 'ASML',
    name: 'ASML Holding',
    stackLayer: 'semiconductor_equipment',
    seedType: 'placeholder',
    research: buildResearchSeed({
      thesis: 'Placeholder for lithography bottleneck exposure.',
      catalyst: 'EUV demand, backlog quality, and advanced-node capex.',
      invalidation: 'Foundry or memory capex slows faster than expected.',
      riskNotes: 'Export restrictions, long-cycle orders, and valuation risk.',
    }),
    tradeSetup: { ...EMPTY_TRADE_SETUP },
  },
  {
    symbol: 'SNPS',
    name: 'Synopsys',
    stackLayer: 'eda_ip',
    seedType: 'placeholder',
    research: buildResearchSeed({
      thesis: 'Placeholder for EDA/IP exposure in custom AI silicon.',
      catalyst: 'Chip-design activity, AI-assisted design demand, and IP attach.',
      invalidation: 'Design starts slow or integration risk weighs on execution.',
      riskNotes: 'Software multiples and large-deal integration risk.',
    }),
    tradeSetup: { ...EMPTY_TRADE_SETUP },
  },
  {
    symbol: 'ANET',
    name: 'Arista Networks',
    stackLayer: 'networking',
    seedType: 'placeholder',
    research: buildResearchSeed({
      thesis: 'Placeholder for AI data-center networking exposure.',
      catalyst: 'Cloud capex, Ethernet adoption, and AI cluster buildouts.',
      invalidation: 'Hyperscaler demand pauses or networking margins compress.',
      riskNotes: 'Customer concentration and capex-cycle sensitivity.',
    }),
    tradeSetup: { ...EMPTY_TRADE_SETUP },
  },
  {
    symbol: 'VRT',
    name: 'Vertiv',
    stackLayer: 'power_cooling',
    seedType: 'placeholder',
    research: buildResearchSeed({
      thesis: 'Placeholder for data-center power and cooling exposure.',
      catalyst: 'Backlog growth, AI rack density, and margin durability.',
      invalidation: 'Orders slow or execution misses against elevated expectations.',
      riskNotes: 'Industrial cycle risk and valuation sensitivity.',
    }),
    tradeSetup: { ...EMPTY_TRADE_SETUP },
  },
  {
    symbol: 'CEG',
    name: 'Constellation Energy',
    stackLayer: 'energy',
    seedType: 'placeholder',
    research: buildResearchSeed({
      thesis: 'Placeholder for AI data-center energy demand exposure.',
      catalyst: 'Power contract demand and nuclear generation scarcity.',
      invalidation: 'Power demand expectations reset or policy risk rises.',
      riskNotes: 'Regulatory, commodity, and contract-duration risk.',
    }),
    tradeSetup: { ...EMPTY_TRADE_SETUP },
  },
]

export function getAiStackLayerLabel(layer: AiStackLayerId): string {
  return AI_STACK_LAYERS.find((item) => item.id === layer)?.label ?? layer
}

function buildResearchSeed(
  input: Pick<
    ResearchFields,
    'thesis' | 'catalyst' | 'invalidation' | 'riskNotes'
  >,
): ResearchFields {
  return {
    ...input,
    sourceNotes: '',
    plannedEntry: '',
    stop: '',
    target: '',
    reviewDate: '',
  }
}
