export function registerFilterSetting(moduleId, onChange) {
  game.settings.register(moduleId, "aeFilters", {
    name: "Action Sheet Filters",
    hint: "Internal setting for Action Sheet filtering.",
    scope: "client",
    config: false,
    type: Object,
    default: {
      weapons: true,
      spells: true,
      equipment: true,
      features: true,
      consumables: true,
      tools: true,
      other: true
    },
    onChange
  });
}

function currentSpellFilters(current) {
  if (typeof current === "boolean") {
    return { all: current, prepared: false, ritual: false, cantrips: false };
  }
  return {
    all: !!current?.all,
    prepared: (current?.prepared ?? true) === true,
    ritual: !!current?.ritual,
    cantrips: !!current?.cantrips
  };
}

export async function openFilterDialog(moduleId) {
  const categories = ["weapons", "equipment", "features", "consumables", "tools", "other"];
  const current = game.settings.get(moduleId, "aeFilters") ?? {};
  const spells = currentSpellFilters(current.spells);

  const content = `<form class="filter-dialog">
    <p>${game.i18n.localize("ACTION_SHEET.FilterPrompt")}</p>
    <ul class="filter-list">
      <li class="filter-group spells-group">
        <div class="filter-group-title">${game.i18n.localize("ACTION_SHEET.Filter.Categories.Spells")}</div>
        <label class="checkbox">
          <input type="checkbox" name="spellsAll" ${spells.all ? "checked" : ""}>
          <span>${game.i18n.localize("ACTION_SHEET.Filter.Spells.All")}</span>
        </label>
        <div class="spells-suboptions">
          <label class="checkbox">
            <input type="checkbox" name="spellsPrepared" ${spells.prepared ? "checked" : ""}>
            <span>${game.i18n.localize("ACTION_SHEET.Filter.Spells.Prepared")}</span>
          </label>
          <label class="checkbox">
            <input type="checkbox" name="spellsRitual" ${spells.ritual ? "checked" : ""}>
            <span>${game.i18n.localize("ACTION_SHEET.Filter.Spells.Ritual")}</span>
          </label>
          <label class="checkbox">
            <input type="checkbox" name="spellsCantrips" ${spells.cantrips ? "checked" : ""}>
            <span>${game.i18n.localize("ACTION_SHEET.Filter.Spells.Cantrips")}</span>
          </label>
        </div>
      </li>
      ${categories.map((category) => {
        const checked = current[category] !== false ? "checked" : "";
        const key = category[0].toUpperCase() + category.slice(1);
        const label = game.i18n.localize(`ACTION_SHEET.Filter.Categories.${key}`);
        return `<li>
          <label class="checkbox">
            <input type="checkbox" name="${category}" ${checked}>
            <span>${label}</span>
          </label>
        </li>`;
      }).join("")}
    </ul>
  </form>`;

  const dialog = new Dialog({
    title: game.i18n.localize("ACTION_SHEET.FilterTitle"),
    content,
    buttons: {
      save: {
        icon: '<i class="fas fa-save"></i>',
        label: game.i18n.localize("ACTION_SHEET.FilterSave"),
        callback: async (html) => {
          const formData = new FormData(html[0].querySelector("form"));
          const next = Object.fromEntries(
            categories.map((category) => [category, formData.get(category) === "on"])
          );

          const all = formData.get("spellsAll") === "on";
          next.spells = {
            all,
            prepared: !all && formData.get("spellsPrepared") === "on",
            ritual: !all && formData.get("spellsRitual") === "on",
            cantrips: !all && formData.get("spellsCantrips") === "on"
          };
          await game.settings.set(moduleId, "aeFilters", next);
        }
      },
      reset: {
        icon: '<i class="fas fa-undo"></i>',
        label: game.i18n.localize("ACTION_SHEET.FilterReset"),
        callback: async () => {
          const next = Object.fromEntries(categories.map((category) => [category, true]));
          next.spells = { all: false, prepared: true, ritual: false, cantrips: false };
          await game.settings.set(moduleId, "aeFilters", next);
        }
      },
      close: {
        icon: '<i class="fas fa-times"></i>',
        label: game.i18n.localize("ACTION_SHEET.Close")
      }
    },
    default: "save"
  }, { width: 420 });

  Hooks.once("renderDialog", (app, html) => {
    if (app !== dialog) return;

    const all = html.find('input[name="spellsAll"]');
    const subfilters = html.find(
      'input[name="spellsPrepared"], input[name="spellsRitual"], input[name="spellsCantrips"]'
    );

    const sync = () => {
      const allChecked = !!all.prop("checked");
      if (allChecked) subfilters.prop("checked", false);
      subfilters.prop("disabled", allChecked);
      all.prop("disabled", !allChecked && subfilters.is(":checked"));
    };

    all.on("change", sync);
    subfilters.on("change", sync);
    sync();
  });

  dialog.render(true);
  return dialog;
}
