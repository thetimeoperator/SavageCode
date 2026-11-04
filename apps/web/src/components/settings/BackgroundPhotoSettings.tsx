import { ImageIcon, Trash2Icon } from "lucide-react";
import { useRef, useState, type CSSProperties } from "react";

import {
  DEFAULT_BACKGROUND_LOOK,
  encodeBackgroundPhoto,
  MAX_BACKGROUND_DARKEN,
  MAX_BACKGROUND_VISIBILITY,
  MIN_BACKGROUND_VISIBILITY,
  useBackgroundLook,
  useBackgroundPhoto,
} from "../../appBackground";
import { Button } from "../ui/button";
import { toastManager } from "../ui/toast";
import { SettingResetButton, SettingsRow, SettingsSection } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";

function sliderStyle(value: number, min: number, max: number) {
  const ratio = (value - min) / (max - min);
  return {
    "--settings-slider-progress": `${ratio * 100}%`,
    "--settings-slider-fill-offset": `${0.5 - ratio}rem`,
  } as CSSProperties;
}

function PercentSlider(props: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex w-full items-center gap-3 sm:w-52">
      <output
        className="min-w-12 rounded-md bg-muted px-2 py-1 text-center font-mono text-xs font-medium tabular-nums text-foreground"
        htmlFor={props.id}
      >
        {props.value}%
      </output>
      <input
        aria-label={props.label}
        className="settings-slider min-w-0 flex-1"
        id={props.id}
        min={props.min}
        max={props.max}
        step={props.step}
        type="range"
        value={props.value}
        style={sliderStyle(props.value, props.min, props.max)}
        onChange={(event) => {
          const next = Number(event.currentTarget.value);
          if (Number.isFinite(next)) props.onChange(Math.min(props.max, Math.max(props.min, next)));
        }}
      />
    </div>
  );
}

export function BackgroundPhotoSection() {
  const [photo, setPhoto] = useBackgroundPhoto();
  const [look, setLook] = useBackgroundLook();
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toastManager.add({ type: "error", title: "Choose an image file" });
      return;
    }
    setBusy(true);
    const encoded = await encodeBackgroundPhoto(file).catch(() => undefined);
    setBusy(false);
    if (encoded === undefined) {
      toastManager.add({ type: "error", title: "Couldn't read that image" });
    } else if (encoded === null) {
      toastManager.add({
        type: "error",
        title: "That photo is too large",
        description: "Try a smaller image.",
      });
    } else {
      setPhoto(encoded);
    }
  };

  const lookChanged =
    look.visibility !== DEFAULT_BACKGROUND_LOOK.visibility ||
    look.darken !== DEFAULT_BACKGROUND_LOOK.darken;

  return (
    <SettingsSection id="appearance-background" title="Background">
      <SettingsRow
        {...searchableSetting("setting-background-photo")}
        description="Show a photo behind the app. The sidebar turns to frosted glass and a tint keeps text readable. It stays on this device."
        control={
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            {photo !== null ? (
              <img
                src={photo}
                alt="Current background"
                className="h-9 w-16 shrink-0 rounded-md border border-border object-cover"
              />
            ) : null}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                void choose(event.currentTarget.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              <ImageIcon aria-hidden />
              {busy ? "Loading…" : photo === null ? "Choose photo" : "Change photo"}
            </Button>
            {photo !== null ? (
              <Button size="sm" variant="ghost-destructive" onClick={() => setPhoto(null)}>
                <Trash2Icon aria-hidden />
                Remove
              </Button>
            ) : null}
          </div>
        }
      />
      {photo !== null ? (
        <>
          <SettingsRow
            {...searchableSetting("setting-background-visibility")}
            description="How much of the photo’s color shows."
            resetAction={
              lookChanged ? (
                <SettingResetButton
                  label="background look"
                  onClick={() => setLook(DEFAULT_BACKGROUND_LOOK)}
                />
              ) : null
            }
            control={
              <PercentSlider
                id="background-visibility"
                label="Photo visibility"
                value={look.visibility}
                min={MIN_BACKGROUND_VISIBILITY}
                max={MAX_BACKGROUND_VISIBILITY}
                step={1}
                onChange={(visibility) => setLook((current) => ({ ...current, visibility }))}
              />
            }
          />
          <SettingsRow
            {...searchableSetting("setting-background-darken")}
            description="Tint over the photo. Raise it if text gets hard to read."
            control={
              <PercentSlider
                id="background-darken"
                label="Darken"
                value={look.darken}
                min={0}
                max={MAX_BACKGROUND_DARKEN}
                step={5}
                onChange={(darken) => setLook((current) => ({ ...current, darken }))}
              />
            }
          />
        </>
      ) : null}
    </SettingsSection>
  );
}
