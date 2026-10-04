import * as db from '../db.js';
import { buildExport, parseBackup, restore, saveFile } from '../backup.js';
import {
  bedsForSite, currentSite, listSites, loadPreset, presetSite, switchSite,
} from '../garden.js';
import { PRESETS } from '../presets.js';
import { busy, frostText, go, h, megabytes, sinceText, toast } from '../ui.js';

const LABELS = {
  sites: 'Gardens', beds: 'Beds', varieties: 'Varieties', plantings: 'Plantings',
  notes: 'Notes', harvests: 'Harvests', questions: 'Questions', photos: 'Photos',
};

export async function render(root) {
  const site = await currentSite();
  if (!site) return go('#/welcome');

  const [settings, sites, derby, beds] = await Promise.all([
    db.getSettings(), listSites(), presetSite('derby'), bedsForSite(site.id),
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
  const derbyBtn = derby ? null : h('button', {
    onclick: () => busy(derbyBtn, 'Loading…', async () => {
      await loadPreset('derby');
      toast(`Loaded the ${PRESETS.derby.label}.`);
      go('#/');
    }),
  }, `Load the ${PRESETS.derby.label}`);

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
      h('button', { onclick: () => go('#/site/new') }, 'Set up another garden'),
      derbyBtn,
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
        h('summary', {}, 'Start again'),
        h('p', { class: 'muted small' }, 'Wipes this phone clean. Export first if you might want anything back.'),
        wipeBtn,
      ),
    ),
  );
}
