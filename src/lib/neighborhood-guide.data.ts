// Curated from the Heather Domi Team "Launching in New York" (2026, V3.2) guide.
// All sales/rent numbers are Q4 2024 snapshots from that guide; live weekly and
// monthly numbers come from Domi Data tools, not this file.

export type MarketPulse = {
  avg_dom_sales: number;
  avg_dom_rental: number;
};

export type RentBand = {
  studio?: number;
  bed_1?: number;
  bed_2?: number;
};

export type NeighborhoodGuideEntry = {
  slug: string;
  name: string;
  boundaries: string;
  summary: string;
  what_to_expect: string;
  youll_fall_in_love_with: string;
  if_you_do_one_thing: string;
  market_pulse: MarketPulse;
  average_rents_usd_q4_2024: RentBand;
  local_favorites: {
    dine: string[];
    shop: string[];
    experience: string[];
  };
  subway_lines: string;
  commute_minutes: {
    union_square?: string;
    grand_central?: string;
    financial_district?: string;
  };
};

export const NEIGHBORHOOD_GUIDES: NeighborhoodGuideEntry[] = [
  {
    slug: "battery-park-city",
    name: "Battery Park City",
    boundaries: "Southwestern tip of Manhattan, between the West Side Highway and the Hudson River.",
    summary:
      "A planned waterfront community with over a third of its land as parkland. Modern residential feel with commercial and green space along the Hudson.",
    what_to_expect:
      "Walking and jogging pathways, Hudson River views, and easy reach to the Statue of Liberty. Quiet by Manhattan standards.",
    youll_fall_in_love_with:
      "The Museum of Jewish Heritage, Skyscraper Museum, Brookfield Place, Asphalt Green, the Oculus, and the Perelman Performing Arts Center.",
    if_you_do_one_thing: "Explore Brookfield Place, a waterfront shopping and dining complex.",
    market_pulse: { avg_dom_sales: 138, avg_dom_rental: 54 },
    average_rents_usd_q4_2024: { studio: 3937, bed_1: 5144, bed_2: 8981 },
    local_favorites: {
      dine: ["Le District", "Mezze On The River", "Hutch & Waldo", "P.J. Clarke's on the Hudson", "Inatteso Cafe", "Seamore's Brookfield Place"],
      shop: ["Brookfield Place", "Le District", "Clean Market", "Davidoff", "Adam Lippes Flagship Store", "Bloom Flowers"],
      experience: ["Rockefeller Park", "Institute of Culinary Education", "ADAM Grooming Atelier", "Museum of Jewish Heritage", "The Battery", "The Rink at Brookfield Place"],
    },
    subway_lines: "1, 2, 3, 4, 5, W, R, A, C, E",
    commute_minutes: { union_square: "20-25", grand_central: "20-30", financial_district: "10 min walk" },
  },
  {
    slug: "chelsea",
    name: "Chelsea",
    boundaries: "6th Avenue to the east, Hudson River to the west, 34th Street to the north, 14th Street to the south.",
    summary:
      "Formerly industrial, now a design and gallery hub. Home to over 200 art galleries and cutting-edge architecture.",
    what_to_expect:
      "Chelsea Market, Chelsea Piers, Google's NYC campus, and a dense gallery district including David Zwirner and Hauser & Wirth.",
    youll_fall_in_love_with:
      "The High Line, Little Island, the historic Hotel Chelsea, and easy access to the Whitney.",
    if_you_do_one_thing: "Walk the High Line, an elevated park with skyline views and rotating art.",
    market_pulse: { avg_dom_sales: 113, avg_dom_rental: 45 },
    average_rents_usd_q4_2024: { studio: 3748, bed_1: 5752, bed_2: 9156 },
    local_favorites: {
      dine: ["ZiZi", "Cookshop", "Cucina Alba", "Cafe Chelsea", "Shukette", "Coby Club", "Hav & Mar"],
      shop: ["Artists & Fleas", "Comme des Garcons Boutique", "Maison 140", "Muleh", "David Zwirner Gallery", "192 Books"],
      experience: ["Chelsea Gallery District", "The High Line", "Chelsea Piers", "Little Island", "Gotham Comedy Club", "Chelsea Market", "Whitney Museum of American Art"],
    },
    subway_lines: "1, 2, 3, A, C, E, L, F, M",
    commute_minutes: { union_square: "5-10", grand_central: "15", financial_district: "10-15" },
  },
  {
    slug: "east-village",
    name: "East Village",
    boundaries: "Bowery, Third Avenue, 14th Street, and Houston Street.",
    summary:
      "Bohemian and eclectic, with historic brownstones, walk-ups, and boutique developments. Strong nightlife.",
    what_to_expect:
      "A dense mix of dining, bars, and speakeasies, plus community gardens tucked between blocks.",
    youll_fall_in_love_with:
      "Foodie and nightlife density, craft cocktail bars, and the pocket parks throughout Alphabet City.",
    if_you_do_one_thing: "Spend an afternoon in Tompkins Square Park.",
    market_pulse: { avg_dom_sales: 76, avg_dom_rental: 50 },
    average_rents_usd_q4_2024: { studio: 3039, bed_1: 3996, bed_2: 5413 },
    local_favorites: {
      dine: ["Momofuku Noodle Bar", "Superiority Burger", "Veselka", "Cafe Mogador", "Soothr", "Apollo Bagels", "Rosella"],
      shop: ["East Village Vintage Collective", "Cloak and Dagger", "Toy Tokyo", "John Derian", "From Lucie", "Bonnie Slotnik Cookbooks", "Archie's Press"],
      experience: ["Tompkins Square Park", "East Village Books", "Connelly Theater", "6BC Botanical Garden", "BATSU!", "Anthology Film Archives"],
    },
    subway_lines: "L, 4, 5, 6, N, R, Q, W, B, D, F, M",
    commute_minutes: { union_square: "15", grand_central: "30-35", financial_district: "25-35" },
  },
  {
    slug: "financial-district",
    name: "Financial District (FiDi)",
    boundaries: "West Street to the west, East River to the east, Chambers Street to the north, South Ferry to the south.",
    summary:
      "The southern tip of Manhattan, dense with skyscrapers and history dating to 1624. Increasingly residential.",
    what_to_expect:
      "Wall Street, the NYSE, and the Federal Reserve. Historic office buildings are being converted into high-end apartments and condos.",
    youll_fall_in_love_with:
      "Evenings on Stone Street and South Street Seaport, plus the 9/11 Memorial, the Oculus, and the Perelman Performing Arts Center.",
    if_you_do_one_thing: "Visit One World Observatory at the top of One World Trade.",
    market_pulse: { avg_dom_sales: 149, avg_dom_rental: 50 },
    average_rents_usd_q4_2024: { studio: 3822, bed_1: 5062, bed_2: 7643 },
    local_favorites: {
      dine: ["Delmonico's", "Kesté", "Le Gratin", "Manhatta", "Fraunces Tavern"],
      shop: ["Westfield World Trade Center", "Best Sicily Bottega", "Seaport District", "Eataly Downtown", "Local Maverick"],
      experience: ["One World Observatory", "9/11 Memorial & Museum", "South Street Seaport Museum", "Fraunces Tavern Museum", "New York Stock Exchange"],
    },
    subway_lines: "2, 3, 4, 5, 6, W, R, A, C, E, J, Z",
    commute_minutes: { union_square: "15-20", grand_central: "20-25", financial_district: "in-neighborhood" },
  },
  {
    slug: "flatiron",
    name: "Flatiron District",
    boundaries: "Park Ave South to the east, 6th Ave to the west, 30th Street to the north, 14th Street to the south.",
    summary:
      "Central, compact, and architecturally significant. Home to Silicon Alley and the Flatiron Building.",
    what_to_expect:
      "Beaux Arts architecture, dense shopping and dining, and quick access to Madison Square Park.",
    youll_fall_in_love_with:
      "Madison Square Park, the dog park, the birthplace of Shake Shack, and the accessible mix of history and daily life.",
    if_you_do_one_thing: "Sit with the public art at Madison Square Park.",
    market_pulse: { avg_dom_sales: 120, avg_dom_rental: 38 },
    average_rents_usd_q4_2024: { studio: 3854, bed_1: 5620, bed_2: 10185 },
    local_favorites: {
      dine: ["Upland", "Cote", "Hawksmoor NYC", "Rezdôra", "S&P Lunch"],
      shop: ["Fishs Eddy", "Eataly Flatiron", "Chocolat Moderne", "Harry Potter New York", "abc carpet & home"],
      experience: ["Madison Square Park", "Spin Ping Pong", "Theodore Roosevelt Birthplace", "National Museum of Mathematics", "The Flatiron Building"],
    },
    subway_lines: "N, Q, R, W, 4, 5, 6, F, M",
    commute_minutes: { union_square: "5", grand_central: "14-20", financial_district: "20" },
  },
  {
    slug: "greenwich-village",
    name: "Greenwich Village",
    boundaries: "Broadway to the east, 6th Ave to the west, 14th Street to the north, Houston Street to the south.",
    summary:
      "Historic bohemian core of Lower Manhattan. Landmarked townhouses, tree-lined streets, and the Gold Coast of pre-war co-ops.",
    what_to_expect:
      "A magnet for artists, NYU and Parsons students, and anyone drawn to the Village's cultural history.",
    youll_fall_in_love_with:
      "Washington Square Park, the Stonewall Inn, the Blue Note, and off-Broadway theaters.",
    if_you_do_one_thing: "Sit under the arch at Washington Square Park.",
    market_pulse: { avg_dom_sales: 98, avg_dom_rental: 41 },
    average_rents_usd_q4_2024: { studio: 3960, bed_1: 5538, bed_2: 9210 },
    local_favorites: {
      dine: ["Loring Place", "Il Totano", "Minetta Tavern", "Cecchi's", "PopUp Bagels"],
      shop: ["C.O. Bigelow", "Chess Forum", "Greenwich Letterpress", "Goods For The Study"],
      experience: ["Minetta Lane Theatre", "Blue Note Jazz Club", "Cafe Wha?", "Stonewall Inn", "Comedy Cellar"],
    },
    subway_lines: "A, C, E, B, D, F, M, 4, 5, 6, N, Q, R, 1, 2, 3, L",
    commute_minutes: { union_square: "5-10", grand_central: "15-20", financial_district: "10-15" },
  },
  {
    slug: "hudson-yards",
    name: "Hudson Yards",
    boundaries: "10th Ave to the east, 12th Ave to the west, 30th Street to the south, 40th Street to the north.",
    summary:
      "Manhattan's newest planned neighborhood. Sleek high-rises, luxury retail, and a strategic bridge from Chelsea to the West Side.",
    what_to_expect:
      "New residential and office towers, world-class amenities, and heavy weekend foot traffic.",
    youll_fall_in_love_with:
      "The Shops at Hudson Yards, Equinox flagship, The Shed, easy Moynihan Train Hall and MSG access.",
    if_you_do_one_thing: "Go up The Edge, the highest outdoor sky deck in the Western Hemisphere.",
    market_pulse: { avg_dom_sales: 213, avg_dom_rental: 39 },
    average_rents_usd_q4_2024: { studio: 3767, bed_1: 6574, bed_2: 7381 },
    local_favorites: {
      dine: ["Peak", "Zou Zou's", "Queensyard", "Estiatorio Milos", "Mercado Little Spain"],
      shop: ["Shops at Hudson Yards", "MUJI", "Messika", "The Conservatory", "Vêtir"],
      experience: ["The Vessel", "The High Line", "The Shed", "Edge NYC", "Equinox Hudson Yards"],
    },
    subway_lines: "7",
    commute_minutes: { union_square: "15", grand_central: "20", financial_district: "20" },
  },
  {
    slug: "lower-east-side",
    name: "Lower East Side",
    boundaries: "Between Bowery and the East River, from Canal to Houston Streets.",
    summary:
      "Historic tenements next to chic new developments like Essex Crossing. Constantly evolving.",
    what_to_expect:
      "Katz's and Russ & Daughters alongside cocktail bars and music venues. Strong gallery and nightlife scene.",
    youll_fall_in_love_with:
      "Bowery Ballroom, thrift shops, Essex Market, and the neighborhood's cool-but-relaxed vibe.",
    if_you_do_one_thing: "Take the Tenement Museum tour.",
    market_pulse: { avg_dom_sales: 91, avg_dom_rental: 48 },
    average_rents_usd_q4_2024: { studio: 3560, bed_1: 4518, bed_2: 5495 },
    local_favorites: {
      dine: ["Russ & Daughters Cafe", "Le French Diner", "Kiki's", "Katz's Delicatessen", "Scarr's Pizza"],
      shop: ["LAAMS", "Desert Vintage", "Assembly New York", "November 19 Shop", "Aedes Perfumery"],
      experience: ["Essex Market", "Tenement Museum", "The Pickle Guys", "Museum at Eldridge Street", "East River Park"],
    },
    subway_lines: "B, D, F, M, J, Z, 6",
    commute_minutes: { union_square: "15-20", grand_central: "25-30", financial_district: "15-25" },
  },
  {
    slug: "murray-hill-kips-bay",
    name: "Murray Hill / Kips Bay",
    boundaries: "Madison Avenue to the west, FDR Drive to the east, 42nd Street to the north, 23rd Street to the south.",
    summary:
      "Historical charm plus contemporary energy. Popular with young professionals; heavy medical and academic presence.",
    what_to_expect:
      "60+ cafes, 100+ restaurants, 12 colleges, and 15 hospitals (nicknamed Hospital Row). Consulates and UN proximity add international flavor.",
    youll_fall_in_love_with:
      "Library Way, the Morgan Library, and a balance between residential calm and city energy.",
    if_you_do_one_thing: "Spend a slow morning at The Morgan Library & Museum.",
    market_pulse: { avg_dom_sales: 112, avg_dom_rental: 50 },
    average_rents_usd_q4_2024: { studio: 3148, bed_1: 4530, bed_2: 6567 },
    local_favorites: {
      dine: ["2nd Ave Deli", "Riverpark", "Nonna Dora's", "Tara Rose", "Chez Francis", "Tempura Matsui"],
      shop: ["Dover Street Market", "Grand Central Plaza", "Katagiri Japanese Grocery", "TigerStars", "Craft + Carry"],
      experience: ["The Morgan Library & Museum", "Scandinavia House", "The Cutting Room NYC", "AKC Museum of the Dog", "John V. Lindsay East River Park"],
    },
    subway_lines: "4, 5, 6, 7, R, W",
    commute_minutes: { union_square: "10-15", grand_central: "10-20", financial_district: "15-25" },
  },
  {
    slug: "midtown-east-sutton-place",
    name: "Midtown East / Sutton Place",
    boundaries: "42nd to 59th Streets, East River to Fifth Avenue.",
    summary:
      "Skyline views, Grand Central, the UN, and Fifth Avenue shopping in easy reach. Distinguished, understated.",
    what_to_expect:
      "Fifth Avenue retail, riverside walks, a mix of pre-war co-ops and modern condos.",
    youll_fall_in_love_with:
      "Sutton Place Park, the Chrysler Building silhouette, and quiet riverside stretches.",
    if_you_do_one_thing: "Take in the East River from Sutton Place Park.",
    market_pulse: { avg_dom_sales: 112, avg_dom_rental: 54 },
    average_rents_usd_q4_2024: { studio: 4432, bed_1: 4704, bed_2: 6652 },
    local_favorites: {
      dine: ["Copinette", "Il Tinello", "La Villetta", "Smith & Wollensky", "Fresco by Scotto"],
      shop: ["Saks Fifth Avenue", "Tiffany & Co.", "Grand Central Market", "American Girl Place New York", "Neuhaus Chocolates"],
      experience: ["Sutton Place Park", "East River Esplanade", "Shop Along 5th Avenue", "The Museum of Modern Art", "Japan Society"],
    },
    subway_lines: "4, 5, 6, 7, N, Q, R, W, E, F, M",
    commute_minutes: { union_square: "15-20", grand_central: "5-10", financial_district: "15-25" },
  },
  {
    slug: "midtown-west-hells-kitchen",
    name: "Midtown West / Hell's Kitchen",
    boundaries: "34th Street to the south, 59th Street to the north, Eighth Avenue to the east, the Hudson River to the west.",
    summary:
      "Theater district energy with a broad mix of dining, from chic to diner. Tenements next to modern high-rises.",
    what_to_expect:
      "Broadway shows, Times Square proximity, and a wide range of rental price points.",
    youll_fall_in_love_with:
      "The Intrepid Sea, Air & Space Museum, Hudson River access, and the nightlife density.",
    if_you_do_one_thing: "Tour the Intrepid Sea, Air & Space Museum.",
    market_pulse: { avg_dom_sales: 102, avg_dom_rental: 55 },
    average_rents_usd_q4_2024: { studio: 3352, bed_1: 4359, bed_2: 5980 },
    local_favorites: {
      dine: ["Norma Hell's Kitchen", "Chalong Restaurant", "Molyvos", "Marseille", "Kashkaval Garden"],
      shop: ["Delphinium Home", "Fine and Dandy Shop", "Miss Nellie's", "Schmackary's", "Poseidon Bakery"],
      experience: ["The Intrepid Sea, Air, & Space Museum", "Bowlmor Lanes", "Playwrights Horizons", "Don't Tell Mama Piano Bar", "54 Below Jazz Bar"],
    },
    subway_lines: "1, 2, 3, A, C, E, 7, N, Q, R, W, B, D",
    commute_minutes: { union_square: "10", grand_central: "25-30", financial_district: "10-15" },
  },
  {
    slug: "morningside-heights",
    name: "Morningside Heights",
    boundaries: "Morningside Drive to the east, 125th Street to the north, 110th Street to the south, Riverside Drive to the west.",
    summary:
      "The city's largest student neighborhood, home to Columbia and Barnard. Small-town feel in the middle of the city.",
    what_to_expect:
      "Green campus edges, historic architecture, and Riverside Park along the Hudson.",
    youll_fall_in_love_with:
      "The Cathedral of St. John the Divine, Riverside Park, and a slower pace than downtown.",
    if_you_do_one_thing: "Walk Riverside Park and see the Cathedral of St. John the Divine.",
    market_pulse: { avg_dom_sales: 86, avg_dom_rental: 27 },
    average_rents_usd_q4_2024: { studio: 3222, bed_1: 3987, bed_2: 6011 },
    local_favorites: {
      dine: ["Sapps", "Massawa", "Le Monde", "Pisticci", "Marlow Bistro"],
      shop: ["Book Culture", "Columbia University Bookstore", "The Hungarian Pastry Shop", "Mondel Chocolates", "The Pet Market"],
      experience: ["Morningside Park", "Riverside Park", "Columbia University Campus", "Cathedral of St. John the Divine", "General Grant National Memorial"],
    },
    subway_lines: "1, A, C, B, D",
    commute_minutes: { union_square: "30", grand_central: "20-30", financial_district: "30-40" },
  },
  {
    slug: "soho-hudson-square",
    name: "SoHo / Hudson Square",
    boundaries: "6th Ave to the east, Hudson River to the west, Clarkson/West Houston to the north, Canal Street to the south.",
    summary:
      "SoHo holds the world's largest collection of cast-iron buildings. Hudson Square is one of Manhattan's newest designated neighborhoods, buoyed by Google and Disney investment.",
    what_to_expect:
      "Cobblestone streets, luxury shopping, galleries, and a dense dining scene.",
    youll_fall_in_love_with:
      "Loft architecture, the cast-iron facades on Mercer, Greene, and Wooster, and the shopping density.",
    if_you_do_one_thing: "Shop the streets of Mercer, Greene, and Wooster.",
    market_pulse: { avg_dom_sales: 96, avg_dom_rental: 54 },
    average_rents_usd_q4_2024: { studio: 8839, bed_1: 6574, bed_2: 12932 },
    local_favorites: {
      dine: ["Cipriani", "Sartiano's", "Sadelle's", "Raoul's", "La Mercerie"],
      shop: ["Reformation", "Despaña", "Kirna Zabête", "The Guild", "Anine Bing"],
      experience: ["Sloomoo Institute", "Jeffrey Deitch Gallery", "MoMA Design Store", "Dominique Ansel Bakery"],
    },
    subway_lines: "A, C, E, W, R, N, Q, 1, 2, 3, 6, B, D, F, M",
    commute_minutes: { union_square: "15-20", grand_central: "25", financial_district: "15-25" },
  },
  {
    slug: "tribeca",
    name: "TriBeCa",
    boundaries: "Broadway to the east, Hudson River to the west, Canal Street to the north, Murray Street to the south.",
    summary:
      "Cobblestone streets, converted industrial lofts, and some of the most expensive residential real estate in Manhattan.",
    what_to_expect:
      "Exceptional dining, boutique retail, and the annual TriBeCa Film Festival.",
    youll_fall_in_love_with:
      "Hudson River Park and Greenway, live jazz at the Roxy, and the neighborhood's quiet luxury.",
    if_you_do_one_thing: "Catch a screening at the TriBeCa Film Festival.",
    market_pulse: { avg_dom_sales: 138, avg_dom_rental: 32 },
    average_rents_usd_q4_2024: { studio: 4220, bed_1: 7328, bed_2: 11664 },
    local_favorites: {
      dine: ["Fouquet's", "Forgione", "Greca", "Beefbar", "Bubby's", "Locanda Verde", "Au Cheval"],
      shop: ["Nili Lotan", "My Little Sunshine Kids Store", "Elyse Walker", "The Westside", "The Mysterious Bookshop", "La Garconne", "Stella", "Babesta"],
      experience: ["Aida Bicaj Skincare", "Hudson River Park", "TriBeCa Film Festival", "Walker Hotel Rooftop", "Philip Williams Posters"],
    },
    subway_lines: "A, C, E, W, R, 4, 5, 6, 1, 2, 3",
    commute_minutes: { union_square: "15-20", grand_central: "20", financial_district: "13-15" },
  },
  {
    slug: "upper-east-side",
    name: "Upper East Side",
    boundaries: "59th Street to the south, 96th Street to the north, Central Park to the west, East River to the east.",
    summary:
      "Museum Mile, Gilded-Age mansions, and prestigious Fifth and Park Avenue co-ops. Family-oriented and upscale.",
    what_to_expect:
      "Wide residential range from grand co-ops to relatively affordable options. Strong school and museum density.",
    youll_fall_in_love_with:
      "The Met, the Guggenheim, the Frick, Central Park and Carl Schurz Park, and Madison Avenue shopping.",
    if_you_do_one_thing: "Spend a morning at the Metropolitan Museum of Art.",
    market_pulse: { avg_dom_sales: 94, avg_dom_rental: 35 },
    average_rents_usd_q4_2024: { studio: 2910, bed_1: 4053, bed_2: 6752 },
    local_favorites: {
      dine: ["Daniel", "Chez Nick", "J.G. Melon", "JoJo", "Cafe Carlyle"],
      shop: ["Bloomingdale's", "Orwasher's Bakery", "Ralph Lauren", "Butterfield Market", "Lisa's on Second"],
      experience: ["Metropolitan Museum of Art", "Solomon R. Guggenheim Museum", "The Frick Collection", "Neue Galerie New York", "Central Park"],
    },
    subway_lines: "4, 5, 6, Q",
    commute_minutes: { union_square: "15-20", grand_central: "20", financial_district: "20-30" },
  },
  {
    slug: "upper-west-side",
    name: "Upper West Side",
    boundaries: "Central Park West to the east, Hudson River to the west, West 59th Street to the south, West 110th Street to the north.",
    summary:
      "Classic tree-lined streets, historic brownstones, and Central Park adjacency. Culturally rich and family-friendly.",
    what_to_expect:
      "Lincoln Center on one end, the Museum of Natural History on another, and a strong daily neighborhood rhythm.",
    youll_fall_in_love_with:
      "Levain, Zabar's, the Beacon Theatre, Riverside Park, and Lincoln Center performances.",
    if_you_do_one_thing: "Visit the American Museum of Natural History.",
    market_pulse: { avg_dom_sales: 88, avg_dom_rental: 37 },
    average_rents_usd_q4_2024: { studio: 2835, bed_1: 4750, bed_2: 7446 },
    local_favorites: {
      dine: ["Cafe Luxembourg", "The Milling Room", "Maison Pickle", "Barney Greengrass", "Pappardella"],
      shop: ["Zabar's", "More & More Antiques", "Levain Bakery", "Shops at Columbus Circle", "Grand Bazaar NYC"],
      experience: ["American Museum of Natural History", "Lincoln Center for the Performing Arts", "Riverside Park", "Central Park", "Beacon Theatre", "Jazz at Lincoln Center"],
    },
    subway_lines: "1, 2, 3, B, D, A, C",
    commute_minutes: { union_square: "25-35", grand_central: "20-30", financial_district: "20-40" },
  },
  {
    slug: "west-village",
    name: "West Village",
    boundaries: "Greenwich Avenue to the east, Hudson River to the west, Houston Street to the south, 14th Street to the north.",
    summary:
      "One of Manhattan's most coveted neighborhoods. Off-grid streets, brownstones, and a strong artistic and culinary identity.",
    what_to_expect:
      "Chic boutiques, cozy cafes, acclaimed restaurants, and intimate jazz clubs.",
    youll_fall_in_love_with:
      "Magnolia Bakery, Village Vanguard, Bar Pisellino, and the townhouse blocks made famous on screen.",
    if_you_do_one_thing: "Catch a set at Village Vanguard.",
    market_pulse: { avg_dom_sales: 61, avg_dom_rental: 35 },
    average_rents_usd_q4_2024: { studio: 3857, bed_1: 6640, bed_2: 6820 },
    local_favorites: {
      dine: ["Via Carota", "4 Charles Prime Rib", "I Sodi", "Fairfax", "American Bar", "Don Angie"],
      shop: ["Maison Kitsuné West Village", "Mure and Grand", "Pink Olive", "Hudson Grace", "Wyld Blue West Village", "CURSIVE HOME"],
      experience: ["Magnolia Bakery", "Village Vanguard", "Cherry Lane Theatre", "Murray's Cheese", "Bar Pisellino", "Bleecker Street shopping"],
    },
    subway_lines: "1, 2, 3, A, C, E, B, D, F, M, L",
    commute_minutes: { union_square: "5-10", grand_central: "20-25", financial_district: "10-25" },
  },
];

export type LifestyleCategory =
  | "shopping"
  | "beauty_wellness"
  | "workout"
  | "social_clubs"
  | "networking"
  | "young_members"
  | "subway"
  | "rideshare"
  | "food_delivery"
  | "animal_care"
  | "medical"
  | "universities"
  | "event_ticketing"
  | "parking"
  | "laundry";

export type LifestyleEntry = { name: string; note: string; heather_favorite?: boolean };

export const LIFESTYLE_RESOURCES: Record<LifestyleCategory, LifestyleEntry[]> = {
  shopping: [
    { name: "SoHo", note: "Heather's pick for a leisurely shopping day. Luxury and trend retailers, galleries, and specialty shops. Best on weekdays.", heather_favorite: true },
    { name: "Chelsea Market", note: "Meatpacking. Artisanal shops, boutiques, and food vendors under one roof." },
    { name: "Greenwich Village", note: "Three Lives & Co bookstore, The Evolution Store, Shop Untitled, plus vintage at Beacon's Closet, Reminiscence, Hamlet Vintage, and Screaming Mimi's." },
    { name: "West Village", note: "James Perse, Cynthia Rowley, Maje, Sandro along Bleecker, plus one-of-a-kind shops on the side streets." },
    { name: "Madison Avenue", note: "Luxury retail: Ralph Lauren, Bottega Veneta, Carolina Herrera, plus Madewell, J.Crew, LoveShackFancy. La Maison du Chocolat for pastries." },
    { name: "NoLiTa", note: "Coclico, Fjällräven, Oroboro, Le Labo, Aimé Leon Dore, Love Adorned." },
    { name: "Williamsburg", note: "Buffalo Exchange, LTrain Vintage, Brooklyn Woke Vintage, The Mini Mall, and a large H&M." },
    { name: "World Trade Center (The Oculus)", note: "Apple, Eataly, COS, plus luxury retailers under Calatrava's design." },
    { name: "Shops at Brookfield Place", note: "Battery Park City. Louis Vuitton, Gucci, Bottega Veneta, plus Le District and Blue Ribbon Sushi." },
    { name: "Hudson Yards", note: "Dior, Cartier, Fendi, Zara, Madewell. Pair with The Shed, The Edge, Mercado Little Spain." },
    { name: "Flatiron", note: "GANNI, Sephora, Fishs Eddy, Ralph Lauren, Club Monaco, plus Eataly's flagship." },
  ],
  beauty_wellness: [
    { name: "Glamsquad (app)", note: "Heather's pick. Blowouts, makeup, mani/pedi delivered to your door.", heather_favorite: true },
    { name: "Aire Ancient Baths", note: "TriBeCa. Restored 1883 textile factory, Roman/Greek/Ottoman bathing traditions." },
    { name: "Bathhouse", note: "Massages, scrubs, sauna rituals, thermal pools; social wellness format." },
    { name: "The Well", note: "Integrated wellness center: medical, spa, mind-body practices under one roof." },
    { name: "Rescue Spa", note: "Flatiron. Face, body, hair, and nails, with microcurrent and LED treatments." },
    { name: "Othership", note: "Guided sauna and ice bath sessions with breathwork and music." },
  ],
  workout: [
    { name: "The Class by Taryn Toomey", note: "Heather's pick. Cathartic strength-training with breath, music, and movement (TriBeCa).", heather_favorite: true },
    { name: "Rumble Boxing", note: "Boxing-inspired HIIT, ten-round format." },
    { name: "[solidcore]", note: "Pilates-reformer high-intensity, low-impact full body." },
    { name: "SoulCycle", note: "45-minute indoor cycling with weights and choreography." },
    { name: "Tracy Anderson Method Studio", note: "Heated rooms, high-rep dance-inspired sequences." },
    { name: "DanceBody", note: "Dance cardio plus sculpting strength." },
    { name: "Barry's", note: "Original HIIT boutique: cardio plus strength intervals." },
    { name: "Nofar Method", note: "Advanced Pilates with cardio and strength integration." },
    { name: "Pure Barre", note: "Low-impact fusion of pilates, ballet, and yoga." },
    { name: "Pvolve (SoHo)", note: "Low-impact functional training with specialized equipment." },
    { name: "ClassPass (app)", note: "Books across many NYC studios in one app." },
    { name: "MindBody (app)", note: "Books F45, [solidcore], Orangetheory, and more." },
    { name: "Tip", note: "Most NYC studios offer free or discounted 1-2 week trials." },
  ],
  social_clubs: [
    { name: "Casa Cipriani", note: "Restaurant, Jazz Cafe, lounges, terraces, rooftop with East River and Statue of Liberty views." },
    { name: "SoHo House / Ludlow House", note: "Global creatives club; Ludlow House is the LES sister property." },
    { name: "Zero Bond", note: "Members' club for lunch, drinks, meetings, and events in NoHo." },
    { name: "The Ned NoMad", note: "Private social club and hotel from the SoHo House CEO; rooftop and multiple bars." },
    { name: "CORE Club", note: "Private members' space with dining, wellness, and cultural programming." },
    { name: "NeueHouse", note: "Private workspace and cultural club for creatives and entrepreneurs." },
    { name: "ZZ's Club", note: "Major Food Group's Ken Fulk-designed club; the only private CARBONE." },
    { name: "Casa Tua NYC", note: "Intimate European-style retreat with an emphasis on privacy." },
    { name: "The Aman Club", note: "Private sanctuary inside Aman New York with spa, dining, and rooftop terrace." },
  ],
  networking: [
    { name: "Bumble For Friends", note: "App for meeting friends and community." },
    { name: "The Marketing Society", note: "Global mentorship community for marketing leaders." },
    { name: "WAVE (Women's Association of Venture and Equity)", note: "Nonprofit for women across the alternative investments industry." },
  ],
  young_members: [
    { name: "AMNH Junior Council", note: "Ages 22-45, American Museum of Natural History." },
    { name: "FoundersCard", note: "Entrepreneur membership with 500+ partner-brand benefits." },
    { name: "Guggenheim Young Collectors Council", note: "Ages 21-40, museum access plus curator-led programs." },
    { name: "MoMA Junior Associates", note: "Ages 21-40, curatorial walkthroughs and studio visits." },
    { name: "NYPL Young Lions", note: "Twenties and thirties supporters of the New York Public Library." },
    { name: "The Frick Young Fellows", note: "Ages 21-45, gallery talks, tours, Spring Garden Party." },
    { name: "The Met Apollo Circle", note: "Twenties and thirties, private receptions and programs." },
    { name: "Whitney Contemporaries", note: "Ages 21-40, studio visits, after-hours tours, exhibition previews." },
    { name: "New York Junior League", note: "Women's leadership through volunteer action and training, UES headquarters." },
  ],
  subway: [
    { name: "Google Maps (Transit)", note: "Heather's pick. Point to a destination, select Transit, tap stations to inspect lines.", heather_favorite: true },
    { name: "Citymapper", note: "Route options, least-crowded cars, and other subway hacks." },
    { name: "Exit Strategy NYC", note: "Every station map with fastest exit routes." },
    { name: "The Weekendest", note: "Weekend service changes on a Vignelli-style diagram." },
    { name: "OMNY", note: "Tap-to-pay with contactless card, phone, wearable, or OMNY card. MetroCard is being phased out." },
    { name: "Local tip", note: "Learn the exits, door sides, and street-level routing of the two stations you use most." },
  ],
  rideshare: [
    { name: "Uber", note: "Rides, courier, food, freight." },
    { name: "Lyft", note: "Ride-hailing in minutes." },
    { name: "Revel", note: "All-electric fleet, operated in-house." },
    { name: "Curb", note: "App to hail licensed yellow and green taxis; Pair and Pay in app." },
    { name: "Citi Bike", note: "NYC bike share. Single ride $4.79 for 30 min, day pass $19, annual $219.99." },
    { name: "NYC Ferry App", note: "Schedules and tickets across the ferry network. One-way $4, 10 rides $27.50." },
  ],
  food_delivery: [
    { name: "DoorDash / Caviar", note: "Broad restaurant coverage." },
    { name: "Uber Eats", note: "Broad restaurant and grocery coverage." },
    { name: "Seamless / GrubHub", note: "NYC delivery mainstay." },
    { name: "Slice", note: "Pizza-focused ordering, supports independent shops." },
    { name: "Too Good To Go", note: "End-of-day surplus food at a discount." },
  ],
  animal_care: [
    { name: "Downtown Veterinary Medical Hospitals (DVMH)", note: "Heather's pick: 16+ years of use. Includes West Village Vet, TriBeCa SoHo, Battery Park, Seaport.", heather_favorite: true },
    { name: "Schwarzman Animal Medical Center (AMC)", note: "World's largest non-profit animal hospital. 24/7 emergency. Yorkville." },
    { name: "BluePearl Pet Hospital", note: "National specialty and emergency network. Midtown West with a Flatiron specialty location." },
    { name: "BondVet", note: "Urgent care plus wellness, vaccines, dental, surgery, international health certificates." },
    { name: "Murray Hill Pet Hospital", note: "Full-service including virtual care and free online chat." },
    { name: "Pawsh (app)", note: "At-home dog grooming with vetted professionals." },
    { name: "VETPASS (app)", note: "Communicate with your own vet: scheduling, messaging, records." },
    { name: "Wag! (app)", note: "Dog walking, sitting, training." },
    { name: "Rover (app)", note: "Pet sitting and dog walking with in-app messaging, photos, GPS." },
    { name: "D is for Doggy", note: "Five Manhattan daycare locations with live cams." },
    { name: "Biscuits + Bath", note: "18 Manhattan locations. Grooming, daycare, walking, 24-hour care, training, vet, transport." },
    { name: "PupCulture", note: "Five NYC locations. Daycare, boarding, grooming, spa, walking, in-home feeding, pick-up/drop-off." },
  ],
  medical: [
    { name: "ZocDoc", note: "Search in-network doctors, book online, read verified reviews." },
    { name: "Castle Connolly", note: "Top Doctors database (peer nomination and screening); no pay-to-list." },
    { name: "Mount Sinai Hospital", note: "Upper East Side." },
    { name: "Lenox Hill", note: "Upper East Side." },
    { name: "NYU Langone Health", note: "Kips Bay." },
    { name: "NewYork-Presbyterian, Weill Cornell Medicine", note: "Upper East Side." },
    { name: "NewYork-Presbyterian, Columbia University Irving Medical Center", note: "Washington Heights." },
    { name: "Memorial Sloan Kettering Cancer Center", note: "Upper East Side." },
  ],
  universities: [
    { name: "Columbia University", note: "Morningside Heights, Manhattanville." },
    { name: "New York University (NYU)", note: "Greenwich Village, West Village, East Village, TriBeCa, SoHo, Gramercy." },
    { name: "Barnard College", note: "Morningside Heights." },
    { name: "Pace University", note: "Financial District." },
    { name: "The New School / Parsons", note: "Greenwich Village." },
    { name: "Fordham University", note: "Lincoln Center, Upper West Side." },
    { name: "Fashion Institute of Technology (FIT)", note: "Chelsea." },
    { name: "The Juilliard School", note: "Lincoln Center, Upper West Side." },
  ],
  event_ticketing: [
    { name: "TodayTix", note: "Heather's pick for theater. Discounts, lotteries, and same-day rush.", heather_favorite: true },
    { name: "TDF (membership)", note: "Discount Broadway and Off Broadway tickets for eligible members." },
    { name: "Madison Square Garden", note: "Knicks, Rangers, concerts, comedy, sporting events." },
    { name: "DICE (app)", note: "Independent venues: club nights, festivals, comedy, drag." },
    { name: "Ticketmaster", note: "Music, sports, arts, theater at scale." },
    { name: "StubHub", note: "Resale with FanProtect Guarantee." },
    { name: "Gametime (app)", note: "Fast mobile-first ticket buying." },
    { name: "BroadwayADay", note: "Auto-enters daily Broadway lotteries for your chosen shows. Free." },
    { name: "Rush and TKTS", note: "Same-day rush tickets at theater box offices, or the TKTS booth in Duffy Square." },
  ],
  parking: [
    { name: "SpotHero", note: "Heather's pick. Pre-reserve off-street parking; integrated with Apple CarPlay.", heather_favorite: true },
    { name: "BestParking", note: "Find and book discounted parking near your destination or airport." },
    { name: "ParkNYC", note: "City meter parking: pay, extend, and manage via app." },
  ],
  laundry: [
    { name: "LaundryHeap", note: "24-hour turnaround, free collection and delivery, 24/7 chat." },
    { name: "The Soap Box", note: "Wash and fold pickup and delivery. Wash & fold 1.5-2 days; dry cleaning 2 days (excl. Sunday)." },
    { name: "Local tip", note: "Many neighborhoods also have independent pickup/delivery services worth trying." },
  ],
};

export const NEIGHBORHOOD_GUIDE_SLUGS = new Set(NEIGHBORHOOD_GUIDES.map((n) => n.slug));

export const LIFESTYLE_CATEGORIES: LifestyleCategory[] = Object.keys(
  LIFESTYLE_RESOURCES,
) as LifestyleCategory[];
