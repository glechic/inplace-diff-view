# In-place Diff View (Obsidian plugin)

Renders inline review markers from the writing-inplace-diff workflow inside Obsidian:

- `{old | new}` — corrections render inline as struck-through old (red) → new (green)
- `{note|observation}` — notes render as blue chips
- Insertions `{|word}` (green) and deletions `{word|}` (struck-through red)

Hover a marker for a tooltip with actions:

- Corrections: **Accept new** / **Keep old**
- Notes: **Delete note**

Applied changes are written through the editor as a single undoable transaction (⌘Z reverts them). Frontmatter and code fences are never touched; markdown table pipes and trivial `{I | I}` markers are left raw.

Commands:

- Accept all corrections
- Keep original text for all corrections
- Delete all notes

Works in both Reading view and Live Preview (markers under the cursor stay raw in Live Preview so they remain editable).

## Development

```sh
npm install
npm run build   # bundles main.ts -> main.js (esbuild)
./node_modules/.bin/tsc --noEmit   # typecheck
```

Install into a vault by copying `main.js`, `manifest.json`, and `styles.css` into
`<vault>/.obsidian/plugins/inplace-diff-view/`.