# Unicode fonts for PDF signature stamps

`custom-pdf-signatures.stamp.ts` embeds a Unicode font so Thai/Cyrillic company
and party names are printed correctly on stamped contract/addendum PDFs (the
fallback WinAnsi path silently drops non-Latin-1 characters).

Place at least one of these SIL OFL-licensed fonts in THIS directory
(`apps/api/src/assets/fonts`):

- `NotoSansThai-Regular.ttf` — Thai + Latin (recommended for the TH market)
- `NotoSans-Regular.ttf`     — Latin + Cyrillic + Greek

Download (any mirror):

- https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansThai/NotoSansThai-Regular.ttf
- https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf

If no file is present the stamp falls back to the legacy WinAnsi-safe Helvetica
path (non-Latin-1 characters are dropped), so commit these files before
production deploy. They are copied to `dist/assets/fonts` by the `assets`
entry in `nest-cli.json`.
