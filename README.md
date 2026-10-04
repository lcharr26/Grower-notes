# Growers Notebook

A quick, offline growing log for gardeners and growers. Logging something
should take under 15 seconds: photo first, a few words, tag later.

It's a Progressive Web App (PWA). It's plain HTML, CSS and JavaScript with no
build step and no runtime dependencies, and everything is stored on the device
in IndexedDB. There are no accounts and no server.

## Build progress

1. [x] Data model, local storage and full export (with restore)
2. [x] Setup flow (site and beds), plus the Derby garden ready to load
3. [x] Quick note capture and inbox (shown as "Tasks")
4. [x] Bed dashboard
5. [ ] Plantings, harvest log and gap-fill prompt
6. [ ] Question queue and photo prompt
7. [ ] Export reminder nudge
8. [ ] Offline/installable PWA, tested on a real phone

## Backup format

"Export everything" makes one `.zip` that any computer can open:

- `data.json`: every record (sites, beds, varieties, plantings, notes,
  harvests, questions, settings)
- `photos/<id>.jpg`: every photo as an ordinary image file
- `README.txt`: a plain-words description

Both live in Settings. "Restore from a backup" reads the same file back. It replaces what's on the
device in one go, so a failed restore never leaves half the data.

## Running it

```sh
npm run serve        # http://localhost:8080
npm install && npm test
```

### Trying it on a phone

The phone needs to load the app over HTTPS, which offline mode and installing
also require. The easiest way is GitHub Pages: in the repo, go to Settings >
Pages, choose "Deploy from a branch", pick this branch and `/ (root)`, then
open the URL it gives you on the phone. (Pages on a private repo needs a paid
GitHub plan. Otherwise, any static host such as Netlify Drop or Cloudflare
Pages works; just upload the folder.)

## Code layout

- `js/model.js`: record shapes and allowed values (each record has a `site_id`)
- `js/db.js`: IndexedDB storage
- `js/zip.js`: dependency-free zip writer and reader
- `js/backup.js`: export, restore and saving the file
- `js/garden.js`: sites and beds, plus loading a ready-made garden
- `js/presets.js`: ready-made gardens (the Derby walled kitchen garden)
- `js/notes.js`: saving, tagging and deleting notes; untagged notes wait in Tasks
- `js/bedview.js`: each bed's current crops, last note, open questions and history
- `js/notecard.js`: the note card (view, tag, edit, delete) used on several screens
- `js/homelayout.js`: which Home cards and shortcuts show, and their order
- `js/photos.js`: shrinking photos before they're stored
- `js/capture.js`: the quick note sheet behind the "+ Note" button
- `js/tags.js`: bed / crop / kind options for tagging
- `js/ui.js`: small shared UI helpers
- `js/app.js`: the screen router
- `js/views/`: one file per screen (welcome, site, beds, home, bed, notes/tasks, settings, customise)
