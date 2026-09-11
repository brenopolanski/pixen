import { describe, expect, it } from 'vitest'

import { decideOpenAction, nextTabAfterClose } from './tabs'

const tab = (id: string, dirty: boolean) => ({ id, dirty })

describe('decideOpenAction', () => {
  it('creates the first tab', () => {
    expect(decideOpenAction([], null)).toEqual({ type: 'create' })
  })

  it('replaces a clean active tab', () => {
    expect(decideOpenAction([tab('a', false)], 'a')).toEqual({ type: 'replace', tabId: 'a' })
  })

  it('opens a new tab when the active one is dirty', () => {
    expect(decideOpenAction([tab('a', true)], 'a')).toEqual({ type: 'create' })
  })

  it('still creates when many dirty tabs are already open', () => {
    const tabs = [tab('a', true), tab('b', true), tab('c', true), tab('d', true), tab('e', true)]

    expect(decideOpenAction(tabs, 'c')).toEqual({ type: 'create' })
  })

  it('still replaces a clean tab among many dirty ones', () => {
    const tabs = [tab('a', true), tab('b', false), tab('c', true), tab('d', true), tab('e', true)]

    expect(decideOpenAction(tabs, 'b')).toEqual({ type: 'replace', tabId: 'b' })
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
