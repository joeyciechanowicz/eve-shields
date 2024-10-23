import fs from "node:fs";
import groups from "./sde-json/groups.json";
import types from "./sde-json/types.json";
import typeDogma from "./sde-json/typeDogma.json";
import dogmaAttributes from "./sde-json/dogmaAttributes.json";

const SHIP_CAT_ID = 6;

const groupIds = new Set<number>(
  groups
    .filter((group) => group.categoryID === SHIP_CAT_ID)
    .map((group) => group.id)
);

const dogmaAttributeNames = new Map<number, string>(
  dogmaAttributes.map((dogma) => [dogma.id, dogma.name])
);

const ships = new Map<number, any>(
  (types as any[])
    .filter((type) => groupIds.has(type.groupID))
    .map((ship) => [ship.id, { ...ship, masteries: undefined }])
);

(typeDogma as any[]).forEach((dogma) => {
  if (ships.has(dogma.id)) {
    ships.get(dogma.id).dogma = {
      dogmaAttributes: Object.fromEntries(
        dogma.dogmaAttributes.map((entry) => [
          dogmaAttributeNames.get(entry.attributeID),
          entry.value,
        ])
      ),
      dogmaEffects: dogma.dogmaEffects,
    };
  }
});

fs.writeFileSync(
  "./sde-json/ships_with_dogma.json",
  JSON.stringify(Array.from(ships.values()), null, "\t")
);
