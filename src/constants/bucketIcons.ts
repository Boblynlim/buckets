// Bucket icon definitions
export const BUCKET_ICONS = [
  'octopus',
  'frog',
  'fish',
  'duck',
  'hippo',
  'shrimp',
  'seahorse',
  'pufferfish',
  'turtle',
] as const;

export type BucketIcon = typeof BUCKET_ICONS[number];

// Map icon names to their require paths
export const BUCKET_ICON_IMAGES = {
  octopus: require('../../assets/images/octopus.png'),
  shrimp: require('../../assets/images/shrimp.png'),
  pufferfish: require('../../assets/images/pufferfish.png'),
  frog: require('../../assets/images/frog.png'),
  duck: require('../../assets/images/duck.png'),
  hippo: require('../../assets/images/hippo.png'),
  turtle: require('../../assets/images/turtle.png'),
  fish: require('../../assets/images/fish.png'),
  seahorse: require('../../assets/images/seahorse.png'),
} as const;

// Get a random bucket icon
export const getRandomBucketIcon = (): BucketIcon => {
  const randomIndex = Math.floor(Math.random() * BUCKET_ICONS.length);
  return BUCKET_ICONS[randomIndex];
};
