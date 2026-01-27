console.log("[sidebar-traits] module loaded");

const MODULE_ID = "sidebar-traits";
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

  const abilMap = { str: "KUV", dex: "ÇEV", con: "DAY", int: "ZEK", wis: "BİL", cha: "KAR" };

  if (abilityKey) {
    const mapped = abilMap[abilityKey] ?? (globalThis.CONFIG?.DND5E?.abilities?.[abilityKey]?.abbreviation ?? abilityKey);
    const txt = String(mapped);
    return `${txt.toUpperCase()} ${dcNum}`;
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

const activityTimeShort = (act) => {
  const t = act?.activation?.type;
  if (t === "action") return "A";
  if (t === "bonus") return "B";
  if (t === "reaction") return "R";
  if (!t) return "—";
  return String(t).charAt(0).toUpperCase();
};

const activityUsesText = (act) => {
  const u = act?.uses;
  if (!u) return "—";
  const max = u.max ?? u.total ?? u.capacity;
  const val = u.value ?? u.spent ?? u.remaining;
  const hasAny = (max ?? val) !== undefined;
  if (!hasAny) return "—";
  if (max === undefined || max === null || max === "") return `${val ?? 0}`;
  if ((max ?? 0) === 0 && (val ?? 0) === 0) return "—";
  return `${val ?? 0}/${max ?? 0}`;
};

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
  // default is visible if missing key
  if (__aeFilters?.[cat] === false) continue;

  buckets[bucket].push(await makeRow(item));
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
  }
});

  try { patchCharacterSheet(); } catch (e) { console.error(e); }
});

async function aeOpenFilterDialog(sheet) {
  const current = duplicate(game.settings.get(MODULE_ID, "aeFilters") ?? {});
  const cats = [
    ["weapons", "ACTION_SHEET.Filter.Categories.Weapons"],
    ["spells", "ACTION_SHEET.Filter.Categories.Spells"],
    ["equipment", "ACTION_SHEET.Filter.Categories.Equipment"],
    ["features", "ACTION_SHEET.Filter.Categories.Features"],
    ["consumables", "ACTION_SHEET.Filter.Categories.Consumables"],
    ["tools", "ACTION_SHEET.Filter.Categories.Tools"],
    ["other", "ACTION_SHEET.Filter.Categories.Other"]
  ];

  const rows = cats.map(([key, labelKey]) => {
    const checked = current[key] !== false ? "checked" : "";
    const label = game.i18n.localize(labelKey);
    return `<label class="ae-filter-row"><input type="checkbox" name="${key}" ${checked}/> ${label}</label>`;
  }).join("");

  const content = `
  <form class="ae-filter-form">
    <p>${game.i18n.localize("ACTION_SHEET.Filter.Prompt")}</p>
    <div class="ae-filter-grid">${rows}</div>
  </form>`;

  return new Dialog({
    title: game.i18n.localize("ACTION_SHEET.Filter.Title"),
    content,
    buttons: {
      save: {
        label: game.i18n.localize("ACTION_SHEET.Filter.Save"),
        callback: async (html) => {
          const form = html[0].querySelector("form.ae-filter-form");
          const data = new FormData(form);
          const next = {};
          for (const [key] of cats) {
            next[key] = data.get(key) === "on";
          }
          await game.settings.set(MODULE_ID, "aeFilters", next);
          sheet.render(true);
        }
      },
      reset: {
        label: game.i18n.localize("ACTION_SHEET.Filter.Reset"),
        callback: async () => {
          const next = { weapons:true, spells:true, equipment:true, features:true, consumables:true, tools:true, other:true };
          await game.settings.set(MODULE_ID, "aeFilters", next);
          sheet.render(true);
        }
      }
    },
    default: "save"
  }).render(true);
}

Hooks.once("ready", () => {
  patchCharacterSheet();
});
