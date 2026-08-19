const MODULE_ID = "sidebar-traits";
const ACTION_TAB_ID = "actionEconomy";
const ACTION_TAB_TEMPLATE = `modules/${MODULE_ID}/templates/actors/tabs/character-actions.hbs`;

let integrationPrepared = false;
let integrationInstalled = false;
let actionContextBuilder = null;
let actionListenerAttacher = null;
let sheetState = null;

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

function interceptNextAssignment(target, property, onAssign) {
  const descriptor = Object.getOwnPropertyDescriptor(target, property);
  if (descriptor && !descriptor.configurable) return false;

  const originalValue = target[property];
  const enumerable = descriptor?.enumerable ?? true;

  Object.defineProperty(target, property, {
    configurable: true,
    enumerable,
    get() {
      return originalValue;
    },
    set(value) {
      Object.defineProperty(target, property, {
        configurable: true,
        enumerable,
        writable: true,
        value: originalValue
      });
      onAssign(value);
    }
  });

  return true;
}

function installCapturedIntegration() {
  if (integrationInstalled || !sheetState || !actionContextBuilder || !actionListenerAttacher) return;

  const { proto, preparePartContext, attachPartListeners } = sheetState;

  proto._preparePartContext = async function(partId, context, options) {
    context = await preparePartContext.call(this, partId, context, options);
    if (partId !== ACTION_TAB_ID) return context;
    return actionContextBuilder.call(this, context, options);
  };

  proto._attachPartListeners = function(partId, html, options) {
    if (partId === ACTION_TAB_ID) {
      // The captured module listener expects the old Details part id.
      return actionListenerAttacher.call(this, "details", html, options);
    }
    return attachPartListeners.call(this, partId, html, options);
  };

  integrationInstalled = true;
}

function prepareCharacterSheetIntegration() {
  if (integrationPrepared) return true;

  const sheetCls = globalThis.dnd5e?.applications?.actor?.CharacterActorSheet;
  if (!sheetCls) return false;

  const proto = sheetCls.prototype;
  sheetState = {
    proto,
    preparePartContext: proto._preparePartContext,
    attachPartListeners: proto._attachPartListeners
  };

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

  const detailsPart = sheetCls.PARTS.details;
  const templateIntercepted = interceptNextAssignment(detailsPart, "template", () => {
    // sidebar-traits.js historically replaced the Details template. Ignore that assignment
    // so the system's regular Details tab remains completely unchanged.
  });

  const contextIntercepted = interceptNextAssignment(proto, "_prepareDetailsContext", (patchedMethod) => {
    actionContextBuilder = patchedMethod;
    installCapturedIntegration();
  });

  const listenersIntercepted = interceptNextAssignment(proto, "_attachPartListeners", (patchedMethod) => {
    actionListenerAttacher = patchedMethod;
    installCapturedIntegration();
  });

  if (!templateIntercepted || !contextIntercepted || !listenersIntercepted) {
    console.error("[sidebar-traits] could not isolate the Actions tab from the regular Details tab");
    return false;
  }

  foundry.applications.handlebars.loadTemplates([ACTION_TAB_TEMPLATE]);
  integrationPrepared = true;
  return true;
}

Hooks.once("init", () => {
  prepareCharacterSheetIntegration();
});

Hooks.once("ready", () => {
  // When the dnd5e sheet class was unavailable during init, this callback is
  // registered before sidebar-traits.js registers its own ready fallback.
  if (!integrationPrepared) prepareCharacterSheetIntegration();

  setTimeout(() => {
    if (!integrationInstalled) {
      console.error("[sidebar-traits] Actions tab integration was not installed");
    }
  }, 0);
});
