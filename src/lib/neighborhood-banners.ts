/**
 * Photographic masthead banners, shared by the neighborhood report page and
 * the image sitemap. Single source of truth: adding an entry here ships the
 * banner AND its <image:image> sitemap entry, with the same alt text reused
 * as the image caption. Key = lowercased geo name (slug = key with dashes).
 */
import stapleStreetAsset from "../assets/staple-street.webp.asset.json";
import uesBrownstonesAsset from "../assets/upper-east-side-brownstones.jpg.asset.json";
import westVillageStreetAsset from "../assets/west-village-street.webp.asset.json";
import sanRemoAsset from "../assets/san-remo-central-park.webp.asset.json";
import lenoxHillAsset from "../assets/lenox-hill-park-avenue.webp.asset.json";
import midtownFifthAsset from "../assets/midtown-fifth-avenue.jpg.asset.json";
import lincolnCenterAsset from "../assets/lincoln-center-sunset.jpg.asset.json";
import greenwichVillageAsset from "../assets/greenwich-village-jefferson-market.webp.asset.json";
import westChelseaHighLineAsset from "../assets/high-line-west-chelsea-visitors.jpg.asset.json";
import sohoCobblestoneAsset from "../assets/soho-cobblestone-street.jpg.asset.json";

// Neighborhoods that carry a photographic masthead banner. Key = lowercased geo.
export const NEIGHBORHOOD_BANNERS: Record<
  string,
  { asset: { url: string }; alt: string; objectPosition?: string }
> = {
  tribeca: {
    asset: stapleStreetAsset,
    alt: "The historic Staple Street sky-bridge in Tribeca, a teal enclosed walkway connecting two brick warehouse buildings above a quiet cobblestone alley lined with cast-iron fire escapes and arched barred windows.",
  },
  "upper east side": {
    asset: uesBrownstonesAsset,
    alt: "A row of Upper East Side brownstones with ornate carved stone stoops, wrought-iron stair railings, and bay windows, along a quiet tree-lined sidewalk.",
    // Bias the crop lower so the stoops and railings stay in frame.
    objectPosition: "center 72%",
  },
  "west village": {
    asset: westVillageStreetAsset,
    alt: "A narrow West Village street lined with red-brick townhouses and cast-iron fire escapes, bicycles parked along the curb, and a tall tree growing between the buildings under a clear blue sky.",
    // Center the band so the tree and the setback tower mid-frame stay in view.
    objectPosition: "center 48%",
  },
  "upper west side": {
    asset: sanRemoAsset,
    alt: "The San Remo's twin towers rising above Central Park's lake and tree line on the Upper West Side, with other Central Park West apartment buildings and a rooftop water tower visible in the background under a clear blue sky.",
    // Bias the crop upward so the twin tower crowns stay in frame.
    objectPosition: "center 22%",
  },
  "lenox hill": {
    asset: lenoxHillAsset,
    alt: "A yellow taxi driving up Park Avenue in Lenox Hill on a spring day, with pink cherry blossom trees and tulip beds lining the median and apartment buildings rising on both sides under a blue sky.",
    // Portrait source (1500x2250) cropped to a wide strip: bias far down so the
    // blossoms, tulip median and taxi are in frame instead of sky and facades.
    objectPosition: "center 66%",
  },
  midtown: {
    asset: midtownFifthAsset,
    alt: "A busy Fifth Avenue crosswalk in Midtown, yellow taxis and pedestrians crossing under red traffic lights, framed by tall office towers and American flags on the building facades.",
    // Bias the crop down so taxis, crosswalk and pedestrians stay in frame
    // rather than the overcast sky at the top of the street canyon.
    objectPosition: "center 88%",
  },
  "lincoln square": {
    asset: lincolnCenterAsset,
    alt: "An aerial view of Lincoln Center's plaza at sunset, with the Metropolitan Opera House's arched glass facade, the Revson Fountain, and the Manhattan skyline glowing under dramatic golden clouds.",
    // Center the crop so the sunset sky and the twin-tower skyline band read
    // first, with the opera house arches and plaza anchoring the lower frame.
    objectPosition: "center 50%",
  },
  "greenwich village": {
    asset: greenwichVillageAsset,
    alt: "Sixth Avenue in Greenwich Village at golden hour, looking toward the red-brick Jefferson Market Library clock tower with One World Trade Center rising in the hazy distance and autumn leaves on the trees.",
    // Bias the crop down so the avenue reads first: storefronts, traffic and
    // autumn trees fill the lower frame, with the Jefferson Market clock tower
    // still recognizable at right (its spire clips out at this crop).
    objectPosition: "center 70%",
  },
  "west chelsea": {
    asset: westChelseaHighLineAsset,
    alt: "Visitors walking and relaxing on the High Line's elevated walkway in West Chelsea, framed by lush greenery, the undulating glass balconies of a modern high-rise, and the Hudson Yards skyline under a bright blue sky.",
    // Landscape source (1200x800) cropped to a wide strip: bias downward so the
    // walkway and its visitors stay in frame beneath the undulating glass
    // facade and the Hudson Yards towers, with greenery flanking both sides.
    objectPosition: "center 65%",
  },
  soho: {
    asset: sohoCobblestoneAsset,
    alt: "A SoHo cobblestone street lined with cast-iron facades and boutique storefronts, shoppers strolling past parked cars and a taxi, with a distant skyscraper rising at the end of the block.",
    // Low-angle landscape: cobblestones fill the bottom, facades and sky the top.
    // 55% keeps the storefronts, shoppers and taxi in frame without letting the
    // cobblestone foreground or the sky take over the crop.
    objectPosition: "center 55%",
  },
};

export type NeighborhoodBanner = (typeof NEIGHBORHOOD_BANNERS)[string];
