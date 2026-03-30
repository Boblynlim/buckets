// Cup image definitions — handmade pottery cups for each bucket

export const CUP_IMAGES = {
  cup0: require('../../assets/images/cup0.png'),
  cup8: require('../../assets/images/cup8.png'),
  cup9: require('../../assets/images/cup9.png'),
  cup10: require('../../assets/images/cup10.png'),
  cup11: require('../../assets/images/cup11.png'),
  cup12: require('../../assets/images/cup12.png'),
  cup13: require('../../assets/images/cup13.png'),
  cup14: require('../../assets/images/cup14.png'),
  cup15: require('../../assets/images/cup15.png'),
  cup16: require('../../assets/images/cup16.png'),
  cup17: require('../../assets/images/cup17.png'),
  cup18: require('../../assets/images/cup18.png'),
  cup19: require('../../assets/images/cup19.png'),
  cup20: require('../../assets/images/cup20.png'),
  cup21: require('../../assets/images/cup21.png'),
} as const;

export const CUP_KEYS = Object.keys(CUP_IMAGES) as (keyof typeof CUP_IMAGES)[];

export type CupIcon = keyof typeof CUP_IMAGES;

// Shuffled order using a seeded shuffle so it looks random but is stable
// Fisher-Yates with a fixed seed
const SHUFFLED_ORDER: number[] = (() => {
  const arr = CUP_KEYS.map((_, i) => i);
  // Simple seeded PRNG (mulberry32)
  let seed = 7;
  const rand = () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
})();

// Get cup by index — cycles through all designs before repeating
// The order is shuffled so it looks random, but every design is used once per cycle
export const getCupByIndex = (index: number) => {
  const shuffledIdx = SHUFFLED_ORDER[index % CUP_KEYS.length];
  return CUP_IMAGES[CUP_KEYS[shuffledIdx]];
};

// Get a random cup icon key
export const getRandomCupIcon = (): CupIcon => {
  const idx = Math.floor(Math.random() * CUP_KEYS.length);
  return CUP_KEYS[idx];
};

// Get the image source for a cup icon key
export const getCupImage = (icon?: string) => {
  if (icon && icon in CUP_IMAGES) {
    return CUP_IMAGES[icon as CupIcon];
  }
  return CUP_IMAGES.cup0;
};

// Build a cup assignment map from a list of bucket IDs (sorted for stability)
// All designs are used before any repeats
// Returns a Map so callers can use it directly — no mutable module state
export const buildCupAssignments = (bucketIds: string[]): Map<string, number> => {
  const cupMap = new Map<string, number>();
  const sorted = [...bucketIds].sort();
  sorted.forEach((id, i) => {
    cupMap.set(id, SHUFFLED_ORDER[i % CUP_KEYS.length]);
  });
  return cupMap;
};

// Module-level cache for getCupForBucketId convenience function
let _cachedKey = '';
let _cupMap: Map<string, number> = new Map();

// Register bucket IDs so getCupForBucketId works — call this once when bucket list changes
export const registerCupAssignments = (bucketIds: string[]) => {
  const key = bucketIds.join(',');
  if (key === _cachedKey) return;
  _cachedKey = key;
  _cupMap = buildCupAssignments(bucketIds);
};

// Get cup image for a bucket by its ID
// Uses registered assignments; falls back to hash-based if not registered
export const getCupForBucketId = (bucketId: string, _icon?: string) => {
  const idx = _cupMap.get(bucketId);
  if (idx !== undefined) {
    return CUP_IMAGES[CUP_KEYS[idx]];
  }
  // Hash-based fallback so each unregistered bucket still gets a distinct cup
  let hash = 0;
  for (let i = 0; i < bucketId.length; i++) {
    hash = ((hash << 5) - hash) + bucketId.charCodeAt(i);
    hash |= 0;
  }
  const fallbackIdx = Math.abs(hash) % CUP_KEYS.length;
  return CUP_IMAGES[CUP_KEYS[fallbackIdx]];
};

// Legacy: derive from bucket name (hash-based, may repeat)
export const getCupForBucket = (bucketName: string, icon?: string) => {
  if (icon && icon in CUP_IMAGES) {
    return CUP_IMAGES[icon as CupIcon];
  }
  let hash = 0;
  for (let i = 0; i < bucketName.length; i++) {
    hash = ((hash << 5) - hash) + bucketName.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % CUP_KEYS.length;
  return CUP_IMAGES[CUP_KEYS[idx]];
};
