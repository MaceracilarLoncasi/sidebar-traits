const MODULE_ID = "sidebar-traits";
const ACTION_TAB_ID = "actionEconomy";
const ACTION_TAB_TEMPLATE = `modules/${MODULE_ID}/templates/actors/tabs/character-actions.hbs`;

function insertPartAfter(parts, afterId, partId, partConfig) {
  const entries = [];
  let inserted = false;

  for (const [id, config] of Object.entries(parts)) {
    entries.push([id, config]);
    if (id !== afterId) continue;

    entries.push([partId, partConfig]);
    inserted = true;
  }

  if (!inserted) entries.push([partId, partConfig]);
  return Object.fromEntries(entries);
}

function patchCharacterActionsTab() {
  const sheetCls = globalThis.dnd5e?.applications?.actor?.CharacterActorSheet;
  if (!sheetCls) {
    console.warn("[sidebar-traits] dnd5e CharacterActorSheet not found yet");
    return false;
  }

  if (!sheetCls.PARTS[ACTION_TAB_ID]) {
    sheetCls.PARTS = insertPartAfter(sheetCls.PARTS, "details", ACTION_TAB_ID, {
      classes: ["flexcol"],
      container: { classes: ["tab-body"], id: "tabs" },
      template: ACTION_TAB_TEMPLATE,
      scrollable: [""]
    });
  }

  if (!sheetCls.TABS.some(({ tab }) => tab === ACTION_TAB_ID)) {
    const detailsIndex = sheetCls.TABS.findIndex(({ tab }) => tab === "details");
    const insertIndex = detailsIndex >= 0 ? detailsIndex + 1 : sheetCls.TABS.length;
    sheetCls.TABS.splice(insertIndex, 0, {
      tab: ACTION_TAB_ID,
      label: "ACTION_SHEET.Actions",
      icon: "fas fa-dice-d20"
    });
  }

  const proto = sheetCls.prototype;
  if (!proto.__actionEconomyTabPatched) {
    const originalOnRender = proto._onRender;

    proto._onRender = async function(context, options) {
      if (typeof originalOnRender === "function") {
        await originalOnRender.call(this, context, options);
      }

      const host = this.element?.querySelector(
        `[data-application-part="${ACTION_TAB_ID}"] .action-economy-host`
      );
      const freshlyRenderedTable = this.element?.querySelector(
        '[data-application-part="details"] .action-economy'
      );
      const table = freshlyRenderedTable ?? this.__actionEconomyTable;

      if (!host || !table) return;
      if (table.parentElement !== host) host.replaceChildren(table);
      this.__actionEconomyTable = table;
    };

    proto.__actionEconomyTabPatched = true;
  }

  foundry.applications.handlebars.loadTemplates([ACTION_TAB_TEMPLATE]);
  return true;
}

Hooks.once("init", () => {
  let patched = false;
  try {
    patched = patchCharacterActionsTab();
  } catch (error) {
    console.error("[sidebar-traits] failed to add the Actions tab", error);
  }

  if (patched) return;
  Hooks.once("ready", () => {
    try {
      patchCharacterActionsTab();
    } catch (error) {
      console.error("[sidebar-traits] failed to add the Actions tab", error);
    }
  });
});
