// Exact find/replace edits from a spec file — tooling for AI-assisted sessions over a terminal bridge.
//
//   node scripts/dev/edit.js <spec.txt>     block format (any extension except .json)
//   node scripts/dev/edit.js <spec.json>    JSON array [{ "file": "tests/...", "find": "...", "replace": "...", "all": false }]
//
// Block format — marker lines, the text between them is taken verbatim (no quoting, no escaping):
//   @@@FILE <path from repo root>   file for the following edits (until the next @@@FILE)
//   @@@FIND  or  @@@FIND all        search text follows (empty = create a new file; "all" = replace every match)
//   @@@REPLACE                      replacement text follows
//   @@@END                          end of the edit
// Lines outside edits are ignored (comments). A marker out of order or an unknown "@@@..." marker is an error.
//
// Why this exists instead of retyping files: the model must never rewrite a file from earlier tool output (which may
// be truncated). Every "find" must match EXACTLY once (or at least once with "all"), otherwise NOTHING is written —
// a silent edit of the wrong place is impossible. Line endings (LF / CRLF) of each file are preserved: matching runs
// on LF text, writing restores the original format (core.autocrlf=true checks files out with CRLF on Windows).
const fs = require("fs");
const path = require("path");

// Built from char codes so the source has no backslash escapes: the terminal bridge mangles doubled backslashes.
const CR = String.fromCharCode(13);
const NL = String.fromCharCode(10);

const REPO = path.resolve(__dirname, "..", "..");
const specPath = process.argv[2];
if (!specPath) {
  console.error("Usage: node scripts/dev/edit.js <spec.txt|spec.json>");
  process.exit(2);
}
const raw = fs.readFileSync(specPath, "utf8");
const spec = specPath.endsWith(".json") ? JSON.parse(raw) : parseBlocks(raw);
const byFile = new Map();
for (const e of spec) {
  if (typeof e.file !== "string" || typeof e.find !== "string" || typeof e.replace !== "string")
    throw new Error("every entry needs file / find / replace strings");
  if (!byFile.has(e.file)) byFile.set(e.file, []);
  byFile.get(e.file).push(e);
}

const out = new Map();
let failed = false;
for (const [file, edits] of byFile) {
  const abs = path.join(REPO, file);
  const exists = fs.existsSync(abs);
  let text = exists ? fs.readFileSync(abs, "utf8") : "";
  const crlf = text.includes(CR + NL);
  if (crlf) text = text.split(CR + NL).join(NL);
  for (const e of edits) {
    const find = e.find.split(CR + NL).join(NL);
    const replace = e.replace.split(CR + NL).join(NL);
    if (find === "") {
      // An empty find creates a file, and only when it does not exist yet — never a silent overwrite.
      if (exists) {
        console.error(`${file}: empty find is allowed only for a new file`);
        failed = true;
        continue;
      }
      text = replace;
      continue;
    }
    const n = text.split(find).length - 1;
    if (n === 0 || (n > 1 && !e.all)) {
      console.error(`${file}: "${find.slice(0, 60).split(NL).join(" / ")}..." — ${n} match(es), expected ${e.all ? ">= 1" : "exactly 1"}`);
      failed = true;
      continue;
    }
    text = text.split(find).join(replace);
  }
  out.set(abs, crlf ? text.split(NL).join(CR + NL) : text);
}
if (failed) {
  console.error("Nothing written.");
  process.exit(1);
}
for (const [abs, text] of out) {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
  console.log("changed", path.relative(REPO, abs));
}

// Block format (see header) -> the same edit array as spec.json.
function parseBlocks(text) {
  const lines = text.split(CR + NL).join(NL).split(NL);
  const edits = [];
  let file = null;
  let cur = null;
  let mode = null;
  let buf = [];
  const fail = (i, msg) => {
    console.error(`${specPath}, line ${i + 1}: ${msg}`);
    console.error("Nothing written.");
    process.exit(2);
  };
  lines.forEach((l, i) => {
    if (l.startsWith("@@@FILE ")) {
      if (mode) fail(i, "@@@FILE inside an edit");
      file = l.slice(8).trim();
    } else if (l === "@@@FIND" || l === "@@@FIND all") {
      if (mode) fail(i, "@@@FIND inside an edit");
      if (!file) fail(i, "@@@FIND before the first @@@FILE");
      cur = { file, find: "", replace: "", all: l === "@@@FIND all" };
      mode = "find";
      buf = [];
    } else if (l === "@@@REPLACE") {
      if (mode !== "find") fail(i, "@@@REPLACE without @@@FIND");
      cur.find = buf.join(NL);
      mode = "replace";
      buf = [];
    } else if (l === "@@@END") {
      if (mode !== "replace") fail(i, "@@@END without @@@REPLACE");
      cur.replace = buf.join(NL);
      edits.push(cur);
      mode = null;
    } else if (l.startsWith("@@@")) {
      fail(i, `unknown marker "${l}"`);
    } else if (mode) {
      buf.push(l);
    }
  });
  if (mode) fail(lines.length - 1, "last edit has no @@@END");
  if (edits.length === 0) fail(0, "no edits");
  return edits;
}
