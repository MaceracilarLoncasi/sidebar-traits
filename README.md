**D&D 5e Action Sheet – v0.2.2**

This release finalizes **D&D 5e Action Sheet** module with a stable feature set, improved filtering, and expanded localization support.

**Action Sheet Overview**
View all Actions, Bonus Actions, and Reactions directly in the Details panel.

**Advanced Filtering System**
Filter by Weapons, Spells, Equipment, Features, Consumables, Tools, and Others
Spell filtering options:
- All Spells
- Prepared Spells
- Ritual Spells
- Only Cantrips

Item- and Feature-granted spells always appear correctly, independent of spell filters
Improved Spell Handling
Fixed duplicated spell entries
Proper handling of prepared, ritual, and always-prepared spells
Updated logic to avoid deprecated D&D 5e system fields

**Localization**
- English
- Türkçe (Turkish)
- Русский (Russian) — community provided translation

**UI & Stability**
Consistent layout across Actions, Bonus Actions, and Reactions
Improved name column width for long item and spell names
Multiple critical rendering issues resolved
Safe fallback behavior to prevent sheet crashes

**Notes**
This version is considered stable and suitable for long-running campaigns.
Built and tested against the current D&D 5e system.
Deprecated Foundry APIs have been avoided where possible to ensure forward compatibility.

![Action](https://github.com/user-attachments/assets/14bdaeb6-6a9f-4503-b543-c6e5a6660830)
