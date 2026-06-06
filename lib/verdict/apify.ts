import { ApifyClient } from 'apify-client'

// A runner takes an actor id + input and returns raw dataset items.
// Injectable so callers (and tests) can swap the real network for fixtures.
export type ActorRunner = (
  actorId: string,
  input: Record<string, unknown>,
) => Promise<unknown[]>

// Build a runner backed by a concrete ApifyClient.
export function makeRunner(client: ApifyClient): ActorRunner {
  return async (actorId, input) => {
    const run = await client.actor(actorId).call(input)
    const { items } = await client.dataset(run.defaultDatasetId).listItems()
    return items
  }
}

// Default runner using APIFY_TOKEN from the environment.
export const apifyRunner: ActorRunner = (actorId, input) =>
  makeRunner(new ApifyClient({ token: process.env.APIFY_TOKEN }))(actorId, input)
