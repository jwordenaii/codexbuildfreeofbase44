export default [
  {
    state: 'Alabama',
    abbr: 'AL',
    permittingAuthority: 'Local jurisdiction (city or county building department)',
    statewideBuildingCode:
      'Yes - Alabama Building Commission adopts IBC; effective statewide except where stricter local codes apply',
    adoptedCodes: ['IBC 2018', 'IPC 2018', 'IMC 2018', 'IECC 2018', 'NEC 2020'],
    residentialThreshold:
      'All new residential construction requires permit; repairs/alterations above $2,500 often require permit',
    commercialThreshold:
      'All commercial construction requires permit; threshold varies by locality',
    exemptions:
      'Minor repairs, painting, flooring, cabinet work (no structural, electrical, plumbing)',
    permitFeeStructure:
      'Varies by jurisdiction; typically $X per $1,000 of construction value or per sq ft',
    inspectionsRequired: [
      'Foundation',
      'Framing',
      'Rough electrical',
      'Rough plumbing',
      'HVAC',
      'Insulation',
      'Final',
    ],
    stateBuildingOffice: 'Alabama Building Commission',
    stateBuildingUrl: 'https://bc.alabama.gov',
    citation: 'Ala. Code § 41-9-141 et seq.',
    notes:
      'Alabama adopted statewide building codes in 2012. Some rural areas lack local enforcement.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Alaska',
    abbr: 'AK',
    permittingAuthority: 'Local jurisdiction or State of Alaska (unorganized areas)',
    statewideBuildingCode:
      'Partial - State Fire Marshal enforces fire code; no single mandatory statewide building code; Anchorage and Fairbanks have own codes',
    adoptedCodes: [
      'IBC 2018 (Anchorage/Fairbanks)',
      'IFC 2018 (state fire marshal)',
      'Local codes vary',
    ],
    residentialThreshold:
      'Varies by jurisdiction; permit typically required for all new construction',
    commercialThreshold:
      'All commercial construction requires permit where local jurisdiction exists; state code in unorganized areas',
    exemptions: 'Agricultural structures in rural areas; minor maintenance',
    permitFeeStructure: 'Varies by jurisdiction',
    inspectionsRequired: ['Foundation', 'Framing', 'Rough MEP', 'Final'],
    stateBuildingOffice:
      'Alaska Division of Fire and Life Safety (fire code); local building departments for building code',
    stateBuildingUrl: 'https://dps.alaska.gov/fire',
    citation: 'AS § 18.70.080',
    notes:
      'Alaska does not have a uniform statewide building code authority outside fire safety. Permafrost and seismic requirements are significant local concerns.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Arizona',
    abbr: 'AZ',
    permittingAuthority: 'Local jurisdiction (city, town, or county)',
    statewideBuildingCode:
      'Partial - Arizona adopts model codes for manufactured housing; cities/counties adopt local codes typically based on IBC',
    adoptedCodes: ['IBC 2018 (most jurisdictions)', 'IFC 2018', 'NEC 2020', 'IRC 2018'],
    residentialThreshold:
      'All new residential construction requires permit; repairs/alterations above $1,000 typically require permit',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions: 'Minor repairs, painting, decorative work; agricultural structures',
    permitFeeStructure:
      'Varies by jurisdiction; typically plan check fee plus permit fee based on valuation',
    inspectionsRequired: [
      'Footing/Foundation',
      'Framing',
      'Rough electrical/plumbing/HVAC',
      'Insulation',
      'Final',
    ],
    stateBuildingOffice:
      'Arizona Department of Fire, Building and Life Safety (manufactured housing and state buildings)',
    stateBuildingUrl: 'https://dfbls.az.gov',
    citation: 'A.R.S. § 9-467 (cities); § 11-867 (counties)',
    notes:
      'Maricopa County and Pima County have county-level building departments. Some rural areas have limited enforcement capacity.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Arkansas',
    abbr: 'AR',
    permittingAuthority:
      'Local jurisdiction; State Fire Prevention Code administered by State Police',
    statewideBuildingCode:
      'Partial - Arkansas Fire Prevention Code is statewide; local building codes vary by jurisdiction',
    adoptedCodes: [
      'IBC 2018 (Little Rock and most cities)',
      'IFC 2018 (statewide fire code)',
      'NEC 2017',
    ],
    residentialThreshold:
      'Permit required for all new residential construction; many rural jurisdictions have no permit requirement',
    commercialThreshold: 'All commercial construction requires permit in incorporated areas',
    exemptions:
      'Farm buildings; structures in unincorporated areas without local ordinance; minor repairs',
    permitFeeStructure: 'Varies by jurisdiction',
    inspectionsRequired: ['Foundation', 'Framing', 'Rough MEP', 'Final'],
    stateBuildingOffice: 'Arkansas State Police - Fire Marshal Division',
    stateBuildingUrl: 'https://www.dfa.arkansas.gov/insurance/state-fire-marshal',
    citation: 'Ark. Code Ann. § 20-22-601 et seq.',
    notes:
      'Many rural counties in Arkansas have no building permit requirement. Contractors should verify local requirements.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'California',
    abbr: 'CA',
    permittingAuthority:
      'Local jurisdiction (city or county building department); DSA for state-funded K-12/community colleges; OSHPD for healthcare',
    statewideBuildingCode:
      'Yes - California Building Standards Code (Title 24) mandatory statewide',
    adoptedCodes: [
      'CBC 2022 (IBC with California amendments)',
      'CRC 2022',
      'CPC 2022',
      'CMC 2022',
      'CEC (NEC with amendments)',
      'CALGreen (CALGreen Mandatory)',
      'CBSC Title 24',
    ],
    residentialThreshold:
      'All new residential construction requires permit; alteration/addition above $500 typically requires permit',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions:
      'Painting, papering, tiling ≤$500 value; one-story detached accessory structures ≤120 sq ft in some jurisdictions; fences ≤6 ft',
    permitFeeStructure:
      'Varies significantly by jurisdiction; plan check fees plus permit fees based on project valuation; some cities charge $10-20+ per sq ft',
    inspectionsRequired: [
      'Foundation',
      'Framing',
      'Sheathing',
      'Rough electrical/plumbing/mechanical',
      'Energy compliance',
      'Insulation',
      'Final',
    ],
    stateBuildingOffice: 'California Building Standards Commission (CBSC)',
    stateBuildingUrl: 'https://www.dgs.ca.gov/BSC',
    citation: 'Cal. Health & Safety Code § 18900 et seq.; Title 24 CCR',
    notes:
      'California Title 24 is one of the most comprehensive building code systems in the nation. CALGreen (California Green Building Standards Code) adds additional sustainability requirements. High fire hazard severity zone requirements apply in many areas.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Colorado',
    abbr: 'CO',
    permittingAuthority: 'Local jurisdiction (municipality or county)',
    statewideBuildingCode:
      'No - No mandatory statewide building code; municipalities adopt own codes',
    adoptedCodes: [
      'IBC 2021 (Denver, Boulder, most municipalities)',
      'IRC 2021',
      'IFC 2021',
      'NEC 2020',
    ],
    residentialThreshold:
      'Varies by jurisdiction; permit required for all new construction in most municipalities',
    commercialThreshold: 'All commercial construction requires permit in municipalities',
    exemptions:
      'Unincorporated rural areas may have no permit requirements; minor maintenance and repairs',
    permitFeeStructure: 'Varies by jurisdiction',
    inspectionsRequired: ['Foundation', 'Framing', 'Rough MEP', 'Insulation', 'Final'],
    stateBuildingOffice:
      'No single state building office; local jurisdictions adopt and enforce codes',
    stateBuildingUrl: 'https://dora.colorado.gov',
    citation: 'C.R.S. § 24-33-502 et seq. (fire code); local municipal codes',
    notes:
      'Colorado has no statewide building code. Counties and municipalities adopt their own. Wildfire construction requirements are increasingly common in many areas.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Connecticut',
    abbr: 'CT',
    permittingAuthority: 'Local jurisdiction (municipal building official)',
    statewideBuildingCode:
      'Yes - Connecticut State Building Code mandatory statewide (2022 update based on IBC 2021)',
    adoptedCodes: [
      'IBC 2021 (CT State Building Code)',
      'IRC 2021',
      'IFC 2021',
      'NEC 2020',
      'IECC 2021',
    ],
    residentialThreshold:
      'Permit required for all new residential construction; renovations/alterations above $10,000 or involving structural work require permit',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions: 'Minor repairs, painting, decorating under $10,000 with no structural/MEP changes',
    permitFeeStructure:
      'Set by each municipality; typically $X per $1,000 valuation; state surcharge applies',
    inspectionsRequired: ['Foundation', 'Framing', 'Rough MEP', 'Insulation', 'Final'],
    stateBuildingOffice:
      'Connecticut Department of Administrative Services - State Building Inspector',
    stateBuildingUrl: 'https://portal.ct.gov/DAS/Construction-Services/State-Building-Inspector',
    citation: 'CGS § 29-251 et seq. (State Building Code)',
    notes:
      'Connecticut updates its State Building Code periodically. All municipalities must adopt and enforce the state code. Towns have building officials who issue permits.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Delaware',
    abbr: 'DE',
    permittingAuthority:
      'Office of State Fire Marshal (statewide); local jurisdiction for many permits',
    statewideBuildingCode:
      'Yes - Delaware Building Code adopted by State Fire Marshal; based on IBC',
    adoptedCodes: ['IBC 2021', 'IRC 2021', 'IFC 2021', 'NEC 2020', 'IECC 2021'],
    residentialThreshold:
      'All new residential construction requires permit; additions/alterations above $5,000 typically require permit',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions: 'Agricultural buildings; minor repairs under $500; maintenance items',
    permitFeeStructure:
      'Based on construction value; $10 per $1,000 valuation typical; county-specific',
    inspectionsRequired: ['Footing', 'Foundation', 'Framing', 'Rough MEP', 'Insulation', 'Final'],
    stateBuildingOffice:
      'Delaware Office of State Fire Marshal - Office of Building Code Compliance',
    stateBuildingUrl: 'https://osfm.delaware.gov',
    citation: '16 Del. Code § 7101 et seq. (State Fire Prevention Regulations and Building Code)',
    notes:
      'Delaware is unique in having the State Fire Marshal administer building codes. New Castle, Kent, and Sussex counties all have local enforcement mechanisms as well.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Florida',
    abbr: 'FL',
    permittingAuthority: 'Local jurisdiction (county or city building department)',
    statewideBuildingCode:
      'Yes - Florida Building Code (FBC) mandatory statewide; updated every 3 years',
    adoptedCodes: [
      'FBC 7th Edition 2020 (based on IBC/IRC with FL amendments)',
      'FBC-Energy',
      'FBC-Residential',
      'NFPA 101 (life safety)',
      'NEC 2020',
    ],
    residentialThreshold:
      'All new residential construction requires permit; additions/renovations above $2,500 typically require permit; re-roofing always requires permit',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions:
      'Minor repairs under $2,500 that do not affect structural, electrical, plumbing, or fire protection systems',
    permitFeeStructure:
      'Varies by county; typically 1-3% of project cost or per sq ft; many counties charge $7-15/sq ft for new construction',
    inspectionsRequired: [
      'Foundation/Slab',
      'Framing/Masonry',
      'Rough electrical/plumbing/mechanical',
      'Energy',
      'Roofing',
      'Final',
      'Hurricane strap/tie-down',
    ],
    stateBuildingOffice:
      'Florida Department of Business and Professional Regulation (DBPR) - Building Codes Program',
    stateBuildingUrl: 'https://www.myfloridalicense.com/DBPR/buildings',
    citation: 'Fla. Stat. § 553.70 et seq. (Florida Building Act)',
    notes:
      'Florida Building Code includes special hurricane/wind load requirements. High-velocity hurricane zones (Miami-Dade and Broward) have stricter wind resistance requirements. Product approval required for many components.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Georgia',
    abbr: 'GA',
    permittingAuthority:
      'Local jurisdiction (county or city building department); DCA for technical codes',
    statewideBuildingCode:
      'Yes - Georgia State Minimum Standard Codes adopted by Department of Community Affairs (DCA)',
    adoptedCodes: [
      'IBC 2018 (with GA amendments)',
      'IRC 2018',
      'IFC 2018',
      'NEC 2020',
      'IECC 2015 (residential)/2018 (commercial)',
    ],
    residentialThreshold:
      'All new residential construction requires permit; renovations involving structural, electrical, plumbing, or mechanical require permit',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions:
      'Minor repairs; agricultural buildings in unincorporated areas; detached accessory structures ≤120 sq ft',
    permitFeeStructure: 'Varies by county; typically based on construction value',
    inspectionsRequired: [
      'Foundation/Footing',
      'Slab',
      'Framing',
      'Rough MEP',
      'Insulation',
      'Final',
    ],
    stateBuildingOffice:
      'Georgia Department of Community Affairs (DCA) - Construction Codes and Housing',
    stateBuildingUrl: 'https://dca.ga.gov/safe-affordable-housing/codes-and-housing-development',
    citation: 'O.C.G.A. § 8-2-20 et seq.',
    notes:
      'Georgia adopts state minimum codes; local governments may adopt more stringent codes. Coastal construction zone has additional requirements.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Hawaii',
    abbr: 'HI',
    permittingAuthority: 'County building department (each island county)',
    statewideBuildingCode:
      'Partial - Each county adopts its own building code, typically based on IBC',
    adoptedCodes: [
      'IBC 2018 (Honolulu City & County, Hawaii County)',
      'IFC 2018',
      'NEC 2017',
      'County-specific amendments',
    ],
    residentialThreshold:
      'All new residential construction requires permit; alterations above $1,000 typically require permit',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions: 'Minor repairs under $1,000; maintenance items; temporary structures',
    permitFeeStructure: 'Varies by county; Honolulu: $45-75+ per $1,000 valuation',
    inspectionsRequired: ['Foundation', 'Framing', 'Rough MEP', 'Final'],
    stateBuildingOffice:
      'Hawaii Department of Accounting and General Services (DAGS) for state facilities; county building departments for private construction',
    stateBuildingUrl: 'https://dags.hawaii.gov',
    citation: 'HRS § 46-1.5 (county authority); county building ordinances',
    notes:
      'Hawaii has no statewide building code; each of the four counties (Honolulu, Hawaii, Maui, Kauai) has its own codes. Solar and hurricane construction requirements important throughout.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Idaho',
    abbr: 'ID',
    permittingAuthority: 'Local jurisdiction (city or county)',
    statewideBuildingCode:
      'Partial - Division of Building Safety (DBS) has statewide authority for specific occupancy types; local codes for most residential/commercial',
    adoptedCodes: ['IBC 2018', 'IRC 2018', 'IFC 2018', 'NEC 2020', 'IECC 2018'],
    residentialThreshold:
      'Varies by jurisdiction; permit required for all new construction in most areas',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions:
      'Agricultural buildings; structures in unincorporated areas without local ordinance',
    permitFeeStructure: 'Varies by jurisdiction; DBS: based on construction value',
    inspectionsRequired: ['Foundation', 'Framing', 'Rough MEP', 'Final'],
    stateBuildingOffice: 'Idaho Division of Building Safety (DBS)',
    stateBuildingUrl: 'https://dbs.idaho.gov',
    citation: 'Idaho Code § 39-4101 et seq.',
    notes:
      'Idaho Division of Building Safety has jurisdiction over manufactured homes, elevators, electrical, plumbing, and HVAC statewide, plus building code in areas without local codes.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Illinois',
    abbr: 'IL',
    permittingAuthority: 'Local jurisdiction (municipality or county)',
    statewideBuildingCode:
      'Partial - No single mandatory statewide code; Capital Development Board (CDB) adopts codes for state facilities; municipalities adopt own codes',
    adoptedCodes: [
      'IBC 2021 (Chicago: Chicago Building Code unique to city)',
      'IRC 2021 (most suburbs)',
      'NEC 2020',
      'IECC 2021',
    ],
    residentialThreshold: 'All new residential construction requires permit in municipalities',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions:
      'Some rural unincorporated areas have no permit requirement; agricultural buildings',
    permitFeeStructure:
      'Varies significantly; Chicago has complex fee structure; suburbs vary widely',
    inspectionsRequired: ['Foundation', 'Framing', 'Rough MEP', 'Insulation', 'Final'],
    stateBuildingOffice: 'Illinois Capital Development Board (CDB) for state facilities',
    stateBuildingUrl: 'https://www2.illinois.gov/cdb',
    citation: '20 ILCS 3105 (CDB Act); local municipal codes',
    notes:
      'Chicago has its own unique building code (not based on IBC). Rest of Illinois relies on local adoption of model codes. No statewide residential building code.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Indiana',
    abbr: 'IN',
    permittingAuthority: 'Local jurisdiction for residential; IDHS for commercial/non-residential',
    statewideBuildingCode:
      'Yes - Indiana has statewide building codes enforced by Indiana Department of Homeland Security (IDHS) for commercial; local for residential',
    adoptedCodes: [
      'IBC 2020 (commercial, state adoption with amendments)',
      'IRC 2020 (residential)',
      'IFC 2018',
      'NEC 2020',
      'IECC 2021',
    ],
    residentialThreshold:
      'All new residential construction requires permit from local building department',
    commercialThreshold:
      'All commercial/non-residential construction requires permit from IDHS or local jurisdiction',
    exemptions:
      'Agricultural buildings; private detached residential accessory structures under 200 sq ft',
    permitFeeStructure: 'IDHS commercial: $0.07-0.12 per sq ft; local residential varies',
    inspectionsRequired: ['Foundation', 'Framing', 'Rough MEP', 'Insulation', 'Final'],
    stateBuildingOffice:
      'Indiana Department of Homeland Security (IDHS) - Fire and Building Safety Division',
    stateBuildingUrl: 'https://www.in.gov/dhs',
    citation: 'IC 22-12-1 et seq.',
    notes:
      'Indiana has a dual system: IDHS enforces state commercial building code; local jurisdictions enforce residential codes. Indiana has preempted local residential code adoption in some respects.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Iowa',
    abbr: 'IA',
    permittingAuthority:
      'Local jurisdiction; Iowa State Fire Marshal for state buildings and fire code',
    statewideBuildingCode:
      'Partial - Iowa State Fire Code (IFC) mandatory statewide; building codes adopted by localities',
    adoptedCodes: [
      'IBC 2018 (Des Moines and most cities)',
      'IRC 2018',
      'IFC 2018 (statewide fire)',
      'NEC 2020',
    ],
    residentialThreshold:
      'Permit required in most municipalities; no statewide residential permit requirement',
    commercialThreshold: 'All commercial construction requires permit in municipalities',
    exemptions:
      'Agricultural buildings; rural unincorporated areas without local codes; minor repairs',
    permitFeeStructure: 'Varies by jurisdiction',
    inspectionsRequired: ['Foundation', 'Framing', 'Rough MEP', 'Final'],
    stateBuildingOffice: 'Iowa State Fire Marshal Division',
    stateBuildingUrl: 'https://iowafm.iowa.gov',
    citation: 'Iowa Code § 103A (State Building Code Act); § 100B (Fire Safety)',
    notes:
      'Iowa Building Code Act allows but does not mandate local adoption. Most urban areas have adopted codes. Rural areas may have limited requirements.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Kansas',
    abbr: 'KS',
    permittingAuthority: 'Local jurisdiction (city or county)',
    statewideBuildingCode:
      'Partial - No mandatory statewide residential building code; State Fire Marshal code for most buildings',
    adoptedCodes: [
      'IBC 2018 (Wichita, Kansas City area)',
      'IFC 2018 (state fire marshal)',
      'NEC 2017',
      'Local codes vary',
    ],
    residentialThreshold: 'Varies by jurisdiction; permit required in most cities',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions:
      'Agricultural buildings; structures in unincorporated areas without local ordinance; minor repairs',
    permitFeeStructure: 'Varies by jurisdiction',
    inspectionsRequired: ['Foundation', 'Framing', 'Rough MEP', 'Final'],
    stateBuildingOffice: 'Kansas State Fire Marshal',
    stateBuildingUrl: 'https://www.ksfm.ks.gov',
    citation: 'K.S.A. 31-133 et seq. (State Fire Marshal Act); local municipal codes',
    notes:
      'Kansas has no statewide building code mandate for local governments. Local adoption varies widely. Tornado/wind construction requirements important.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Kentucky',
    abbr: 'KY',
    permittingAuthority:
      'Local jurisdiction; Department of Housing, Buildings and Construction (DHBC) for commercial/non-residential',
    statewideBuildingCode:
      'Yes - Kentucky Building Code mandatory statewide for commercial; Kentucky Residential Code for new residential',
    adoptedCodes: [
      'KBC (based on IBC 2018 with KY amendments)',
      'KRC (based on IRC 2018)',
      'IFC 2018',
      'NEC 2017',
      'IECC 2021',
    ],
    residentialThreshold:
      'All new residential construction requires permit; additions/renovations involving structural or MEP require permit',
    commercialThreshold: 'All commercial construction requires state permit',
    exemptions: 'Agricultural buildings; detached accessory structures under 200 sq ft',
    permitFeeStructure: 'DHBC: $0.05-0.10 per sq ft for commercial; residential varies by locality',
    inspectionsRequired: ['Foundation', 'Framing', 'Rough MEP', 'Insulation', 'Final'],
    stateBuildingOffice: 'Kentucky Department of Housing, Buildings and Construction (DHBC)',
    stateBuildingUrl: 'https://dhbc.ky.gov',
    citation: 'KRS 198B.010 et seq. (State Building Code)',
    notes:
      'Kentucky has a statewide building code system. DHBC handles commercial permits; local building departments handle residential in most areas.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Louisiana',
    abbr: 'LA',
    permittingAuthority:
      'Local jurisdiction (parish or municipal building department); State Fire Marshal for certain occupancies',
    statewideBuildingCode:
      'Yes - Louisiana State Uniform Construction Code (LSUCC) mandatory statewide based on IBC',
    adoptedCodes: ['IBC 2015 (LSUCC)', 'IRC 2015', 'IFC 2015', 'NEC 2017', 'IECC 2015'],
    residentialThreshold:
      'All new residential construction requires permit; alterations/additions involving structural or MEP require permit',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions:
      'Agricultural buildings; minor repairs under $5,000; structures under 400 sq ft on residential lots',
    permitFeeStructure: 'Varies by parish/municipality; typically based on valuation',
    inspectionsRequired: ['Foundation/Slab', 'Framing', 'Rough MEP', 'Final'],
    stateBuildingOffice: 'Louisiana State Fire Marshal - Office of the State Fire Marshal',
    stateBuildingUrl: 'https://lsfm.louisiana.gov',
    citation: 'La. Rev. Stat. § 40:1730.21 et seq. (LSUCC)',
    notes:
      'Louisiana adopted the LSUCC in 2005 after Hurricane Katrina to standardize building requirements. Wind and flood construction requirements are significant along the Gulf Coast.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Maine',
    abbr: 'ME',
    permittingAuthority:
      'Local jurisdiction; Maine Building Codes and Standards (DACF) for state buildings',
    statewideBuildingCode:
      'Partial - Mandatory for 1-2 family dwellings and manufactured housing under state code; rest by local adoption',
    adoptedCodes: [
      'IRC 2015 (Maine Uniform Building and Energy Code for 1-2 family)',
      'IBC 2015 (voluntary for commercial)',
      'NEC 2020',
      'ASHRAE 90.1 2019 for commercial energy',
    ],
    residentialThreshold:
      'State requires permits for new 1-2 family dwellings; local jurisdictions set other thresholds',
    commercialThreshold: 'Commercial permits required by local jurisdiction',
    exemptions:
      'Buildings in municipalities with <2,000 population or <10 permits/year may be exempt from state code; farm buildings',
    permitFeeStructure: 'Varies by jurisdiction',
    inspectionsRequired: ['Foundation', 'Framing', 'Rough MEP', 'Insulation', 'Final'],
    stateBuildingOffice:
      'Maine Department of Agriculture, Conservation and Forestry (DACF) - Building Codes',
    stateBuildingUrl: 'https://www.maine.gov/dacf/building_codes',
    citation: '30-A M.R.S.A. § 4101 et seq. (Uniform Building and Energy Code)',
    notes:
      'Maine adopted the Uniform Building and Energy Code (UBEC) for 1-2 family dwellings. Small municipalities (population <4,000) may opt out.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Maryland',
    abbr: 'MD',
    permittingAuthority: 'Local jurisdiction (county building department)',
    statewideBuildingCode:
      'Yes - Maryland Building Performance Standards (MBPS) mandatory statewide',
    adoptedCodes: [
      'IBC 2018 (with MD amendments)',
      'IRC 2018',
      'IFC 2018',
      'NEC 2020',
      'IECC 2021',
    ],
    residentialThreshold:
      'All new residential construction requires permit; alterations involving structural, electrical, plumbing, or mechanical require permit',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions:
      'Agricultural buildings (partial); minor repairs under $5,000 not affecting structural/MEP',
    permitFeeStructure:
      'Varies by county; typically based on construction value; Montgomery County among highest fees',
    inspectionsRequired: ['Foundation/Footing', 'Framing', 'Rough MEP', 'Insulation', 'Final'],
    stateBuildingOffice:
      'Maryland Department of Labor - Division of Labor and Industry (Code Administration)',
    stateBuildingUrl: 'https://www.dllr.state.md.us/labor/codes',
    citation: 'Md. Code Ann., Bus. Reg. § 8-101 et seq.; COMAR 09.12.50 et seq.',
    notes:
      'Maryland Building Performance Standards apply statewide but counties enforce locally with some variations. MDE approvals also required for many projects.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Massachusetts',
    abbr: 'MA',
    permittingAuthority:
      'Local jurisdiction (building inspector or building commissioner) under state delegation',
    statewideBuildingCode: 'Yes - Massachusetts State Building Code (780 CMR) mandatory statewide',
    adoptedCodes: [
      '780 CMR (based on IBC 2021 with MA amendments)',
      'IRC 2021 (CMR 9th Edition)',
      'IFC 2021',
      'NEC 2020',
      'IECC 2021 (Stretch Energy Code in many communities)',
    ],
    residentialThreshold:
      'All new residential construction requires permit; alterations/additions involving structural or MEP require permit',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions:
      'Minor repairs not involving structural/MEP under $1,000; maintenance items; one-story accessory structures ≤120 sq ft',
    permitFeeStructure:
      'Set by each municipality; BBRS sets minimum standards; typical $X per $1,000 valuation',
    inspectionsRequired: [
      'Foundation/Footing',
      'Framing',
      'Rough MEP',
      'Insulation',
      'Blower door test (residential energy)',
      'Final',
    ],
    stateBuildingOffice: 'Massachusetts Board of Building Regulations and Standards (BBRS) - BBRS',
    stateBuildingUrl: 'https://www.mass.gov/building-code',
    citation: 'M.G.L. c. 143, § 93-100; 780 CMR',
    notes:
      'Massachusetts has a strong statewide building code. Many communities have adopted the Stretch Energy Code with more stringent energy requirements. Seismic requirements apply. BBRS reviews and updates code.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Michigan',
    abbr: 'MI',
    permittingAuthority:
      'Local jurisdiction (city, township, or county); LARA for state building code oversight',
    statewideBuildingCode: 'Yes - Michigan Building Code (MBC) mandatory statewide based on IBC',
    adoptedCodes: [
      'MBC (IBC 2015 with MI amendments)',
      'MRC (IRC 2015)',
      'IFC 2015',
      'NEC 2017',
      'Michigan Energy Code (based on IECC 2015 with amendments)',
    ],
    residentialThreshold:
      'All new residential construction requires permit; alterations/additions above $10,000 or involving structural/MEP require permit',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions:
      'Agricultural buildings; minor repairs under $10,000 not affecting structural integrity or MEP systems',
    permitFeeStructure:
      'Varies by local unit; state-authorized fee schedule; typically based on construction value',
    inspectionsRequired: ['Footer/Foundation', 'Framing', 'Rough MEP', 'Insulation', 'Final'],
    stateBuildingOffice:
      'Michigan Department of Licensing and Regulatory Affairs (LARA) - Bureau of Construction Codes (BCC)',
    stateBuildingUrl: 'https://www.michigan.gov/lara/divisions-agencies/bcc',
    citation: 'MCL § 125.1501 et seq. (Construction Code Act)',
    notes:
      'Michigan Bureau of Construction Codes provides oversight of the statewide building code program. Local governments are agents of the state for code enforcement.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Minnesota',
    abbr: 'MN',
    permittingAuthority: 'Local jurisdiction (city or county) under state delegation',
    statewideBuildingCode: 'Yes - Minnesota State Building Code (MSBC) mandatory statewide',
    adoptedCodes: [
      'MSBC (IBC 2020 with MN amendments)',
      'Minnesota Residential Code (IRC 2020)',
      'IFC 2018',
      'NEC 2020',
      'Minnesota Energy Code (IECC 2021 with MN amendments)',
    ],
    residentialThreshold:
      'All new residential construction requires permit; alterations/additions requiring structural changes or MEP permit',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions:
      'Agricultural buildings; farm homes (partial); garages and accessory structures under 200 sq ft with no utilities',
    permitFeeStructure:
      'Set by each municipality; state has minimum fee schedule; typical based on valuation',
    inspectionsRequired: ['Footings', 'Foundation', 'Framing', 'Rough MEP', 'Insulation', 'Final'],
    stateBuildingOffice:
      'Minnesota Department of Labor and Industry (DLI) - Construction Codes and Licensing',
    stateBuildingUrl: 'https://www.dli.mn.gov/construction-codes-and-licensing',
    citation: 'Minn. Stat. § 326B.02 et seq. (Minnesota State Building Code)',
    notes:
      'Minnesota has a strong statewide code program. State Building Official oversees local enforcement. Snow load and cold climate construction requirements are significant.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Mississippi',
    abbr: 'MS',
    permittingAuthority:
      'Local jurisdiction (city or county); no mandatory statewide code for private buildings',
    statewideBuildingCode:
      'Partial - State Board of Health enforces code for certain facilities; IBC adopted by many municipalities voluntarily',
    adoptedCodes: [
      'IBC 2015 (Jackson and major cities)',
      'IRC 2015',
      'NEC 2017',
      'Local codes vary significantly',
    ],
    residentialThreshold: 'Varies by jurisdiction; many rural areas have no permit requirement',
    commercialThreshold: 'Commercial permits required in incorporated areas with codes',
    exemptions: 'Many unincorporated rural areas have no permit system',
    permitFeeStructure: 'Varies by jurisdiction; many rural areas have no fee structure',
    inspectionsRequired: ['Varies by jurisdiction'],
    stateBuildingOffice:
      'Mississippi State Fire Marshal Office (fire code); no statewide building code office',
    stateBuildingUrl: 'https://www.mid.ms.gov/fire-marshal',
    citation: 'Miss. Code Ann. § 75-76-1 et seq.; local municipal codes',
    notes:
      'Mississippi does not have a statewide building code mandate for local governments. Code adoption and enforcement varies widely by locality. Coastal areas have enhanced wind and flood requirements.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Missouri',
    abbr: 'MO',
    permittingAuthority: 'Local jurisdiction (city or county)',
    statewideBuildingCode:
      'Partial - State Fire Marshal enforces fire code; no statewide building code mandate for local governments',
    adoptedCodes: [
      'IBC 2018 (Kansas City, St. Louis metro)',
      'IRC 2018',
      'IFC 2018 (statewide)',
      'NEC 2020',
      'Local codes vary',
    ],
    residentialThreshold:
      'Permit required in most municipalities; rural areas may have no requirement',
    commercialThreshold: 'All commercial construction requires permit in municipalities',
    exemptions: 'Agricultural buildings; unincorporated areas without local codes; minor repairs',
    permitFeeStructure: 'Varies by jurisdiction',
    inspectionsRequired: ['Foundation', 'Framing', 'Rough MEP', 'Final'],
    stateBuildingOffice: 'Missouri Division of Fire Safety',
    stateBuildingUrl: 'https://dfs.dps.mo.gov',
    citation: 'Mo. Rev. Stat. § 320.010 et seq. (Fire Marshal); local municipal codes',
    notes:
      'Missouri has no statewide building code mandate. Code adoption by localities varies. St. Louis and Kansas City metro areas have comprehensive permit programs.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Montana',
    abbr: 'MT',
    permittingAuthority:
      'Local jurisdiction; Montana Building Codes Bureau for commercial permits in many areas',
    statewideBuildingCode:
      'Yes - Montana Building Codes Act provides statewide code; administered by MBCC',
    adoptedCodes: ['IBC 2021', 'IRC 2021', 'IFC 2021', 'NEC 2020', 'IECC 2021'],
    residentialThreshold:
      'All new residential construction requires permit; many rural areas rely on state permit office',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions:
      'Agricultural buildings; single-family homes on agricultural land (partial); farm buildings',
    permitFeeStructure:
      'Montana Building Codes Bureau: fee schedule based on construction value; local jurisdictions vary',
    inspectionsRequired: ['Foundation', 'Framing', 'Rough MEP', 'Insulation', 'Final'],
    stateBuildingOffice: 'Montana Department of Labor and Industry (DLI) - Building Codes Bureau',
    stateBuildingUrl: 'https://dli.mt.gov/building-codes',
    citation: 'Mont. Code Ann. § 50-60-101 et seq.',
    notes:
      'Montana has a statewide building code program. In areas without local enforcement, Montana Building Codes Bureau provides permit and inspection services.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Nebraska',
    abbr: 'NE',
    permittingAuthority: 'Local jurisdiction (city or county); State Fire Marshal for fire code',
    statewideBuildingCode:
      'Partial - State Fire Marshal enforces fire code; no mandatory statewide building code for local governments',
    adoptedCodes: [
      'IBC 2018 (Omaha, Lincoln)',
      'IRC 2018',
      'IFC 2018 (statewide fire)',
      'NEC 2020',
      'Local codes vary',
    ],
    residentialThreshold: 'Varies by jurisdiction; permit required in most cities and villages',
    commercialThreshold: 'All commercial construction requires permit in incorporated areas',
    exemptions: 'Agricultural buildings; unincorporated areas; minor maintenance',
    permitFeeStructure: 'Varies by jurisdiction',
    inspectionsRequired: ['Foundation', 'Framing', 'Rough MEP', 'Final'],
    stateBuildingOffice: 'Nebraska State Fire Marshal',
    stateBuildingUrl: 'https://sfm.nebraska.gov',
    citation: 'Neb. Rev. Stat. § 81-502 et seq. (State Fire Marshal); local codes',
    notes:
      'Nebraska does not have a statewide building code mandate for local governments. Major metro areas (Omaha, Lincoln) have comprehensive permit programs.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Nevada',
    abbr: 'NV',
    permittingAuthority: 'Local jurisdiction (city or county)',
    statewideBuildingCode:
      'Yes - Nevada Revised Statutes require adoption of model codes by local governments; State Public Works Division for state buildings',
    adoptedCodes: [
      'IBC 2018 (Clark, Washoe, other counties)',
      'IRC 2018',
      'IFC 2018',
      'NEC 2020',
      'IECC 2018',
    ],
    residentialThreshold:
      'All new residential construction requires permit; alterations/additions above $1,500 typically require permit',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions:
      'Agricultural buildings; detached accessory structures under 200 sq ft (varies by jurisdiction)',
    permitFeeStructure:
      'Varies by county; Clark County (Las Vegas): significant fee schedule; Washoe County (Reno): moderate fees',
    inspectionsRequired: ['Foundation', 'Framing', 'Rough MEP', 'Insulation', 'Final'],
    stateBuildingOffice:
      'Nevada State Public Works Division for state facilities; local jurisdictions for private construction',
    stateBuildingUrl: 'https://spwd.nv.gov',
    citation: 'NRS § 278.580 et seq. (building codes); NRS § 444.430 (manufactured housing)',
    notes:
      'Nevada requires local governments to adopt the model codes. Seismic and high wind requirements apply in many areas. Clark County (Las Vegas) processes very high permit volumes.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'New Hampshire',
    abbr: 'NH',
    permittingAuthority: 'Local jurisdiction (city or town building inspector)',
    statewideBuildingCode:
      'Yes - New Hampshire Building Code (based on IBC) required for commercial; residential code for 1-2 family dwellings',
    adoptedCodes: [
      'IBC 2015 (with NH amendments, commercial)',
      'IRC 2015 (residential 1-2 family)',
      'IFC 2015',
      'NEC 2017',
      'IECC 2015',
    ],
    residentialThreshold:
      'All new residential construction requires permit; alterations/additions involving structural or MEP require permit',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions: 'Minor repairs under $5,000; agricultural buildings; maintenance items',
    permitFeeStructure: 'Varies by municipality; typically based on construction value',
    inspectionsRequired: ['Foundation', 'Framing', 'Rough MEP', 'Insulation', 'Final'],
    stateBuildingOffice:
      'New Hampshire Office of Professional Licensure and Certification (OPLC) - State Building Code Review Board',
    stateBuildingUrl: 'https://www.oplc.nh.gov',
    citation: 'RSA 155-A (New Hampshire Building Code); RSA 674 (Local Land Use)',
    notes:
      'New Hampshire adopted the NH Building Code for statewide commercial construction. Local zoning also applies.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'New Jersey',
    abbr: 'NJ',
    permittingAuthority:
      'Local jurisdiction (municipal construction official) under state oversight',
    statewideBuildingCode: 'Yes - New Jersey Uniform Construction Code (UCC) mandatory statewide',
    adoptedCodes: [
      'NJUCC (based on IBC 2021 with NJ amendments)',
      'NJ Residential Subcode (IRC based)',
      'NJ Fire Prevention Code (IFC based)',
      'NEC 2020',
      'NJ Energy Subcode (IECC based)',
    ],
    residentialThreshold:
      'All new residential construction requires permit; alterations/additions above $5,000 or involving structural/MEP require permit',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions:
      'Minor repairs under $500; maintenance items; painting and decorating; detached accessory structures ≤200 sq ft with no utilities (some jurisdictions)',
    permitFeeStructure:
      'NJ DCA establishes fee schedule; complex: based on use group, construction type, area, equipment',
    inspectionsRequired: ['Foundation/Footing', 'Framing', 'Rough MEP', 'Insulation', 'Final'],
    stateBuildingOffice:
      'New Jersey Department of Community Affairs (NJDCA) - Division of Codes and Standards',
    stateBuildingUrl: 'https://www.nj.gov/dca/codes',
    citation: 'N.J.S.A. 52:27D-119 et seq. (UCC Act)',
    notes:
      'New Jersey UCC is administered by DCA with local enforcement. Very comprehensive system with multiple subcodes (building, fire, electrical, plumbing, energy). State DOE energy code applies.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'New Mexico',
    abbr: 'NM',
    permittingAuthority: 'Local jurisdiction or State Construction Industries Division (CID)',
    statewideBuildingCode:
      'Yes - New Mexico Construction Industries Code mandatory statewide; CID administers',
    adoptedCodes: [
      'IBC 2018 (with NM amendments)',
      'IRC 2018',
      'IFC 2018',
      'NEC 2017',
      'NM Energy Conservation Code (IECC 2018 based)',
    ],
    residentialThreshold:
      'All new residential construction requires permit; alterations/additions above $5,000 typically require permit',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions: 'Agricultural buildings; temporary construction trailers; minor repairs',
    permitFeeStructure:
      'CID: based on construction value; local jurisdictions may have additional fees',
    inspectionsRequired: ['Foundation', 'Framing', 'Rough MEP', 'Insulation', 'Final'],
    stateBuildingOffice:
      'New Mexico Regulation and Licensing Department - Construction Industries Division (CID)',
    stateBuildingUrl: 'https://www.rld.nm.gov/construction-industries',
    citation: 'NMSA § 60-13-1 et seq. (Construction Industries Licensing Act)',
    notes:
      'New Mexico CID has statewide authority for construction permits and inspections. In areas without local enforcement, CID is the default permitting authority.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'New York',
    abbr: 'NY',
    permittingAuthority:
      'Local jurisdiction (city, town, or village building department); NYC has own Department of Buildings',
    statewideBuildingCode:
      'Yes - New York State Uniform Fire Prevention and Building Code (Uniform Code) mandatory statewide',
    adoptedCodes: [
      'Uniform Code (IBC 2020 based with NY amendments)',
      'IRC 2020',
      'IFC 2020',
      'NEC 2020',
      'NY Energy Conservation Construction Code (IECC 2021 with NY amendments)',
    ],
    residentialThreshold:
      'All new residential construction requires permit; alterations/additions above $20,000 or involving structural/MEP require permit in most jurisdictions',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions:
      'Minor repairs under $20,000 (varies by locality); maintenance items; agricultural buildings on agricultural land',
    permitFeeStructure:
      'Varies by jurisdiction; NYC has complex fee schedule; upstate jurisdictions vary widely',
    inspectionsRequired: [
      'Foundation/Footing',
      'Framing',
      'Rough MEP',
      'Insulation',
      'Final',
      'Certificate of Occupancy',
    ],
    stateBuildingOffice:
      'New York State Department of State - Division of Building Standards and Codes',
    stateBuildingUrl: 'https://www.dos.ny.gov/dcea/buildingcodes',
    citation: 'Executive Law § 370 et seq. (Uniform Fire Prevention and Building Code Act)',
    notes:
      'New York City uses its own NYC Building Code (locally enacted but generally consistent with Uniform Code). NYC has particularly complex permit requirements for major construction (Directive 14, etc.).',
    lastVerified: '2026-01-01',
  },
  {
    state: 'North Carolina',
    abbr: 'NC',
    permittingAuthority: 'Local jurisdiction (county or city building inspection department)',
    statewideBuildingCode: 'Yes - North Carolina State Building Code mandatory statewide',
    adoptedCodes: [
      'NC Building Code (IBC 2018 with NC amendments)',
      'NC Residential Code (IRC 2018)',
      'NC Fire Prevention Code (IFC 2018)',
      'NEC 2020',
      'NC Energy Conservation Code (IECC 2021 with NC amendments)',
    ],
    residentialThreshold:
      'All new residential construction requires permit; alterations/additions above $15,000 or involving structural/MEP require permit',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions:
      'Agricultural buildings; detached residential accessory structures ≤12 sq ft; temporary structures',
    permitFeeStructure:
      'Varies by county; NC sets fee schedules; typically $X per $1,000 construction value',
    inspectionsRequired: ['Footings', 'Foundation', 'Framing', 'Rough MEP', 'Insulation', 'Final'],
    stateBuildingOffice:
      'North Carolina Department of Insurance - Engineering Division (Building Code)',
    stateBuildingUrl: 'https://www.ncdoi.gov/engineering',
    citation: 'N.C. Gen. Stat. § 160D-1101 et seq. (NC State Building Code)',
    notes:
      'NC State Building Code is enforced by county and municipal building inspection departments. State Building Code Council adopts the code. Coastal areas have enhanced hurricane construction requirements.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'North Dakota',
    abbr: 'ND',
    permittingAuthority:
      'Local jurisdiction; ND State Plumbing Board and Electrical Board for trades',
    statewideBuildingCode:
      'Partial - No mandatory statewide building code; IFC adopted by State Fire Marshal; specialty trades regulated statewide',
    adoptedCodes: [
      'IBC 2018 (Fargo, Bismarck, Grand Forks)',
      'IFC 2018 (statewide fire)',
      'NEC 2020 (statewide electrical)',
      'Local codes vary',
    ],
    residentialThreshold:
      'Varies by jurisdiction; many rural areas have no building permit requirement',
    commercialThreshold: 'Commercial permits required in incorporated areas',
    exemptions: 'Agricultural buildings; many rural unincorporated areas; minor repairs',
    permitFeeStructure: 'Varies by jurisdiction',
    inspectionsRequired: ['Varies by jurisdiction'],
    stateBuildingOffice:
      'North Dakota State Fire Marshal (fire); no statewide building code office',
    stateBuildingUrl: 'https://www.nd.gov/sfm',
    citation: 'NDCC § 23-01-37 (State Fire Code); local municipal codes',
    notes:
      'North Dakota does not have a mandatory statewide building code. Urban areas have adopted codes; rural areas may have minimal requirements.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Ohio',
    abbr: 'OH',
    permittingAuthority:
      'Local jurisdiction; OBBC for commercial permits in areas without local department',
    statewideBuildingCode:
      'Yes - Ohio Building Code (OBC) mandatory statewide for commercial/non-residential; local code for residential',
    adoptedCodes: [
      'OBC (IBC 2017 with OH amendments)',
      'ORCA (Ohio Residential Code)',
      'Ohio Fire Code (IFC 2017)',
      'NEC 2017',
      'Ohio Energy Code (IECC 2017)',
    ],
    residentialThreshold:
      'All new residential construction requires permit from local building department; alterations/additions above $5,000 or involving structural/MEP require permit',
    commercialThreshold:
      'All commercial/non-residential construction requires state or local permit under OBC',
    exemptions:
      'Agricultural buildings; detached accessory residential structures under 200 sq ft; minor repairs under $5,000',
    permitFeeStructure:
      'Varies by jurisdiction; OBBC fees: based on construction value and use group',
    inspectionsRequired: [
      'Foundation/Footing',
      'Slab',
      'Framing',
      'Rough MEP',
      'Insulation',
      'Final',
    ],
    stateBuildingOffice:
      'Ohio Board of Building Standards (BBS) / Ohio Building Professional Association (OBPA)',
    stateBuildingUrl:
      'https://com.ohio.gov/divisions-and-programs/industrial-compliance/boards/board-of-building-standards',
    citation: 'ORC § 3781.01 et seq. (Building Standards)',
    notes:
      'Ohio has a statewide commercial building code (OBC). Residential code enforced locally. Ohio has detailed plan review and inspection requirements.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Oklahoma',
    abbr: 'OK',
    permittingAuthority:
      'Local jurisdiction (city or county); no mandatory statewide code for all buildings',
    statewideBuildingCode:
      'Partial - Oklahoma Uniform Building Code Commission (UBCC) adopts codes; adoption by localities is voluntary for some code types',
    adoptedCodes: [
      'IBC 2018 (Oklahoma City, Tulsa)',
      'IRC 2018',
      'IFC 2018',
      'NEC 2020',
      'Local codes vary',
    ],
    residentialThreshold:
      'Permit required in most municipalities; rural areas may have no requirement',
    commercialThreshold: 'All commercial construction requires permit in incorporated areas',
    exemptions: 'Agricultural buildings; unincorporated areas without local codes; minor repairs',
    permitFeeStructure: 'Varies by jurisdiction',
    inspectionsRequired: ['Foundation', 'Framing', 'Rough MEP', 'Final'],
    stateBuildingOffice: 'Oklahoma Uniform Building Code Commission (UBCC)',
    stateBuildingUrl: 'https://www.ok.gov/ubcc',
    citation: '74 O.S. § 324.1 et seq. (UBCC Act)',
    notes:
      'Oklahoma UBCC establishes codes that local governments may adopt. Tornado construction requirements are increasingly common. Some municipalities have adopted enhanced standards.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Oregon',
    abbr: 'OR',
    permittingAuthority:
      'Local jurisdiction under BCD oversight; Oregon Building Codes Division (BCD) for state oversight',
    statewideBuildingCode: 'Yes - Oregon Structural Specialty Code (OSSC) mandatory statewide',
    adoptedCodes: [
      'OSSC (IBC 2021 with OR amendments)',
      'ORSC (IRC 2021)',
      'Oregon Fire Code (OFC)',
      'NEC 2020',
      'OEESC (IECC 2021 based energy code)',
    ],
    residentialThreshold:
      'All new residential construction requires permit; alterations/additions above $1,000 or involving structural/MEP require permit',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions:
      'Agricultural buildings; detached accessory structures ≤200 sq ft with no plumbing or electrical; temporary structures',
    permitFeeStructure:
      'State sets fee schedule components; local jurisdictions may add surcharges; typical $X per $1,000 valuation',
    inspectionsRequired: [
      'Foundation/Footing',
      'Framing',
      'Rough MEP',
      'Insulation',
      'Energy',
      'Final',
    ],
    stateBuildingOffice:
      'Oregon Department of Consumer and Business Services (DCBS) - Building Codes Division (BCD)',
    stateBuildingUrl: 'https://www.oregon.gov/bcd',
    citation: 'ORS § 455.010 et seq. (Building Codes)',
    notes:
      'Oregon has a comprehensive statewide building code program. BCD provides oversight; local municipalities are agents for enforcement. Oregon Energy Efficiency Specialty Code (OEESC) applies.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Pennsylvania',
    abbr: 'PA',
    permittingAuthority:
      'Local jurisdiction; DLI for commercial permits in municipalities without local inspection',
    statewideBuildingCode:
      'Yes - Pennsylvania Construction Code Act (Uniform Construction Code / UCC) mandatory statewide',
    adoptedCodes: [
      'PA UCC (IBC 2018 with PA amendments)',
      'PA Residential Code (IRC 2018)',
      'IFC 2018',
      'NEC 2017',
      'PA Energy Code (IECC 2021)',
    ],
    residentialThreshold:
      'All new residential construction requires permit; alterations/additions above $5,000 or involving structural/MEP require permit',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions:
      'Agricultural buildings; certain detached residential accessory structures; mining operations; temporary construction trailers',
    permitFeeStructure:
      'State-established fee schedule; $X per $1,000 valuation; counties may charge additional',
    inspectionsRequired: [
      'Foundation/Footing',
      'Slab/Rough Floor',
      'Framing',
      'Rough MEP',
      'Insulation',
      'Final',
    ],
    stateBuildingOffice:
      'Pennsylvania Department of Labor and Industry (DLI) - Building Code Division',
    stateBuildingUrl: 'https://www.dli.pa.gov/Individuals/Construction-Codes-Safety/ucc',
    citation: '34 Pa.C.S. § 7101 et seq. (Uniform Construction Code Act)',
    notes:
      'Pennsylvania enacted the UCC in 1999 to create statewide code. Municipalities are responsible for enforcement. DLI is the default permitting authority in municipalities that have not opted in.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Rhode Island',
    abbr: 'RI',
    permittingAuthority:
      'Local jurisdiction (city or town building official) under state oversight',
    statewideBuildingCode: 'Yes - Rhode Island State Building Code mandatory statewide',
    adoptedCodes: [
      'RI Building Code (IBC 2018 with RI amendments)',
      'RI One and Two Family Dwelling Code (IRC 2018)',
      'RI Fire Code',
      'NEC 2020',
      'RI Energy Conservation Code (IECC 2021)',
    ],
    residentialThreshold:
      'All new residential construction requires permit; alterations/additions above $5,000 or involving structural/MEP require permit',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions: 'Minor repairs under $5,000; agricultural buildings; maintenance items',
    permitFeeStructure: 'Set by each municipality; state recommends fee schedule',
    inspectionsRequired: ['Foundation', 'Framing', 'Rough MEP', 'Insulation', 'Final'],
    stateBuildingOffice:
      'Rhode Island Department of Business Regulation (DBR) - Building Code Standards Committee (BCSC)',
    stateBuildingUrl: 'https://dbr.ri.gov',
    citation: 'R.I. Gen. Laws § 23-27.3-1 et seq. (State Building Code)',
    notes: '',
    lastVerified: '2026-01-01',
  },
  {
    state: 'South Carolina',
    abbr: 'SC',
    permittingAuthority: 'Local jurisdiction; SCLLR for fire code and certain specialty permits',
    statewideBuildingCode: 'Yes - South Carolina Building Code (based on IBC) mandatory statewide',
    adoptedCodes: [
      'SC Building Code (IBC 2018 with SC amendments)',
      'IRC 2018',
      'SC Fire Code (IFC 2018)',
      'NEC 2017',
      'SC Energy Conservation Code (IECC 2018)',
    ],
    residentialThreshold:
      'All new residential construction requires permit; alterations/additions above $5,000 or involving structural/MEP require permit',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions:
      'Agricultural buildings; detached accessory structures under 200 sq ft; minor repairs',
    permitFeeStructure: 'Varies by county; typically based on construction value',
    inspectionsRequired: ['Foundation/Footing', 'Framing', 'Rough MEP', 'Insulation', 'Final'],
    stateBuildingOffice:
      'South Carolina Department of Labor, Licensing and Regulation (LLR) - Building Codes Division',
    stateBuildingUrl: 'https://llr.sc.gov/bc',
    citation: 'S.C. Code Ann. § 6-9-10 et seq. (South Carolina Building Codes)',
    notes:
      'South Carolina has a statewide building code. Coastal areas (coastal zone) have additional flood and wind construction requirements. Berkeley, Charleston, Dorchester counties in particular have strong enforcement.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'South Dakota',
    abbr: 'SD',
    permittingAuthority: 'Local jurisdiction; State Fire Marshal for fire code',
    statewideBuildingCode:
      'Partial - State Fire Prevention Code mandatory; no mandatory statewide building code for all buildings',
    adoptedCodes: [
      'IBC 2018 (Sioux Falls, Rapid City)',
      'IFC 2018 (state fire code)',
      'NEC 2020 (statewide electrical)',
      'Local codes vary',
    ],
    residentialThreshold:
      'Varies by jurisdiction; many rural areas have no building permit requirement',
    commercialThreshold: 'Commercial permits required in incorporated areas',
    exemptions: 'Agricultural buildings; many rural unincorporated areas; minor repairs',
    permitFeeStructure: 'Varies by jurisdiction',
    inspectionsRequired: ['Varies by jurisdiction'],
    stateBuildingOffice: 'South Dakota State Fire Marshal',
    stateBuildingUrl: 'https://dps.sd.gov/fire-marshal',
    citation: 'SDCL § 34-29B (State Fire Prevention Code); local codes',
    notes:
      'South Dakota does not have a mandatory statewide building code for local governments. Code adoption varies by locality.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Tennessee',
    abbr: 'TN',
    permittingAuthority:
      'Local jurisdiction; TSBCE for commercial; State Fire Marshal for fire code',
    statewideBuildingCode:
      'Yes - Tennessee Building Codes mandatory statewide for commercial; residential through DARC',
    adoptedCodes: [
      'IBC 2018 (TN SBC for commercial)',
      'IRC 2018 (TN RC for residential)',
      'IFC 2018',
      'NEC 2020',
      'IECC 2021',
    ],
    residentialThreshold:
      'All new residential construction requires permit; alterations above $5,000 or structural/MEP work requires permit',
    commercialThreshold:
      'All commercial construction requires state permit through local enforcement',
    exemptions: 'Agricultural buildings; detached accessory structures under 144 sq ft',
    permitFeeStructure: 'Varies by county; TSBCE: $X per sq ft for commercial review',
    inspectionsRequired: ['Foundation', 'Framing', 'Rough MEP', 'Insulation', 'Final'],
    stateBuildingOffice:
      'Tennessee State Building Commission (TSBC) and Department of Commerce and Insurance (DCI) - Fire Prevention Division',
    stateBuildingUrl: 'https://www.tn.gov/commerce/fire-prevention.html',
    citation: 'TCA § 68-120-101 et seq. (Tennessee Building and Fire Prevention Code)',
    notes:
      'Tennessee adopted statewide building codes with the Tennessee Building and Fire Prevention Code. Both residential and commercial codes are mandatory statewide with local enforcement.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Texas',
    abbr: 'TX',
    permittingAuthority:
      'Local jurisdiction (city); no state-mandated building permit for unincorporated areas',
    statewideBuildingCode:
      'Partial - State Fire Marshal for fire code; TDLR for accessibility (TAS); no mandatory statewide building code',
    adoptedCodes: [
      'IBC 2015 (Houston, Dallas, Austin; each may amend locally)',
      'IRC 2015',
      'NEC 2017',
      'Texas Accessibility Standards (TAS - statewide)',
      'IECC 2015',
    ],
    residentialThreshold:
      'Varies by city; all major cities require permits for new construction; no state requirement for unincorporated areas',
    commercialThreshold:
      'All commercial construction requires permit in incorporated areas; TDLR requires registration of commercial construction for accessibility review',
    exemptions:
      'Unincorporated county areas (counties have no permit authority in Texas except for some platted subdivisions); agricultural buildings; certain temporary structures',
    permitFeeStructure: 'Varies significantly by city; no state fee structure',
    inspectionsRequired: ['Foundation', 'Framing', 'Rough MEP', 'Final'],
    stateBuildingOffice:
      'Texas Department of Licensing and Regulation (TDLR) - Architectural Barriers',
    stateBuildingUrl: 'https://www.tdlr.texas.gov',
    citation: "Tex. Gov't Code § 469 (accessibility); local municipal codes",
    notes:
      'Texas counties cannot require building permits by state law. Texas municipalities regulate building through local codes. TDLR requires registration and inspection of all commercial construction projects for accessibility compliance (Texas Accessibility Standards). Significant variation among cities.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Utah',
    abbr: 'UT',
    permittingAuthority:
      'Local jurisdiction; DOPL for contractor licensing; SEOC for state buildings',
    statewideBuildingCode: 'Yes - Utah Building Code mandatory statewide',
    adoptedCodes: [
      'IBC 2021 (with UT amendments)',
      'IRC 2021',
      'IFC 2021',
      'NEC 2020',
      'Utah Energy Code (IECC 2021)',
    ],
    residentialThreshold:
      'All new residential construction requires permit; alterations/additions above $1,000 or involving structural/MEP require permit',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions:
      'Agricultural buildings; detached accessory structures under 200 sq ft; minor repairs under $1,000',
    permitFeeStructure: 'Varies by jurisdiction; state sets minimum standards',
    inspectionsRequired: ['Foundation', 'Framing', 'Rough MEP', 'Insulation', 'Final'],
    stateBuildingOffice:
      'Utah Division of Facilities and Construction Management (DFCM) for state buildings; local jurisdictions for private',
    stateBuildingUrl: 'https://dfcm.utah.gov',
    citation: 'Utah Code § 15A-1-101 et seq. (Utah Construction and Fire Code Act)',
    notes:
      'Utah adopted the Utah Construction and Fire Codes Act to standardize codes statewide. Updates follow model code cycles. Seismic requirements apply along Wasatch Front.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Vermont',
    abbr: 'VT',
    permittingAuthority:
      'Local jurisdiction for most projects; Act 250 for larger development; BISHCA for some project types',
    statewideBuildingCode:
      'Yes - Vermont Residential Building Energy Standards (RBES) mandatory; commercial energy code mandatory; fire code statewide',
    adoptedCodes: [
      'VT Residential Building Energy Standards (RBES)',
      'IBC 2018 (adopted by most municipalities)',
      'VT Fire and Building Safety Code (IFC based)',
      'NEC 2020',
      'ASHRAE 90.1 2019 (commercial energy)',
    ],
    residentialThreshold:
      'All new residential construction requires permit; alterations/additions above $1,000 or involving structural/MEP require permit; Act 250 for developments >1 acre or >10 units',
    commercialThreshold:
      'All commercial construction requires permit; Act 250 applies to commercial projects above threshold',
    exemptions:
      'Agricultural buildings; minor maintenance; small additions under certain thresholds',
    permitFeeStructure: 'Set by each municipality; Act 250 application fees additional',
    inspectionsRequired: [
      'Foundation',
      'Framing',
      'Rough MEP',
      'Insulation',
      'Blower door test (RBES)',
      'Final',
    ],
    stateBuildingOffice: 'Vermont Department of Public Safety - Division of Fire Safety',
    stateBuildingUrl: 'https://dps.vermont.gov/firesafety',
    citation: '20 V.S.A. § 2901 et seq. (Fire Safety); 10 V.S.A. § 6001 et seq. (Act 250)',
    notes:
      'Vermont Act 250 is a major land use permit that applies to significant development projects statewide. Vermont RBES requires blower door testing and energy verification for residential construction.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Virginia',
    abbr: 'VA',
    permittingAuthority:
      'Local jurisdiction (county or city building official) under DHCD oversight',
    statewideBuildingCode:
      'Yes - Virginia Uniform Statewide Building Code (USBC) mandatory statewide',
    adoptedCodes: [
      'VUSBC (IBC 2018 with VA amendments)',
      'VRRC (IRC 2018 with VA amendments)',
      'VFPC (IFC 2018)',
      'NEC 2020',
      'VECC (IECC 2021)',
    ],
    residentialThreshold:
      'All new residential construction requires permit; alterations/additions above $5,000 or involving structural/MEP require permit',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions:
      'Agricultural buildings; detached accessory structures under 256 sq ft in some localities; minor repairs under $1,000',
    permitFeeStructure: 'Varies by locality; DHCD sets minimum fee schedule',
    inspectionsRequired: ['Foundation/Footing', 'Framing', 'Rough MEP', 'Insulation', 'Final'],
    stateBuildingOffice:
      'Virginia Department of Housing and Community Development (DHCD) - Building and Fire Regulation',
    stateBuildingUrl: 'https://www.dhcd.virginia.gov/buildingcodes',
    citation: 'Code of Va. § 36-97 et seq. (USBC)',
    notes:
      "Virginia USBC is one of the strongest statewide code programs. DHCD is the Board of Housing and Community Development's administrative agency. The Code requires re-inspection fees and detailed documentation.",
    lastVerified: '2026-01-01',
  },
  {
    state: 'Washington',
    abbr: 'WA',
    permittingAuthority: 'Local jurisdiction (city or county) under SBCC oversight',
    statewideBuildingCode: 'Yes - Washington State Building Code (WSBC) mandatory statewide',
    adoptedCodes: [
      'IBC 2021 (with WA amendments)',
      'IRC 2021',
      'IFC 2021',
      'NEC 2020',
      'Washington State Energy Code (WSEC 2021 - IECC based with significant WA amendments)',
    ],
    residentialThreshold:
      'All new residential construction requires permit; alterations/additions above $2,000 or involving structural/MEP require permit',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions:
      'Agricultural structures; detached accessory structures ≤200 sq ft (some jurisdictions); minor repairs',
    permitFeeStructure:
      'Varies by jurisdiction; WSBC sets minimum standards; major cities charge premium fees',
    inspectionsRequired: [
      'Foundation',
      'Framing',
      'Rough MEP',
      'Insulation',
      'Energy compliance',
      'Final',
    ],
    stateBuildingOffice: 'Washington State Building Code Council (SBCC)',
    stateBuildingUrl: 'https://sbcc.wa.gov',
    citation: 'RCW § 19.27 (State Building Code Act); RCW § 19.27A (Washington State Energy Code)',
    notes:
      'Washington has one of the most stringent energy codes in the nation (WSEC). Seismic requirements significant throughout state. SBCC adopts and updates state building codes on regular cycle.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'West Virginia',
    abbr: 'WV',
    permittingAuthority:
      'Local jurisdiction; State Fire Marshal for fire code; WVDO for commercial in some areas',
    statewideBuildingCode:
      'Partial - State Fire Code mandatory; WV State Building Code for commercial/multi-family; local residential codes vary',
    adoptedCodes: [
      'IBC 2018 (commercial)',
      'IRC 2018 (residential, most areas)',
      'IFC 2018 (statewide fire)',
      'NEC 2020',
      'IECC 2018',
    ],
    residentialThreshold:
      'All new residential construction requires permit in municipalities; rural areas vary',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions:
      'Agricultural buildings; single-family homes in some rural unincorporated areas; minor repairs',
    permitFeeStructure: 'Varies by county',
    inspectionsRequired: ['Foundation', 'Framing', 'Rough MEP', 'Final'],
    stateBuildingOffice: 'West Virginia Division of Labor (WVDO) - Building Code',
    stateBuildingUrl: 'https://labor.wv.gov',
    citation: 'W. Va. Code § 29-3-1 et seq. (State Fire Code); § 21-11-1 (building contractors)',
    notes:
      'West Virginia has a patchwork of building code adoption. Some rural areas have limited building permit requirements.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Wisconsin',
    abbr: 'WI',
    permittingAuthority:
      'Local jurisdiction; DSPS for commercial permits in areas without local inspection',
    statewideBuildingCode:
      'Yes - Wisconsin Commercial Building Code and Residential Building Code mandatory statewide',
    adoptedCodes: [
      'Wis. Commercial Building Code (IBC 2015 with WI amendments)',
      'Wis. Residential Code (IRC 2015)',
      'Wis. Fire Prevention Code (IFC 2015)',
      'NEC 2017',
      'Wisconsin Energy Code (IECC 2015)',
    ],
    residentialThreshold:
      'All new residential construction requires permit; alterations/additions above $5,000 or involving structural/MEP require permit',
    commercialThreshold: 'All commercial construction requires permit',
    exemptions:
      'Agricultural buildings (partial); detached residential garages up to 600 sq ft in some areas; minor repairs',
    permitFeeStructure: 'Varies by municipality; DSPS: based on construction value',
    inspectionsRequired: ['Foundation/Footing', 'Framing', 'Rough MEP', 'Insulation', 'Final'],
    stateBuildingOffice:
      'Wisconsin Department of Safety and Professional Services (DSPS) - Safety and Buildings Division',
    stateBuildingUrl: 'https://dsps.wi.gov',
    citation:
      'Wis. Stat. § 101.01 et seq. (Commercial Building Safety); § 101.60 et seq. (Residential Building Safety)',
    notes:
      'Wisconsin has a comprehensive statewide code. DSPS enforces code in municipalities that opt not to have local inspectors. SBD provides plan review for commercial projects.',
    lastVerified: '2026-01-01',
  },
  {
    state: 'Wyoming',
    abbr: 'WY',
    permittingAuthority: 'Local jurisdiction; State Fire Marshal for fire code',
    statewideBuildingCode:
      'Partial - State Fire Code mandatory; no mandatory statewide building code for local governments',
    adoptedCodes: [
      'IBC 2018 (Cheyenne, Casper)',
      'IFC 2018 (statewide fire)',
      'NEC 2020 (statewide electrical)',
      'Local codes vary',
    ],
    residentialThreshold:
      'Varies by jurisdiction; many rural areas have no building permit requirement',
    commercialThreshold: 'Commercial permits required in incorporated areas',
    exemptions: 'Agricultural buildings; many rural unincorporated areas; minor repairs',
    permitFeeStructure: 'Varies by jurisdiction',
    inspectionsRequired: ['Varies by jurisdiction'],
    stateBuildingOffice: 'Wyoming State Fire Marshal',
    stateBuildingUrl: 'https://wyo.gov/state-agencies/state-fire-marshal',
    citation:
      'Wyo. Stat. § 35-9-101 et seq. (Fire Prevention and Electrical Safety); local municipal codes',
    notes:
      'Wyoming does not have a mandatory statewide building code for all buildings. Individual municipalities adopt codes. Rural areas may have minimal requirements.',
    lastVerified: '2026-01-01',
  },
]
