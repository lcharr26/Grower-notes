import * as db from '../db.js';
import { buildExport, parseBackup, restore, saveFile } from '../backup.js';
import {
  bedsForSite, currentSite, deleteSite, listSites, loadSample, sampleSite, switchSite,
} from '../garden.js';
import { makeNote, makePhoto } from '../model.js';
import { busy, frostText, go, h, megabytes, sinceText, toast } from '../ui.js';

const LABELS = {
  sites: 'Gardens', beds: 'Beds', varieties: 'Varieties', plantings: 'Plantings',
  notes: 'Notes', harvests: 'Harvests', questions: 'Questions', photos: 'Photos',
};

export async function render(root) {
  const site = await currentSite();
  if (!site) return go('#/welcome');

  const [settings, sites, sample, beds] = await Promise.all([
    db.getSettings(), listSites(), sampleSite(), bedsForSite(site.id),
  ]);
  const counts = {};
  for (const store of Object.keys(LABELS)) counts[store] = await db.count(store);
  const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  const estimate = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
  const rerender = () => render(root);

  const frost = [
    site.last_frost && `last frost ${frostText(site.last_frost)}`,
    site.first_frost && `first frost ${frostText(site.first_frost)}`,
  ].filter(Boolean).join(', ');

  // Gardens on this phone
  const otherSites = sites.filter((s) => s.id !== site.id);
  const sampleBtn = h('button', {
    onclick: () => busy(sampleBtn, 'Loading…', async () => {
      await loadSample();
      toast('Switched to the sample garden.');
      go('#/');
    }),
  }, sample ? 'Open the sample garden' : 'Load the sample garden');
  const removeSampleBtn = sample ? h('button', {
    class: 'danger',
    onclick: () => busy(removeSampleBtn, 'Removing…', async () => {
      if (!confirm('Remove the sample garden and everything in it? Your own garden is not touched.')) return;
      await deleteSite(sample.id);
      toast('Sample garden removed.');
      if (await currentSite()) await rerender(); else go('#/welcome');
    }),
  }, 'Remove the sample garden') : null;

  // Backup
  const exportBtn = h('button', { class: 'primary', onclick: () => busy(exportBtn, 'Preparing…', doExport) }, 'Export everything');
  const restoreInput = h('input', { type: 'file', accept: '.zip,application/zip', onchange: doRestore });

  async function doExport() {
    const { blob, filename, exportedAt } = await buildExport();
    const outcome = await saveFile(blob, filename);
    if (outcome === 'cancelled') return;
    await db.setSetting('last_export', exportedAt);
    toast(`Exported ${filename} (${megabytes(blob.size)}).`);
    await rerender();
  }

  async function doRestore(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = await parseBackup(file);
      const c = parsed.counts;
      const summary = `${c.notes} notes, ${c.photos} photos, ${c.beds} beds, ${c.plantings} plantings`;
      const when = parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleString('en-GB') : 'an unknown date';
      if (!confirm(`This backup is from ${when} and holds ${summary}.\n\nRestoring replaces everything currently on this phone. Carry on?`)) return;
      await restore(parsed);
      toast(parsed.missingPhotos ? `Restored, but ${parsed.missingPhotos} photo(s) were missing from the file.` : 'Restored.');
      go('#/');
    } catch (err) {
      console.error(err);
      toast(err.message || 'That backup could not be restored.');
    }
  }

  // Test tools (temporary, until quick note arrives in step 3)
  const noteText = h('textarea', { placeholder: 'A few words…' });
  const notePhoto = h('input', { type: 'file', accept: 'image/*', multiple: true });
  const addBtn = h('button', {
    onclick: () => busy(addBtn, 'Saving…', async () => {
      const note = makeNote(site.id, { text: noteText.value.trim() });
      const writes = [];
      for (const file of notePhoto.files) {
        const photo = makePhoto(site.id, file, { note_id: note.id });
        note.photos.push(photo.id);
        writes.push(['photos', photo]);
      }
      writes.push(['notes', note]);
      await db.putMany(writes);
      toast(`Saved${note.photos.length ? ` with ${note.photos.length} photo(s)` : ''}.`);
      await rerender();
    }),
  }, 'Save test note');
  const wipeBtn = h('button', {
    class: 'danger',
    onclick: async () => {
      if (!confirm('Delete every garden, note and photo on this phone? This cannot be undone. Export first if unsure.')) return;
      await db.clearAll();
      toast('Everything deleted.');
      go('#/welcome');
    },
  }, 'Delete everything on this phone');

  root.replaceChildren(
    h('section', { class: 'card' },
      h('h2', {}, site.name),
      h('p', { class: 'muted small' },
        [site.location, frost].filter(Boolean).join(' · ') || 'No location or frost dates yet.'),
      h('p', { class: 'small' }, `${beds.length} bed${beds.length === 1 ? '' : 's'}`),
      h('button', { onclick: () => go('#/site') }, 'Edit garden details'),
      h('button', { onclick: () => go('#/beds') }, 'Add or edit beds'),
    ),

    h('section', { class: 'card' },
      h('h2', {}, 'Gardens on this phone'),
      otherSites.map((s) => h('button', {
        onclick: async () => { await switchSite(s.id); toast(`Switched to ${s.name}.`); go('#/'); },
      }, `Switch to ${s.name}`)),
      sites.every((s) => s.sample) ? h('button', { class: 'primary', onclick: () => go('#/site/new') }, 'Set up my own garden') : null,
      site.sample ? null : sampleBtn,
      removeSampleBtn,
      sample ? h('p', { class: 'muted small' }, 'The sample garden is separate from yours; removing it never touches your own notes.') : null,
    ),

    h('section', { class: 'card' },
      h('h2', {}, 'Backup'),
      h('p', { class: 'muted small' },
        `Last export: ${sinceText(settings.last_export)}. `,
        'One file with all your notes and photos, which you can save anywhere.'),
      exportBtn,
      h('label', { class: 'button file-label' }, 'Restore from a backup', restoreInput),
    ),

    h('section', { class: 'card' },
      h('h2', {}, 'On this phone'),
      h('p', { class: 'muted small' },
        'Everything is kept on this device only. No account, no server. ',
        persisted === true ? 'The browser has agreed to keep it safe from automatic clean-up.'
          : persisted === false ? 'The browser may clear it if the phone runs short of space, so export now and then.'
            : ''),
      h('ul', { class: 'counts' },
        Object.entries(LABELS).map(([store, label]) => h('li', {}, label, h('b', {}, counts[store])))),
      estimate ? h('p', { class: 'muted small' }, `Using about ${megabytes(estimate.usage || 0)}.`) : null,
      h('details', {},
        h('summary', {}, 'Test tools'),
        noteText,
        h('label', { class: 'button file-label' }, 'Add photos', notePhoto),
        addBtn,
        wipeBtn,
      ),
    ),
  );
}
