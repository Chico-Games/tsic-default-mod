# TSIC Definitions Export

## What this is

A JSON snapshot of every gameplay-data Definition .uasset in TSIC, exported by
`Tools/Export/export_definitions.py`. This is intended as the source of truth for an external
level editor and for any AI assistant or downstream tool that needs to read TSIC's gameplay rules
without launching Unreal Editor. The full design lives in
`docs/plans/2026-05-09-json-definitions-tooling-design.md`.

## Generation metadata

- generated_at: 2026-05-15T17:05:39.079540+00:00
- schema_version: 2
- exporter_git_rev: b9ff8cfd5

## Folder layout

One folder per concrete Definition leaf class with at least one .uasset instance. Folder names
are the class name with the `U` prefix dropped, snake_cased, and pluralized when the result ends
in `_definition`.

- ammo_definitions (1 files)
- available_recipe_rules_definitions (16 files)
- biome_definitions (25 files)
- constructable_item_definitions (270 files)
- consumable_definitions (88 files)
- containment_cage_definitions (1 files)
- craft_recipe_definitions (65 files)
- crafting_material_definitions (120 files)
- crafting_station_definitions (7 files)
- damageable_furniture_definitions (448 files)
- death_box_definitions (1 files)
- elevator_definitions (1 files)
- enemy_definitions (10 files)
- enemy_spawn_point_definitions (6 files)
- equippable_definitions (20 files)
- furniture_definitions (70 files)
- furniture_upgrade_recipe (92 files)
- furniture_with_components_definitions (2 files)
- glove_definitions (3 files)
- interactable_text_definitions (2 files)
- inventory_rules_definitions (8 files)
- layout_definitions (251 files)
- loot_definitions (79 files)
- loot_spawn_point_definitions (24 files)
- plant_recipe_definitions (4 files)
- plantable_definitions (2 files)
- production_station_definitions (10 files)
- scp_game_data (1 files)
- seed_item_definitions (9 files)
- shopping_cart_definitions (1 files)
- spawn_point_definitions (12 files)
- static_item_definitions (496 files)
- storage_definitions (17 files)
- teleporter_definitions (2 files)
- toggleable_furniture_definitions (31 files)
- trap_item_definitions (1 files)
- universal_storage_definitions (1 files)

Plus the sidecar files listed below.

## ID rule

Every JSON file's `id` field equals the .uasset filename stem, verbatim. The same string is the
filename of the JSON, and the same string is what cross-references use. Asset names are
project-wide unique; renaming a .uasset breaks any reference to it.

## Class hierarchy

Each JSON file carries:
- `class` — the leaf C++ class (e.g., `"UStorageDefinition"`).
- `schema_version` — currently `2` (lean format).

Family roots:
- UItemDefinition
- UFurnitureDefinition
- URecipeDefinition
- UWorldGenObjectDefinition
- UAchievementDefinition
- UInventoryRulesDefinition
- UAvailableRecipeRulesDefinition
- UScpGameData
- UBiomeDefinition

The full parent chain for every class lives in `_schema.json` (see below);
`.class-hierarchy.json` contains the inheritance graph with per-class instance counts and the
family root each class descends from.

## JSON format (lean values)

Property values are raw JSON — the shape mirrors the C++ `FProperty` type so the reader can
dispatch on reflection rather than on JSON tags:

- bool / int / float → JSON primitive
- FString / FName / FText → JSON string
- FGameplayTag → JSON string (`"X.Y.Z"`) or `null`
- FGameplayTagContainer → JSON array of strings
- USTRUCT → JSON object `{snake_field: value, ...}`
- TArray / TSet → JSON array
- TMap → JSON array of `{"key": ..., "value": ...}` pairs
- UENUM → JSON object `{"name": "X", "value": N}` (dual format for drift detection)
- Definition cross-reference → bare asset id string
- Asset / class path → bare path string

## Cross-references

Cross-reference values are bare asset names. To resolve one:
1. Look up the asset name in `.manifest.json` — it tells you the asset path.
2. Read the corresponding `<folder>/<asset_name>.json`.

No folder guessing required.

## What's *not* in the JSON

The exporter writes only gameplay data. It does *not* write:
- Spatial data — transforms, hitboxes, collision, loot positions. Those live on the .uasset and
  are extracted into the entity actor by `AEntityEditor`.

Asset references (meshes, textures, materials, sounds, animations, blueprint classes) are
recorded as path strings so external tools can resolve them; the runtime treats them as soft
references and only loads what it needs.

## Sidecar files

- `_schema.json` — informational type schema. Lists every class with its parent chain and
  per-property kind descriptors, every struct with its field types, and every enum with its
  members (name + integer value). The C++ reader does *not* consult this file; tooling and mod
  authors do.
- `.manifest.json` — index of every asset name → asset path.
- `.gameplay-tags.json` — every gameplay tag declared in the project.
- `.class-hierarchy.json` — full inheritance graph + per-class instance counts.
- `.asset-refs.json` — soft-asset paths → expected package GUIDs (drift detection).
- `.assets/<Class>.json` — per-class asset catalogs covering every referenced non-Definition
  asset.

These are exporter-generated indexes — do not hand-edit them.

## Status

Phase 1.0 — gameplay-data export only. The game runtime does not yet read this directory. JSON is
the source of truth for the level editor; the previous CSV-driven workflow is being retired.
