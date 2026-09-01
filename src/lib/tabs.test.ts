import { describe, expect, it } from 'vitest'

import { decideNewTabAction, decideOpenAction, nextTabAfterClose, tabsFullMessage } from './tabs'

const tab = (id: string, dirty: boolean) => ({ id, dirty })

describe('decideOpenAction', () => {
  it('creates the first tab', () => {
    expect(decideOpenAction([], null, 5)).toEqual({ type: 'create' })
  })

  it('replaces a clean active tab', () => {
    expect(decideOpenAction([tab('a', false)], 'a', 5)).toEqual({ type: 'replace', tabId: 'a' })
  })

  it('opens a new tab when the active one is dirty', () => {
    expect(decideOpenAction([tab('a', true)], 'a', 5)).toEqual({ type: 'create' })
  })

  it('refuses when every slot is taken and the active tab is dirty', () => {
    const tabs = [tab('a', true), tab('b', true), tab('c', true), tab('d', true), tab('e', true)]

    expect(decideOpenAction(tabs, 'c', 5)).toEqual({ type: 'refuse' })
  })

  it('still replaces a clean tab at the cap', () => {
    const tabs = [tab('a', true), tab('b', false), tab('c', true), tab('d', true), tab('e', true)]

    expect(decideOpenAction(tabs, 'b', 5)).toEqual({ type: 'replace', tabId: 'b' })
  })
})

describe('decideNewTabAction', () => {
  it('creates even when the current tab is clean', () => {
    expect(decideNewTabAction(1, 5)).toEqual({ type: 'create' })
  })

  it('refuses at the cap instead of replacing', () => {
    expect(decideNewTabAction(5, 5)).toEqual({ type: 'refuse' })
  })
})

describe('nextTabAfterClose', () => {
  it('activates the neighbour to the right, or the new last tab', () => {
    const tabs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

    expect(nextTabAfterClose(tabs, 'a')?.id).toBe('b')
    expect(nextTabAfterClose(tabs, 'c')?.id).toBe('b')
  })

  it('returns null when the last tab closes', () => {
    expect(nextTabAfterClose([{ id: 'a' }], 'a')).toBeNull()
  })
})

describe('tabsFullMessage', () => {
  it('names the cap rather than a hardcoded five', () => {
    expect(tabsFullMessage(5)).toContain('5')
  })
})
