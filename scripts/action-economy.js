import { openFilterDialog } from "./filter-dialog.js";

export const ACTION_TAB_ID = "actionEconomy";
const DASH = "—";

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

export function registerActionTab(sheetClass, moduleId) {
  const actionTabTemplate = `modules/${moduleId}/templates/actors/tabs/character-actions.hbs`;
  if (!sheetClass.PARTS[ACTION_TAB_ID]) {
    sheetClass.PARTS = insertPartAfter(sheetClass.PARTS, "details", ACTION_TAB_ID, {
      classes: ["flexcol"],
      container: { classes: ["tab-body"], id: "tabs" },
      template: actionTabTemplate,
      scrollable: [""]
    });
  }

  if (sheetClass.TABS.some(({ tab }) => tab === ACTION_TAB_ID)) return;

  const detailsIndex = sheetClass.TABS.findIndex(({ tab }) => tab === "details");
  const insertIndex = detailsIndex >= 0 ? detailsIndex + 1 : sheetClass.TABS.length;
  sheetClass.TABS.splice(insertIndex, 0, {
    tab: ACTION_TAB_ID,
    label: "ACTION_SHEET.Actions",
    icon: "fas fa-dice-d20"
  });
}

function getActivities(item) {
  const activities = item?.system?.activities;
  if (!activities) return [];
  if (Array.isArray(activities)) return activities;
  if (Array.isArray(activities.contents)) return activities.contents;
  if (typeof activities.values === "function") return Array.from(activities.values());
  if (typeof activities[Symbol.iterator] === "function") return Array.from(activities);
  if (typeof activities === "object") return Object.values(activities).filter(Boolean);
  return [];
}

function getPrimaryActivity(item) {
  const activities = getActivities(item);
  return activities.find((activity) => activity?.canUse) ?? activities[0] ?? null;
}

function activationBucketFromActivity(activity) {
  const type = activity?.activation?.type ?? activity?.system?.activation?.type;
  if (type === "action") return "action";
  if (type === "bonus") return "bonus";
  if (type === "reaction") return "reaction";
  return null;
}

function activationBucketFromItem(item) {
  for (const activity of getActivities(item)) {
    const bucket = activationBucketFromActivity(activity);
    if (bucket) return bucket;
  }

  const type = item?.system?.activation?.type;
  if (type === "action") return "action";
  if (type === "bonus") return "bonus";
  if (type === "reaction") return "reaction";

  const label = item?.labels?.activation ?? "";
  if (/bonus/i.test(label)) return "bonus";
  if (/reaksiyon|reaction/i.test(label)) return "reaction";
  if (/aksiyon|action/i.test(label)) return "action";
  return null;
}

function isSpellLikeActivity(activity) {
  const type = activity?.type ?? activity?.kind ?? activity?.activityType;
  return type === "spell" || type === "cast" || type === "spellcast";
}

function itemCategory(item) {
  switch (item?.type) {
    case "weapon": return "weapons";
    case "spell": return "spells";
    case "equipment": return "equipment";
    case "consumable": return "consumables";
    case "tool": return "tools";
    case "feat":
    case "class":
    case "subclass":
    case "background": return "features";
    default: return "other";
  }
}

function shouldIncludeSpell(spell, filter) {
  if (!spell) return false;
  if (typeof filter === "boolean") return filter;
  if (filter?.all) return true;

  const system = spell.system ?? {};
  const method = Object.hasOwn(system, "method")
    ? system.method
    : system.preparation?.mode;
  const prepared = Object.hasOwn(system, "prepared")
    ? !!system.prepared
    : !!system.preparation?.prepared;
  const ritual = !!(system.ritual ?? system.properties?.ritual);
  const level = Number(system.level?.value ?? system.level ?? system.levels ?? 0);

  return (
    (!!filter?.prepared && (
      prepared || ["always", "atwill", "innate", "pact"].includes(String(method ?? "").toLowerCase())
    )) ||
    (!!filter?.ritual && ritual) ||
    (!!filter?.cantrips && level === 0)
  );
}

function normalizeLabel(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(normalizeLabel).filter(Boolean).join(", ");
  if (typeof value?.values === "function") {
    return Array.from(value.values()).map(normalizeLabel).filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    if (typeof value.label === "string") return value.label.trim();
    if (typeof value.text === "string") return value.text.trim();
    if (Array.isArray(value.parts)) {
      return value.parts
        .map((part) => Array.isArray(part) ? part[0] : part?.formula)
        .filter(Boolean)
        .join(" + ");
    }
  }

  return "";
}

function localizedConfigLabel(configEntry, fallback = "") {
  const label = configEntry?.label;
  if (!label) return fallback;
  return game.i18n.localize(label);
}

function damageTypeKey(typeOrLabel) {
  const text = normalizeLabel(typeOrLabel).toLowerCase();
  if (!text) return "";

  const damageTypes = globalThis.CONFIG?.DND5E?.damageTypes ?? {};
  const healingTypes = globalThis.CONFIG?.DND5E?.healingTypes ?? {};
  if (damageTypes[text] || healingTypes[text]) return text;

  for (const [key, config] of Object.entries({ ...damageTypes, ...healingTypes })) {
    const label = localizedConfigLabel(config).toLowerCase();
    if (label && (text === label || text.includes(label) || label.includes(text))) return key;
  }

  const aliases = {
    ezme: "bludgeoning",
    delme: "piercing",
    kesme: "slashing",
    bludgeon: "bludgeoning",
    pierce: "piercing",
    slash: "slashing",
    bludgeoning: "bludgeoning",
    piercing: "piercing",
    slashing: "slashing"
  };
  if (aliases[text]) return aliases[text];
  if (text.includes("iyileştir")) return "healing";
  return "";
}

function damageTypeData(typeOrLabel) {
  const key = damageTypeKey(typeOrLabel);
  if (!key) return null;

  const config =
    globalThis.CONFIG?.DND5E?.damageTypes?.[key] ??
    globalThis.CONFIG?.DND5E?.healingTypes?.[key];
  if (!config) return null;

  return {
    key,
    label: localizedConfigLabel(config, key),
    icon: config.icon ?? `systems/dnd5e/icons/svg/damage/${key}.svg`
  };
}

function renderDamagePart(formula, typeOrLabel) {
  const text = normalizeLabel(formula) || DASH;
  const type = damageTypeData(typeOrLabel);
  const icon = type
    ? `<span data-tooltip="${type.label}" aria-label="${type.label}"><dnd5e-icon src="${type.icon}"></dnd5e-icon></span>`
    : "";
  return `<div class="row"><span class="formula">${text}</span>${icon}</div>`;
}

function normalizeDamageParts(parts) {
  if (!parts) return [];
  if (Array.isArray(parts)) return parts;
  if (Array.isArray(parts.contents)) return parts.contents;
  if (Array.isArray(parts.parts)) return parts.parts;
  if (typeof parts[Symbol.iterator] === "function") return Array.from(parts);
  if (typeof parts === "object") return Object.values(parts);
  return [];
}

function buildDamageHtml(source, fallbackText = "") {
  const labelDamages = source?.labels?.damages ?? source?.label?.damages;
  if (Array.isArray(labelDamages) && labelDamages.length) {
    const rows = labelDamages
      .filter((damage) => damage && damage.firstDamage !== false)
      .map((damage) => {
        if (typeof damage === "string") return renderDamagePart(damage, damage);
        return renderDamagePart(
          damage.formula ?? damage.value,
          damage.damageType ?? damage.type ?? damage.types
        );
      })
      .filter(Boolean);
    if (rows.length) return rows.join("");
  }

  const rawParts =
    source?.damage?.parts ??
    source?.damage?.damageParts ??
    source?.damageParts ??
    source?.system?.damage?.parts ??
    source?.system?.damageParts;
  const parts = normalizeDamageParts(rawParts);
  if (parts.length) {
    return parts.map((part) => {
      const formula = Array.isArray(part)
        ? part[0]
        : part?.formula ?? part?.value;
      const type = Array.isArray(part)
        ? part[1]
        : part?.type ?? part?.damageType ?? part?.damageTypes ?? part?.types;
      return renderDamagePart(formula, type);
    }).join("");
  }

  const text = normalizeLabel(fallbackText);
  if (!text) return "";
  return text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => renderDamagePart(part, part))
    .join("");
}

function abilityAbbreviation(key) {
  const config = globalThis.CONFIG?.DND5E?.abilities?.[key];
  if (!config) return String(key ?? "").slice(0, 3).toUpperCase();

  const abbreviation = config.abbreviation
    ? game.i18n.localize(config.abbreviation)
    : key;
  return String(abbreviation).toUpperCase();
}

function saveTextFromActivity(activity) {
  const save = activity?.save ?? activity?.system?.save;
  if (!save) return "";

  let ability = save.ability;
  if (ability?.size !== undefined && typeof ability[Symbol.iterator] === "function") {
    const abilities = Array.from(ability);
    ability = abilities.length === 1 ? abilities[0] : null;
  }

  const dcValue = save?.dc?.value ?? save?.dc;
  const dc = dcValue === null || dcValue === undefined ? null : Number(dcValue);
  if (dc === null || Number.isNaN(dc)) return "";
  return ability ? `${abilityAbbreviation(ability)} ${dc}` : String(dc);
}

function usesText(uses) {
  if (!uses) return DASH;

  const maxValue = uses.max ?? uses.total ?? uses.capacity;
  let currentValue = uses.value ?? uses.remaining;
  if (currentValue === undefined && uses.spent !== undefined && maxValue !== undefined) {
    currentValue = Number(maxValue) - Number(uses.spent);
  }

  if (maxValue === undefined && currentValue === undefined) return DASH;

  const max = maxValue === null || maxValue === "" ? undefined : Number(maxValue);
  const current = currentValue === null || currentValue === "" ? undefined : Number(currentValue);
  if ((max ?? 0) === 0 && (current ?? 0) === 0) return DASH;
  if (max === undefined) return String(current ?? 0);
  return `${current ?? 0}/${max}`;
}

function activationShort(activity) {
  const activation = activity?.time ?? activity?.activation ?? activity?.system?.activation;
  const type = String(activation?.type ?? activation?.value ?? "").toLowerCase();
  if (["action", "a"].includes(type)) return "A";
  if (["bonus", "bonusaction", "ba"].includes(type)) return "B";
  if (["reaction", "r"].includes(type)) return "R";
  if (["minute", "min"].includes(type)) return "dk";
  if (["hour", "hr"].includes(type)) return "sa";
  if (type === "day") return "g";
  return type ? type.slice(0, 3).toUpperCase() : DASH;
}

function activityRow(activity, item) {
  return {
    name: activity?.name ?? item.name,
    icon: activity?.icon ?? activity?.img ?? "",
    usesText: usesText(activity?.uses),
    timeShort: activationShort(activity),
    damageHtml: buildDamageHtml(activity)
  };
}

async function itemRow(item, actor) {
  const labels = item.labels ?? {};
  const primaryActivity = getPrimaryActivity(item);
  const rollText =
    saveTextFromActivity(primaryActivity) ||
    normalizeLabel(labels.toHit) ||
    normalizeLabel(labels.attack) ||
    normalizeLabel(labels.roll) ||
    DASH;
  const damageText =
    normalizeLabel(labels.damage) ||
    normalizeLabel(labels.damages) ||
    normalizeLabel(labels.dmg);
  const damageHtml = buildDamageHtml(item, damageText);
  const description = await TextEditor.enrichHTML(item.system?.description?.value ?? "", {
    async: true,
    documents: true,
    links: true,
    rolls: true,
    secrets: false,
    relativeTo: actor
  });

  return {
    id: item.id,
    name: item.name,
    img: item.img,
    uses: usesText(item.system?.uses),
    rollText,
    dmgHtml: damageHtml || damageText || DASH,
    range: normalizeLabel(labels.range) || DASH,
    target: normalizeLabel(labels.target) || DASH,
    description,
    activities: getActivities(item).map((activity) => activityRow(activity, item))
  };
}

function spellIdentity(item) {
  return (
    item?.flags?.core?.sourceId ||
    item?.flags?.dnd5e?.sourceId ||
    item?.system?.sourceId ||
    item?.system?.identifier ||
    item?.system?.slug ||
    `${item?.name ?? ""}|${item?.system?.level ?? ""}|${item?.system?.school ?? ""}`
  );
}

export async function prepareActionEconomyContext(context, moduleId) {
  const buckets = {
    action: [],
    bonus: [],
    reaction: [],
    actionCount: 0,
    bonusCount: 0,
    reactionCount: 0
  };
  const seenSpells = {
    action: new Set(),
    bonus: new Set(),
    reaction: new Set()
  };
  const filters = game.settings.get(moduleId, "aeFilters") ?? {};

  for (const item of this.actor.items) {
    const bucket = activationBucketFromItem(item);
    if (!bucket) continue;

    const category = itemCategory(item);
    if (category === "spells") {
      const identity = spellIdentity(item);
      if (seenSpells[bucket].has(identity)) continue;
      seenSpells[bucket].add(identity);
      if (!shouldIncludeSpell(item, filters.spells)) continue;
    } else if (filters[category] === false) {
      continue;
    }

    buckets[bucket].push(await itemRow(item, this.actor));

    if (category === "spells") continue;
    for (const activity of getActivities(item).filter(isSpellLikeActivity)) {
      const activityBucket = activationBucketFromActivity(activity) ?? bucket;
      const row = await itemRow(item, this.actor);
      const damageHtml = buildDamageHtml(activity);
      row.name = activity.name ?? row.name;
      row.img = activity.icon ?? activity.img ?? row.img;
      row.rollText = typeof activity.rollAttack === "function"
        ? game.i18n.localize("ACTION_SHEET.RollAttack")
        : saveTextFromActivity(activity) || row.rollText;
      row.dmgHtml = damageHtml || row.dmgHtml;
      row.activities = [activityRow(activity, item)];
      buckets[activityBucket].push(row);
    }
  }

  const sortByName = (left, right) =>
    (left.name ?? "").localeCompare(right.name ?? "", game.i18n.lang);
  buckets.action.sort(sortByName);
  buckets.bonus.sort(sortByName);
  buckets.reaction.sort(sortByName);
  buckets.actionCount = buckets.action.length;
  buckets.bonusCount = buckets.bonus.length;
  buckets.reactionCount = buckets.reaction.length;

  context.actionEconomy = buckets;
  return context;
}

export function attachActionEconomyListeners(sheet, html, moduleId) {
  for (const element of html.querySelectorAll(".action-economy [data-ae-action='toggle']")) {
    element.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const row = element.closest("tr.ae-row");
      const summary = row?.nextElementSibling;
      if (!summary?.classList.contains("ae-summary-row")) return;

      const isOpen = summary.classList.toggle("open");
      const icon = row.querySelector(".ae-toggle i");
      icon?.classList.toggle("fa-chevron-down", !isOpen);
      icon?.classList.toggle("fa-chevron-up", isOpen);
    });
  }

  for (const element of html.querySelectorAll(".action-economy [data-ae-action='open-filter']")) {
    element.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await openFilterDialog(moduleId);
    });
  }

  for (const row of html.querySelectorAll(".action-economy tr.ae-row")) {
    row.addEventListener("click", (event) => {
      if (event.target.closest("[data-ae-action]")) return;
      const item = sheet.actor.items.get(row.dataset.itemId);
      if (typeof item?.use === "function") item.use({ event });
    });
  }
}
