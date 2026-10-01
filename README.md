# Studio QR Code

A lightweight, browser-based QR code studio for creating single QR codes or batches from a CSV file. It is a static application: generation, image processing, and ZIP export all happen locally in the browser.

## Features

- Create a QR code from any text or URL.
- Generate multiple QR codes from a CSV file.
- Use custom file names for batch exports and validate duplicate names.
- Choose square, rounded, or dot modules, including matching finder eyes.
- Use a single colour or a two-colour linear gradient with a configurable angle.
- Set a custom background colour or export with a transparent background.
- Add an optional centred logo, automatically fitted to `120 × 120 px`.
- Export one QR code as PNG or SVG, or export a batch as a ZIP archive.
- Download a ready-to-use CSV example directly from the application.

## Run locally

No build step or package installation is required. Serve the `dist` directory with any static file server. For example:

```bash
python3 -m http.server 4173 --directory dist
```

Then open [http://localhost:4173](http://localhost:4173).

## CSV import

The app accepts comma- or semicolon-separated UTF-8 CSV files.

For automatically named files, use a single `text` column:

```csv
text
https://example.com
Hello from Studio QR Code
```

For custom file names, use `name,text`. Each `name` must be unique:

```csv
name,text
website,https://example.com
welcome-message,Hello from Studio QR Code
```

The included [`dist/exemple-qrcodes.csv`](./dist/exemple-qrcodes.csv) file provides a working example.

## Logo safety

When a logo is added, the app:

- uses high QR error correction;
- fits the image into a `120 × 120 px` central area;
- places it on a protective light background to preserve scanability.

PNG, JPEG, WebP, and SVG logos are supported up to 2 MB. The image is processed in the browser and embedded in the generated export.

## Project structure

```text
qrcode-studio/
├── dist/
│   ├── index.html            # Application markup
│   ├── styles.css            # UI styling
│   ├── app.js                # QR creation, CSV import, previews, and exports
│   ├── qrcode.min.js         # Bundled QR generation library
│   ├── jszip.min.js          # Bundled ZIP creation library
│   └── exemple-qrcodes.csv   # Sample batch import file
```

## Privacy

The application does not upload QR contents, CSV files, or logos. All generation and export operations run in the user’s browser.

## License

Released under the [MIT License](./LICENSE).
