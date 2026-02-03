console.log("[sidebar-traits] module loaded");

const MODULE_ID = "sidebar-traits";

function rerenderOpenCharacterSheets() {
  // Foundry v13 can track open apps in multiple registries depending on Application API (V1/V2).
  const apps = new Set();

  try {
    for (const app of Object.values(ui?.windows ?? {})) apps.add(app);
  } catch (_) {}

  try {
    const inst = globalThis.foundry?.applications?.instances;
    if (inst) {
      // Map-like in v13
      if (typeof inst.values === "function") {
        for (const app of inst.values()) apps.add(app);
      } else {
        for (const app of Object.values(inst)) apps.add(app);
      }
    }
  } catch (_) {}

  try {
    for (const app of apps) {
      if (!app) continue;

      // Only re-render open Actor sheets (character sheets are Actor sheets).
      const isActorSheet =
        app.documentName === "Actor" ||
        app.actor ||
        (app.options?.documentType === "Actor");

      if (!isActorSheet) continue;

      // In v13, some apps expose "rendered", others expose element length.
      const rendered =
        app.rendered === true ||
        (typeof app.element?.length === "number" && app.element.length > 0);

      if (!rendered) continue;

      if (typeof app.render === "function") app.render(true);
    }
  } catch (e) {
    console.error("[sidebar-traits] rerenderOpenCharacterSheets failed", e);
  }
}



function shouldIncludeSpell(spell, spellsFilter) {
  // spellsFilter: { all, prepared, ritual }
  if (!spell) return false;
  const sys = spell.system ?? {};

  // In dnd5e 5.1+ "preparation" is deprecated in favor of "method" + "prepared".
  // Avoid touching sys.preparation unless we must (older system data).
  let method;
  if (Object.prototype.hasOwnProperty.call(sys, "method")) method = sys.method;
  else if (Object.prototype.hasOwnProperty.call(sys, "preparation")) method = sys.preparation?.mode;

  let prepared;
  if (Object.prototype.hasOwnProperty.call(sys, "prepared")) prepared = !!sys.prepared;
  else if (Object.prototype.hasOwnProperty.call(sys, "preparation")) prepared = !!sys.preparation?.prepared;

  const isRitual = !!(sys.ritual ?? sys.properties?.ritual);

  // If "all" is enabled, accept any spell
  if (spellsFilter?.all) return true;

  // Otherwise match specific sub-filters
  const wantPrepared = !!spellsFilter?.prepared;
  const wantRitual = !!spellsFilter?.ritual;
  const wantCantrips = !!spellsFilter?.cantrips;

  const level = Number(sys.level?.value ?? sys.level ?? sys.levels ?? 0);
  const isCantrip = level === 0;

  let ok = false;

  if (wantPrepared) {
    // prepared spells + always/atwill/innate-style methods
    // method values vary by dnd5e version; we include common ones.
    ok = ok || prepared || ["always", "atwill", "innate", "pact"].includes(String(method ?? "").toLowerCase());
  }

  if (wantRitual) {
    ok = ok || isRitual;
  }

    if (wantCantrips) {
    ok = ok || isCantrip;
  }

  return ok;
}

function isSpellLikeActivity(activity) {
  const t = activity?.type ?? activity?.kind ?? activity?.activityType;
  return t === "spell" || t === "cast" || t === "spellcast";
}

const DASH = "—";

function aeCategoryForItem(item) {
  const t = item?.type ?? "";
  if (t === "weapon") return "weapons";
  if (t === "spell") return "spells";
  if (t === "equipment") return "equipment";
  if (t === "consumable") return "consumables";
  if (t === "tool") return "tools";
  // Features are usually feats, classes, subclasses, backgrounds, etc.
  if (t === "feat" || t === "class" || t === "subclass" || t === "background") return "features";
  return "other";
}


function aeDamageAndHealingIcon(damageType) {
  const key = aeMapDamageLabelToKey(damageType) || (damageType ?? "").toString().trim();
  const dmg = globalThis.CONFIG?.DND5E?.damageTypes?.[key];
  const heal = globalThis.CONFIG?.DND5E?.healingTypes?.[key];
  const data = dmg ?? heal ?? null;
  if (!data) return null;
  const label = data.label ? game.i18n.localize(data.label) : key;
  const icon = data.icon ?? `systems/dnd5e/icons/svg/damage/${key}.svg`;
  return { label, icon };
}


function aeMapDamageLabelToKey(label) {
  const txt = (label ?? "").toString().trim().toLowerCase();
  if (!txt) return "";
  const dmg = globalThis.CONFIG?.DND5E?.damageTypes ?? {};
  const heal = globalThis.CONFIG?.DND5E?.healingTypes ?? {};
  // direct key
  if (dmg[txt] || heal[txt]) return txt;

  const all = Object.entries(dmg).concat(Object.entries(heal));
  for (const [k, v] of all) {
    const lab = v?.label ? game.i18n.localize(v.label).toLowerCase() : "";
    if (lab && (txt === lab || lab.includes(txt) || txt.includes(lab))) return k;
  }

  // common TR / EN synonyms (fallback)
  const map = {
    "ezme":"bludgeoning",
    "delme":"piercing",
    "kesme":"slashing",
    "bludgeoning":"bludgeoning",
    "piercing":"piercing",
    "slashing":"slashing",
    "bludgeon":"bludgeoning",
    "pierce":"piercing",
    "slash":"slashing"
  };
  return map[txt] ?? "";
}

function aeGetSaveTextFromActivity(activity) {
  if (!activity) return "";
  const save = activity.save ?? activity.system?.save ?? null;
  if (!save) return "";

  // Ability can be a Set (multiple abilities), a string, or something else
  let abilityKey = null;
  try {
    const abil = save.ability;
    if (abil?.size != null && typeof abil[Symbol.iterator] === "function") {
      const arr = Array.from(abil);
      if (arr.length === 1) abilityKey = arr[0];
    } else if (typeof abil === "string" && abil) {
      abilityKey = abil;
    }
  } catch (e) {}

  // DC
  const dcVal = save?.dc?.value ?? save?.dc ?? null;
  const dcNum = dcVal == null ? null : Number(dcVal);
  if (dcNum == null || Number.isNaN(dcNum)) return "";

  const AE_ABILITY_CAMEL = { str: "Str", dex: "Dex", con: "Con", int: "Int", wis: "Wis", cha: "Cha" };

  

if (abilityKey) {
  const camel = AE_ABILITY_CAMEL[abilityKey];
  const i18nKey = camel ? `DND5E.Ability${camel}Abbr` : null;

  // Prefer dnd5e localization so EN/TR/etc. follow Foundry language
  let abbr = null;
  try {
    if (i18nKey && game?.i18n?.localize) {
      const loc = game.i18n.localize(i18nKey);
      // If localization key is missing, Foundry returns the key itself
      if (loc && loc !== i18nKey) abbr = loc;
    }
  } catch (e) {}

  // Fallbacks
  if (!abbr) {
    abbr = globalThis.CONFIG?.DND5E?.abilities?.[abilityKey]?.abbreviation ?? abilityKey;
  }

  return `${String(abbr).toUpperCase()} ${dcNum}`;
}
  // If no single ability, just show DC number (no label)
  return `${dcNum}`;
}

function normalizeLabel(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number") return String(val);
  if (Array.isArray(val)) return val.map(normalizeLabel).filter(Boolean).join(", ");
  if (typeof val === "object") {
    if (typeof val.label === "string") return val.label.trim();
    if (typeof val.text === "string") return val.text.trim();
    if (Array.isArray(val.parts)) {
      const formulas = val.parts.map(p => Array.isArray(p) ? (p[0] ?? "") : "").filter(Boolean);
      const types = val.parts.map(p => Array.isArray(p) ? (p[1] ?? "") : "").filter(Boolean);
      const f = formulas.join(" + ");
      const t = [...new Set(types)].filter(Boolean).join(", ");
      return t ? `${f} (${t})` : f;
    }
    try { return JSON.stringify(val); } catch (e) { return ""; }
  }
  return "";
}


function damageKeyFromLocalizedLabel(label) {
  if (!label) return null;
  const l = label.trim().toLowerCase();

  // Search damageTypes then healingTypes for a localized label match
  const types = [
    ["damageTypes", globalThis.CONFIG?.DND5E?.damageTypes],
    ["healingTypes", globalThis.CONFIG?.DND5E?.healingTypes]
  ];

  for (const [, cfg] of types) {
    if (!cfg) continue;
    let best = null;
    for (const [k, v] of Object.entries(cfg)) {
      const raw = v?.label ?? "";
      const loc = raw ? game.i18n.localize(raw) : "";
      const cand = loc.trim().toLowerCase();
      if (!cand) continue;
      // Prefer exact word/ending matches and longer labels
      if (l === cand || l.endsWith(" " + cand) || l.includes(cand)) {
        if (!best || cand.length > best.cand.length) best = { key: k, cand };
      }
    }
    if (best) return best.key;
  }

  // Extra: common Turkish verb form "iyileştir" -> healing
  if (l.includes("iyileştir")) return "healing";
  return null;
}

function iconForDamageKey(key) {
  if (!key) return "";
  const icon =
    globalThis.CONFIG?.DND5E?.damageTypes?.[key]?.icon ??
    globalThis.CONFIG?.DND5E?.healingTypes?.[key]?.icon ??
    `systems/dnd5e/icons/svg/damage/${key}.svg`;
  return icon;
}

function renderDamageRow(formulaText, keyOrLabel) {
  const key = keyOrLabel && (globalThis.CONFIG?.DND5E?.damageTypes?.[keyOrLabel] || globalThis.CONFIG?.DND5E?.healingTypes?.[keyOrLabel])
    ? keyOrLabel
    : damageKeyFromLocalizedLabel(keyOrLabel);

  const label =
    (key && (globalThis.CONFIG?.DND5E?.damageTypes?.[key]?.label || globalThis.CONFIG?.DND5E?.healingTypes?.[key]?.label))
      ? game.i18n.localize(globalThis.CONFIG?.DND5E?.damageTypes?.[key]?.label ?? globalThis.CONFIG?.DND5E?.healingTypes?.[key]?.label)
      : (keyOrLabel ?? "");

  const icon = key ? iconForDamageKey(key) : "";
  const iconHtml = icon ? `<span data-tooltip="${label}" aria-label="${label}"><dnd5e-icon src="${icon}"></dnd5e-icon></span>` : "";
  const f = (formulaText ?? "").trim();
  return `<div class="row"><span class="formula">${f || "—"}</span>${iconHtml}</div>`;
}

function parseDamageTextToHtml(txt) {
  const s = (txt ?? "").trim();
  if (!s) return "";

  // Multiple parts separated by comma
  const parts = s.split(",").map(p => p.trim()).filter(Boolean);

  return parts.map(seg => {
    // Try to find a known localized damage label inside the segment
    const cfg = globalThis.CONFIG?.DND5E?.damageTypes ?? {};
    const heal = globalThis.CONFIG?.DND5E?.healingTypes ?? {};
    const candidates = [];

    const addCand = (k, v) => {
      const raw = v?.label ?? "";
      const loc = raw ? game.i18n.localize(raw) : "";
      const cand = loc.trim();
      if (cand) candidates.push({ key: k, label: cand, len: cand.length });
    };

    for (const [k,v] of Object.entries(cfg)) addCand(k,v);
    for (const [k,v] of Object.entries(heal)) addCand(k,v);

    // Add common Turkish "iyileştir"
    candidates.push({ key: "healing", label: "iyileştir", len: 9 });

    const lower = seg.toLowerCase();
    let best = null;
    for (const c of candidates) {
      const cl = c.label.toLowerCase();
      if (!cl) continue;
      if (lower.includes(cl)) {
        if (!best || c.len > best.len) best = c;
      }
    }

    if (best) {
      // Remove the label from segment to get formula-ish portion
      const formula = seg.replace(new RegExp(best.label, "i"), "").trim();
      return renderDamageRow(formula, best.key);
    }

    // Fallback: show the whole segment as formula
    return `<div class="row"><span class="formula">${seg}</span></div>`;
  }).join("");
}


function aeAbilityAbbr(keyOrLabel) {
  const k = (keyOrLabel ?? "").toString().trim().toLowerCase();
  const cfg = globalThis.CONFIG?.DND5E?.abilities ?? {};
  if (cfg[k]) {
    const ab = cfg[k]?.abbreviation ? game.i18n.localize(cfg[k].abbreviation) : k.toUpperCase();
    return ab;
  }
  // Try match against localized labels/abbreviations
  for (const [key, v] of Object.entries(cfg)) {
    const lab = v?.label ? game.i18n.localize(v.label).toLowerCase() : "";
    const ab  = v?.abbreviation ? game.i18n.localize(v.abbreviation).toLowerCase() : "";
    if (k === lab || k === ab || lab.includes(k) || ab === k) {
      return v?.abbreviation ? game.i18n.localize(v.abbreviation) : key.toUpperCase();
    }
  }
  return (keyOrLabel ?? "—").toString().slice(0, 3).toUpperCase();
}

function aeExtractSave(label) {
  if (!label || typeof label !== "string") return null;
  // Examples: "ÇEV DC 13", "DC 13 ÇEV", "Dex DC 13"
  const m1 = label.match(/([A-Za-zÇĞİÖŞÜçğıöşü]{3,})\s*DC\s*(\d+)/i);
  const m2 = label.match(/DC\s*(\d+)\s*([A-Za-zÇĞİÖŞÜçğıöşü]{3,})/i);
  const dc = m1 ? Number(m1[2]) : (m2 ? Number(m2[1]) : null);
  const abilTxt = m1 ? m1[1] : (m2 ? m2[2] : null);
  if (!abilTxt || dc == null || Number.isNaN(dc)) return null;
  return { ability: abilTxt, dc };
}

function aeSaveTextFromActivity(act) {
  if (!act) return "";
  const labels = act.labels ?? act?.system?.labels ?? {};
  const s = act.system?.save ?? act.save ?? null;

  let ability = (s?.ability ?? s?.abil ?? s?.attribute ?? s?.stat ?? "").toString().trim();
  let dc = s?.dc ?? s?.value ?? s?.DC ?? null;

  // Fallback to labels.save if present
  if ((!ability || dc == null) && typeof labels.save === "string" && labels.save) {
    const parsed = aeExtractSave(labels.save);
    if (parsed) {
      if (!ability) ability = parsed.ability;
      if (dc == null) dc = parsed.dc;
    }
  }

  // Sometimes save data is nested differently
  if (!ability && act.system?.save?.ability) ability = String(act.system.save.ability);
  if (dc == null && act.system?.save?.dc != null) dc = act.system.save.dc;

  if (!ability) return "";
  const abbr = aeAbilityAbbr(ability);
  const nDc = dc == null ? null : Number(dc);
  const dcText = (nDc == null || Number.isNaN(nDc)) ? "DC —" : `DC ${nDc}`;
  return `${abbr} ${dcText}`;
}


function getActivities(item) {
  const acts = item?.system?.activities;
  if (!acts) return [];
  if (Array.isArray(acts)) return acts;
  if (Array.isArray(acts.contents)) return acts.contents;
  if (typeof acts === "object") return Object.values(acts).filter(a => a && typeof a === "object");
  return [];
}

function getActivityById(item, id) {
  return getActivities(item).find(a => (a.id ?? a._id) === id) ?? null;
}

function getPrimaryUsableActivity(item) {
  const list = getActivities(item);
  return list.find(a => a?.canUse) ?? list[0] ?? null;
}

function getActivationBucket(item) {
  for (const a of getActivities(item)) {
    const t = a?.activation?.type;
    if (t === "action") return "action";
    if (t === "bonus") return "bonus";
    if (t === "reaction") return "reaction";
  }
  const t = item?.system?.activation?.type;
  if (t === "action") return "action";
  if (t === "bonus") return "bonus";
  if (t === "reaction") return "reaction";
  const lbl = item?.labels?.activation ?? "";
  if (/bonus/i.test(lbl)) return "bonus";
  if (/reaksiyon|reaction/i.test(lbl)) return "reaction";
  if (/aksiyon|action/i.test(lbl)) return "action";
  return null;
}

function getActivationBucketFromActivity(activity) {
  const t = activity?.activation?.type ?? activity?.system?.activation?.type ?? null;
  if (!t) return null;
  if (t === "bonus") return "bonus";
  if (t === "reaction") return "reaction";
  if (t === "action") return "action";
  return null;
}

function patchCharacterSheet() {
  const sheetCls = globalThis.dnd5e?.applications?.actor?.CharacterActorSheet;
  if (!sheetCls) {
    console.warn("[sidebar-traits] dnd5e CharacterActorSheet not found yet");
    return false;
  }

  const sidebarTpl = `modules/${MODULE_ID}/templates/actors/character-sidebar.hbs`;
  const detailsTpl = `modules/${MODULE_ID}/templates/actors/tabs/character-details.hbs`;
  sheetCls.PARTS.sidebar.template = sidebarTpl;
  sheetCls.PARTS.details.template = detailsTpl;

  const proto = sheetCls.prototype;

  if (!proto.__sidebarTraitsPatched) {
    const orig = proto._prepareSidebarContext;
    proto._prepareSidebarContext = async function(context, options) {
      context = await orig.call(this, context, options);
      if (!context.traits && typeof this._prepareTraits === "function") context.traits = this._prepareTraits(context);
      if (!context.senses && typeof this._prepareSenses === "function") context.senses = this._prepareSenses(context);
      return context;
    };
    proto.__sidebarTraitsPatched = true;
  }

  if (!proto.__actionEconomyPatched) {
    const orig = proto._prepareDetailsContext;
    proto._prepareDetailsContext = async function(context, options) {
      context = await orig.call(this, context, options);

      const buckets = {
        action: [], bonus: [], reaction: [],
        actionCount: 0, bonusCount: 0, reactionCount: 0
      
      };

      // De-duplicate rows (mainly spells) by shared sourceId/identifier.
      const __aeSeen = { action: new Set(), bonus: new Set(), reaction: new Set() };

      /**
       * Build damage HTML for either an Item or an Activity.
       *
       * Prefer label damages when available because dnd5e already formats + localizes them.
       * Fall back to system damage parts otherwise.
       */
      const buildDamageHtml = (source, labelsOverride = null) => {
        const labels = labelsOverride ?? source?.labels ?? null;
        const labelDamages = Array.isArray(labels?.damages) ? labels.damages : null;

        // Label-based damages (already localized by system)
        if (labelDamages && labelDamages.length) {
          const rows = labelDamages
            .map((d) => {
              // Try to extract the last token as a damage/healing type key.
              // Example: "1d8 healing" or "2d6 fire".
              const t = String(d).trim().split(/\s+/).pop();
              const iconKey = mapDamageOrHealingTypeToIconKey(t);
              return renderDamageRow({ formula: d, iconKey, tooltip: localizeDamageOrHealingType(t) });
            })
            .join("");
          return rows || "—";
        }

        // Raw parts (formula, type)
        const parts = source?.damage?.parts ?? source?.system?.damage?.parts;
        if (!Array.isArray(parts) || !parts.length) return "—";

        const rows = parts
          .map((p) => {
            const formula = Array.isArray(p) ? p[0] : p?.formula;
            const type = Array.isArray(p) ? p[1] : p?.type;
            if (!formula) return "";
            const iconKey = mapDamageOrHealingTypeToIconKey(type);
            return renderDamageRow({ formula, iconKey, tooltip: localizeDamageOrHealingType(type) });
          })
          .join("");

        return rows || "—";
      };

      const makeRow = async (item) => {
        const labels = item.labels ?? {};

        const uses = (() => {
          const u = item.system?.uses;
          if (!u) return "";
          const max = u.max;
          const val = u.value;
          const hasMax = (max !== null && max !== undefined && max !== "" && max !== 0);
          const hasVal = (val !== null && val !== undefined && val !== "" && val !== 0);
          if (!hasMax && !hasVal) return "";
          if (max === null || max === undefined || max === "") return `${val ?? 0}`;
          if ((max ?? 0) === 0 && (val ?? 0) === 0) return "";
          return `${val ?? 0}/${max ?? 0}`;
        })();

        const rollOrSave =
          normalizeLabel(labels.toHit) ||
          normalizeLabel(labels.attack) ||
          normalizeLabel(labels.roll);

// If this item uses a Saving Throw (most commonly via its primary Activity),
// show it in the Zar / ST column when there is no attack roll.
const primaryAct = getPrimaryUsableActivity(item);
const saveText = aeGetSaveTextFromActivity(primaryAct);


        const damage =
          normalizeLabel(labels.damage) ||
          normalizeLabel(labels.damages) ||
          normalizeLabel(labels.dmg);
const localizeDmgType = (t) => {
  const cfg = globalThis.CONFIG?.DND5E?.damageTypes?.[t];
  if (cfg?.label) return game.i18n.localize(cfg.label);
  const h = globalThis.CONFIG?.DND5E?.healingTypes?.[t];
  if (h?.label) return game.i18n.localize(h.label);
  return t ? String(t) : "";
};

const buildDamageHtml = () => {
const damages = labels?.damages;
if (Array.isArray(damages) && damages.length) {
  const rows = damages
    .filter((d) => d && d.formula && d.firstDamage !== false)
    .map((d) => {
      const di = aeDamageAndHealingIcon(d.damageType);
      const iconHtml = di ? `<span data-tooltip="${di.label}" aria-label="${di.label}"><dnd5e-icon src="${di.icon}"></dnd5e-icon></span>` : "";
      return `<div class="row"><span class="formula">${d.formula}</span>${iconHtml}</div>`;
    });
  return rows.join("");
}


          const parts = item.system?.damage?.parts;
          if (Array.isArray(parts) && parts.length) {
            const rows = parts.map(([formula, dtype]) => {
                          const f = formula ?? "";
            const tKey = dtype ?? "";

              const label =
                globalThis.CONFIG?.DND5E?.damageTypes?.[tKey]?.label ??
                globalThis.CONFIG?.DND5E?.healingTypes?.[tKey]?.label ??
                tKey;
              const loc = label ? game.i18n.localize(label) : "";
              const icon =
                globalThis.CONFIG?.DND5E?.damageTypes?.[tKey]?.icon ??
                globalThis.CONFIG?.DND5E?.healingTypes?.[tKey]?.icon ??
                (tKey ? `systems/dnd5e/icons/svg/damage/${tKey}.svg` : "");
              const iconHtml = icon ? `<span data-tooltip="${loc}" aria-label="${loc}"><dnd5e-icon src="${icon}"></dnd5e-icon></span>` : "";
              return `<div class="row"><span class="formula">${f}</span>${iconHtml}</div>`;
            });
            return rows.join("");
          }
          const txt = damage ? damage : "";
          return txt ? parseDamageTextToHtml(txt) : "";
        };

const dmgHtml = buildDamageHtml();

        const range = normalizeLabel(labels.range);
        const target = normalizeLabel(labels.target);

const rawDescription = item.system?.description?.value ?? "";
const description = await TextEditor.enrichHTML(rawDescription, {
  async: true,
  documents: true,
  links: true,
  rolls: true,
  secrets: false,
  relativeTo: this.actor
});


        const localizeActDmgType = (t) => {
  const cfg = globalThis.CONFIG?.DND5E?.damageTypes?.[t];
  if (cfg?.label) return game.i18n.localize(cfg.label);
  const h = globalThis.CONFIG?.DND5E?.healingTypes?.[t];
  if (h?.label) return game.i18n.localize(h.label);
  return t ? String(t) : "";
};

const buildPartsHtml = (parts, fallbackText="") => {
          // Normalize various shapes into an array of [formula, type]
          let arr = parts;

          // Some activity damage payloads are objects, Maps, or Collections
          if (arr && !Array.isArray(arr)) {
            if (Array.isArray(arr.parts)) arr = arr.parts;
            else if (typeof arr[Symbol.iterator] === "function") arr = Array.from(arr);
            else if (typeof arr === "object") arr = Object.values(arr);
          }

          if (!Array.isArray(arr) || !arr.length) {
            return fallbackText ? parseDamageTextToHtml(fallbackText) : "";
          }

          return arr.map((p) => {
  const formula = Array.isArray(p) ? (p[0] ?? "") : (p?.formula ?? p?.value ?? "");
  const dtypeRaw = Array.isArray(p) ? (p[1] ?? "") : (p?.type ?? p?.damageType ?? p?.damageTypes ?? p?.types ?? "");

  const normTypeAct = (dt) => {
    if (!dt) return "";
    if (Array.isArray(dt)) return dt[0] ?? "";
                // Set/Iterable
                if (dt?.size != null && typeof dt[Symbol.iterator] === "function") return Array.from(dt)[0] ?? "";
    if (typeof dt === "object") return dt.type ?? dt.value ?? dt.damageType ?? (Array.isArray(dt.types) ? (dt.types[0] ?? "") : "") ?? "";
    const s = String(dt);
                return aeMapDamageLabelToKey(s) || s;
  };

  const tKey = normTypeAct(dtypeRaw);
  const label =
    globalThis.CONFIG?.DND5E?.damageTypes?.[tKey]?.label ??
    globalThis.CONFIG?.DND5E?.healingTypes?.[tKey]?.label ??
    tKey;
  const loc = label ? game.i18n.localize(label) : "";
  const icon =
    globalThis.CONFIG?.DND5E?.damageTypes?.[tKey]?.icon ??
    globalThis.CONFIG?.DND5E?.healingTypes?.[tKey]?.icon ??
    (tKey ? `systems/dnd5e/icons/svg/damage/${tKey}.svg` : "");
  const iconHtml = icon
    ? `<span data-tooltip="${loc}" aria-label="${loc}"><dnd5e-icon src="${icon}"></dnd5e-icon></span>`
    : "";

  const f = formula ?? "";
  return `<div class="row"><span class="formula">${f}</span>${iconHtml}</div>`;
}).join("");
        };

function activityTimeShort(act) {
  const t = act?.activation?.type;
  if (t === "action") return "A";
  if (t === "bonus") return "B";
  if (t === "reaction") return "R";
  if (!t) return "—";
  return String(t).charAt(0).toUpperCase();
}

function activityUsesText(act) {
  const u = act?.uses;
  if (!u) return "—";
  const max = u.max ?? u.total ?? u.capacity;
  const val = u.value ?? u.spent ?? u.remaining;
  const hasAny = (max ?? val) !== undefined;
  if (!hasAny) return "—";
  if (max === undefined || max === null || max === "") return `${val ?? 0}`;
  if ((max ?? 0) === 0 && (val ?? 0) === 0) return "—";
  return `${val ?? 0}/${max ?? 0}`;
}

const activityDamageHtml = (act) => {
const damages = act?.labels?.damages ?? act?.label?.damages ?? null;
if (Array.isArray(damages) && damages.length) {
  return damages
    .filter((d) => d && d.formula && d.firstDamage !== false)
    .map((d) => {
      const di = aeDamageAndHealingIcon(d.damageType);
      const iconHtml = di ? `<span data-tooltip="${di.label}" aria-label="${di.label}"><dnd5e-icon src="${di.icon}"></dnd5e-icon></span>` : "";
      return `<div class="row"><span class="formula">${d.formula}</span>${iconHtml}</div>`;
    })
    .join("");
}


  const parts = act?.damage?.parts ?? act?.damage?.damageParts ?? act?.damageParts ?? act?.system?.damage?.parts ?? act?.system?.damageParts;
  const lbl = normalizeLabel(act?.labels?.damage) || normalizeLabel(act?.labels?.damages) || normalizeLabel(act?.labels?.dmg);
  return buildPartsHtml(parts, lbl);
};

const activities = getActivities(item).map(a => {
  const id = a.id ?? a._id ?? "";
  const name = a.name ?? item.name;
  const icon = a.icon ?? a.img ?? "";
  return {
    id,
    name,
    icon,
    usesText: activityUsesText(a),
    timeShort: activityTimeShort(a),
    damageHtml: activityDamageHtml(a),
    hasRollAttack: typeof a.rollAttack === "function",
    hasRollDamage: typeof a.rollDamage === "function",
    hasUse: typeof a.use === "function"
  };
});


        return {
          id: item.id,
          name: item.name,
          img: item.img,
          uses: uses ? uses : DASH,
          rollText: (saveText ? saveText : (rollOrSave ? rollOrSave : DASH)),
          rollHtml: "",
          dmgText: damage ? damage : DASH,
          dmgHtml: dmgHtml ? dmgHtml : (damage ? damage : DASH),
          range: range ? range : DASH,
          target: target ? target : DASH,
          description,
          activities
        };
      };

      const __aeFilters = game.settings.get(MODULE_ID, "aeFilters") ?? {};
for (const item of this.actor.items) {
  const bucket = getActivationBucket(item);
  if (!bucket) continue;

  const cat = aeCategoryForItem(item);
  // If an actor has multiple copies of the same spell (e.g. dragged in more than once),
  // only show it once in this table.
  if (cat === "spells") {
    const src = item?.flags?.core?.sourceId || item?.flags?.dnd5e?.sourceId || item?.system?.sourceId || item?.system?.identifier || item?.system?.slug;
    const lvl = item?.system?.level ?? "";
    const sch = item?.system?.school ?? "";
    const key = src || `${item?.name ?? ""}|${lvl}|${sch}`;
    if (__aeSeen[bucket].has(key)) continue;
    __aeSeen[bucket].add(key);
  }

  // default is visible if missing key
  if (cat !== "spells") {
    if (__aeFilters?.[cat] === false) continue;
  } else {
    const spellFilter = __aeFilters?.spells;
    if (!shouldIncludeSpell(item, spellFilter)) continue;
  }

  buckets[bucket].push(await makeRow(item));

  // Spell-like activities embedded in non-spell items/features:
  // These should respect the parent category filter (equipment/features/etc.) and remain visible even if the Spells filter is off.
  const acts = getActivities(item).filter(isSpellLikeActivity);
  if (cat !== "spells" && acts.length) {
    for (const act of acts) {
      const aBucket = getActivationBucketFromActivity(act) ?? bucket;
      const aRow = await makeRow(item);
      // Keep the underlying item id for interactions
      aRow.id = item.id;
      // Prefer activity label/icon
      aRow.name = act.name ?? aRow.name;
      aRow.img = act.icon ?? act.img ?? aRow.img;
      // Show only this activity in the expanded section so buttons map correctly
      aRow.activities = [{
        id: act.id ?? act._id ?? "",
        name: act.name ?? item.name,
        icon: act.icon ?? act.img ?? "",
        // Compute uses text inline so rendering never depends on external helper scope.
        usesText: (() => {
          const u = act?.uses;
          if (!u) return "—";
          const max = u.max ?? u.total ?? u.capacity;
          const val = u.value ?? u.spent ?? u.remaining;
          // If neither side is present, treat it as no-uses.
          if (max === undefined && val === undefined) return "—";
          const nMax = (max === null || max === "") ? undefined : Number(max);
          const nVal = (val === null || val === "") ? undefined : Number(val);
          if ((nMax ?? 0) === 0 && (nVal ?? 0) === 0) return "—";
          if (nMax === undefined) return String(nVal ?? 0);
          return `${nVal ?? 0}/${nMax}`;
        })(),
        // Time/activation shorthand (A/B/R etc.) computed inline so it cannot go out of scope.
        timeShort: (() => {
          const t = act?.time ?? act?.activation ?? act?.system?.activation;
          const type = (t?.type ?? t?.value ?? "").toString().toLowerCase();
          // Common D&D 5e shorthands.
          if (["action", "a"].includes(type)) return "A";
          if (["bonus", "bonusaction", "ba"].includes(type)) return "B";
          if (["reaction", "r"].includes(type)) return "R";
          if (["minute", "min"].includes(type)) return "dk";
          if (["hour", "hr"].includes(type)) return "sa";
          if (["day"].includes(type)) return "g";
          // Fallback: show a short, safe string.
          return type ? type.slice(0, 3).toUpperCase() : "–";
        })(),
	        // Damage HTML derived from the activity itself.
	        damageHtml: buildDamageHtml(act),
        hasRollAttack: typeof act.rollAttack === "function",
        hasRollDamage: typeof act.rollDamage === "function",
        hasUse: typeof act.use === "function"
      }];
      // Display roll/damage fields from the activity if present
      aRow.uses = (typeof act.use === "function") ? aRow.uses : aRow.uses;
      aRow.rollText = (typeof act.rollAttack === "function") ? game.i18n.localize("ACTION_SHEET.RollAttack") : aRow.rollText;
	      aRow.dmgHtml = buildDamageHtml(act) || aRow.dmgHtml;
	      aRow.dmgText = buildDamageHtml(act) ? "" : aRow.dmgText;

      buckets[aBucket].push(aRow);
    }
  }

}

      const sortByName = (a,b) => (a.name ?? "").localeCompare(b.name ?? "", game.i18n.lang);
      buckets.action.sort(sortByName);
      buckets.bonus.sort(sortByName);
      buckets.reaction.sort(sortByName);

      buckets.actionCount = buckets.action.length;
      buckets.bonusCount = buckets.bonus.length;
      buckets.reactionCount = buckets.reaction.length;

      context.actionEconomy = buckets;
      return context;
    };
    proto.__actionEconomyPatched = true;
  }

  if (!proto.__actionEconomyListenersPatched) {
    const orig = proto._attachPartListeners;
    proto._attachPartListeners = function(partId, html, options) {
      orig.call(this, partId, html, options);
      if (partId !== "details") return;

      html.querySelectorAll(".action-economy [data-ae-action='toggle']").forEach(el => {
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const tr = el.closest("tr.ae-row");
          const sum = tr?.nextElementSibling;
          if (!sum?.classList.contains("ae-summary-row")) return;
          const isOpen = sum.classList.toggle("open");
          const icon = tr.querySelector(".ae-toggle i");
          if (icon) {
            icon.classList.toggle("fa-chevron-down", !isOpen);
            icon.classList.toggle("fa-chevron-up", isOpen);
          }
        });
      });

      html.querySelectorAll(".action-economy [data-ae-action='open-filter']").forEach(el => {
        el.addEventListener("click", async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          await aeOpenFilterDialog(this);
        });
      });

      html.querySelectorAll(".action-economy tr.ae-row").forEach(tr => {
        tr.addEventListener("click", (ev) => {
          if (ev.target.closest("[data-ae-action]")) return;
          const id = tr.dataset.itemId;
          const item = this.actor.items.get(id);
          if (!item) return;
          if (typeof item.use === "function") item.use({ event: ev });
        });
      });

      html.querySelectorAll(".action-economy [data-ae-activity]").forEach(el => {
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const sumTr = el.closest("tr.ae-summary-row");
          const tr = sumTr?.previousElementSibling;
          const id = tr?.dataset.itemId;
          const item = this.actor.items.get(id);
          if (!item) return;

          const actId = el.dataset.aeActivity;
          const action = el.dataset.aeAction;
          const act = getActivityById(item, actId) ?? getPrimaryUsableActivity(item);

          if (action === "activity-use") {
            if (act?.use) return act.use({ event: ev });
            return item.use({ event: ev });
          }
          if (action === "roll-attack") {
            if (act?.rollAttack) return act.rollAttack({ event: ev });
            return item.use({ event: ev });
          }
          if (action === "roll-damage") {
            if (act?.rollDamage) return act.rollDamage({ event: ev });
            return item.use({ event: ev });
          }
        });
      });
    };
    proto.__actionEconomyListenersPatched = true;
  }

  foundry.applications.handlebars.loadTemplates([sidebarTpl, detailsTpl]);
  return true;
}

Hooks.once("init", () => {

game.settings.register("sidebar-traits", "aeFilters", {
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
  onChange: () => rerenderOpenCharacterSheets(),
});

  let __patched = false;
  try { __patched = patchCharacterSheet(); } catch (e) { console.error(e); }
  if (!__patched) {
    Hooks.once("ready", () => {
      try { patchCharacterSheet(); } catch (e) { console.error(e); }
    });
  }
});

async function aeOpenFilterDialog() {
  const cats = ["weapons","equipment","features","consumables","tools","other"];
  const current = game.settings.get(MODULE_ID, "aeFilters") ?? {};

  const currentSpells = (() => {
    const s = current.spells;
    if (typeof s === "boolean") return { all: s, prepared: false, ritual: false, cantrips: false };
    return {
      all: !!(s?.all),
      // default: Prepared checked
      prepared: (s?.prepared ?? true) === true,
      ritual: !!(s?.ritual),
      cantrips: !!(s?.cantrips),
    };
  })();

  const spellsGroup = `
    <li class="filter-group spells-group">
      <div class="filter-group-title">${game.i18n.localize("ACTION_SHEET.Filter.Categories.Spells")}</div>
      <label class="checkbox">
        <input type="checkbox" name="spellsAll" ${currentSpells.all ? "checked" : ""}>
        <span>${game.i18n.localize("ACTION_SHEET.Filter.Spells.All")}</span>
      </label>
      <div class="spells-suboptions">
        <label class="checkbox">
          <input type="checkbox" name="spellsPrepared" ${currentSpells.prepared ? "checked" : ""}>
          <span>${game.i18n.localize("ACTION_SHEET.Filter.Spells.Prepared")}</span>
        </label>
        <label class="checkbox">
          <input type="checkbox" name="spellsRitual" ${currentSpells.ritual ? "checked" : ""}>
          <span>${game.i18n.localize("ACTION_SHEET.Filter.Spells.Ritual")}</span>
        </label>
        <label class="checkbox">
          <input type="checkbox" name="spellsCantrips" ${currentSpells.cantrips ? "checked" : ""}>
          <span>${game.i18n.localize("ACTION_SHEET.Filter.Spells.Cantrips")}</span>
        </label>
      </div>
    </li>
  `;

  const content = `<form class="filter-dialog">
    <p>${game.i18n.localize("ACTION_SHEET.FilterPrompt")}</p>
    <ul class="filter-list">
      ${spellsGroup}
      ${cats.map((cat) => {
        const key = cat;
        const checked = current[key] !== false ? "checked" : "";
        const label = game.i18n.localize(`ACTION_SHEET.Filter.Categories.${cat[0].toUpperCase()}${cat.slice(1)}`);
        return `<li>
          <label class="checkbox">
            <input type="checkbox" name="${key}" ${checked}>
            <span>${label}</span>
          </label>
        </li>`;
      }).join("")}
    </ul>
  </form>`;

  const dlg = new Dialog({
    title: game.i18n.localize("ACTION_SHEET.FilterTitle"),
    content,
    buttons: {
      save: {
        icon: '<i class="fas fa-save"></i>',
        label: game.i18n.localize("ACTION_SHEET.FilterSave"),
        callback: async (html) => {
          const fd = new FormData(html[0].querySelector("form"));

          const next = {};
          for (const cat of cats) next[cat] = fd.get(cat) === "on";

          let spellsAll = fd.get("spellsAll") === "on";
          let spellsPrepared = fd.get("spellsPrepared") === "on";
          let spellsRitual = fd.get("spellsRitual") === "on";
          let spellsCantrips = fd.get("spellsCantrips") === "on";

          // Mutual exclusivity rules
          // - "All Spells" disables (and clears) the other spell filters.
          // - Prepared/Ritual disables "All Spells".
          // - Cantrips is independent, except it is disabled when "All Spells" is selected.
          if (spellsAll) {
            spellsPrepared = false;
            spellsRitual = false;
            spellsCantrips = false;
          } else if (spellsPrepared || spellsRitual) {
            spellsAll = false;
          }

          next.spells = { all: spellsAll, prepared: spellsPrepared, ritual: spellsRitual, cantrips: spellsCantrips };

          await game.settings.set(MODULE_ID, "aeFilters", next);
          rerenderOpenCharacterSheets();
        },
      },
      reset: {
        icon: '<i class="fas fa-undo"></i>',
        label: game.i18n.localize("ACTION_SHEET.FilterReset"),
        callback: async () => {
          const next = {};
          for (const cat of cats) next[cat] = true;
          next.spells = { all: false, prepared: true, ritual: false, cantrips: false };
          await game.settings.set(MODULE_ID, "aeFilters", next);
          rerenderOpenCharacterSheets();
        },
      },
      close: {
        icon: '<i class="fas fa-times"></i>',
        label: game.i18n.localize("ACTION_SHEET.Close"),
      },
    },
    default: "save",
  }, { width: 420 });

  dlg.render(true);

  // UI syncing
  const syncUI = () => {
    const html = dlg.element;
    const all = html.find('input[name="spellsAll"]');
    const prep = html.find('input[name="spellsPrepared"]');
    const rit = html.find('input[name="spellsRitual"]');
    const can = html.find('input[name="spellsCantrips"]');

    const allChecked = !!all.prop("checked");
    const prepChecked = !!prep.prop("checked");
    const ritChecked = !!rit.prop("checked");

    // "All Spells" is mutually exclusive with the other spell filters.
    if (allChecked) {
      prep.prop("checked", false);
      rit.prop("checked", false);
      can.prop("checked", false);
    }

    // Disable rules:
    // - If Prepared or Ritual is checked, All Spells becomes unavailable.
    // - If All Spells is checked, the other spell checkboxes become unavailable.
    all.prop("disabled", prepChecked || ritChecked);
    prep.prop("disabled", allChecked);
    rit.prop("disabled", allChecked);
    can.prop("disabled", allChecked);
  };

  // Bind
  const bind = () => {
    const html = dlg.element;
    html.find('input[name="spellsAll"], input[name="spellsPrepared"], input[name="spellsRitual"], input[name="spellsCantrips"]').on("change", syncUI);
    syncUI();
  };

// Bind after the dialog is actually rendered in the DOM
  Hooks.once("renderDialog", (app, html) => {
    if (app !== dlg) return;

    const all = html.find('input[name="spellsAll"]');
    const prep = html.find('input[name="spellsPrepared"]');
    const rit = html.find('input[name="spellsRitual"]');

    const syncUI = () => {
      if (all.prop("checked")) {
        // Clear + lock sub-options
        prep.prop("checked", false).prop("disabled", true);
        rit.prop("checked", false).prop("disabled", true);
      } else {
        prep.prop("disabled", false);
        rit.prop("disabled", false);
      }

      // If any sub-option is active, lock "All Spells"
      if (prep.prop("checked") || rit.prop("checked")) {
        all.prop("checked", false).prop("disabled", true);
      } else {
        all.prop("disabled", false);
      }
    };

    // Events
    all.on("change", syncUI);
    prep.on("change", syncUI);
    rit.on("change", syncUI);

    // Initial state
    syncUI();
  });

  return dlg;
}


