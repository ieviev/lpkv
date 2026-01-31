import {
  initialize,
  serializeObject,
  lookupString,
  entriesStrings,
  toObject,
  count,
} from "../../npm/src/index.ts";

const output = document.getElementById("output");
const log = (msg) => (output.textContent += msg + "\n");

async function main() {
  output.textContent = "";

  await initialize();
  log("Initialized\n");

  const data = serializeObject({ name: "Alice", age: "30", city: "New York" });
  log(`Serialized ${data.length} bytes, ${count(data)} entries`);
  log(`name: ${lookupString("name", data)}`);
  log(`age: ${lookupString("age", data)}`);
  log(`missing: ${lookupString("missing", data)}\n`);

  log("Entries:");
  for (const [key, value] of entriesStrings(data)) {
    log(`  ${key} = ${value}`);
  }

  log("\nAs object:");
  log(JSON.stringify(toObject(data), null, 2));
}

main().catch((err) => {
  output.textContent = `Error: ${err.message}`;
  console.error(err);
});
