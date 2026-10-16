# Fonts in version 10

## Bundled: 18 open-license families

Bangla: Noto Sans Bengali, Hind Siliguri, Noto Serif Bengali, Tiro Bangla, Baloo Da 2, Anek Bangla, Mina, Galada, Atma.

English: Inter, Montserrat, Poppins, Playfair Display, Oswald, DM Sans, Manrope, Space Grotesk, Bebas Neue.

These are self-hosted; their licenses are in licenses/. The modern picker supports search, language filters and live visual previews. Choose a default, override individual sections, or give each extra-text layer its own font.

## Lipighor fonts

Lipighor permits personal/commercial designs, but its published EULA prohibits distributing/uploading/re-uploading the font files to another website or medium without permission. “Free font” is not the same as permission to redistribute it as a web font in a paid design tool. Therefore no Lipighor TTF/ZIP files are included or hotlinked in this release.

Get explicit permission covering web embedding, use in this hosted editor and server rendering. Suitable styles to discuss with Lipighor include Alinur Nilabhro, Alinur Sangbadpatra, Alinur Ruposhi and other Unicode families you prefer. Choose Unicode, not ANSI, for modern Bangla input.

After obtaining permission:

1. Download your permitted font files from https://lipighor.com/.
2. Put TTF/OTF/WOFF/WOFF2 files into `custom-fonts/` on your own installation.
3. Copy `custom-fonts/manifest.example.json` to `custom-fonts/manifest.json`.
4. Use the exact licensed font family name and filename. Add one item per family. Set webEmbeddingLicensed=true only after permission is confirmed.
5. Run `npm run fonts:install`, then `npm run build`, then restart Node.

Example manifest:

```json
[
  {"name":"Alinur Nilabhro","file":"AlinurNilabhro.ttf","group":"Bangla","webEmbeddingLicensed":true}
]
```

The installer makes the fonts available in every template and extra text layer, in the browser and official server exports. Family names must use English letters/spaces/hyphens for consistent CSS identifiers. Do not rename the original font's identity to claim authorship. Keep license records. Installed web fonts necessarily reach users' browsers, so they cannot be made technically unextractable.

To remove custom fonts, set the manifest to an empty list, remove their public/custom-fonts files, rerun installation/build and restart. Old projects using removed fonts fall back to bundled fonts.

Source checked for this release: https://lipighor.com/EULA.html
