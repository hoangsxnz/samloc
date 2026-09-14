import type { RulesState } from './state';

/** Deep copy via JSON; `RulesState` is JSON round-trippable by design (no Map/Set/Date/classes). */
export function cloneState(state: RulesState): RulesState {
  return JSON.parse(JSON.stringify(state)) as RulesState;
}
