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
npm run build   # typecheck + production bundle (src/main.ts -> main.js, styles.scss -> styles.css)
npm run dev     # watch mode with inline sourcemaps
```

Project layout follows the official `obsidian-sample-plugin` template:
sources in `src/`, `esbuild.config.mjs` for bundling, `versions.json` +
`version-bump.mjs` for releases (`npm version patch` keeps them in sync).
Styles are written in `styles.scss` and compiled to `styles.css` by
dart-sass during the build.

Install into a vault by copying `main.js`, `manifest.json`, and `styles.css` into
`<vault>/.obsidian/plugins/inplace-diff-view/`.