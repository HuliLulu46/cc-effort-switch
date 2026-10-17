import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, TurnStepInput } from 'claude-code'

const MODEL = 'claude-opus-5-5'

const BAND = {
  plugin: 'cc-effort-switch',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 9, contentRows: 1 },
    view: {},
  },
} as const

const FOOTER = { plugin: 'cc-effort-switch', component: 'SessionMode', props: { modes: [] } } as const

// Stands in for the engine: the session's model, its settings and env, and the model requests' bottom.
function engine(on: On, settings: Record<string, unknown> = {}) {
  const sent: TurnStepInput['effort'][] = []
  let model = MODEL
  on('turn.step', async function* (_$, e) {
    sent.push(e.effort)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: null }
  })
  on('session.model', async () => ({ value: model }))
  on('settings.read', async () => ({ value: settings }))
  on('env.get', async () => ({ value: undefined }))
  on('command.run', async () => ({ text: '' }))
  on('ui.render', async ($, e) => {
    const { Text } = $.ui.resolve(e)
    if (e.component === 'SessionMode') {
      const { Box } = $.ui.resolve(e)
      return (
        <Box>
          <Text dimColor>{e.props.modes.join(' & ')}</Text>
          <Text key="beneath">budget meter</Text>
        </Box>
      )
    }
    return <Text key="beneath">from beneath</Text>
  })
  return { sent, useModel: (next: string) => (model = next) }
}

async function request($: Engine, input: Partial<TurnStepInput> = {}) {
  const stream = $.turn.step({ turnId: 't', index: 0, model: MODEL, messageCount: 1, effort: 'high', ...input })
  for await (const _ of stream) {
  }
  return stream.result
}

const press = ($: Engine, key: 'effort-up' | 'effort-down') => $.ui.press({ plugin: 'cc-effort-switch', key })

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: the hidden keys step the level the next request carries`, async ($, on) => {
    const { sent } = engine(on)
    await $.ui.mount({ ...BAND, surface })
    await request($)

    await press($, 'effort-up')
    await request($)
    expect(sent.at(-1)).toBe('xhigh')

    await press($, 'effort-down')
    await press($, 'effort-down')
    await request($)
    expect(sent.at(-1)).toBe('medium')
  })

  test(`${surface}: the band keeps what is beneath it and shows no buttons`, async ($, on) => {
    engine(on)
    const band = await $.ui.mount({ ...BAND, surface })
    expect(await band.find({ type: 'Button', key: 'effort-up' })).toBeDefined()
    expect(await band.find({ text: 'from beneath' })).toBeDefined()
  })

  test(`${surface}: the footer keeps what is beneath it, then the meter`, async ($, on) => {
    engine(on, { modelSettings: { [MODEL]: { effortLevel: 'high' } } })
    const footer = await $.ui.mount({ ...FOOTER, surface, props: { modes: ['focus'] } })
    expect(await footer.find({ type: 'Text', text: 'focus' })).toBeDefined()
    expect(await footer.find({ type: 'Text', text: 'budget meter' })).toBeDefined()
    expect(await footer.findAll({ type: 'Text', text: '▰' })).toHaveLength(3)
  })
}

test('the footer shows the saved level before any request, then the pick', async ($, on) => {
  engine(on, { modelSettings: { [MODEL]: { effortLevel: 'medium' } } })
  const footer = await $.ui.mount({ ...FOOTER, surface: 'terminal' })
  expect(await footer.find({ type: 'Text', text: /^ medium\s*$/ })).toBeDefined()
  expect(await footer.findAll({ type: 'Text', text: '▰' })).toHaveLength(2)

  await $.ui.mount({ ...BAND, surface: 'terminal' })
  await press($, 'effort-up')
  expect(await footer.find({ type: 'Text', text: /^ high\s*$/ })).toBeDefined()
  expect(await footer.findAll({ type: 'Text', text: '▰' })).toHaveLength(3)
  expect(await footer.find({ type: 'Text', text: '*' })).toBeDefined()
})

test('passes the engine level through until a key is pressed', async ($, on) => {
  const { sent } = engine(on)
  await request($, { effort: 'low' })
  expect(sent).toEqual(['low'])
})

test('clamps at max and leaves subagent requests alone', async ($, on) => {
  const { sent } = engine(on)
  await $.ui.mount({ ...BAND, surface: 'terminal' })
  await request($)
  for (let i = 0; i < 4; i++) await press($, 'effort-up')
  await request($)
  await request($, { agentId: 'sub-1', effort: 'low' })
  expect(sent.slice(1)).toEqual(['max', 'low'])
})

test('an engine change of level on the same model (Alt+P) drops the pick', async ($, on) => {
  const { sent } = engine(on)
  await $.ui.mount({ ...BAND, surface: 'terminal' })
  await request($)
  await press($, 'effort-up')
  await request($, { effort: 'low' })
  expect(sent.at(-1)).toBe('low')
})

test('/effort drops the pick', async ($, on) => {
  const { sent } = engine(on)
  await $.ui.mount({ ...BAND, surface: 'terminal' })
  await request($)
  await press($, 'effort-up')
  await $.command.run({
    command: 'effort',
    args: 'medium',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  } as Parameters<Engine['command']['run']>[0])
  await request($, { effort: 'medium' })
  expect(sent.at(-1)).toBe('medium')
})

test('a pick belongs to its model', async ($, on) => {
  const { sent, useModel } = engine(on)
  await $.ui.mount({ ...BAND, surface: 'terminal' })
  await request($)
  await press($, 'effort-up')
  useModel('claude-sonnet-5-5')
  await request($, { model: 'claude-sonnet-5-5', effort: 'medium' })
  expect(sent.at(-1)).toBe('medium')
})
