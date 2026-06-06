import { describe, it, expect, vi } from 'vitest'
import { makeRunner } from './apify'

describe('makeRunner', () => {
  it('calls the actor with input and returns dataset items', async () => {
    const listItems = vi.fn().mockResolvedValue({ items: [{ a: 1 }, { a: 2 }] })
    const dataset = vi.fn().mockReturnValue({ listItems })
    const call = vi.fn().mockResolvedValue({ defaultDatasetId: 'ds1' })
    const actor = vi.fn().mockReturnValue({ call })
    const fakeClient = { actor, dataset } as unknown as import('apify-client').ApifyClient

    const run = makeRunner(fakeClient)
    const items = await run('user/actor', { query: 'Acme' })

    expect(actor).toHaveBeenCalledWith('user/actor')
    expect(call).toHaveBeenCalledWith({ query: 'Acme' })
    expect(dataset).toHaveBeenCalledWith('ds1')
    expect(items).toEqual([{ a: 1 }, { a: 2 }])
  })
})
