import * as Schema from "effect/Schema";

import { useLocalStorage } from "./hooks/useLocalStorage";

// Device-local on purpose: client settings sync to the server, and a photo is too heavy for that.
const PHOTO_KEY = "savage:background-photo";
const LOOK_KEY = "savage:background-look-v2";
const MAX_PHOTO_CHARS = 3_500_000;

export const MIN_BACKGROUND_VISIBILITY = 10;
export const MAX_BACKGROUND_VISIBILITY = 100;
export const MAX_BACKGROUND_DARKEN = 90;

const BackgroundLook = Schema.Struct({ visibility: Schema.Number, darken: Schema.Number });
export type BackgroundLook = typeof BackgroundLook.Type;
export const DEFAULT_BACKGROUND_LOOK: BackgroundLook = { visibility: 85, darken: 55 };

const NO_PHOTO: string | null = null;
const StoredPhoto = Schema.NullOr(Schema.String);

export function useBackgroundPhoto() {
  return useLocalStorage(PHOTO_KEY, NO_PHOTO, StoredPhoto);
}

export function useBackgroundLook() {
  return useLocalStorage(LOOK_KEY, DEFAULT_BACKGROUND_LOOK, BackgroundLook);
}

const ENCODINGS = [
  { maxSide: 2560, quality: 0.82 },
  { maxSide: 1920, quality: 0.76 },
  { maxSide: 1440, quality: 0.7 },
] as const;

/** Downscales and re-encodes a photo so it fits in local storage. */
export async function encodeBackgroundPhoto(file: Blob): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  try {
    for (const { maxSide, quality } of ENCODINGS) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (context === null) return null;
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const encoded = canvas.toDataURL("image/jpeg", quality);
      if (encoded.length <= MAX_PHOTO_CHARS) return encoded;
    }
    return null;
  } finally {
    bitmap.close();
  }
}
