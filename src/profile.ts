// Personal defaults for one user. Everything here ends up in the deployed JavaScript bundle,
// so keep it to what you're happy for anyone with the URL to read. Empty it (and use the
// Settings page instead, which stays in your browser) if the deployment is public.
export const PROFILE = {
  /** Upper-cased names excluded from red flags & drains by default (e.g. family). */
  excludedPeople: ['MERCY CHEPKOECH'] as string[],
  /** Venue names that don't contain a generic bar keyword but are bars. */
  extraBarPattern: /FAMOUS GATE|YATCH|TAMASHA|XO LOUNGE/i as RegExp | null,
  /** Venue names that are restaurants but lack a generic food keyword. */
  extraFoodPattern: /WAKALUCY|MENA POINT/i as RegExp | null,
  /** Several tills that are really one venue. */
  venueMerges: [{ match: /^FAMOUS GATE/i, name: 'Famous Gates (all tills)' }] as { match: RegExp; name: string }[],
};
