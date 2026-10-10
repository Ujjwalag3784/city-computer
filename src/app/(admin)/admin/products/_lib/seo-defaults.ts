/**
 * Search-result defaults for the product wizard's last step, used when the
 * owner leaves the page title / search description blank.
 */
const STORE_SUFFIX = "City Computer";
const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;
const DESCRIPTION_TARGET = 110;
const DESCRIPTION_TAIL =
  "Buy at City Computer, New Road, Kathmandu: genuine products with warranty and delivery across Nepal.";

/** Cuts at the last whole word that fits, so nothing ends mid-word. */
function fitWords(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit + 1);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : text.slice(0, limit)).replace(
    /[\s,;:|–-]+$/,
    "",
  );
}

/**
 * The page title Google shows when the owner leaves it blank. Picks the
 * richest version that still fits in 60 characters and always keeps the
 * full product name (the SEO hint checks for it). Brand is not added:
 * product names already start with it ("Lenovo IdeaPad…").
 */
export function defaultPageTitle(productName: string, _brandName?: string): string {
  const name = productName.trim();
  if (!name) return "";
  const candidates = [
    `${name} Price in Nepal | ${STORE_SUFFIX}`,
    `${name} | ${STORE_SUFFIX}`,
    `${name} Price in Nepal`,
    name,
  ];
  return candidates.find((c) => c.length <= TITLE_LIMIT) ?? fitWords(name, TITLE_LIMIT);
}

/**
 * The search description when the owner leaves it blank: leads with the
 * product name, then their own description, then a shop line if it's still
 * short, all within 160 characters.
 */
export function defaultSearchDescription(productName: string, shortDescription: string): string {
  const name = productName.trim();
  const description = shortDescription.trim().replace(/\s+/g, " ");
  let text =
    !description || description === name
      ? name
      : description.toLowerCase().includes(name.toLowerCase())
        ? description
        : `${name}. ${description}`;
  if (text && !/[.!?]$/.test(text)) text += ".";
  if (text.length < DESCRIPTION_TARGET) text = `${text} ${DESCRIPTION_TAIL}`.trim();
  return fitWords(text, DESCRIPTION_LIMIT);
}
