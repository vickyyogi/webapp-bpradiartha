import sharp from "sharp";

/**
 * Canonical canvas that every hero slide image is normalized onto.
 * Because every slide ends up with identical pixel dimensions and an
 * identical subject height, all slides render at the same visual size
 * regardless of the original upload's dimensions or aspect ratio.
 */
export const HERO_CANVAS_WIDTH = 1100;
export const HERO_CANVAS_HEIGHT = 1400;

/** Height the subject fills inside the canvas (small breathing gap top/bottom). */
export const HERO_SUBJECT_HEIGHT = 1380;
/** Hard cap so an unusually wide subject can never spill outside the canvas. */
export const HERO_MAX_SUBJECT_WIDTH = 1080;

/** Frame aspect ratio (width / height) the public hero should use. */
export const HERO_ASPECT_RATIO = HERO_CANVAS_WIDTH / HERO_CANVAS_HEIGHT;

/**
 * Normalizes a hero slide image:
 *
 *   1. auto-orient and guarantee an alpha channel
 *   2. crop away the transparent border so we measure the real subject
 *   3. scale the subject to a fixed height (or width, for very wide subjects)
 *   4. centre it on a transparent canvas of fixed size
 *
 * The result is always a transparent PNG with exactly the same dimensions,
 * so the subject appears the same size in every slide.
 */
export async function normalizeHeroImage(
  input: Buffer
): Promise<{ data: Buffer; width: number; height: number }> {
  // 1. orient + ensure transparency support
  const prepared = await sharp(input, { failOn: "error" })
    .rotate()
    .ensureAlpha()
    .png()
    .toBuffer();
  const preparedMeta = await sharp(prepared).metadata();

  // 2. crop the transparent border. Images without transparency (e.g. a photo
  //    on a solid background) simply come back untrimmed.
  let subjectBuffer = prepared;
  let subjectWidth = preparedMeta.width ?? HERO_CANVAS_WIDTH;
  let subjectHeight = preparedMeta.height ?? HERO_CANVAS_HEIGHT;

  try {
    const trimmed = await sharp(prepared)
      .trim({ threshold: 10 })
      .toBuffer({ resolveWithObject: true });
    if (trimmed.info.width && trimmed.info.height) {
      subjectBuffer = trimmed.data;
      subjectWidth = trimmed.info.width;
      subjectHeight = trimmed.info.height;
    }
  } catch {
    // already tight (or fully uniform) - keep the prepared image
  }

  // 3. scale by whichever axis hits its limit first, so the ratio is preserved
  const byHeight =
    HERO_SUBJECT_HEIGHT / subjectHeight <= HERO_MAX_SUBJECT_WIDTH / subjectWidth;

  const resized = await sharp(subjectBuffer)
    .resize(byHeight ? { height: HERO_SUBJECT_HEIGHT } : { width: HERO_MAX_SUBJECT_WIDTH })
    .png()
    .toBuffer({ resolveWithObject: true });

  const w = resized.info.width;
  const h = resized.info.height;

  // 4. centre on the fixed transparent canvas
  const left = Math.max(0, Math.round((HERO_CANVAS_WIDTH - w) / 2));
  const top = Math.max(0, Math.round((HERO_CANVAS_HEIGHT - h) / 2));

  const data = await sharp({
    create: {
      width: HERO_CANVAS_WIDTH,
      height: HERO_CANVAS_HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized.data, left, top }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  return { data, width: HERO_CANVAS_WIDTH, height: HERO_CANVAS_HEIGHT };
}
