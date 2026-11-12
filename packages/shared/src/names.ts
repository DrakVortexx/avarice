const ADJECTIVES = [
  "Wandering",
  "Gilded",
  "Quiet",
  "Lucky",
  "Crooked",
  "Velvet",
  "Restless",
  "Hollow",
  "Bright",
  "Sly",
];

const NOUNS = [
  "Collector",
  "Broker",
  "Keeper",
  "Drifter",
  "Merchant",
  "Archivist",
  "Peddler",
  "Warden",
  "Hoarder",
  "Scout",
];

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function makeGuestName(seed: string): string {
  const hash = hashString(seed);
  const adjective = ADJECTIVES[hash % ADJECTIVES.length] ?? "Wandering";
  const noun = NOUNS[Math.floor(hash / ADJECTIVES.length) % NOUNS.length] ?? "Collector";
  const suffix = (hash % 900) + 100;
  return `${adjective} ${noun} ${suffix}`;
}
