const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
test("module language defaults to English, supports regional Danish and falls back safely", () => {
  let module;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "MMM-MPlayer-BODK.js"), "utf8"), {
    Module: { register(name, definition) { module = definition; } }, config: { language: "da" }
  });
  assert.equal(module.defaults.language, "en");
  module.config = { ...module.defaults };
  const english = module.text("Camera");
  assert.notEqual(english, "Kamera");
  module.config.language = "da-DK";
  assert.equal(module.text("Camera"), "Kamera");
  for (const language of ["unsupported", "toString", "", "en-US"]) {
    module.config.language = language;
    assert.equal(module.text("Camera"), english);
  }
});
