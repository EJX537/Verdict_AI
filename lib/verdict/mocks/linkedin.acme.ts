import type { LinkedInEmployee } from '../adapters/people'

// Canned harvestapi/linkedin-company-employees roster for a single snapshot.
// Matches the normalized LinkedInEmployee shape (isCurrent/isFounder are derived
// in sources.ts from currentPosition[] and headline respectively).
export const linkedinAcme: LinkedInEmployee[] = [
  {
    name: 'Alice Founder',
    title: 'Chief Executive Officer',
    profileUrl: 'https://linkedin.com/in/alice-acme',
    isCurrent: true,
    isFounder: true,
  },
  {
    name: 'Bob Tech',
    title: 'Chief Technology Officer',
    profileUrl: 'https://linkedin.com/in/bob-acme',
    isCurrent: true,
    isFounder: false,
  },
  {
    name: 'Carol Sales',
    title: 'VP Sales',
    profileUrl: 'https://linkedin.com/in/carol-acme',
    isCurrent: true,
    isFounder: false,
  },
  {
    name: 'Dave Eng',
    title: 'Senior Software Engineer',
    profileUrl: 'https://linkedin.com/in/dave-acme',
    isCurrent: true,
    isFounder: false,
  },
]
