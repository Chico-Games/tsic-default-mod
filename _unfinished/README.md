# Unfinished content

Folders whose name starts with `_` are skipped by the pack loader
(`DefinitionPackManifest`, non-recursively), so nothing in here is parsed,
hashed into a mod handshake, or reachable in game. It is a holding pen, not a
second pack.

## enemy_definitions / behavior_definitions / perception_definitions

Four enemies whose behaviour, perception, attacks and drop tables were authored
but whose character blueprint was never made. While they sat in the live pack
the game claimed to have ten enemy types and could spawn five: worldgen picked
one, the class pointer resolved to nothing, and the pawn silently failed to
spawn (GH #284). They are parked rather than deleted because three of them are
the head start on open work:

| Definition | Missing asset | Issue |
|---|---|---|
| `ED_Chef` + `BHV_Chef` + `PRC_Chef` | `CH_Chef` | #52 Enemy: Cook (Restaurant) |
| `ED_CarParkAttendant` + `BHV_` + `PRC_` | `CH_CarParkAttendant` | #51 Enemy: Car Park Attendant |
| `ED_SunPillow` + `BHV_` + `PRC_` | `CH_SunPillow` | #49 Enemy: Kids (Pillow Enemy) |
| `ED_FlyingDrone` | names no class at all | — |

To finish one: make the character blueprint at the `enemy_class` path the
definition already names, then move all three of its files back into the
matching `*_definitions/` folder at the pack root. `TSIC.AI.V2.EnemyPackIntegrity`
fails if a live enemy definition names a class that is not on disk, so nothing
can drift back into the state this folder exists to prevent.

## equippable_definitions / static_item_definitions / craft_recipe_definitions

Four melee weapons whose definitions were authored but whose content never was:
no mesh, no ability set, not even a `Content/Items/Equipment/Weapons/<name>/`
folder. Live, each one loaded with two `unresolved asset ref` warnings, could be
crafted or found as a labelled cardboard box that cannot swing, and failed
`TSIC.Showcase.MuseumCoverage` ("no resolvable preview mesh") on every run.

| Equippable | World form | Recipe |
|---|---|---|
| `ID_ContainmentBaton_EQ` | `FD_ContainmentBaton_SI` | — |
| `ID_FireAxe_EQ` | `FD_FireAxe_SI` | `RD_FireAxe_CR` |
| `ID_MeatCleaver_EQ` | `FD_MeatCleaver_SI` | `RD_MeatCleaver_CR` |
| `ID_SteelPipe_EQ` | `FD_SteelPipe_SI` | `RD_SteelPipe_CR` |

To finish one: build it per `docs/melee-weapon-setup-guide.md` (mesh under the
weapon's `Content/` folder, an `AS_<Name>` ability set, montages with hitbox
notifies), then move its three files back to the pack root. `ID_Crowbar_EQ`
stays live: it has a mesh (`SM_Crowbar`) but still no ability set.
