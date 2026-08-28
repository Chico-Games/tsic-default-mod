# Parked: outfits

These two definitions name `UOutfitDefinition`, a C++ class that does not exist
anywhere in `Source/`. Every pack load dropped them and logged a warning, twice,
in the same log people read when a definition genuinely fails (#467).

The folder is prefixed with `_` rather than deleted. That prefix is the pack's
disable convention, not a naming whim: `ScpModManagerSubsystem::IsDefinitionVirtualPath`
and `FDefinitionPackManifest` both skip any path segment starting with `_` or `.`,
so nothing here is read, hashed into the manifest, or listed as shipped content.
The files stay because the outfit intent is still wanted -- a body-slot cosmetic
that hides armour, gloves and shoes -- and re-authoring it from nothing is worse
than keeping two files nobody loads.

## To bring outfits back

1. Implement `UOutfitDefinition` and register it in `FDefinitionClassRegistry`.
2. Rename this folder back to `outfit_definitions`.
3. Put `outfit_definitions` back in `EquippableAssetRefTests::EquippableFolders`,
   and `UOutfitDefinition` back in the tier-3 gear check in
   `ResearchPipelineContentTest.cpp`. Both dropped the name when this was parked,
   because a test that allows a class the runtime cannot construct is a test that
   passes for the wrong reason.
