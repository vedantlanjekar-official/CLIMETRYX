import credits from "@/public/images/editorial/credits.json";

export type EditorialImage = {
  slug: string;
  file: string;
  width: number;
  height: number;
  title: string;
  author: string;
  licence: string;
  licenceUrl: string | null;
  source: string;
  description: string;
  modified: string;
};

export const EDITORIAL_IMAGES: readonly EditorialImage[] = credits;

export function editorialImage(slug: string): EditorialImage {
  const image = EDITORIAL_IMAGES.find((item) => item.slug === slug);
  if (!image) throw new Error(`Unknown editorial image: ${slug}`);
  return image;
}
