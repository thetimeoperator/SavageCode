declare const __SAVAGE_KEEP_T3_DATA__: boolean | undefined;

/**
 * Savage Code keeps its own folders so it never reads or writes Savage Code's data. A build made with
 * SAVAGE_KEEP_T3_DATA=1 in the repo .env keeps Savage Code's folders, for installs that already live there.
 */
export const keepsT3CodeData =
  typeof __SAVAGE_KEEP_T3_DATA__ !== "undefined" && __SAVAGE_KEEP_T3_DATA__ === true;

export const DATA_FOLDER_NAME = keepsT3CodeData ? ".t3" : ".savage-code";

export function userDataFolderNames(keepT3CodeData: boolean) {
  return keepT3CodeData
    ? { development: "t3code-dev", production: "t3code-v2" }
    : { development: "savage-code-dev", production: "savage-code" };
}

export const APP_USER_MODEL_ID = keepsT3CodeData
  ? "com.t3tools.t3code"
  : "fyi.aiforsavages.savagecode";
