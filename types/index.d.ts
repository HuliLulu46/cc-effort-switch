export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

/** One model's effort level. */
export type EffortPick = { model: string; level: Effort }

declare module 'claude-code' {
  interface PluginState {
    'cc-effort-switch': {
      /** The level the keys picked for a model, sent on its main-loop requests; null follows the engine. */
      override: EffortPick | null
      /** The engine's own level on the model's last main-loop request, before the override. */
      base: EffortPick | null
    }
  }
}
