// Master location dataset — single source of truth for all market pages,
// sitemap, navigation, and schema generation.
// Each entry produces /locations/[slug]

export const PRIMARY_DOMAIN = 'https://www.jwordenasphaltpaving.com';
export const RICHMOND_CENTER = { lat: 37.5407, lng: -77.4360 };
export const RICHMOND_RADIUS_MILES = 90;

export const LOCATIONS = [
  // ──────── VIRGINIA ────────
  {
    slug: 'chester-va',
    city: 'Chester',
    state: 'Virginia',
    stateAbbr: 'VA',
    region: 'Central Virginia',
    geo: { lat: 37.3563, lng: -77.4411 },
    isHeadquarters: true,
    headline: 'Asphalt Paving in Chester, VA — Our Hometown for 40+ Years',
    intro:
      'J. Worden & Sons was founded in Chester, Virginia, and we still run every job from our Ware Bottom Spring Road headquarters. From River\'s Bend driveways to Route 10 commercial lots, this is the community that built us — and the streets we know inch by inch.',
    neighborhoods: [
      'River\'s Bend', 'Bermuda Hundred', 'Enon', 'Curtis', 'Rivers Bend',
      'Meadowville', 'Old Centralia', 'Indian Hill', 'Point of Rocks',
    ],
    landmarks: ['Henricus Historical Park', 'Chesterfield County Airport', 'Route 10 corridor', 'Old Bermuda Hundred Rd'],
    climate: {
      title: 'Chester\'s Tidewater Freeze-Thaw',
      body: 'Chester sits in USDA Zone 7b — winters dip to 15°F and summers crest 95°F. We use a PG 64-22 binder rated for that exact temperature swing, and we mill 2.5″ deep on driveways to outrun the James River basin clay heave.',
    },
    faqs: [
      {
        q: 'Do I need a Chesterfield County permit for a new driveway in Chester?',
        a: 'For new construction or a culvert tie-in to a county road, yes — through Chesterfield Building Inspection. For straight overlay of an existing driveway on private property, typically no. We handle the application paperwork as part of our scope.',
      },
      {
        q: 'My driveway sits on river-bottom clay. Will it heave?',
        a: 'Only if the base prep is wrong. We dig 8–10″ below grade on Bermuda Hundred and River\'s Bend properties, lay a #57 stone subbase with geotextile fabric, then compact in 4″ lifts. Done right, it doesn\'t heave for 25 years.',
      },
      {
        q: 'How fast can you start a Chester project?',
        a: 'We\'re local — most Chester driveways start within 7–10 days of contract signing. HQ trucks are 4 minutes from your house.',
      },
    ],
    reviews: 142,
    rating: 4.9,
  },
  {
    slug: 'richmond-va',
    city: 'Richmond',
    state: 'Virginia',
    stateAbbr: 'VA',
    region: 'Central Virginia',
    geo: { lat: 37.5407, lng: -77.4360 },
    headline: 'Asphalt Paving in Richmond, VA — Local Driveways, Lots, Sealcoating, and Repair',
    intro:
      'Richmond is home-market asphalt for J. Worden & Sons: residential driveways, rural lanes just outside the city, HOA roads, church lots, commercial parking lots, sealcoating, crack repair, pothole patching, milling, and overlays. From The Fan, Church Hill, Scott\'s Addition, and Manchester to Chester, Henrico, Midlothian, Short Pump, and the county-road residential corridors around Richmond, the work starts with local diagnosis and a written scope.',
    neighborhoods: [
      'The Fan', 'Church Hill', 'Shockoe Bottom', 'Scott\'s Addition',
      'Museum District', 'Carytown', 'Manchester', 'Forest Hill',
      'Westover Hills', 'Bellevue', 'Northside',
    ],
    landmarks: ['VCU campus', 'Capital One West Creek', 'Richmond International Raceway', 'Diamond District redevelopment', 'Scott\'s Addition breweries'],
    climate: {
      title: 'James River Freeze-Thaw + Clay Subsoil',
      body: 'Richmond cycles through freeze-thaw 30–40 times each winter, and the city\'s expansive Triassic clay subsoil swells with every wet spell. Standard mixes crack within 3 years. We spec polymer-modified PG 70-22 on commercial work and run 12″ of compacted aggregate base under every parking lot.',
    },
    faqs: [
      {
        q: 'Do you handle Richmond historic district overlay restrictions?',
        a: 'Yes. The Fan, Church Hill, and Jackson Ward have specific surface and edging requirements. We coordinate with Richmond Planning & Development Review and use brick-edged borders or stamped transitions where required.',
      },
      {
        q: 'Can you pave around mature oaks without killing the root system?',
        a: 'We do this constantly in the West End and Bellevue. We use root-bridge construction — a perforated geogrid suspended above the critical root zone — so the oxygen exchange continues. Costs about 20% more than standard but the trees survive.',
      },
      {
        q: 'How do you handle Richmond\'s stormwater runoff requirements?',
        a: 'Lots over 2,500 sq ft trigger Richmond DPU stormwater review. We design with permeable asphalt options or integrate bioswale tie-ins. We submit the SWPPP plan for you.',
      },
      {
        q: 'Do you handle sealcoating and asphalt repair around Richmond?',
        a: 'Yes. Richmond metro sealcoating, crack repair, pothole patching, milling, overlays, and pavement preservation are core services for residential driveways, HOAs, church lots, retail lots, and industrial yards.',
      },
      {
        q: 'What areas around Richmond are priority service markets?',
        a: 'Richmond, Chester, Chesterfield, Henrico, Glen Allen, Short Pump, Midlothian, Bon Air, Tuckahoe, Mechanicsville, Ashland, Petersburg, Hopewell, and nearby rural residential corridors are core local markets.',
      },
    ],
    reviews: 287,
    rating: 4.9,
  },
  {
    slug: 'midlothian-va',
    city: 'Midlothian',
    state: 'Virginia',
    stateAbbr: 'VA',
    region: 'Central Virginia',
    geo: { lat: 37.5068, lng: -77.6488 },
    headline: 'Midlothian, VA Asphalt Paving — Long Driveways Done Right',
    intro:
      'Midlothian properties run long. We\'ve laid 800-foot curved driveways through Brandermill, paved cul-de-sacs in Salisbury, and replaced the asphalt at Westchester Commons. The Midlothian Turnpike corridor has unique sub-grade challenges — and we\'ve solved them since the \'80s.',
    neighborhoods: [
      'Brandermill', 'Woodlake', 'Salisbury', 'Sycamore Square',
      'Hallsley', 'Foxcroft', 'Robious', 'Bon Air', 'Old Buckingham',
    ],
    landmarks: ['Westchester Commons', 'Midlothian Mines Park', 'Robious Landing Park', 'Powhite Parkway terminus'],
    climate: {
      title: 'Midlothian\'s Mica-Schist Geology',
      body: 'The old Midlothian coal seams left a mica-schist subsoil that drains poorly and shifts under load. Standard 2″ overlays fail in 5 years here. We base-prep with crushed bluestone (not gravel) and pour 3″ of binder course before the surface lift.',
    },
    faqs: [
      {
        q: 'My HOA in Brandermill requires written paving specs. Do you provide them?',
        a: 'Yes — we deliver a full submittal packet: mix design, compaction specs, surface drainage plan, and a typical section drawing. Brandermill ARB usually approves within 14 days.',
      },
      {
        q: 'Can you grade a 600-foot driveway with a switchback?',
        a: 'Standard work for us in Hallsley and Salisbury. We laser-grade for a 2% cross-fall and use heated screed equipment to keep mat temperature consistent across the whole run.',
      },
      {
        q: 'Do you do circular driveways with center medians?',
        a: 'Yes. We pave the loop, then frame the center median with 6″ extruded concrete curb and let your landscaper handle the planting bed.',
      },
    ],
    reviews: 96,
    rating: 5.0,
  },
  {
    slug: 'short-pump-va',
    city: 'Short Pump',
    state: 'Virginia',
    stateAbbr: 'VA',
    region: 'Central Virginia',
    geo: { lat: 37.6512, lng: -77.6155 },
    headline: 'Short Pump, VA Paving — Commercial-Grade for Premium Properties',
    intro:
      'Short Pump\'s explosive growth — Town Center, Innsbrook, GreenGate — means high-traffic commercial lots and high-end residential developments. We\'ve done both. Our Innsbrook crew specializes in nighttime parking lot resurfacing so businesses never close.',
    neighborhoods: [
      'Wyndham', 'Hickory Hill', 'GreenGate', 'Twin Hickory',
      'Glen Allen', 'Wellesley', 'Gayton', 'Nuckols Crossing',
    ],
    landmarks: ['Short Pump Town Center', 'Innsbrook corporate campus', 'GreenGate development', 'West Broad Marketplace'],
    climate: {
      title: 'High-Traffic Wear in Suburban Henrico',
      body: 'Short Pump commercial lots see 3,000+ vehicle counts daily — punishing for standard SM-9.5A mixes. We spec SM-12.5D heavy-duty surface course rated for that exact load class, so your lot doesn\'t need re-striping every spring.',
    },
    faqs: [
      {
        q: 'Can you pave a commercial parking lot without closing the business?',
        a: 'Yes — we run nighttime crews for Short Pump retail and Innsbrook offices. Mill at 10 PM, base course by midnight, surface lift by 4 AM, striping by 6. Open at 8.',
      },
      {
        q: 'How long do Short Pump Town Center-grade parking lots last?',
        a: 'A properly built Short Pump commercial lot — 4″ base course + 2.5″ surface, sealed every 3 years — runs 18–22 years before full replacement. We warranty 5 years on workmanship.',
      },
      {
        q: 'Do you stripe to ADA spec?',
        a: 'Every job. We use methyl methacrylate (MMA) striping paint — 8× the lifespan of latex — and certify each ADA stall to current Henrico code.',
      },
    ],
    reviews: 124,
    rating: 4.9,
  },
  {
    slug: 'henrico-va',
    city: 'Henrico',
    state: 'Virginia',
    stateAbbr: 'VA',
    region: 'Central Virginia',
    geo: { lat: 37.5907, lng: -77.4360 },
    headline: 'Henrico County, VA Asphalt Paving — From West End to Eastern Henrico',
    intro:
      'Henrico is two counties in one — the affluent West End around Glen Allen and the industrial corridor along Laburnum and Williamsburg Road. We work both. Whether it\'s a Wyndham driveway or a Sandston warehouse yard, we know the soil, the codes, and the inspectors.',
    neighborhoods: [
      'Glen Allen', 'Tuckahoe', 'Lakeside', 'Highland Springs',
      'Sandston', 'Varina', 'Fair Oaks', 'Brookland',
    ],
    landmarks: ['Richmond International Airport', 'Innsbrook', 'Lewis Ginter Botanical Garden', 'Deep Run Park'],
    climate: {
      title: 'Eastern Henrico\'s Sand-Loam vs. West End Clay',
      body: 'Soil composition flips dramatically across Henrico — West End is plastic Cecil clay, Eastern Henrico runs sandy loam from the old Chickahominy floodplain. Same county, two completely different base prep specs. We test before we dig.',
    },
    faqs: [
      {
        q: 'Do I need a Henrico County permit?',
        a: 'Driveway aprons connecting to county roads require a Henrico DPW permit. Private driveways behind the right-of-way usually do not. Commercial work always does. We pull all permits as part of the scope.',
      },
      {
        q: 'Can you handle the airport-area industrial yards?',
        a: 'Yes — we\'ve paved truck staging yards in Sandston rated for FAA crash-truck loads. That requires 6″ of asphalt over 12″ of crushed concrete base. Heavy work, and we\'re built for it.',
      },
      {
        q: 'How does Henrico stormwater code affect my parking lot?',
        a: 'Anything over 2,500 sq ft of new impervious surface triggers Henrico stormwater review. We design with on-site detention or permeable sections to keep your project under threshold when possible.',
      },
    ],
    reviews: 178,
    rating: 4.9,
  },
  {
    slug: 'chesapeake-va',
    city: 'Chesapeake',
    state: 'Virginia',
    stateAbbr: 'VA',
    region: 'Hampton Roads',
    geo: { lat: 36.7682, lng: -76.2875 },
    headline: 'Chesapeake, VA Paving — Built for Hampton Roads Salt & Storms',
    intro:
      'Chesapeake\'s coastal proximity changes everything about asphalt. Salt-laden air corrodes binders, hurricane drainage demands precision grading, and the high water table eats unprepared base courses. We\'ve paved Greenbrier driveways and Western Branch industrial lots that have survived Isabel, Irene, and Florence.',
    neighborhoods: [
      'Greenbrier', 'Western Branch', 'Great Bridge', 'Deep Creek',
      'South Norfolk', 'Hickory', 'Bells Mill', 'Dominion Boulevard',
    ],
    landmarks: ['Chesapeake Square', 'Greenbrier Mall', 'Dismal Swamp Canal', 'Jordan Bridge'],
    climate: {
      title: 'Salt Air, High Water Table, Hurricane Drainage',
      body: 'Hampton Roads asphalt fails three ways: salt oxidation, undermined base from a 4-foot water table, and stormwater channeling during named storms. We use anti-strip additives in every Chesapeake mix, install French drains at low points, and slope every surface 1.5%–2% for hurricane runoff.',
    },
    faqs: [
      {
        q: 'How does the high water table affect my driveway?',
        a: 'Most of Chesapeake sits 4–6 feet above the water table. Untreated, your base course wicks moisture and pumps fines under load. We install woven geotextile and pour 6″ of #57 stone — non-negotiable on every Chesapeake job.',
      },
      {
        q: 'Will salt air really degrade asphalt?',
        a: 'Within 3–4 miles of the Chesapeake Bay, yes. Coastal asphalt loses 30% of its binder to oxidation in half the time of inland surfaces. We seal-coat every 2.5 years instead of the standard 3–5.',
      },
      {
        q: 'Can you pave during hurricane season?',
        a: 'June through November, yes — we just plan around named storms. We won\'t lay a surface course within 48 hours of forecast tropical weather, and we always finish drainage before the surface lift.',
      },
    ],
    reviews: 89,
    rating: 4.8,
  },
  {
    slug: 'williamsburg-va',
    city: 'Williamsburg',
    state: 'Virginia',
    stateAbbr: 'VA',
    region: 'Historic Triangle',
    geo: { lat: 37.2707, lng: -76.7075 },
    headline: 'Williamsburg, VA Paving — Modern Asphalt, Historic Sensibility',
    intro:
      'Williamsburg properties — from Kingsmill to Ford\'s Colony to historic district homes — demand paving that looks restrained, ages gracefully, and respects 300-year-old surroundings. We\'ve done driveways in Colonial Williamsburg overlay zones and parking lots at William & Mary. Discretion is part of the spec.',
    neighborhoods: [
      'Kingsmill', 'Ford\'s Colony', 'Governor\'s Land', 'Powhatan Plantation',
      'Stonehouse', 'Greensprings', 'New Town', 'Norge',
    ],
    landmarks: ['Colonial Williamsburg Historic Area', 'College of William & Mary', 'Busch Gardens', 'Jamestown Settlement'],
    climate: {
      title: 'Tidewater Humidity + Historic Overlay Constraints',
      body: 'James City County has one of the strictest historic preservation overlays in Virginia — surface color, edge treatment, and even the matte vs. semi-matte finish are regulated near the Historic Area. We have a charcoal-finish recipe that meets the overlay and still drains like standard asphalt.',
    },
    faqs: [
      {
        q: 'Do you handle Colonial Williamsburg overlay district paving?',
        a: 'Yes — we\'ve done multiple driveways within 1,000 feet of the Historic Area. The CW Foundation reviews the surface treatment, and we deliver the matte charcoal finish they specify.',
      },
      {
        q: 'How do you protect mature trees in Ford\'s Colony?',
        a: 'Same root-bridge geogrid system we use in Richmond\'s West End. Critical for Ford\'s Colony and Governor\'s Land where the mature canopy is the property\'s defining feature.',
      },
      {
        q: 'Can you match an existing colonial-era brick edging?',
        a: 'We frame the asphalt with a 6″ stretcher-bond brick border in your existing brick — sourced from the original lot if you have a stash, or matched as closely as possible.',
      },
    ],
    reviews: 67,
    rating: 5.0,
  },

  {
    slug: 'new-kent-va',
    city: 'New Kent County',
    state: 'Virginia',
    stateAbbr: 'VA',
    region: 'Williamsburg / New Kent Growth Corridor',
    geo: { lat: 37.5176, lng: -76.9789 },
    headline: 'New Kent County, VA Asphalt Paving — New Construction Driveways and Commercial Access',
    intro:
      'New Kent County is one of the fastest-growing construction corridors between Richmond and Williamsburg, and the rural areas between bigger cities are where many residential asphalt jobs happen. New subdivisions, rural estates, county-road homes, commercial pads, and access roads need asphalt scopes that account for fresh grading, builder fill, drainage movement, and long driveway runs before the final surface goes down.',
    neighborhoods: [
      'New Kent', 'Quinton', 'Providence Forge', 'Barhamsville',
      'Lanexa', 'Bottoms Bridge', 'Talleysville', 'Eltham',
      'Brickshire', 'Viniterra', 'I-64 corridor', 'Route 60 corridor',
    ],
    landmarks: ['I-64 corridor', 'New Kent Winery', 'Viniterra', 'Brickshire', 'Colonial Downs', 'Route 60'],
    climate: {
      title: 'Fresh Builder Fill, Long Driveways, and Growth-Corridor Drainage',
      body: 'New Kent paving often happens on recently disturbed soils, new subdivision pads, rural estate entrances, and commercial access roads. We check compaction, water movement, stone depth, and edge support before paving so new asphalt does not rut, settle, or crack early as the site continues to stabilize.',
    },
    faqs: [
      {
        q: 'Do you pave new-construction driveways in New Kent County?',
        a: 'Yes. We handle new-construction driveways, rural estate lanes, subdivision driveways, and commercial access roads across New Kent County with grading, stone base prep, drainage review, and asphalt installation.',
      },
      {
        q: 'Why do new-construction driveways fail early in New Kent?',
        a: 'Early failure usually comes from unsettled builder fill, weak compaction, thin stone base, poor drainage, or paving before the site is ready. We look at the base and water movement before recommending the final pavement scope.',
      },
      {
        q: 'Do you serve the Williamsburg to Richmond growth corridor?',
        a: 'Yes. New Kent, Providence Forge, Quinton, Lanexa, Williamsburg, and the I-64 corridor are practical service areas when the project scope and scheduling align.',
      },
    ],
    reviews: 28,
    rating: 4.9,
  },

  // ──────── I-81 CORRIDOR (Mountain Virginia) ────────
  {
    slug: 'roanoke-va',
    city: 'Roanoke',
    state: 'Virginia',
    stateAbbr: 'VA',
    region: 'I-81 Corridor / Blue Ridge',
    geo: { lat: 37.2710, lng: -79.9414 },
    headline: 'Roanoke, VA Asphalt Paving — Mountain-Grade Driveways Built for the Blue Ridge',
    intro:
      'Roanoke driveways face what flatland pavement never sees — sustained grades, freeze-thaw cycles in the 40s per winter, and Blue Ridge rain events that scour undersized base courses. We engineer every Roanoke Valley job with a 6-inch structural stone base and a polymer-modified binder rated for mountain conditions. Family-owned, 4th-generation, and honest about what your property actually needs. Competitors like Whittaker Paving Pros and James R. Carter Paving do good work — we bring the same craft with larger equipment, legacy depth, and a written warranty.',
    neighborhoods: [
      'South Roanoke', 'Raleigh Court', 'Grandin Village', 'Wasena',
      'Hunting Hills', 'Cave Spring', 'Hollins', 'Vinton',
      'Salem', 'Bonsack', 'Smith Mountain Lake', 'Daleville',
    ],
    landmarks: ['Mill Mountain Star', 'Roanoke Valley', 'Carilion Clinic', 'Virginia Tech Carilion', 'Appalachian Trail crossings', 'I-81 corridor'],
    climate: {
      title: 'Blue Ridge Freeze-Thaw + Steep-Grade Drainage',
      body: 'Roanoke sits at 900–1,800 feet with 40+ freeze-thaw cycles per winter and Blue Ridge rain events that drop 2″ in an hour. Cheap 4″ stone bases saturate and pump within 3 winters. Our 6-inch structural stone base — woven geotextile, #57 crushed stone, compacted in 3-inch lifts — is built specifically for Virginia mountain driveways. Paired with PG 70-22 polymer-modified binder, it holds up to sloped driveway scour and freeze-cycle fatigue.',
    },
    faqs: [
      {
        q: 'My Roanoke driveway has a 14% grade — can you pave it safely?',
        a: 'Yes — we do steep-grade work throughout Cave Spring, Hunting Hills, and the Blue Ridge Parkway access roads. Anything over 10% gets a broom-finish surface for traction, and we cut cross-drainage swales at transition points so stormwater can\'t sheet down the driveway.',
      },
      {
        q: 'Why do my Roanoke driveway cracks come back every spring?',
        a: 'Almost always inadequate base. Standard 4-inch stone base is not enough for Blue Ridge freeze-thaw. Our 6-inch structural base over geotextile stops the saturation-pumping cycle that causes mountain driveway fatigue cracking.',
      },
      {
        q: 'How do you compare to Whittaker Paving Pros or James R. Carter Paving?',
        a: 'They\'re respected local firms and we\'ve worked alongside both on commercial bids. Our differentiation: 4th-generation family ownership, larger equipment fleet for big jobs (long driveways, commercial lots, subdivisions), a written 5-year workmanship warranty, and transparent line-item estimates. Get two bids and compare.',
      },
      {
        q: 'Do you serve Smith Mountain Lake and Franklin County?',
        a: 'Yes — we\'re one of the few Central Virginia pavers who regularly run crews to SML and the Franklin County side of the lake. Lakefront driveways get our coastal-spec drainage treatment because the seasonal water table matters there too.',
      },
    ],
    reviews: 47,
    rating: 4.9,
  },
  {
    slug: 'harrisonburg-va',
    city: 'Harrisonburg',
    state: 'Virginia',
    stateAbbr: 'VA',
    region: 'I-81 Corridor / Shenandoah Valley',
    geo: { lat: 38.4496, lng: -78.8689 },
    headline: 'Harrisonburg, VA Paving — Shenandoah Valley Asphalt Done Right the First Time',
    intro:
      'Harrisonburg and Rockingham County sit at the heart of the Shenandoah Valley, where karst geology, heavy agricultural equipment, and I-81 freight traffic all punish sub-par pavement. We\'ve paved JMU-area rental properties, farm-lane driveways in Bridgewater, and commercial lots along Route 33. While the VDOT crews are milling Pleasant Hill Road and other local corridors, we\'re the residential alternative — same mountain-grade spec, family-owned accountability.',
    neighborhoods: [
      'Old Town', 'Northend', 'Park View', 'Pleasant Hill',
      'Bridgewater', 'Dayton', 'Elkton', 'McGaheysville',
      'Linville', 'Mount Crawford', 'Broadway', 'Timberville',
    ],
    landmarks: ['James Madison University', 'Massanutten Resort', 'Shenandoah National Park gateway', 'Route 33 corridor', 'I-81 exits 243–251'],
    climate: {
      title: 'Shenandoah Valley Karst + Agricultural Load',
      body: 'The Valley\'s karst limestone bedrock creates unpredictable sinkhole risk and uneven bearing capacity — something no pre-paving test from out-of-area contractors catches. We probe subgrade on every Harrisonburg job and lime-stabilize where plasticity runs high. For farm and commercial properties that see tractor and freight-truck traffic, we spec 3-inch binder course + 2-inch surface + 6-inch stone base — mountain-grade for mountain loads.',
    },
    faqs: [
      {
        q: 'I saw VDOT milling on Pleasant Hill Road — can you pave my driveway while your crews are nearby?',
        a: 'That\'s exactly when we schedule Harrisonburg residential work — crew mobilization is already efficient, materials are moving through the Valley, and we can often shave 5–8% off standard quotes. Call us the week you see VDOT out.',
      },
      {
        q: 'My Bridgewater farm driveway carries tractor and grain truck traffic — standard asphalt?',
        a: 'No — standard residential spec will rut in one harvest season. We build agricultural driveways with 3″ binder + 2″ surface over 6″ of crushed stone, and we often recommend a turnaround apron in concrete for the heaviest point loads.',
      },
      {
        q: 'Does the Valley karst soil really affect driveway paving?',
        a: 'On roughly 20% of Harrisonburg-area properties, yes. Karst subsoil can settle unpredictably, creating low spots within 2–3 years. We test subgrade bearing capacity before we quote, and where indicated we lime-stabilize or install additional geotextile reinforcement.',
      },
      {
        q: 'Can you coordinate JMU-area rental property work between school sessions?',
        a: 'Yes — May and August are our prime windows for JMU-area landlords. We schedule the full overlay plus line striping during the quietest weeks.',
      },
    ],
    reviews: 34,
    rating: 4.9,
  },
  {
    slug: 'winchester-va',
    city: 'Winchester',
    state: 'Virginia',
    stateAbbr: 'VA',
    region: 'I-81 Corridor / Northern Shenandoah',
    geo: { lat: 39.1857, lng: -78.1633 },
    headline: 'Winchester, VA Asphalt Paving — Northern Shenandoah Durability',
    intro:
      'Winchester and Frederick County sit where the Shenandoah Valley meets Northern Virginia\'s commuter sprawl. The result: freeze-thaw cycles from the mountain side, 30,000-vehicle-per-day commuter traffic on Route 7 and Route 37, and a regional infrastructure buildout that has strained every local paver. We bring Central Virginia family-owned accountability to the Northern Valley — same structural stone base, same written warranty, same phone that gets answered.',
    neighborhoods: [
      'Old Town', 'Senseny Road corridor', 'Amherst Street',
      'Stephens City', 'Middletown', 'Berryville', 'Boyce',
      'Clear Brook', 'Gainesboro', 'Front Royal', 'Strasburg',
    ],
    landmarks: ['Shenandoah University', 'Old Town Walking Mall', 'Route 7 corridor', 'Winchester Medical Center', 'I-81 Exits 310–317'],
    climate: {
      title: 'Northern Valley Freeze-Thaw + Commuter Traffic Load',
      body: 'Winchester averages 45+ freeze-thaw cycles per winter (more than Richmond) and Route 7 commuter properties see traffic volumes that rival suburban DC. The combination eats cheap residential driveways in 5–7 years. Our spec: PG 70-22 polymer-modified binder, 6-inch structural stone base on every driveway over 100 linear feet, and a compaction protocol engineered for repeat freeze-cycle loading.',
    },
    faqs: [
      {
        q: 'My Winchester driveway is 15 years old and failing — overlay or full replacement?',
        a: 'Depends on the base. If the failure is surface cracking with a solid base, a 2-inch overlay buys you 10–12 years. If the base is pumping or we see alligator cracking at high-load points, full replacement is the right call. We\'ll bring a core probe and tell you straight.',
      },
      {
        q: 'Do you serve Front Royal and Strasburg?',
        a: 'Yes — Warren and Shenandoah County properties are regular work for our Northern Valley crew. Same pricing, same spec.',
      },
      {
        q: 'Route 7 commuter property — how long will a new driveway last?',
        a: 'Built right — PG 70-22 binder, 6-inch structural base, proper crown — Northern Valley driveways last 22–28 years before full reconstruction. We warranty 5 years on workmanship and include a seal-coat schedule.',
      },
      {
        q: 'Can you handle Winchester\'s historic district paving restrictions?',
        a: 'Yes — Old Town\'s historic overlay has surface treatment rules similar to Williamsburg and Charleston. We\'ve done several carriage-house driveways in the walking mall area using matte charcoal finish with brick edge framing.',
      },
    ],
    reviews: 28,
    rating: 4.9,
  },

  // ──────── VIRGINIA BEACH / HAMPTON ROADS ────────
  {
    slug: 'virginia-beach-va',
    city: 'Virginia Beach',
    state: 'Virginia',
    stateAbbr: 'VA',
    region: 'Hampton Roads / Atlantic Coast',
    geo: { lat: 36.8529, lng: -75.9780 },
    headline: 'Virginia Beach Asphalt Paving — The Cure for Sloppy Coastal Repairs',
    intro:
      'Virginia Beach driveways fail for three reasons competitors won\'t tell you: sandy subgrade pumping under load, salt aerosol oxidizing the binder, and base courses too thin for Atlantic coastal conditions. We see it constantly — driveways built with 4-inch bases and no geotextile, patched with what Yelp reviewers correctly call "sloppy, Mickey Mouse repairs." Our 6-inch structural stone base over woven geotextile is the engineered cure for deep puddling, ruts, and band-aid patch cycles. Family-owned. Written 5-year warranty. The eco-friendly, weather-resistant coastal finish Virginia Beach homeowners actually want.',
    neighborhoods: [
      'Great Neck', 'Alanton', 'Bay Colony', 'North End',
      'Chicks Beach', 'Lynnhaven', 'Kempsville', 'Princess Anne',
      'Red Mill', 'Sandbridge', 'Pungo', 'Thalia',
      'Birdneck Point', 'Croatan', 'Shore Drive corridor',
    ],
    landmarks: ['Oceanfront / Boardwalk', 'Virginia Beach Convention Center', 'Joint Expeditionary Base Little Creek', 'Lynnhaven Mall', 'First Landing State Park', 'Sandbridge Beach'],
    climate: {
      title: 'Sandy Subgrade + Salt Aerosol + Atlantic Hurricane Drainage',
      body: 'Virginia Beach\'s sandy coastal soil pumps under vehicle load when the base is too thin or the geotextile is missing. Add salt aerosol (accelerates binder oxidation by 30–40%) and Atlantic hurricane drainage demands, and you get the ruts, puddles, and surface deterioration competitors like Excel Paving get reamed for in Yelp reviews. Our coastal spec is non-negotiable: 6-inch #57 stone base + woven geotextile + PG 76-22 polymer-modified binder + 2.5-inch surface course + 1.5%–2% cross-fall for hurricane runoff. Seal every 2.5 years, not the inland 4.',
    },
    faqs: [
      {
        q: 'Why does my Virginia Beach driveway have ruts and puddles already?',
        a: 'Two causes, both fixable only by rebuild: sandy subgrade pumping (no geotextile reinforcement) and inadequate base depth. Cheap contractors use 3–4 inches of stone on coastal driveways. The Atlantic sand shifts under load, the base pumps fines up through the asphalt, and within 2–3 years you have the exact ruts and deep puddling you\'re seeing. Our 6-inch structural stone base over woven geotextile permanently eliminates the pumping mechanism.',
      },
      {
        q: 'I got a cheap quote that was $2,000 less. What am I missing?',
        a: 'Usually one of three things: 3-inch base instead of 6, no geotextile, or standard PG 64-22 binder instead of coastal-spec PG 76-22 polymer-modified. Each is a $500–$1,500 line item that fails in 3 years. Check the written spec — not the price. If they won\'t put it in writing, that\'s your answer.',
      },
      {
        q: 'How often does a Virginia Beach driveway need sealing?',
        a: 'Every 2–2.5 years within 3 miles of the oceanfront. Salt aerosol accelerates binder oxidation significantly. We include a 5-year seal-coat schedule with every VB install and seal-coat reminder outreach.',
      },
      {
        q: 'Can you pave on sandy soil in Sandbridge or Chicks Beach?',
        a: 'Yes — we\'ve done extensive work in both neighborhoods. The protocol is identical to Outer Banks coastal: woven geotextile on subgrade, 6–8 inches of crushed stone with non-woven separator, then asphalt courses. Done right, it lasts 20+ years.',
      },
      {
        q: 'What about hurricane storm surge on oceanfront properties?',
        a: 'We elevate finish grade above 10-year projected surge level and use base course thick enough to resist scour. Properties we paved before Hurricanes Florence and Dorian came through intact.',
      },
      {
        q: 'How do you compare to Campbell\'s Asphalt Paving and All American Paving?',
        a: 'Both are established Hampton Roads firms — decades of experience, good reputations. Our differentiation: 4th-generation family ownership, written 5-year workmanship warranty on every job, transparent line-item estimates with mix design spelled out, and an honest conversation about what your property actually needs vs. what cheap contractors sold your neighbor.',
      },
    ],
    reviews: 58,
    rating: 4.9,
  },

  // ──────── FREDERICKSBURG / NOVA CORRIDOR ────────
  {
    slug: 'fredericksburg-va',
    city: 'Fredericksburg',
    state: 'Virginia',
    stateAbbr: 'VA',
    region: 'I-95 Corridor / Rappahannock',
    geo: { lat: 38.3032, lng: -77.4605 },
    headline: 'Fredericksburg, VA Asphalt Paving — Fast Quotes, Virgin-Soil Engineering',
    intro:
      'Fredericksburg, Stafford, and Spotsylvania have exploded with new-construction residential — and with that growth has come a wave of new driveways laid on compacted virgin soil that ruts within 18 months. We see it constantly. New home. New driveway. Tire ruts, depression spots, and patchwork within two years. The cure isn\'t asphalt grade — it\'s subgrade engineering. We probe the subgrade, stabilize where needed, and lay a structural stone base that won\'t compress under vehicle load. Same-week quotes, written scope, phone answered live.',
    neighborhoods: [
      'Downtown Fredericksburg', 'Celebrate Virginia', 'Leavells',
      'Spotsylvania Courthouse', 'Chancellor', 'Salem Fields',
      'Stafford', 'Aquia Harbour', 'Garrisonville', 'Hartwood',
      'Lake of the Woods', 'Locust Grove', 'Massaponax', 'Thornburg',
    ],
    landmarks: ['University of Mary Washington', 'Mary Washington Hospital', 'Celebrate Virginia', 'I-95 Exits 126–133', 'Spotsylvania Town Centre', 'Quantico Marine Corps Base approach'],
    climate: {
      title: 'Virgin-Soil Compaction Failure in New Construction',
      body: 'New construction in Spotsylvania, Stafford, and Fredericksburg\'s growth zones often leaves driveway pads on incompletely compacted virgin soil — builder-grade fill that settles unpredictably under vehicle load. Combined with 30+ freeze-thaw cycles per winter and I-95 commuter traffic volumes, the result is rutting and depression spots within 18–24 months. Our fix: subgrade probe, lime or cement stabilization where bearing capacity tests low, and a proper 6-inch structural stone base over the stabilized subgrade. Adds 10–15% to base cost. Doubles driveway life.',
    },
    faqs: [
      {
        q: 'My new Spotsylvania home\'s driveway has ruts after 2 years. What went wrong?',
        a: 'Almost certainly virgin-soil compaction failure. Builder pads are often placed on fill that\'s compacted to 90% — driveways need 95% or higher. Under vehicle load, the pad settles, the asphalt deflects, ruts form at tire tracks. The only permanent fix is tear-out, subgrade re-compact or stabilize, and rebuild with proper 6-inch structural stone base.',
      },
      {
        q: 'How fast can you quote a Fredericksburg driveway?',
        a: 'Same week. Most Fredericksburg quotes go out within 48 hours of the site visit, with a written line-item scope. Slow quote response is one of the top complaints about this market\'s contractors — we fix that problem first.',
      },
      {
        q: 'Can you coordinate with my builder on a brand-new home?',
        a: 'Yes — we prefer to. New-construction coordination lets us specify the subgrade prep before the builder pours the driveway pad, which prevents the virgin-soil rutting problem entirely. Talk to us before the builder starts driveway work, not after.',
      },
      {
        q: 'Do you serve Stafford and the Quantico commuter corridor?',
        a: 'Yes — Stafford, Aquia Harbour, Garrisonville, and the I-95 commuter corridor are all regular territory for our Northern crew. Same spec, same warranty.',
      },
      {
        q: 'How do you compare to O. Cooper Asphalt Paving and Supreme Paving?',
        a: 'Both do solid work in this market. Our differentiation: 4th-generation family ownership, subgrade engineering on every new-construction driveway (most competitors skip this step), written 5-year warranty, and honest same-week quoting. Get two bids and compare specs, not just prices.',
      },
    ],
    reviews: 42,
    rating: 4.9,
  },

  // ──────── SOUTHSIDE / DINWIDDIE CORRIDOR ────────
  {
    slug: 'dinwiddie-va',
    city: 'Dinwiddie',
    state: 'Virginia',
    stateAbbr: 'VA',
    region: 'Southside Virginia / I-85 Corridor',
    geo: { lat: 37.0779, lng: -77.5861 },
    headline: 'Dinwiddie, VA Asphalt Paving — Southside Driveways, Lots, and Access Roads',
    intro:
      'Dinwiddie County is core Southside territory for J. Worden & Sons. We support residential driveways, rural access roads, church lots, small commercial properties, and light industrial paving with clear diagnosis, drainage-first prep, and practical scopes built for clay soil, farm access, and I-85 corridor traffic.',
    neighborhoods: [
      'Dinwiddie', 'Sutherland', 'McKenney', 'DeWitt',
      'Carson', 'Church Road', 'Ford', 'Dewitt',
      'Petersburg area', 'Prince George corridor', 'I-85 corridor',
    ],
    landmarks: ['Dinwiddie County Airport', 'I-85 corridor', 'Route 1', 'Route 460', 'Petersburg National Battlefield area'],
    climate: {
      title: 'Southside Clay, Rural Access, and Drainage Control',
      body: 'Dinwiddie-area pavement often deals with clay subgrade, rural driveway lengths, farm and service traffic, and drainage that moves across open ground instead of curb-and-gutter systems. We focus on stable base construction, crown, slope, stone depth, and edge support so driveways and lots do not rut or unravel early.',
    },
    faqs: [
      {
        q: 'Do you pave long residential and rural driveways in Dinwiddie County?',
        a: 'Yes. We handle long driveways, private lanes, farm entrances, and residential access roads with grading, drainage, stone base prep, and asphalt installation matched to the property.',
      },
      {
        q: 'Do you serve commercial and church parking lots in Dinwiddie and Southside Virginia?',
        a: 'Yes. We support small commercial lots, churches, community properties, and light industrial yards with repair, resurfacing, sealcoating, striping, and full paving scopes.',
      },
      {
        q: 'What causes driveway rutting around Dinwiddie and Petersburg?',
        a: 'Rutting usually comes from weak base, trapped water, poor compaction, or clay subgrade movement. We diagnose those conditions before recommending overlay, repair, or replacement.',
      },
    ],
    reviews: 34,
    rating: 4.9,
  },

  // ──────── NORTHERN VIRGINIA / FAIRFAX CORRIDOR ────────
  {
    slug: 'fairfax-va',
    city: 'Fairfax',
    state: 'Virginia',
    stateAbbr: 'VA',
    region: 'Northern Virginia / DMV Fringe',
    geo: { lat: 38.8462, lng: -77.3064 },
    headline: 'Fairfax, VA Asphalt Paving — Residential and Commercial Precision for NOVA Traffic',
    intro:
      'Fairfax properties demand disciplined asphalt planning due to commuter load, tight access constraints, and strict property standards. We support driveways, commercial lots, and phased paving programs with documented scope, drainage-first prep, and long-life installation quality.',
    neighborhoods: [
      'Aldie', 'Alexandria', 'Annandale', 'Arlington',
      'Ashburn', 'Bristow', 'Broad Run', 'Burke',
      'Catharpin', 'Centreville', 'Chantilly', 'Clifton',
      'Fairfax', 'Fairfax County', 'Fairfax Station', 'Falls Church',
      'Fauquier County', 'Gainesville', 'Great Falls', 'Haymarket',
      'Herndon', 'Leesburg', 'Loudoun County', 'Manassas',
      'McLean', 'Nokesville', 'Oak Hill', 'Oakton',
      'Prince William County', 'Purcellville', 'Reston', 'Springfield',
      'Sterling', 'Vienna', 'Warrenton', 'Woodbridge',
    ],
    landmarks: ['Fairfax County Parkway', 'I-66 corridor', 'I-495 Beltway', 'GMU area', 'Mosaic District', 'Route 50 and Route 29 corridors'],
    climate: {
      title: 'NOVA Commuter Load + Freeze-Thaw Wear',
      body: 'Fairfax asphalt surfaces see dense daily traffic and repeated freeze-thaw movement. We use base-prep discipline, drainage correction, and compaction control to reduce premature cracking and edge failure under NOVA conditions.',
    },
    faqs: [
      {
        q: 'Do you handle both driveway and parking-lot paving in Fairfax?',
        a: 'Yes. We support homeowners, HOAs, and commercial operators with driveway installs, resurfacing, lot repair, striping, and phased paving scopes.',
      },
      {
        q: 'Can you stage paving for active Fairfax businesses?',
        a: 'Yes. We phase work to keep access open while completing paving in controlled sections for safer operations and better schedule reliability.',
      },
      {
        q: 'Do you serve rural and semi-rural areas between Richmond and Fairfax?',
        a: 'Yes. We regularly service corridor markets and rural areas between major anchors, including Loudoun, Fauquier, and Prince William County localities, when projects align with route scheduling and scope planning.',
      },
    ],
    reviews: 39,
    rating: 4.9,
  },

  // ──────── VIRGINIA — EXPANDED GRID (skeletal entries from spacexgeminijworden port) ────────
  // Minimal-shape entries that drive the Authority engine + sitemap + factory.
  // Rich fields (neighborhoods, climate, faqs, headline, intro, reviews) are
  // populated by a future content pass. Components must degrade gracefully
  // when these optional fields are undefined.

  // Greater Richmond
  { slug: 'tuckahoe-va',         city: 'Tuckahoe',         state: 'Virginia', stateAbbr: 'VA', region: 'Central Virginia',                county: 'Henrico',       geo: { lat: 37.5854, lng: -77.5772 } },
  { slug: 'glen-allen-va',       city: 'Glen Allen',       state: 'Virginia', stateAbbr: 'VA', region: 'Central Virginia',                county: 'Henrico',       geo: { lat: 37.6657, lng: -77.5072 } },
  { slug: 'mechanicsville-va',   city: 'Mechanicsville',   state: 'Virginia', stateAbbr: 'VA', region: 'Central Virginia',                county: 'Hanover',       geo: { lat: 37.6088, lng: -77.3733 } },
  { slug: 'bon-air-va',          city: 'Bon Air',          state: 'Virginia', stateAbbr: 'VA', region: 'Central Virginia',                county: 'Chesterfield',  geo: { lat: 37.5246, lng: -77.5697 } },
  { slug: 'lakeside-va',         city: 'Lakeside',         state: 'Virginia', stateAbbr: 'VA', region: 'Central Virginia',                county: 'Henrico',       geo: { lat: 37.6087, lng: -77.4783 } },
  { slug: 'sandston-va',         city: 'Sandston',         state: 'Virginia', stateAbbr: 'VA', region: 'Central Virginia',                county: 'Henrico',       geo: { lat: 37.5251, lng: -77.3197 } },
  { slug: 'stratford-hills-va',  city: 'Stratford Hills',  state: 'Virginia', stateAbbr: 'VA', region: 'Central Virginia',                county: 'Richmond City', geo: { lat: 37.5337, lng: -77.5447 } },
  { slug: 'westham-va',          city: 'Westham',          state: 'Virginia', stateAbbr: 'VA', region: 'Central Virginia',                county: 'Henrico',       geo: { lat: 37.5851, lng: -77.5519 } },
  { slug: 'windsor-farms-va',    city: 'Windsor Farms',    state: 'Virginia', stateAbbr: 'VA', region: 'Central Virginia',                county: 'Richmond City', geo: { lat: 37.5604, lng: -77.5119 } },

  // Tri-Cities / Chesterfield
  { slug: 'chesterfield-va',     city: 'Chesterfield',     state: 'Virginia', stateAbbr: 'VA', region: 'Tri-Cities / Central Virginia',   county: 'Chesterfield',  geo: { lat: 37.3777, lng: -77.5050 } },
  { slug: 'petersburg-va',       city: 'Petersburg',       state: 'Virginia', stateAbbr: 'VA', region: 'Tri-Cities / Central Virginia',   county: 'Petersburg City', geo: { lat: 37.2279, lng: -77.4019 } },
  { slug: 'hopewell-va',         city: 'Hopewell',         state: 'Virginia', stateAbbr: 'VA', region: 'Tri-Cities / Central Virginia',   county: 'Hopewell City', geo: { lat: 37.3043, lng: -77.2872 } },
  { slug: 'colonial-heights-va', city: 'Colonial Heights', state: 'Virginia', stateAbbr: 'VA', region: 'Tri-Cities / Central Virginia',                            geo: { lat: 37.2654, lng: -77.3992 } },
  { slug: 'moseley-va',          city: 'Moseley',          state: 'Virginia', stateAbbr: 'VA', region: 'Tri-Cities / Central Virginia',   county: 'Chesterfield',  geo: { lat: 37.4163, lng: -77.7758 } },
  { slug: 'prince-george-va',    city: 'Prince George',    state: 'Virginia', stateAbbr: 'VA', region: 'Tri-Cities / Central Virginia',   county: 'Prince George', geo: { lat: 37.2235, lng: -77.2880 } },
  { slug: 'sussex-va',           city: 'Sussex',           state: 'Virginia', stateAbbr: 'VA', region: 'Southside Virginia / I-85 Corridor', county: 'Sussex',     geo: { lat: 36.9135, lng: -77.2730 } },

  // Hampton Roads
  { slug: 'norfolk-va',          city: 'Norfolk',          state: 'Virginia', stateAbbr: 'VA', region: 'Hampton Roads',                                            geo: { lat: 36.8508, lng: -76.2859 } },
  { slug: 'newport-news-va',     city: 'Newport News',     state: 'Virginia', stateAbbr: 'VA', region: 'Hampton Roads',                                            geo: { lat: 37.0871, lng: -76.4730 } },
  { slug: 'hampton-va',          city: 'Hampton',          state: 'Virginia', stateAbbr: 'VA', region: 'Hampton Roads',                                            geo: { lat: 37.0299, lng: -76.3452 } },
  { slug: 'suffolk-va',          city: 'Suffolk',          state: 'Virginia', stateAbbr: 'VA', region: 'Hampton Roads',                                            geo: { lat: 36.7282, lng: -76.5836 } },
  { slug: 'portsmouth-va',       city: 'Portsmouth',       state: 'Virginia', stateAbbr: 'VA', region: 'Hampton Roads',                                            geo: { lat: 36.8354, lng: -76.2983 } },

  // Northern Virginia
  { slug: 'mclean-va',           city: 'McLean',           state: 'Virginia', stateAbbr: 'VA', region: 'Northern Virginia / DMV Fringe',  county: 'Fairfax',       geo: { lat: 38.9339, lng: -77.1773 } },
  { slug: 'warrenton-va',        city: 'Warrenton',        state: 'Virginia', stateAbbr: 'VA', region: 'Northern Virginia / DMV Fringe',  county: 'Fauquier',      geo: { lat: 38.7137, lng: -77.7956 } },
  { slug: 'culpeper-va',         city: 'Culpeper',         state: 'Virginia', stateAbbr: 'VA', region: 'Northern Virginia / DMV Fringe',  county: 'Culpeper',      geo: { lat: 38.4732, lng: -77.9967 } },
  { slug: 'spotsylvania-va',     city: 'Spotsylvania',     state: 'Virginia', stateAbbr: 'VA', region: 'I-95 Corridor / Rappahannock',    county: 'Spotsylvania',  geo: { lat: 38.1985, lng: -77.5853 } },
  { slug: 'stafford-va',         city: 'Stafford',         state: 'Virginia', stateAbbr: 'VA', region: 'I-95 Corridor / Rappahannock',    county: 'Stafford',      geo: { lat: 38.4221, lng: -77.4083 } },
  { slug: 'caroline-va',         city: 'Caroline',         state: 'Virginia', stateAbbr: 'VA', region: 'I-95 Corridor / Rappahannock',    county: 'Caroline',      geo: { lat: 38.0334, lng: -77.3464 } },
  { slug: 'king-george-va',      city: 'King George',      state: 'Virginia', stateAbbr: 'VA', region: 'I-95 Corridor / Rappahannock',    county: 'King George',   geo: { lat: 38.2682, lng: -77.1856 } },
  { slug: 'orange-va',           city: 'Orange',           state: 'Virginia', stateAbbr: 'VA', region: 'Northern Virginia / DMV Fringe',  county: 'Orange',        geo: { lat: 38.2462, lng: -78.1109 } },
  { slug: 'prince-william-va',   city: 'Prince William',   state: 'Virginia', stateAbbr: 'VA', region: 'Northern Virginia / DMV Fringe',  county: 'Prince William', geo: { lat: 38.7026, lng: -77.4789 } },

  // Surrounding Counties
  { slug: 'charlottesville-va',  city: 'Charlottesville',  state: 'Virginia', stateAbbr: 'VA', region: 'Central Virginia',                county: 'Albemarle',     geo: { lat: 38.0293, lng: -78.4767 } },
  { slug: 'hanover-va',          city: 'Hanover',          state: 'Virginia', stateAbbr: 'VA', region: 'Central Virginia',                county: 'Hanover',       geo: { lat: 37.7613, lng: -77.3697 } },
  { slug: 'powhatan-va',         city: 'Powhatan',         state: 'Virginia', stateAbbr: 'VA', region: 'Central Virginia',                county: 'Powhatan',      geo: { lat: 37.5435, lng: -77.9166 } },
  { slug: 'goochland-va',        city: 'Goochland',        state: 'Virginia', stateAbbr: 'VA', region: 'Central Virginia',                county: 'Goochland',     geo: { lat: 37.6837, lng: -77.8836 } },
  { slug: 'amelia-va',           city: 'Amelia',           state: 'Virginia', stateAbbr: 'VA', region: 'Central Virginia',                county: 'Amelia',        geo: { lat: 37.3438, lng: -77.9836 } },
  { slug: 'ashland-va',          city: 'Ashland',          state: 'Virginia', stateAbbr: 'VA', region: 'Central Virginia',                county: 'Hanover',       geo: { lat: 37.7593, lng: -77.4791 } },
  { slug: 'charles-city-va',     city: 'Charles City',     state: 'Virginia', stateAbbr: 'VA', region: 'Central Virginia',                county: 'Charles City',  geo: { lat: 37.3424, lng: -77.0758 } },
  { slug: 'cumberland-va',       city: 'Cumberland',       state: 'Virginia', stateAbbr: 'VA', region: 'Central Virginia',                county: 'Cumberland',    geo: { lat: 37.5101, lng: -78.2422 } },
  { slug: 'fluvanna-va',         city: 'Fluvanna',         state: 'Virginia', stateAbbr: 'VA', region: 'Central Virginia',                county: 'Fluvanna',      geo: { lat: 37.8412, lng: -78.2769 } },
  { slug: 'louisa-va',           city: 'Louisa',           state: 'Virginia', stateAbbr: 'VA', region: 'Central Virginia',                county: 'Louisa',        geo: { lat: 37.9786, lng: -77.9961 } },
  { slug: 'king-william-va',     city: 'King William',     state: 'Virginia', stateAbbr: 'VA', region: 'Central Virginia',                county: 'King William',  geo: { lat: 37.6826, lng: -77.1011 } },

  // ──────── OUTER BANKS / COASTAL NORTH CAROLINA ────────
  {
    slug: 'outer-banks-nc',
    city: 'Outer Banks',
    state: 'North Carolina',
    stateAbbr: 'NC',
    region: 'Coastal North Carolina / Outer Banks',
    geo: { lat: 35.9574, lng: -75.6241 },
    headline: 'Outer Banks, NC Asphalt Paving — Driveways, Parking Lots, and Coastal Durability',
    intro:
      'Outer Banks pavement sees heavy seasonal traffic, salt-air exposure, and rapid weather swings that punish weak asphalt systems. We support residential driveways, parking lots, access roads, and mixed-use surfaces across OBX communities with strong base prep, drainage-first grading, and durable coastal asphalt mixes designed for both daily homeowners and high-turnover vehicle volume.',
    neighborhoods: [
      'Nags Head', 'Kill Devil Hills', 'Kitty Hawk', 'Southern Shores',
      'Duck', 'Corolla', 'Manteo', 'Wanchese',
    ],
    landmarks: ['Wright Memorial Bridge', 'NC-12 corridor', 'Nags Head Beach Accesses', 'Jockey\'s Ridge State Park', 'Outer Banks Visitors Bureau area'],
    climate: {
      title: 'Salt Air, Sand Intrusion, and Seasonal Parking Loads',
      body: 'OBX driveways, lots, and drive lanes face concentrated summer traffic, wind-driven sand, and salt aerosol that accelerates oxidation. We use coastal-ready compaction and drainage design to protect driveway and parking-lot edges, reduce standing water, and extend pavement life in high-demand tourist corridors.',
    },
    faqs: [
      {
        q: 'Do you handle both residential driveways and high-traffic parking lots in the Outer Banks?',
        a: 'Yes. We handle driveway installs and replacements for homeowners plus parking-lot scopes for tourism-heavy turnover with reinforced high-wear zones and practical phasing.',
      },
      {
        q: 'How do you protect OBX driveways and lots from salt air and coastal moisture?',
        a: 'We focus on stable base construction, clean drainage paths, and maintenance cadence tuned for coastal oxidation so driveways and lots hold up longer under beach-market conditions.',
      },
      {
        q: 'Can you pave around active businesses, rentals, and occupied homes?',
        a: 'Yes. We stage work in sections to keep access open for guests, residents, homeowners, and delivery traffic while the paving plan is completed safely.',
      },
    ],
    reviews: 31,
    rating: 4.9,
  },

      // ──────── GEORGIA (Multi-State GBP Architecture) ────────
    {
      slug: 'atlanta-ga',
      city: 'Atlanta',
      state: 'Georgia',
      stateAbbr: 'GA',
      region: 'Atlanta Metro',
      geo: { lat: 33.7490, lng: -84.3880 },
      isHeadquarters: false,
      headline: 'Premium Commercial Asphalt Paving in Atlanta, GA',
      intro: 'Expanding our premium commercial and residential paving operations to the Atlanta Metropolitan area. We bring over 40 years of precision grading, surface mixing, and sealcoating expertise to Fulton County.',
      localGbpName: 'Atlanta Paving & Sealing',
      neighborhoods: ['Buckhead', 'Midtown', 'Sandy Springs', 'Downtown', 'Decatur', 'Macon', 'Duluth'],
      landmarks: ['Piedmont Park', 'Atlanta BeltLine'],
      climate: {
        title: 'Atlanta Heat-Resistant Paving',
        body: 'Atlanta’s high summer temperatures require a stiffer asphalt binder to prevent rutting and shoving in high-traffic parking lots. We modify our aggregate mix to hold up against Georgia\'s relentless heat indices.'
      },
      faqs: [
        {
          q: 'Do you offer commercial sealcoating in Atlanta?',
          a: 'Yes. Atlanta Paving & Sealing provides premium sealcoating and striping for parking lots to protect against extreme UV oxidation and water damage.'
        }
      ],
      reviews: 12,
      rating: 4.9,
    },

    {
      slug: 'savannah-ga',
      city: 'Savannah',
      state: 'Georgia',
      stateAbbr: 'GA',
      region: 'Coastal Georgia',
      geo: { lat: 32.0809, lng: -81.0912 },
      isHeadquarters: false,
      headline: 'Coastal Asphalt Paving & Repair in Savannah, GA',
      intro: 'Serving Savannah and the surrounding coastal communities with resilient asphalt paving solutions. We build driveways and parking lots designed to withstand salt air, heavy rains, and intense heat.',
      localGbpName: 'Savannah Paving & Sealing',
      neighborhoods: ['Historic District', 'Midtown', 'Pooler', 'Richmond Hill', 'Guyton'],
      landmarks: ['Forsyth Park', 'River Street', 'Tybee Island'],
      climate: {
        title: 'Coastal Georgia Paving Challenges',
        body: 'Coastal environments require specialized base preparation to handle high water tables and sandy soils. We ensure proper drainage grade and utilize salt-resistant sealcoats.'
      },
      faqs: [
        {
          q: 'Do you pave outside of Savannah proper?',
          a: 'Yes, Savannah Paving & Sealing covers surrounding areas including Guyton, Pooler, and Richmond Hill.'
        }
      ],
      reviews: 0,
      rating: 0,
    },

    // ──────── FLORIDA (Multi-State GBP Architecture) ────────
  {
    slug: 'bradenton-fl',
    city: 'Bradenton',
    state: 'Florida',
    stateAbbr: 'FL',
    region: 'Southwest Florida',
    geo: { lat: 27.4989, lng: -82.5748 },
    isHeadquarters: false,
    headline: 'Commercial Asphalt Paving & Sealcoating in Bradenton, FL',
    intro: 'Providing top-tier asphalt paving services and structural maintenance throughout Southwest Florida. Our proprietary mixes withstand Florida\'s high UV index and heavy rain events.',
    localGbpName: 'Mid Florida Asphalt Paving', 
    localPhone: '+14073616446',
    neighborhoods: ['Downtown Bradenton', 'Lakewood Ranch', 'Palmetto', 'Cortez'],
    landmarks: ['Bradenton Riverwalk', 'Village of the Arts'],
    climate: {
      title: 'Florida Sun & Rain Resistant Asphalt',
      body: 'Florida paving demands rapid drainage solutions and high-UV resistant sealcoats. We specialize in porous asphalt engineering and heavy-duty storm water runoff systems for commercial lots.'
    },
    faqs: [
      {
        q: 'How does Florida weather affect asphalt?',
        a: 'The intense UV rays oxidize the asphalt binder quickly, while heavy afternoon rains test the base drainage. We recommend a rigid sealcoating schedule every 2-3 years to seal pores against water intrusion.'
      }
    ],
    reviews: 2,
    rating: 5.0,
    gallery: [
      '/work/portfolio/portfolio-007.jpg',
      '/work/portfolio/portfolio-008.jpg',
      '/work/portfolio/portfolio-019.jpg',
      '/work/portfolio/portfolio-021.jpg'
    ]
  },
    // ──────── MISSOURI (Midwest Expansion) ────────
  {
    slug: 'kansas-city-mo',
    city: 'Kansas City',
    state: 'Missouri',
    stateAbbr: 'MO',
    region: 'Midwest',
    geo: { lat: 39.0997, lng: -94.5786 },
    isHeadquarters: false,
    headline: 'Commercial Restaurant & QSR Paving in Kansas City',
    intro: 'Our portfolio in Kansas City runs deep. As a trusted nationwide paving partner for enterprise QSR (Quick Service Restaurants), we have constructed or overlaid the parking lots for every single KFC franchise location in the Kansas City metropolitan area, proving our logistical reach and quality standards in the Midwest.',
    neighborhoods: ['Downtown KC', 'Overland Park', 'Independence', 'Lee\'s Summit'],
    landmarks: ['Power & Light District', 'Country Club Plaza'],
    climate: {
      title: 'Midwestern Extreme Weather Paving',
      body: 'Kansas City experiences rapid temperature swings and heavy winter snow. We engineer our parking lots here with deeper aggregate bases and specialized winter-grade binders to prevent aggressive ice heaving.'
    },
    faqs: [
      {
        q: 'Do you pave commercial restaurants in Kansas City?',
        a: 'Yes. We are a trusted nationwide paving partner for enterprise QSR (Quick Service Restaurants). For example, we constructed or overlaid the parking lots for every KFC location in the Kansas City market.'
      }
    ],
    reviews: 5,
    rating: 4.9,
    gallery: [
      '/work/kfc/kfc-job-001.jpg',
      '/work/kfc/kfc-job-002.jpg',
      '/work/kfc/kfc-job-003.jpg',
      '/work/kfc/kfc-job-004.jpg',
      '/work/kfc/kfc-job-005.jpg',
      '/work/kfc/kfc-job-006.jpg'
    ],
    video: {
      url: '/work/imported/KFC/IMG_9513.MOV',
      description: 'On-site video documenting commercial parking lot construction for a KFC real estate development in Kansas City.'
    }
  }
];

export const getLocationBySlug = (slug) => LOCATIONS.find((l) => l.slug === slug);
export const getLocationsByRegion = () => {
  const grouped = {};
  LOCATIONS.forEach((loc) => {
    if (!grouped[loc.region]) grouped[loc.region] = [];
    grouped[loc.region].push(loc);
  });
  return grouped;
};

const toRadians = (value) => (value * Math.PI) / 180;

export const haversineMiles = (a, b) => {
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const aTerm =
    sinLat * sinLat +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * sinLng * sinLng;

  const c = 2 * Math.atan2(Math.sqrt(aTerm), Math.sqrt(1 - aTerm));
  return earthRadiusMiles * c;
};

export const getLocationsWithinRadius = (center, radiusMiles) => {
  return LOCATIONS
    .filter((loc) => loc?.geo?.lat && loc?.geo?.lng)
    .map((loc) => ({
      ...loc,
      distanceMiles: haversineMiles(center, loc.geo),
    }))
    .filter((loc) => loc.distanceMiles <= radiusMiles)
    .sort((a, b) => a.distanceMiles - b.distanceMiles);
};

export const getRichmondRadiusLocations = () =>
  getLocationsWithinRadius(RICHMOND_CENTER, RICHMOND_RADIUS_MILES);

export const STRATEGIC_CORRIDOR_SLUGS = [
  'virginia-beach-va',
  'chesapeake-va',
  'williamsburg-va',
  'new-kent-va',
  'richmond-va',
  'henrico-va',
  'midlothian-va',
  'short-pump-va',
  'chester-va',
  'dinwiddie-va',
  'fredericksburg-va',
  'fairfax-va',
  'harrisonburg-va',
  'outer-banks-nc',
  'kansas-city-mo',
  'atlanta-ga',
  'savannah-ga',
  'bradenton-fl',
];

export const getStrategicCorridorLocations = () =>
  STRATEGIC_CORRIDOR_SLUGS
    .map((slug) => getLocationBySlug(slug))
    .filter(Boolean);
