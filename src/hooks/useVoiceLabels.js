import { useForge } from '../store/useForgeStore.js'
import { roleLabel } from '../lib/babelRoles.js'

/**
 * Resolve display labels for a voice key.
 * @param {'a'|'b'|'c'} agentKey
 * @param {{ name?: string } | null | undefined} agentSpec
 */
export function useVoiceLabels(agentKey, agentSpec) {
  const { state } = useForge()
  const roleId = state.roles?.[agentKey]
  return {
    roleId,
    roleTitle: roleLabel(roleId),
    modelName: agentSpec?.name ?? 'Model',
  }
}
