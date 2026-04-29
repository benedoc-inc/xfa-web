# xfa-web

Web UI for filling XFA PDF forms — upload a PDF, fill the fields in a structured form interface, then download the filled PDF.

## What it does

- Parses XFA and AcroForm PDFs via the `pdfer` Go library
- Renders the schema as a navigable, section-by-section form
- Evaluates conditional visibility rules in the browser (FormCalc + JavaScript)
- Exports the completed form back to a filled PDF
- Supports XML data round-trips (export current values to XML; import a previously saved XML file)
- File attachment fields embed selected files into the exported PDF

## Architecture

```
xfa-web/
├── cmd/server/      — Go HTTP server (single binary)
├── internal/handler/— /api/parse, /api/export, /api/export-xml
└── web/             — Vite + React + TypeScript frontend
    ├── src/engine/  — rules.ts: client-side visibility / calculate rule engine
    ├── src/components/
    │   ├── FormRenderer.tsx  — top-level layout: header, sidebar, section view
    │   ├── SectionNav.tsx    — left nav with per-section completion dots
    │   ├── SectionView.tsx   — renders a section's questions + prev/next nav
    │   └── fields/           — per-type field components (text, checkbox, dropdown, file, signature, …)
    └── src/utils/
        └── sectionIndex.ts   — builds section tree, completion map, duplicate-label set
```

## Local development

### Hot-reload (recommended)

Requires Docker with Compose V2.

```bash
cd xfa-web
docker compose -f docker-compose.dev.yml up --build
```

- Backend: [http://localhost:8080](http://localhost:8080) — Go with Air hot-reload
- Frontend: [http://localhost:5173](http://localhost:5173) — Vite HMR
- The `pdfer` directory is volume-mounted so backend changes to the library are picked up without a full rebuild

### Production build

```bash
docker compose up --build
# → single container, frontend served as static files at :8080
```

## API

| Endpoint | Method | Body | Response |
|---|---|---|---|
| `/api/parse` | POST | `multipart/form-data`: `pdf` file, optional `password` | JSON `{schema, values, pdf_data}` |
| `/api/export` | POST | JSON `{pdf_data, values, password?}` or multipart with file attachments | PDF blob |
| `/api/export-xml` | POST | JSON `{pdf_data, values, password?}` | XML blob (XFA datasets format) |

## Rules engine

`web/src/engine/rules.ts` evaluates XFA rules extracted by `pdfer`. Supported expression patterns:

- `$.rawValue == "value"` / `this.rawValue == "value"` (FormCalc and JavaScript)
- `fieldName.rawValue == "value"` (path or ID lookup)
- `path.rawValue != null` / `!= ""` (null/empty checks)
- `path.presence == "visible"` / `== "hidden"` (presence checks)
- Compound `&&` and `||` with three-valued Kleene logic (unknown = skip rule)
- `xfa.host.*` calls (treated as unknown — rule skipped gracefully)

## Gaps and known limitations

See the [plan file](../.claude/plans/polymorphic-greeting-teacup.md) for a detailed audit of remaining XFA fidelity gaps. Summary:

| Gap | Status |
|---|---|
| Script body capture (P0) | ✅ Fixed — `inScript` CharData handler in pdfer |
| SOM path trimming (P2) | ✅ Fixed |
| `contentType` lang hint (P3) | ✅ Fixed |
| `$.rawValue` condition (P4) | ✅ Fixed — rules.ts handles `$` as current field |
| if/else rule splitting (P1) | ⏳ Pending — only if-branch emitted |
| Subform event collection (P5) | ⏳ Pending |
| Subform presence propagation (P6) | ⏳ Pending |
| Sub-section navigation | ⏳ Pending — sidebar shows top-level only |
| Long label → instruction block | ⏳ Pending |
