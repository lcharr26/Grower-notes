// Settings: the things you set once and rarely touch. Garden setup, backup,
// how Home looks, and what's stored on this phone.

import * as db from '../db.js';
import { exportNow, parseBackup, restore } from '../backup.js';
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

  const [settings, beds, sites, derby] = await Promise.all([
    db.getSettings(), bedsForSite(site.id), listSites(), presetSite('derby'),
  ]);
  const counts = {};
  for (const store of Object.keys(LABELS)) counts[store] = await db.count(store);
  const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  const estimate = navigator.storage?.estimate ? await navigator.storage.estimate() : null;

  const frost = [
    site.last_frost && `last frost ${frostText(site.last_frost)}`,
    site.first_frost && `first frost ${frostText(site.first_frost)}`,
  ].filter(Boolean).join(', ');

  const exportBtn = h('button', {
    class: 'primary',
    onclick: () => busy(exportBtn, 'Preparing…', async () => { if (await exportNow()) go(location.hash); }),
  }, 'Export everything');
  const restoreInput = h('input', { type: 'file', accept: '.zip,application/zip', onchange: doRestore });

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

  const derbyBtn = derby ? null : h('button', {
    onclick: () => busy(derbyBtn, 'Loading…', async () => {
      await loadPreset('derby');
      toast(`Loaded the ${PRESETS.derby.label}.`);
      go('#/');
    }),
  }, `Load the ${PRESETS.derby.label}`);

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
    h('h2', { class: 'site-title' }, 'Settings'),

    h('section', { class: 'card' },
      h('h2', {}, 'Garden'),
      h('p', { class: 'small' }, h('strong', {}, site.name), ` · ${beds.length} bed${beds.length === 1 ? '' : 's'}`),
      h('p', { class: 'muted small' }, [site.location, frost].filter(Boolean).join(' · ') || 'No location or frost dates yet.'),
      h('div', { class: 'two' },
        h('button', { onclick: () => go('#/site') }, 'Garden details'),
        h('button', { onclick: () => go('#/beds') }, 'Beds'),
      ),
      h('details', {},
        h('summary', {}, 'Other gardens'),
        sites.filter((s) => s.id !== site.id).map((s) => h('button', {
          onclick: async () => { await switchSite(s.id); toast(`Switched to ${s.name}.`); go('#/'); },
        }, `Switch to ${s.name}`)),
        h('button', { onclick: () => go('#/site/new') }, 'Set up another garden'),
        derbyBtn,
      ),
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
      h('h2', {}, 'Home screen'),
      h('p', { class: 'muted small' }, 'Choose which cards and shortcuts show on Home, and in what order.'),
      h('a', { class: 'button', href: '#/customise' }, 'Customise home'),
    ),

    h('section', { class: 'card' },
      h('h2', {}, 'Storage on this phone'),
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
        wipeBtn),
    ),
  );
}
