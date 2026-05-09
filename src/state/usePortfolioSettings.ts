import type { CommandCenterState } from './useCommandCenterState'

export function usePortfolioSettings(state: CommandCenterState) {
  return {
    buyingPowerForm: state.buyingPowerForm,
    payYourselfForm: state.payYourselfForm,
    settingsForm: state.settingsForm,
    updateBuyingPowerForm: state.actions.updateBuyingPowerForm,
    updatePayYourselfRule: state.actions.updatePayYourselfRule,
    updateSetting: state.actions.updateSetting,
  }
}
