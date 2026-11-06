const fs = require("fs");
const path = require("path");
const { Resvg } = require(path.resolve(__dirname, "..", "docs/diagrams/activity/node_modules/@resvg/resvg-js"));

const [input, output, dpiArg] = process.argv.slice(2);
const svg = fs.readFileSync(input, "utf8");
const dpi = Number(dpiArg) || 300;

const resvg = new Resvg(svg, {
  fitTo: { mode: "zoom", value: dpi / 96 },
  font: { loadSystemFonts: true, defaultFontFamily: "Segoe UI" },
  background: "#ffffff",
});
const png = resvg.render().asPng();
fs.writeFileSync(output, png);
console.log(`${output} (${resvg.width}x${resvg.height} @ ${dpi}dpi)`);
