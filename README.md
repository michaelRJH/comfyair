# Comfyair Job Sheets

A phone app for Comfyair engineers. Fill in job sheets on site, take photos, get the customer to sign on the screen, and send a branded PDF by email, WhatsApp or anything else on the phone.

**Live app:** https://michaelrjh.github.io/comfyair/

## What it does

| Job type | Replaces | PDF |
| --- | --- | --- |
| Service sheet | Comfyair service sheet | Service / Maintenance Sheet |
| Multi-unit report | VRF service and maintenance report | VRF Service and Maintenance Report |
| Commissioning | Commissioning sheet | Air Conditioning Commissioning Report |
| RAMS | Method statement and risk assessment | Method Statement & Risk Assessment (risk assessment prints landscape) |

Every job has:

- Job numbers handed out automatically (starting at 1479, change it in Settings)
- Client and site details that fill themselves in next time
- Photos from the camera or library, with captions
- Engineer and customer signatures drawn on the screen
- Arrival and leaving times with one tap, plus travel time and mileage
- A check before finishing that flags anything missing, like an unsigned sheet
- A preview of the actual PDF, then Email, WhatsApp, Share, Save or Open

It also:

- Lets you **add your own** to any list: gases, visit types, job status, unit types, pipe sizes, check results, quick comments, RAMS tools, extra check list items and hazards. Anything added is remembered on the phone and offered again. Tidy it up in **Settings, Your lists**.
- Remembers every **site** and the **units** on it. On the next visit, pick the site and all the units load in.
- Shows **services coming due** on the Home screen when a next service date is set.
- Works out **risk scores** on the RAMS automatically (severity x probability) and colours them.
- Exports an **hours and miles spreadsheet** for invoicing (Settings).
- Works with **no signal** once it has been opened once.

## Putting it on a phone

**iPhone:** open the link in Safari, tap the Share button, then **Add to Home Screen**.

**Android:** open the link in Chrome, tap **Install** on the banner (or the menu, then **Add to Home screen**).

It then opens full screen with the Comfyair icon, like any other app.

## Where the data lives

Jobs are saved **on the phone that made them**. Nothing is sent to a server, so there are no running costs and nothing to break. The flip side:

- Each phone has its own jobs. Elliott sees his engineer's work when the PDF is sent to him.
- **Back up regularly.** Settings, then **Back up everything**, and send the file to your email or Google Drive. The same file restores everything onto a new phone.
- With more than one phone, give each engineer their own job number range in Settings (for example 2000s and 5000s) so numbers never clash.

Syncing between phones can be added later if the team grows.

## Changing it

The app is plain HTML, CSS and JavaScript with no build step. Edit the files and push to `main`, and GitHub Pages republishes within a minute or two.

| To change | Edit |
| --- | --- |
| Check list items, hazard library, default RAMS wording | `js/schema.js` |
| Form fields | `js/forms.js` |
| PDF layout | `js/pdf.js` |
| Colours and styling | `css/app.css` |
| Company details, email message | In the app, Settings |

**After any change, bump `VERSION` at the top of `sw.js`** (for example `comfyair-v1.0.1`). Phones then show "A new version is ready" and update with one tap.

## Built with

- [Preact](https://preactjs.com) and [htm](https://github.com/developit/htm) for the interface
- [pdfmake](http://pdfmake.org) to make the PDFs on the phone
- [PDF.js](https://mozilla.github.io/pdf.js/) for the in-app preview
- [Archivo](https://fonts.google.com/specimen/Archivo) typeface (SIL Open Font License)

All libraries are stored in `vendor/` so the app works offline.
