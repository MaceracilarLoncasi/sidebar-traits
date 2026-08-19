import {
  ACTION_TAB_ID,
  attachActionEconomyListeners,
  prepareActionEconomyContext,
  registerActionTab
} from "./action-economy.js";

export function patchCharacterSheet(moduleId) {
  const sidebarTemplate = `modules/${moduleId}/templates/actors/character-sidebar.hbs`;
  const actionTabTemplate = `modules/${moduleId}/templates/actors/tabs/character-actions.hbs`;
  const sheetClass = globalThis.dnd5e?.applications?.actor?.CharacterActorSheet;
  if (!sheetClass) {
    console.warn("[sidebar-traits] dnd5e CharacterActorSheet not found yet");
    return false;
  }

  registerActionTab(sheetClass, moduleId);
  sheetClass.PARTS.sidebar.template = sidebarTemplate;

  const prototype = sheetClass.prototype;

  if (!prototype.__sidebarTraitsPatched) {
    const prepareSidebarContext = prototype._prepareSidebarContext;
    prototype._prepareSidebarContext = async function(context, options) {
      context = await prepareSidebarContext.call(this, context, options);
      if (!context.traits && typeof this._prepareTraits === "function") {
        context.traits = this._prepareTraits(context);
      }
      if (!context.senses && typeof this._prepareSenses === "function") {
        context.senses = this._prepareSenses(context);
      }
      return context;
    };
    prototype.__sidebarTraitsPatched = true;
  }

  if (!prototype.__actionEconomyContextPatched) {
    const preparePartContext = prototype._preparePartContext;
    prototype._preparePartContext = async function(partId, context, options) {
      context = await preparePartContext.call(this, partId, context, options);
      if (partId !== ACTION_TAB_ID) return context;
      return prepareActionEconomyContext.call(this, context, moduleId);
    };
    prototype.__actionEconomyContextPatched = true;
  }

  if (!prototype.__actionEconomyListenersPatched) {
    const attachPartListeners = prototype._attachPartListeners;
    prototype._attachPartListeners = function(partId, html, options) {
      attachPartListeners.call(this, partId, html, options);
      if (partId === ACTION_TAB_ID) attachActionEconomyListeners(this, html, moduleId);
    };
    prototype.__actionEconomyListenersPatched = true;
  }

  foundry.applications.handlebars.loadTemplates([sidebarTemplate, actionTabTemplate]);
  return true;
}
