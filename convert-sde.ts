import fs from "fs";
import { parse } from "yaml";

const files = [
  "categories",
  "groups",
  "dogmaAttributeCategories",
  "dogmaAttributes",
  "dogmaEffects",
  "typeDogma",
  "types",
];

function removeLangs(obj: any) {
  for (var property in obj) {
    if (obj.hasOwnProperty(property)) {
      if (typeof obj[property] == "object") {
        /// replace any lang key with just EN
        if (obj[property].en) {
          obj[property] = obj[property].en;
        } else {
          removeLangs(obj[property]);
        }
      }
    }
  }
  return obj;
}

for (const file of files) {
  console.log(`Reading and formatting ${file}`);
  const parsed = parse(fs.readFileSync(`./sde/fsd/${file}.yaml`).toString());
  const converted = Object.keys(parsed).map((id) => {
    const obj = parsed[id];
    obj.id = parseInt(id);
    return obj;
  });
  console.log(`Writing ${file}`);
  fs.writeFileSync(
    `./sde-json/${file}.json`,
    JSON.stringify(removeLangs(converted), null, "\t")
  );
}

// const parsed = parse(fs.readFileSync(`./sde/fsd/types.yaml`).toString());
// const toArrayVersion = (parsed: any) => Object.keys(parsed).map((key) => {
//   const type = parsed[key];
//   const obj = removeLangs(type);
//   return obj;
// });
// fs.writeFileSync('./sde-json/types.json', JSON.stringify(toArrayVersion(parsed), null, '\t'));
