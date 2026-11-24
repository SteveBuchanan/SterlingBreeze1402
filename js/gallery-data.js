// Photo catalog: display order, caption and category ("condo" | "resort" | "beach").
// Each photo exists in Images/ as <file>-600.webp, -1200.webp and -2000.webp, where the number is
// the LONG edge. Landscape photos are 4:3; portrait photos (portrait: true) are 3:4.

export const PHOTO_SIZES = [600, 1200, 2000];

export const CATEGORIES = [
  { id: 'all', label: 'All photos' },
  { id: 'condo', label: 'The condo' },
  { id: 'resort', label: 'The resort' },
  { id: 'beach', label: 'The beach' },
];

export const PHOTOS = [
  // The condo
  { file: 'unit-1402-18-balcony-gulf-view', caption: 'Gulf view from the 14th-floor balcony', category: 'condo' },
  { file: 'unit-1402-16-living-room', caption: 'Living room with balcony access', category: 'condo' },
  { file: 'unit-1402-20-living-room-and-kitchen', caption: 'Living room and kitchen', category: 'condo', portrait: true },
  { file: 'unit-1402-09-dining-and-living-room', caption: 'Dining and living room', category: 'condo' },
  { file: 'unit-1402-15-dining-area', caption: 'Dining area', category: 'condo' },
  { file: 'unit-1402-07-kitchen', caption: 'Full kitchen', category: 'condo' },
  { file: 'unit-1402-08-kitchen-sideboard', caption: 'Kitchen sideboard', category: 'condo' },
  { file: 'unit-1402-11-master-bedroom', caption: 'Master suite', category: 'condo' },
  { file: 'unit-1402-10-master-bedroom-doorway', caption: 'Master suite entrance', category: 'condo', portrait: true },
  { file: 'unit-1402-14-master-bathroom-vanity', caption: 'Master bathroom vanity', category: 'condo' },
  { file: 'unit-1402-13-master-shower', caption: 'Master bathroom shower', category: 'condo', portrait: true },
  { file: 'unit-1402-12-master-bathroom-entry', caption: 'Master bathroom', category: 'condo', portrait: true },
  { file: 'unit-1402-02-guest-bedroom', caption: 'Guest bedroom', category: 'condo', portrait: true },
  { file: 'unit-1402-04-bunk-beds', caption: 'Bunk area', category: 'condo', portrait: true },
  { file: 'unit-1402-03-guest-bathroom', caption: 'Second full bathroom', category: 'condo', portrait: true },
  { file: 'unit-1402-06-washer-dryer', caption: 'Washer and dryer', category: 'condo', portrait: true },
  { file: 'unit-1402-17-balcony', caption: 'Gulf-view balcony', category: 'condo' },
  { file: 'unit-1402-19-balcony-seating', caption: 'Balcony seating', category: 'condo' },
  { file: 'unit-1402-01-hallway', caption: 'Hallway', category: 'condo', portrait: true },
  { file: 'unit-1402-05-hallway-closets', caption: 'Hallway closets', category: 'condo', portrait: true },
  { file: 'unit-1402-21-front-door', caption: 'Front door', category: 'condo', portrait: true },

  // The resort
  { file: 'sterling-breeze-22-pool', caption: 'Pool', category: 'resort' },
  { file: 'sterling-breeze-23-pool-deck', caption: 'Pool deck', category: 'resort' },
  { file: 'sterling-breeze-14-hot-tub', caption: 'Hot tub', category: 'resort', portrait: true },
  { file: 'sterling-breeze-18-lobby', caption: 'Lobby', category: 'resort' },
  { file: 'sterling-breeze-04-lobby-coffee-bar', caption: 'Lobby coffee bar', category: 'resort' },
  { file: 'sterling-breeze-05-fire-pit-seating', caption: 'Fire pit seating', category: 'resort' },
  { file: 'sterling-breeze-01-fitness-center', caption: 'Fitness center', category: 'resort' },
  { file: 'sterling-breeze-02-fitness-center-2', caption: 'Fitness center', category: 'resort' },
  { file: 'sterling-breeze-03-fitness-center-3', caption: 'Fitness center', category: 'resort' },
  { file: 'sterling-breeze-19-general-store', caption: 'On-site general store', category: 'resort' },
  { file: 'sterling-breeze-20-general-store-2', caption: 'On-site general store', category: 'resort' },
  { file: 'sterling-breeze-21-general-store-sign', caption: 'General store', category: 'resort', portrait: true },
  { file: 'sterling-breeze-15-skybridge', caption: 'Skybridge', category: 'resort' },
  { file: 'sterling-breeze-16-building-street-view', caption: 'Sterling Breeze from Front Beach Road', category: 'resort' },
  { file: 'sterling-breeze-17-building-exterior', caption: 'Sterling Breeze tower', category: 'resort', portrait: true },

  // The beach
  { file: 'sterling-breeze-11-gulf-sunset', caption: 'Sunset over the Gulf', category: 'beach' },
  { file: 'sterling-breeze-10-beach', caption: 'The beach', category: 'beach' },
  { file: 'sterling-breeze-07-beach-dunes', caption: 'Beach dunes', category: 'beach' },
  { file: 'sterling-breeze-08-beach-evening', caption: 'Evening on the beach', category: 'beach' },
  { file: 'sterling-breeze-06-beach-access', caption: 'Beach access', category: 'beach' },
  { file: 'sterling-breeze-09-boardwalk-stairs', caption: 'Boardwalk to the beach', category: 'beach', portrait: true },
  { file: 'sterling-breeze-13-boardwalk-gate', caption: 'Beach boardwalk gate', category: 'beach', portrait: true },
  { file: 'sterling-breeze-12-beach-rentals-hut', caption: 'Beach rentals hut', category: 'beach' },
];

/** Path to one size of a photo. `size` is the long edge: 600, 1200 or 2000. */
export function photoUrl(file, size) {
  return `Images/${file}-${size}.webp`;
}

/** Pixel width and height of one size of a photo. */
export function photoDimensions(photo, size) {
  const short = Math.round(size * 0.75);
  return photo.portrait ? { width: short, height: size } : { width: size, height: short };
}

/** srcset with true pixel widths (portrait photos are narrower than their size suffix). */
export function photoSrcset(photo, sizes = PHOTO_SIZES) {
  return sizes.map((size) => `${photoUrl(photo.file, size)} ${photoDimensions(photo, size).width}w`).join(', ');
}
