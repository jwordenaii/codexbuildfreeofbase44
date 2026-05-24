export const BUSINESS = {
  name:            'J. Worden & Sons Paving LLC',
  phone:           '+18044461296',
  googlePlaceId:   'ChIJG3X8o_OStokRzRynNBuVfQ0',
  googleReviewUrl: 'https://search.google.com/local/writereview?placeid=ChIJG3X8o_OStokRzRynNBuVfQ0',
}

// Asphalt mix lay-down thresholds (°F)
export const ASPHALT = {
  minLayTemp:       275,
  breakdownTemp:    240,
  finalRollTemp:    175,
  dangerColdBelow:  250,
}

// Compaction pass targets
export const COMPACTION = {
  minPasses:       3,
  targetDensity:   96,  // % of max theoretical density
}
