import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ThemeKey } from 'claude-code'

import type { Effort } from '../types'

const LEVELS: readonly Effort[] = ['low', 'medium', 'high', 'xhigh', 'max']
// Each level's color by theme key, so it follows the person's theme: cool to hot.
const HEAT: Record<Effort, ThemeKey> = { low: 'inactive', medium: 'success', high: 'warning', xhigh: 'claude', max: 'error' }
const WIDEST = Math.max(...LEVELS.map(level => level.length))

const override = atom({ plugin: 'cc-effort-switch', key: 'override' } as const, null)
const base = atom({ plugin: 'cc-effort-switch', key: 'base' } as const, null)

const isLevel = (value: unknown): value is Effort => LEVELS.includes(value as Effort)

// The engine's level for a model before its first request: CLAUDE_CODE_EFFORT_LEVEL, else the level
// /effort or Alt+P saved for it under modelSettings. Unknown otherwise until a request carries one.
async function startingLevel($: EngineInterface, model: string): Promise<Effort | null> {
  const env = (await $.env.get('CLAUDE_CODE_EFFORT_LEVEL'))?.trim().toLowerCase()
  if (isLevel(env)) return env
  const settings = await $.settings.read()
  const saved = settings.modelSettings as Record<string, { effortLevel?: unknown }> | undefined
  const level = saved?.[model.replace(/\[.*\]$/, '')]?.effortLevel
  return isLevel(level) ? level : null
}

async function shownLevel($: EngineInterface, model: string): Promise<Effort | null> {
  const picked = await read($, override)
  if (picked?.model === model) return picked.level
  const held = await read($, base)
  if (held?.model === model) return held.level
  return startingLevel($, model)
}

// Two presses close together make two steps: each reads the level the last one wrote.
let queue: Promise<unknown> = Promise.resolve()
function step($: EngineInterface, by: 1 | -1) {
  const run = queue.then(async () => {
    const model = await $.session.model()
    const from = await shownLevel($, model)
    const index = from === null ? LEVELS.indexOf('high') : LEVELS.indexOf(from) + by
    const level = LEVELS[Math.min(LEVELS.length - 1, Math.max(0, index))] ?? 'high'
    await update($, override, () => ({ model, level }))
  })
  queue = run.catch(() => undefined)
  return run
}

export const register: Register = on => {
  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined || !isLevel(e.effort)) return yield* next(e)

    const held = await read($, base)
    if (held?.model !== e.model || held.level !== e.effort) {
      // The engine changed its level on this model (Alt+P): its change wins over the keys' pick.
      if (held?.model === e.model) await update($, override, () => null)
      await update($, base, () => ({ model: e.model, level: e.effort as Effort }))
    }
    const picked = await read($, override)

    return yield* next(picked?.model === e.model ? { ...e, effort: picked.level } : e)
  })

  on('command.run', { command: 'effort' }, async ($, e, next) => {
    const ran = await next(e)
    await update($, override, () => null)
    const level = e.args.trim()
    if (isLevel(level)) {
      const model = await $.session.model()
      await update($, base, () => ({ model, level }))
    }

    return ran
  }).catch(($, e, next) => next(e))

  // What the engine and other mods draw stays, then a meter: one cell per level, filled up to the
  // current one in its heat color, and the level's word padded so the footer does not shift.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const below = await next(e)
    const { Box, Text } = $.ui.resolve(e)
    const level = await shownLevel($, await $.session.model())
    const isPicked = (await read($, override)) !== null
    const filled = level === null ? 0 : LEVELS.indexOf(level) + 1
    const color = level === null ? undefined : HEAT[level]

    return (
      <Box>
        {below}
        {e.props.modes.length > 0 && <Text dimColor> · </Text>}
        <Text dimColor>effort </Text>
        {LEVELS.map((_, i) =>
          i < filled ? <Text color={color}>▰</Text> : <Text dimColor>▱</Text>,
        )}
        <Text color={color} dimColor={level === null} weight={level === 'max' ? 'bold' : undefined}>
          {' '}
          {(level ?? '—').padEnd(WIDEST)}
        </Text>
        <Text dimColor>{isPicked ? '*' : ' '}</Text>
      </Box>
    )
  })

  // A mod reaches a key only through a Button naming an engine keybinding action, pressed by the
  // action's Global bindings alone. The diff panel's file-list actions idle at the prompt and are
  // bound to Ctrl/Alt+Up and Ctrl/Alt+Down by default; keybindings.json adds more keys to them in
  // Global. The Buttons sit hidden beside whatever the band already draws.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    const { Box, Button } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {below}
        <Box display="none">
          <Button key="effort-up" label="effort up" action="app:diffFileListUp" onPress={() => step($, 1)} />
          <Button key="effort-down" label="effort down" action="app:diffFileListDown" onPress={() => step($, -1)} />
        </Box>
      </Box>
    )
  })
}
