// Preset routes for the 5 seeded tourists.
// Waypoints are [latitude, longitude], the order Google Maps shows (the backend converts to GeoJSON itself).
// The routes deliberately walk in and out of the seeded zones so the Stage 3 alerts can be demonstrated.
// loop: true  -> walks back to the start and repeats
// loop: false -> stops at the last point and stays there (used for the "no movement" rule in Stage 6)
module.exports = [
  {
    email: 'tourist1@demo.com', // Aarav
    description: 'Walks around Tank Bund, stays in the green zone',
    loop: true,
    waypoints: [[17.418, 78.468], [17.427, 78.47], [17.428, 78.478], [17.42, 78.478]],
  },
  {
    email: 'tourist2@demo.com', // Emma
    description: 'Charminar market (yellow) then the Musi riverbed (red)',
    loop: true,
    waypoints: [
      [17.3675, 78.476], [17.3616, 78.4747], [17.36, 78.4775], [17.366, 78.4815],
      [17.37, 78.487], [17.3708, 78.493], [17.3745, 78.49], [17.374, 78.48],
    ],
  },
  {
    email: 'tourist3@demo.com', // Liam
    description: 'Golconda Fort ruins (yellow) then the defence area (red)',
    loop: true,
    waypoints: [
      [17.378, 78.405], [17.3833, 78.4011], [17.388, 78.399], [17.393, 78.394],
      [17.3885, 78.412], [17.378, 78.41],
    ],
  },
  {
    email: 'tourist4@demo.com', // Priya
    description: 'Birla Mandir -> Lumbini Park -> Hussain Sagar (green zones)',
    loop: true,
    waypoints: [[17.4062, 78.4691], [17.41, 78.4729], [17.4135, 78.4735], [17.4239, 78.4738], [17.42, 78.47]],
  },
  {
    email: 'tourist5@demo.com', // Lucas
    description: 'Salar Jung Museum -> walks into the Musi riverbed (red) and stops there',
    loop: false,
    waypoints: [[17.3713, 78.4804], [17.3725, 78.4835], [17.3702, 78.487], [17.3705, 78.4905]],
  },
];
