/**
 * Content images that belong in the image sitemap, keyed by the route that
 * renders them. The alt text written for the page is reused verbatim as the
 * sitemap caption, so the two can never drift.
 *
 * Neighborhood banners are NOT listed here: they come from
 * NEIGHBORHOOD_BANNERS, so a new banner ships its sitemap entry automatically.
 */
import heroImgAsset from "../assets/manhattan-hero-reflection.jpg.asset.json";
import weekHeroAsset from "../assets/manhattan-aerial-lower-manhattan.jpg.asset.json";
import monthHeroAsset from "../assets/manhattan-dusk-skyline.jpg.asset.json";

export type SiteImage = { url: string; caption: string };

export const HOME_HERO = {
  url: heroImgAsset.url,
  caption:
    "Lower Manhattan skyline at sunrise, One World Trade Center rising above the financial district towers, mirrored in the still water of the harbor under a pink and gold sky.",
} satisfies SiteImage;

export const WEEK_HERO = {
  url: weekHeroAsset.url,
  caption:
    "Aerial view of Lower Manhattan at golden hour, One World Trade Center and the Financial District skyline surrounded by the Hudson and East Rivers, with the Brooklyn Bridge visible in the distance.",
} satisfies SiteImage;

export const MONTH_HERO = {
  url: monthHeroAsset.url,
  caption:
    "Manhattan skyline at dusk, One World Trade Center lit against an orange-to-blue sunset sky, with the Verrazzano-Narrows Bridge visible in the distance.",
} satisfies SiteImage;

/** Route path → content images rendered on that page. */
export const ROUTE_IMAGES: Record<string, SiteImage[]> = {
  "/": [HOME_HERO],
  "/this-week": [WEEK_HERO],
  "/monthly": [MONTH_HERO],
};
