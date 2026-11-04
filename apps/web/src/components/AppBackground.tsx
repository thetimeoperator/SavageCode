import { useEffect } from "react";

import { useBackgroundLook, useBackgroundPhoto } from "../appBackground";

const CANVAS = "var(--app-theme-canvas, #0a0a0a)";

/**
 * The user's background photo, painted behind the whole app. While it is set, the root carries
 * `data-app-background="photo"`, which index.css uses to make the canvas see-through and the
 * sidebar frosted glass. The tint layer uses the theme canvas so light themes fade to light.
 */
export function AppBackground() {
  const [photo] = useBackgroundPhoto();
  const [look] = useBackgroundLook();
  const active = photo !== null;

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- mirrors the photo onto <html> so global CSS can open up the app's surfaces
  useEffect(() => {
    const root = document.documentElement;
    if (active) root.dataset.appBackground = "photo";
    else delete root.dataset.appBackground;
    return () => {
      delete root.dataset.appBackground;
    };
  }, [active]);

  if (photo === null) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 select-none"
      style={{ zIndex: -1, backgroundColor: CANVAS }}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url("${photo}")`, opacity: look.visibility / 100 }}
      />
      <div
        className="absolute inset-0"
        style={{ backgroundColor: CANVAS, opacity: look.darken / 100 }}
      />
    </div>
  );
}
