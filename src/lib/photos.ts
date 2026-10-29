import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Claude doesn't need more than this for food photos, and smaller images cost fewer tokens.
const MAX_EDGE = 1024;

export type PreparedPhoto = { uri: string; base64: string };

/** Shrink a photo so its longest edge is at most 1024px and re-encode it as JPEG. */
export async function preparePhoto(uri: string, width: number, height: number): Promise<PreparedPhoto> {
  const context = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > MAX_EDGE) {
    context.resize(width >= height ? { width: MAX_EDGE, height: null } : { width: null, height: MAX_EDGE });
  }
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  if (!result.base64) throw new Error('Could not read the photo.');
  return { uri: result.uri, base64: result.base64 };
}

const photoDir = () => new Directory(Paths.document, 'meal-photos');

/** Copy a (cached) photo into permanent app storage and return its new uri. */
export function keepPhoto(cacheUri: string): string {
  const dir = photoDir();
  if (!dir.exists) dir.create({ intermediates: true });
  const dest = new File(dir, `${Date.now()}.jpg`);
  new File(cacheUri).copy(dest);
  return dest.uri;
}

export function deletePhoto(uri: string | null) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // The photo is only a nice-to-have; a failed delete shouldn't block anything.
  }
}
