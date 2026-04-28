export default [
  {
    state: 'Alabama',
    abbr: 'AL',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Sand or fine granular material, 4 in. min above and below pipe',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth per ALDOT; cased crossing required',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. minimum or approved conduit',
    },
    water: {
      minBurialDepthIn: 36,
      frostLineDepthIn: 6,
      roadCrossingDepthIn: 42,
    },
    sewer: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote:
      'PHMSA 49 CFR § 192.327 governs gas; NEC Article 300 for electric; AWWA C600 for water',
    citation: 'Ala. Admin. Code r. 770-X-8; ALDOT Standard Specifications',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Alaska',
    abbr: 'AK',
    gas: {
      minBurialDepthIn: 36,
      trenchBeddingNote:
        'Sand or granular fill; depth must be below frost line (84 in. in most of state)',
      roadCrossingDepthIn: 48,
      waterwayCrossingNote:
        'Below scour depth; may require directional drilling under navigable waterways',
    },
    electric: {
      minBurialDepthIn: 36,
      roadCrossingDepthIn: 48,
      highVoltageNote:
        'Permafrost areas require special engineering; 600V+ minimum 36 in. or conduit',
    },
    water: {
      minBurialDepthIn: 84,
      frostLineDepthIn: 84,
      roadCrossingDepthIn: 96,
    },
    sewer: {
      minBurialDepthIn: 84,
      roadCrossingDepthIn: 96,
    },
    telecom: {
      minBurialDepthIn: 36,
      directBuriedDepthIn: 36,
      conduitDepthIn: 24,
    },
    fiber: {
      minBurialDepthIn: 36,
      directBuriedDepthIn: 36,
      conduitDepthIn: 24,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC 300; permafrost engineering per ADOT&PF specs',
    citation: 'AAC 3 AAC 55 et seq.; ADOT&PF Standard Specifications',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Arizona',
    abbr: 'AZ',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Sand or granular material 4 in. above and below',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth per ADOT requirements',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: 'Over 600V: 36 in. minimum depth',
    },
    water: {
      minBurialDepthIn: 18,
      frostLineDepthIn: 12,
      roadCrossingDepthIn: 24,
    },
    sewer: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 30,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 18,
      directBuriedDepthIn: 18,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'A.A.C. R14-5-210; ADOT Utility Accommodation Policy',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Arkansas',
    abbr: 'AR',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Screened native material or granular bedding 6 in. around pipe',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below established scour depth',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. minimum or conduit',
    },
    water: {
      minBurialDepthIn: 36,
      frostLineDepthIn: 12,
      roadCrossingDepthIn: 42,
    },
    sewer: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'ARDOT Standard Specifications; Ark. Code Ann. § 23-18-101',
    lastVerified: '2026-01-01',
  },
  {
    state: 'California',
    abbr: 'CA',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Sand bedding 4 in. above and below; tracer wire required',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote:
        'Below lowest point of scour; CPUC approval required for major crossings',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V-22kV: 30 in. min; over 22kV: 36 in. min or per Caltrans requirements',
    },
    water: {
      minBurialDepthIn: 24,
      frostLineDepthIn: 12,
      roadCrossingDepthIn: 36,
    },
    sewer: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; CPUC General Order 128; NEC Article 300',
    citation: 'Cal. Code Regs. tit. 8, § 2940; Caltrans Utility Notice; CPUC GO-128',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Colorado',
    abbr: 'CO',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Sand or fine granular material 6 in. above and below pipe',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote:
        'Below scour depth per CDOT requirements; casing required under CDOT roads',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit',
    },
    water: {
      minBurialDepthIn: 60,
      frostLineDepthIn: 36,
      roadCrossingDepthIn: 72,
    },
    sewer: {
      minBurialDepthIn: 48,
      roadCrossingDepthIn: 60,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300; CDOT Utility Accommodation Code',
    citation: 'CDOT Utility Accommodation Code; 4 CCR 723-3',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Connecticut',
    abbr: 'CT',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Compacted sand or fine granular bedding',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth; CTDOT approval required',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or approved conduit',
    },
    water: {
      minBurialDepthIn: 54,
      frostLineDepthIn: 42,
      roadCrossingDepthIn: 60,
    },
    sewer: {
      minBurialDepthIn: 42,
      roadCrossingDepthIn: 54,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'Conn. Agencies Regs. § 16-11-110; CTDOT Utility Policy',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Delaware',
    abbr: 'DE',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Sand or granular material 4 in. above and below',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth per DelDOT',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. minimum',
    },
    water: {
      minBurialDepthIn: 42,
      frostLineDepthIn: 30,
      roadCrossingDepthIn: 48,
    },
    sewer: {
      minBurialDepthIn: 36,
      roadCrossingDepthIn: 42,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'DelDOT Utility Accommodation Policy; Del. Admin. Code tit. 26',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Florida',
    abbr: 'FL',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Sand or compacted granular material; no frost concern in most of state',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth; FDOT and SFWMD approvals may be required',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit; FPL and utility-specific specs apply',
    },
    water: {
      minBurialDepthIn: 18,
      frostLineDepthIn: 0,
      roadCrossingDepthIn: 24,
    },
    sewer: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 30,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 18,
      directBuriedDepthIn: 18,
      conduitDepthIn: 12,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300; FDEP requirements',
    citation: 'FDOT Utility Accommodation Manual; Fla. Admin. Code r. 62-621',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Georgia',
    abbr: 'GA',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Sand or fine granular material 4 in. above and below',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth per GDOT standards',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit; Georgia Power specs apply',
    },
    water: {
      minBurialDepthIn: 18,
      frostLineDepthIn: 6,
      roadCrossingDepthIn: 24,
    },
    sewer: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 30,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 18,
      directBuriedDepthIn: 18,
      conduitDepthIn: 12,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'GDOT Utility Accommodation Policy; Ga. Code Ann. § 46-7-81',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Hawaii',
    abbr: 'HI',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Compacted granular fill; no frost concern',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth; HDOT approval required',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit; HECO specs apply',
    },
    water: {
      minBurialDepthIn: 18,
      frostLineDepthIn: 0,
      roadCrossingDepthIn: 24,
    },
    sewer: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 30,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 18,
      directBuriedDepthIn: 18,
      conduitDepthIn: 12,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'HAR § 6E-43; Hawaii DOT Utility Policy',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Idaho',
    abbr: 'ID',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Sand or screened granular material 6 in. above and below',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth per ITD; casing pipe required under state highways',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit',
    },
    water: {
      minBurialDepthIn: 42,
      frostLineDepthIn: 30,
      roadCrossingDepthIn: 48,
    },
    sewer: {
      minBurialDepthIn: 36,
      roadCrossingDepthIn: 42,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'IDAPA 31.11.01; ITD Utility Policy',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Illinois',
    abbr: 'IL',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Fine granular material 4 in. above and below; tracer wire required',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth per IDOT; special crossing permit required',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit',
    },
    water: {
      minBurialDepthIn: 54,
      frostLineDepthIn: 42,
      roadCrossingDepthIn: 60,
    },
    sewer: {
      minBurialDepthIn: 48,
      roadCrossingDepthIn: 54,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote:
      'PHMSA 49 CFR § 192.327; NEC Article 300; IDOT Utility Accommodation Policy',
    citation: '83 Ill. Adm. Code § 590; IDOT Utility Policy',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Indiana',
    abbr: 'IN',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Granular bedding 6 in. above and below',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth; INDOT encroachment permit required',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit',
    },
    water: {
      minBurialDepthIn: 54,
      frostLineDepthIn: 42,
      roadCrossingDepthIn: 60,
    },
    sewer: {
      minBurialDepthIn: 48,
      roadCrossingDepthIn: 54,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: '170 IAC 1-1; INDOT Utility Accommodation Policy',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Iowa',
    abbr: 'IA',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Sand or fine granular material 4 in. above and below',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth; Iowa DOT crossing permit required',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit',
    },
    water: {
      minBurialDepthIn: 72,
      frostLineDepthIn: 60,
      roadCrossingDepthIn: 84,
    },
    sewer: {
      minBurialDepthIn: 60,
      roadCrossingDepthIn: 72,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'Iowa Admin. Code r. 199-11.4; Iowa DOT Utility Accommodation Policy',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Kansas',
    abbr: 'KS',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Sand or screened granular bedding 4 in. above and below',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth; KDOT crossing permit required',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit',
    },
    water: {
      minBurialDepthIn: 48,
      frostLineDepthIn: 36,
      roadCrossingDepthIn: 54,
    },
    sewer: {
      minBurialDepthIn: 42,
      roadCrossingDepthIn: 48,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'K.A.R. 82-14-1 et seq.; KDOT Utility Accommodation Policy',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Kentucky',
    abbr: 'KY',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Sand or fine granular material 4 in. above and below',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth per KYTC; casing required under highways',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit',
    },
    water: {
      minBurialDepthIn: 30,
      frostLineDepthIn: 18,
      roadCrossingDepthIn: 36,
    },
    sewer: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 30,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: '807 KAR 5:041; KYTC Utility Accommodation Policy',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Louisiana',
    abbr: 'LA',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote:
        'Sand or granular bedding 6 in. above and below; high water table areas require special design',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote:
        'Below scour depth; USACE and LADOTD approvals required for wetland/waterway crossings',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit; Entergy specs apply in service territory',
    },
    water: {
      minBurialDepthIn: 24,
      frostLineDepthIn: 6,
      roadCrossingDepthIn: 30,
    },
    sewer: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 30,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 18,
      directBuriedDepthIn: 18,
      conduitDepthIn: 12,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300; USACE Section 404 for wetlands',
    citation: 'LAC 43:XIII; LADOTD Utility Accommodation Manual',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Maine',
    abbr: 'ME',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Granular bedding 4 in. above and below; all depths below frost line',
      roadCrossingDepthIn: 42,
      waterwayCrossingNote: 'Below scour depth per MaineDOT; casing required under state roads',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 42,
      highVoltageNote: '600V+ requires 36 in. or conduit',
    },
    water: {
      minBurialDepthIn: 72,
      frostLineDepthIn: 60,
      roadCrossingDepthIn: 84,
    },
    sewer: {
      minBurialDepthIn: 60,
      roadCrossingDepthIn: 72,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: '65-407 CMR ch. 250; MaineDOT Utility Accommodation Policy',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Maryland',
    abbr: 'MD',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Sand or fine granular bedding 4 in. above and below',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth; MDE and SHA approvals required',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit; BGE and Pepco specs apply',
    },
    water: {
      minBurialDepthIn: 42,
      frostLineDepthIn: 30,
      roadCrossingDepthIn: 48,
    },
    sewer: {
      minBurialDepthIn: 36,
      roadCrossingDepthIn: 42,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'COMAR 20.55.02; SHA Utility Accommodation Policy',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Massachusetts',
    abbr: 'MA',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Granular bedding meeting DPU specifications; tracer wire required',
      roadCrossingDepthIn: 42,
      waterwayCrossingNote: 'Below scour depth; MassDOT and MassWRC approvals required',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 42,
      highVoltageNote: '600V+ requires 36 in. or conduit; Eversource/National Grid specs apply',
    },
    water: {
      minBurialDepthIn: 60,
      frostLineDepthIn: 48,
      roadCrossingDepthIn: 72,
    },
    sewer: {
      minBurialDepthIn: 48,
      roadCrossingDepthIn: 60,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote:
      'PHMSA 49 CFR § 192.327; NEC Article 300; 220 CMR for gas; 220 CMR 51 for electric',
    citation: '220 CMR 51; MassDOT Utility Accommodation Policy',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Michigan',
    abbr: 'MI',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Granular bedding meeting MPSC specs 4 in. above and below',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth; MDOT encroachment permit required',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit; Consumers Energy and DTE specs apply',
    },
    water: {
      minBurialDepthIn: 54,
      frostLineDepthIn: 42,
      roadCrossingDepthIn: 60,
    },
    sewer: {
      minBurialDepthIn: 48,
      roadCrossingDepthIn: 54,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'Mich. Admin. Code R 460.20101 et seq.; MDOT Utility Accommodation Policy',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Minnesota',
    abbr: 'MN',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Granular bedding meeting DOC specs; depth below frost line required',
      roadCrossingDepthIn: 42,
      waterwayCrossingNote: 'Below scour depth; MnDOT and DNR approvals required',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 42,
      highVoltageNote:
        '600V+ requires 36 in. or conduit; Xcel Energy and other utility specs apply',
    },
    water: {
      minBurialDepthIn: 72,
      frostLineDepthIn: 60,
      roadCrossingDepthIn: 84,
    },
    sewer: {
      minBurialDepthIn: 60,
      roadCrossingDepthIn: 72,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'Minn. R. 7820.1000 et seq.; MnDOT Utility Accommodation Policy',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Mississippi',
    abbr: 'MS',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Sand or fine granular material 4 in. above and below',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth per MDOT; permit required',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit',
    },
    water: {
      minBurialDepthIn: 24,
      frostLineDepthIn: 6,
      roadCrossingDepthIn: 30,
    },
    sewer: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 30,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 18,
      directBuriedDepthIn: 18,
      conduitDepthIn: 12,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'MDOT Standard Specifications; PSC Rule 3.05',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Missouri',
    abbr: 'MO',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Sand or fine granular bedding 4 in. above and below',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth per MoDOT; casing required under state routes',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit; Ameren and KCP&L specs apply',
    },
    water: {
      minBurialDepthIn: 42,
      frostLineDepthIn: 30,
      roadCrossingDepthIn: 48,
    },
    sewer: {
      minBurialDepthIn: 36,
      roadCrossingDepthIn: 42,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'MoDOT Utility Accommodation Policy; 4 CSR 240-40.030',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Montana',
    abbr: 'MT',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Granular material 6 in. above and below; depth adjusted for frost',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote:
        'Below scour depth per MDT; directional drill preferred for large waterways',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit',
    },
    water: {
      minBurialDepthIn: 60,
      frostLineDepthIn: 48,
      roadCrossingDepthIn: 72,
    },
    sewer: {
      minBurialDepthIn: 48,
      roadCrossingDepthIn: 60,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'MDT Utility Accommodation Policy; ARM 38.5.1301',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Nebraska',
    abbr: 'NE',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Granular bedding 4 in. above and below pipe',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth per NDOT; casing required under interstates',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit; NPPD and LES specs apply',
    },
    water: {
      minBurialDepthIn: 54,
      frostLineDepthIn: 42,
      roadCrossingDepthIn: 60,
    },
    sewer: {
      minBurialDepthIn: 48,
      roadCrossingDepthIn: 54,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: '291 NAC 1; NDOT Utility Accommodation Policy',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Nevada',
    abbr: 'NV',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Sand or granular bedding 4 in. above and below',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth; NDOT and BLM approvals required',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit; NV Energy specs apply',
    },
    water: {
      minBurialDepthIn: 36,
      frostLineDepthIn: 24,
      roadCrossingDepthIn: 42,
    },
    sewer: {
      minBurialDepthIn: 30,
      roadCrossingDepthIn: 36,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'NDOT Utility Accommodation Manual; NAC 704',
    lastVerified: '2026-01-01',
  },
  {
    state: 'New Hampshire',
    abbr: 'NH',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Granular bedding 4 in. above and below; all below frost',
      roadCrossingDepthIn: 42,
      waterwayCrossingNote: 'Below scour depth per NHDOT; DES permit required',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 42,
      highVoltageNote: '600V+ requires 36 in. or conduit',
    },
    water: {
      minBurialDepthIn: 66,
      frostLineDepthIn: 54,
      roadCrossingDepthIn: 72,
    },
    sewer: {
      minBurialDepthIn: 54,
      roadCrossingDepthIn: 66,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'N.H. Code Admin. R. Puc 600; NHDOT Utility Accommodation Manual',
    lastVerified: '2026-01-01',
  },
  {
    state: 'New Jersey',
    abbr: 'NJ',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Granular bedding per NJ BPU standards',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth; NJDOT and NJDEP approvals required',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit; JCP&L and PSE&G specs apply',
    },
    water: {
      minBurialDepthIn: 48,
      frostLineDepthIn: 36,
      roadCrossingDepthIn: 54,
    },
    sewer: {
      minBurialDepthIn: 42,
      roadCrossingDepthIn: 48,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'N.J.A.C. 14:3-3; NJDOT Utility Accommodation Policy',
    lastVerified: '2026-01-01',
  },
  {
    state: 'New Mexico',
    abbr: 'NM',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Sand or fine granular material 4 in. above and below',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth per NMDOT; casing required under highways',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit; PNM specs apply',
    },
    water: {
      minBurialDepthIn: 30,
      frostLineDepthIn: 18,
      roadCrossingDepthIn: 36,
    },
    sewer: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 30,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 18,
      directBuriedDepthIn: 18,
      conduitDepthIn: 12,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'NMPRC Gas Rule 570; NMDOT Utility Accommodation Policy',
    lastVerified: '2026-01-01',
  },
  {
    state: 'New York',
    abbr: 'NY',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Granular bedding per PSC standards; tracer wire required',
      roadCrossingDepthIn: 42,
      waterwayCrossingNote:
        'Below scour depth; NYSDOT and DEC approvals required; horizontal directional drilling preferred',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 42,
      highVoltageNote: '600V+ requires 36 in. or conduit; Con Edison and National Grid specs apply',
    },
    water: {
      minBurialDepthIn: 60,
      frostLineDepthIn: 48,
      roadCrossingDepthIn: 72,
    },
    sewer: {
      minBurialDepthIn: 48,
      roadCrossingDepthIn: 60,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300; PSC 16 NYCRR Part 255',
    citation: '16 NYCRR Part 255; NYSDOT Utility Accommodation Policy',
    lastVerified: '2026-01-01',
  },
  {
    state: 'North Carolina',
    abbr: 'NC',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Sand or fine granular material 4 in. above and below',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth per NCDOT',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit; Duke Energy specs apply',
    },
    water: {
      minBurialDepthIn: 24,
      frostLineDepthIn: 12,
      roadCrossingDepthIn: 30,
    },
    sewer: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 30,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 18,
      directBuriedDepthIn: 18,
      conduitDepthIn: 12,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'NCDOT Utility Accommodation Manual; 4 NCAC 11R .0600',
    lastVerified: '2026-01-01',
  },
  {
    state: 'North Dakota',
    abbr: 'ND',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Granular material 6 in. above and below; depths below frost line',
      roadCrossingDepthIn: 42,
      waterwayCrossingNote: 'Below scour depth; NDDOT and NDG&ED approvals required',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 42,
      highVoltageNote: '600V+ requires 36 in. or conduit',
    },
    water: {
      minBurialDepthIn: 72,
      frostLineDepthIn: 60,
      roadCrossingDepthIn: 84,
    },
    sewer: {
      minBurialDepthIn: 60,
      roadCrossingDepthIn: 72,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'N.D. Admin. Code ch. 69-09-05; NDDOT Utility Accommodation Policy',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Ohio',
    abbr: 'OH',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Granular bedding per PUCO and ODOT standards',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth; ODOT and OEPA approvals required',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit; AEP and FirstEnergy specs apply',
    },
    water: {
      minBurialDepthIn: 48,
      frostLineDepthIn: 36,
      roadCrossingDepthIn: 54,
    },
    sewer: {
      minBurialDepthIn: 42,
      roadCrossingDepthIn: 48,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'Ohio Admin. Code 4901:1-16; ODOT Utility Accommodation Policy',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Oklahoma',
    abbr: 'OK',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Sand or granular material 4 in. above and below',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth; ODOT crossing permit required',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit; OG&E and PSO specs apply',
    },
    water: {
      minBurialDepthIn: 30,
      frostLineDepthIn: 18,
      roadCrossingDepthIn: 36,
    },
    sewer: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 30,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 18,
      directBuriedDepthIn: 18,
      conduitDepthIn: 12,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'OAC 165:5-3; ODOT Utility Accommodation Policy',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Oregon',
    abbr: 'OR',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Granular bedding per PUC specs; tracer wire required',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth; ODOT and DSL approvals required; HDD preferred',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit; PGE and Pacific Power specs apply',
    },
    water: {
      minBurialDepthIn: 30,
      frostLineDepthIn: 18,
      roadCrossingDepthIn: 36,
    },
    sewer: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 30,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'OAR 860-024; ODOT Utility Accommodation Manual',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Pennsylvania',
    abbr: 'PA',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote:
        'Granular bedding per PUC specifications; tracer wire required on all plastic pipe',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth; PennDOT and DEP approvals required',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit; PECO and PPL specs apply',
    },
    water: {
      minBurialDepthIn: 48,
      frostLineDepthIn: 36,
      roadCrossingDepthIn: 54,
    },
    sewer: {
      minBurialDepthIn: 42,
      roadCrossingDepthIn: 48,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300; 52 Pa. Code § 59.33',
    citation: '52 Pa. Code § 59.33; PennDOT Publication 282',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Rhode Island',
    abbr: 'RI',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Granular bedding per PUC standards',
      roadCrossingDepthIn: 42,
      waterwayCrossingNote: 'Below scour depth; RIDOT and DEM approvals required',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 42,
      highVoltageNote: '600V+ requires 36 in. or conduit; National Grid specs apply',
    },
    water: {
      minBurialDepthIn: 54,
      frostLineDepthIn: 42,
      roadCrossingDepthIn: 60,
    },
    sewer: {
      minBurialDepthIn: 42,
      roadCrossingDepthIn: 54,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'R.I. PUC Tariff; RIDOT Utility Accommodation Manual',
    lastVerified: '2026-01-01',
  },
  {
    state: 'South Carolina',
    abbr: 'SC',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Sand or fine granular material 4 in. above and below',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote:
        'Below scour depth per SCDOT; SCDHEC approval required for waterway crossings',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit; Duke Energy and Dominion specs apply',
    },
    water: {
      minBurialDepthIn: 18,
      frostLineDepthIn: 6,
      roadCrossingDepthIn: 24,
    },
    sewer: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 30,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 18,
      directBuriedDepthIn: 18,
      conduitDepthIn: 12,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'SCDOT Utility Accommodation Manual; S.C. Code Regs. 103-400',
    lastVerified: '2026-01-01',
  },
  {
    state: 'South Dakota',
    abbr: 'SD',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Granular bedding 6 in. above and below; all below frost line',
      roadCrossingDepthIn: 42,
      waterwayCrossingNote: 'Below scour depth per SDDOT; casing required under state highways',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 42,
      highVoltageNote: '600V+ requires 36 in. or conduit',
    },
    water: {
      minBurialDepthIn: 60,
      frostLineDepthIn: 48,
      roadCrossingDepthIn: 72,
    },
    sewer: {
      minBurialDepthIn: 48,
      roadCrossingDepthIn: 60,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'ARSD 20:10:01; SDDOT Utility Accommodation Policy',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Tennessee',
    abbr: 'TN',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Sand or fine granular material 4 in. above and below',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth per TDOT; TVA approval may be required',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit; TVA and local utility specs apply',
    },
    water: {
      minBurialDepthIn: 24,
      frostLineDepthIn: 12,
      roadCrossingDepthIn: 30,
    },
    sewer: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 30,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 18,
      directBuriedDepthIn: 18,
      conduitDepthIn: 12,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation:
      'TDOT Utilities Installation and Accommodation Guidelines; Tenn. Code Ann. § 65-31-101',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Texas',
    abbr: 'TX',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote:
        'Sand or granular bedding 4 in. above and below; tracer wire required on plastic',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote:
        'Below scour depth; TxDOT and USACE approvals required; HDD preferred for major crossings',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote:
        '600V+ requires 36 in. or conduit; Oncor, CenterPoint, and other utility specs apply',
    },
    water: {
      minBurialDepthIn: 18,
      frostLineDepthIn: 6,
      roadCrossingDepthIn: 24,
    },
    sewer: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 30,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 18,
      directBuriedDepthIn: 18,
      conduitDepthIn: 12,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: '16 TAC § 8.101; TxDOT Utility Accommodation Policy',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Utah',
    abbr: 'UT',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote:
        'Sand or granular material 4 in. above and below; tracer wire required on plastic',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth; UDOT and DWR approvals required',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit; Rocky Mountain Power specs apply',
    },
    water: {
      minBurialDepthIn: 42,
      frostLineDepthIn: 30,
      roadCrossingDepthIn: 48,
    },
    sewer: {
      minBurialDepthIn: 36,
      roadCrossingDepthIn: 42,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'Utah Admin. Code R746-400; UDOT Utility Accommodation Policy',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Vermont',
    abbr: 'VT',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Granular bedding below frost line; VGS and Unitil specs apply',
      roadCrossingDepthIn: 42,
      waterwayCrossingNote: 'Below scour depth; VTrans and ANR approvals required',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 42,
      highVoltageNote: '600V+ requires 36 in. or conduit; Green Mountain Power specs apply',
    },
    water: {
      minBurialDepthIn: 72,
      frostLineDepthIn: 60,
      roadCrossingDepthIn: 84,
    },
    sewer: {
      minBurialDepthIn: 60,
      roadCrossingDepthIn: 72,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'Vt. Admin. Code 30-000-010; VTrans Utility Accommodation Policy',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Virginia',
    abbr: 'VA',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Granular material per SCC standards; tracer wire on plastic',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth; VDOT and DEQ approvals required',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote:
        '600V+ requires 36 in. or conduit; Dominion Energy and Appalachian Power specs apply',
    },
    water: {
      minBurialDepthIn: 30,
      frostLineDepthIn: 18,
      roadCrossingDepthIn: 36,
    },
    sewer: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 30,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: '9 VAC 5-10-10 et seq.; VDOT Utility Accommodation Policy',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Washington',
    abbr: 'WA',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Granular bedding per UTC standards; tracer wire required on plastic pipe',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote:
        'Below scour depth; WSDOT and Ecology approvals required; HDD preferred',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit; Puget Sound Energy and PSE specs apply',
    },
    water: {
      minBurialDepthIn: 36,
      frostLineDepthIn: 24,
      roadCrossingDepthIn: 42,
    },
    sewer: {
      minBurialDepthIn: 30,
      roadCrossingDepthIn: 36,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'WAC 480-93-005 et seq.; WSDOT Utilities Accommodation Manual',
    lastVerified: '2026-01-01',
  },
  {
    state: 'West Virginia',
    abbr: 'WV',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Granular bedding 4 in. above and below; tracer wire on plastic',
      roadCrossingDepthIn: 36,
      waterwayCrossingNote: 'Below scour depth; WVDOH and DEP approvals required',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 36,
      highVoltageNote: '600V+ requires 36 in. or conduit; FirstEnergy and AEP specs apply',
    },
    water: {
      minBurialDepthIn: 42,
      frostLineDepthIn: 30,
      roadCrossingDepthIn: 48,
    },
    sewer: {
      minBurialDepthIn: 36,
      roadCrossingDepthIn: 42,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'CSR 150-1-1 et seq.; WVDOH Utility Accommodation Policy',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Wisconsin',
    abbr: 'WI',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Granular bedding per PSC specs; tracer wire required on plastic',
      roadCrossingDepthIn: 42,
      waterwayCrossingNote: 'Below scour depth; WisDOT and DNR approvals required',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 42,
      highVoltageNote: '600V+ requires 36 in. or conduit; We Energies and Alliant specs apply',
    },
    water: {
      minBurialDepthIn: 66,
      frostLineDepthIn: 54,
      roadCrossingDepthIn: 78,
    },
    sewer: {
      minBurialDepthIn: 54,
      roadCrossingDepthIn: 66,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'PSC Wis. Admin. Code Gas § 136; WisDOT Utility Accommodation Policy',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Wyoming',
    abbr: 'WY',
    gas: {
      minBurialDepthIn: 24,
      trenchBeddingNote: 'Granular bedding 6 in. above and below; depth below frost line required',
      roadCrossingDepthIn: 42,
      waterwayCrossingNote:
        'Below scour depth; WYDOT and DEQ approvals required; HDD preferred for major waterways',
    },
    electric: {
      minBurialDepthIn: 24,
      roadCrossingDepthIn: 42,
      highVoltageNote: '600V+ requires 36 in. or conduit; Rocky Mountain Power specs apply',
    },
    water: {
      minBurialDepthIn: 60,
      frostLineDepthIn: 48,
      roadCrossingDepthIn: 72,
    },
    sewer: {
      minBurialDepthIn: 48,
      roadCrossingDepthIn: 60,
    },
    telecom: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    fiber: {
      minBurialDepthIn: 24,
      directBuriedDepthIn: 24,
      conduitDepthIn: 18,
    },
    federalOverlayNote: 'PHMSA 49 CFR § 192.327; NEC Article 300',
    citation: 'WYDOT Utility Accommodation Policy; Wyo. Rules & Regs. PSC-UTIL-001',
    lastVerified: '2026-01-01',
  },
]
