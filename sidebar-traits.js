import { patchCharacterSheet } from "./scripts/character-sheet.js";
import { registerFilterSetting } from "./scripts/filter-dialog.js";

console.log("[sidebar-traits] module loaded");

const MODULE_ID = "sidebar-traits";

function rerenderOpenCharacterSheets() {
  const apps = new Set();

  try {
    for (const app of Object.values(ui?.windows ?? {})) apps.add(app);
  } catch (_) {}

  try {
    const instances = globalThis.foundry?.applications?.instances;
    if (typeof instances?.values === "function") {
      for (const app of instances.values()) apps.add(app);
    } else {
      for (const app of Object.values(instances ?? {})) apps.add(app);
    }
  } catch (_) {}

  try {
    for (const app of apps) {
      if (!app) continue;

      const isActorSheet =
        app.documentName === "Actor" ||
        app.actor ||
        app.options?.documentType === "Actor";
      if (!isActorSheet) continue;

      const rendered =
        app.rendered === true ||
        (typeof app.element?.length === "number" && app.element.length > 0);
      if (rendered && typeof app.render === "function") app.render(true);
    }
  } catch (error) {
    console.error("[sidebar-traits] failed to re-render character sheets", error);
  }
}

Hooks.once("init", () => {
  registerFilterSetting(MODULE_ID, rerenderOpenCharacterSheets);

  let patched = false;
  try {
    patched = patchCharacterSheet(MODULE_ID);
  } catch (error) {
    console.error("[sidebar-traits] failed to patch the character sheet", error);
  }

  if (patched) return;
  Hooks.once("ready", () => {
    try {
      patchCharacterSheet(MODULE_ID);
    } catch (error) {
      console.error("[sidebar-traits] failed to patch the character sheet", error);
    }
  });
});
