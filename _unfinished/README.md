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
