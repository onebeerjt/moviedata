// Subscription streaming services people can add on the Free page. One entry
// per service; providerIds are TMDB/JustWatch's ids for each of its plans
// (Netflix with and without ads, Peacock Premium and Premium Plus...). The
// first id is the one the site uses for the service everywhere.
// Shared by the data scripts and the site, so keep it dependency-free.
export type Subscription = { id: number; key: string; name: string; logo: string; providerIds: number[] };

export const SUBSCRIPTIONS: Subscription[] = [
  { id: 8, key: "netflix", name: "Netflix", logo: "/rK1KljqmbvO9HQa1PBFLILWah72.png", providerIds: [8, 1796] },
  { id: 1899, key: "max", name: "Max", logo: "/skypuy7SXuugIQeYg0IglmzoKaS.png", providerIds: [1899] },
  { id: 15, key: "hulu", name: "Hulu", logo: "/44uAnmSqvA4yBOdbPWN8YgQHjWm.png", providerIds: [15] },
  { id: 337, key: "disney", name: "Disney+", logo: "/5eZ872CghnHFLB1j8grszbrx0dx.png", providerIds: [337] },
  { id: 9, key: "prime", name: "Prime Video", logo: "/gMZdpavHmxFNnLpMHwVxfqeux2g.png", providerIds: [9] },
  { id: 350, key: "apple", name: "Apple TV+", logo: "/9icYBfYFcwgCbky5VdGUIKJ4C5i.png", providerIds: [350] },
  { id: 386, key: "peacock", name: "Peacock", logo: "/a1UIdq5BrkcAxnxcUhFsNbXnxeu.png", providerIds: [386, 387] },
  { id: 2303, key: "paramount", name: "Paramount+", logo: "/4N4BMd0Mm0kHAmF7RZgL5lW3cwc.png", providerIds: [2303, 2616] },
  { id: 43, key: "starz", name: "Starz", logo: "/h25xjouKmiSmFiiqw0aDXbxGZo7.png", providerIds: [43] },
  { id: 34, key: "mgm", name: "MGM+", logo: "/q63Uzpu7JAs566vA2G23Lk7LcID.png", providerIds: [34] },
  { id: 526, key: "amc", name: "AMC+", logo: "/wsCUflcmL4dCkzBUaGP8cj1cTkh.png", providerIds: [526] },
  { id: 258, key: "criterion", name: "Criterion Channel", logo: "/32XVilXkVbrwV96O3N5i0rtuyd6.png", providerIds: [258] },
  { id: 11, key: "mubi", name: "MUBI", logo: "/k7iSlvgWzZuO4zU5PcBjhABMuia.png", providerIds: [11] },
  { id: 99, key: "shudder", name: "Shudder", logo: "/58O6yqUFM6qoOiBNAddJs7xNKc.png", providerIds: [99] },
];

/** TMDB provider id (any plan) -> the service's id. */
export const SUBSCRIPTION_OF: Record<number, number> = Object.fromEntries(
  SUBSCRIPTIONS.flatMap((s) => s.providerIds.map((p) => [p, s.id])),
);

export const SUBS_COOKIE = "consensus-subs";
