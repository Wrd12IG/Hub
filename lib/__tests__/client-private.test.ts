import { describe, it, expect } from 'vitest'
import { splitPrivateFields } from '../client-private'

describe('splitPrivateFields', () => {
  it('separa mediaPlan e postLead e lascia gli altri campi', () => {
    const { rest, privateFields } = splitPrivateFields({ name: 'X', mediaPlan: { lines: [] }, postLead: { entries: [] } })
    expect(rest).toEqual({ name: 'X' })
    expect(privateFields).toEqual({ mediaPlan: { lines: [] }, postLead: { entries: [] } })
  })
  it('conserva null (eliminazione) e non inventa campi assenti', () => {
    expect(splitPrivateFields({ mediaPlan: null }).privateFields).toEqual({ mediaPlan: null })
    expect(splitPrivateFields({ name: 'X' }).privateFields).toEqual({})
  })
  it('separa anche budget, note e token pubblico', () => {
    const { rest, privateFields } = splitPrivateFields({ name: 'X', budget: 500, notes: 'interno', publicToken: 't', publicTokenCreatedAt: 'd' })
    expect(rest).toEqual({ name: 'X' })
    expect(privateFields).toEqual({ budget: 500, notes: 'interno', publicToken: 't', publicTokenCreatedAt: 'd' })
  })
})
