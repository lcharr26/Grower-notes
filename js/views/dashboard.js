// Dashboard: the cards the user has chosen, in the order they chose, plus a
// customise mode to change that. Garden setup and backup live here too, so
// they're always to hand without getting in the way day to day.

import * as db from '../db.js';
import { buildExport, parseBackup, restore, saveFile } from '../backup.js';
import { openCapture } from '../capture.js';
import { loadLayout, move, saveLayout, toggle } from '../dashboard.js';
import {
  bedsForSite, currentSite, listSites, loadPreset, presetSite, switchSite,
} from '../garden.js';
import { inboxNotes, notesForSite } from '../notes.js';
import { PRESETS } from '../presets.js';
import { TYPE_LABELS } from '../tags.js';
import { busy, frostText, go, h, megabytes, sinceText, toast, whenText } from '../ui.js';

const LABELS = {
  sites: 'Gardens', beds: 'Beds', varieties: 'Varieties', plantings: 'Plantings',
  notes: 'Notes', harvests: 'Harvests', questions: 'Questions', photos: 'Photos',
};

async function doExport() {
  const { blob, filename, exportedAt } = await buildExport();
  const outcome = await saveFile(blob, filename);
  if (outcome === 'cancelled') return false;
  await db.setSetting('last_export', exportedAt);
  toast(`Exported ${filename} (${megabytes(blob.size)}).`);
  return true;
}

export async function render(root, { customise = false } = {}) {
  const site = await currentSite();
  if (!site) return go('#/welcome');
  const layout = await loadLayout();
  const rerender = () => go(location.hash);

  if (customise) return renderCustomise(root, layout);

  const [settings, beds, tidy, notes, questions] = await Promise.all([
    db.getSettings(), bedsForSite(site.id), inboxNotes(site.id), notesForSite(site.id),
    db.getByIndex('questions', 'site_id', site.id),
  ]);
  const bedName = (id) => beds.find((b) => b.id === id)?.name;
  const openQuestions = questions.filter((q) => q.status === 'open');

  const exportButton = (label, cls) => {
    const b = h('button', { class: cls, onclick: () => busy(b, 'Preparing…', async () => { if (await doExport()) rerender(); }) }, label);
    return b;
  };

  const SHORTCUT_ACTIONS = {
    note: () => openCapture(),
    tasks: () => go('#/tasks'),
    notes: () => go('#/notes'),
    'beds-home': () => go('#/'),
    beds: () => go('#/beds'),
    site: () => go('#/site'),
  };

  const builders = {
    shortcuts: () => {
      const on = layout.shortcuts.filter((s) => s.on);
      if (!on.length) return null;
      return h('section', { class: 'shortcuts' }, on.map((s) => (s.id === 'export'
        ? exportButton(s.label, 'shortcut')
        : h('button', { class: 'shortcut', onclick: SHORTCUT_ACTIONS[s.id] },
          s.id === 'tasks' && tidy.length ? `${s.label} (${tidy.length})` : s.label))));
    },

    tidy: () => h('section', { class: 'card' },
      h('h2', {}, 'Notes to tidy'),
      tidy.length
        ? [h('p', { class: 'muted small' }, `${tidy.length} note${tidy.length > 1 ? 's' : ''} saved without a bed or crop.`),
          h('button', { class: 'primary', onclick: () => go('#/tasks') }, 'Tag them now')]
        : h('p', { class: 'muted small' }, 'All tidy.')),

    questions: () => h('section', { class: 'card' },
      h('h2', {}, `Open questions (${openQuestions.length})`),
      openQuestions.length
        ? h('ul', { class: 'plain-list' }, openQuestions.map((q) => h('li', {},
          h('span', {}, q.text),
          q.bed_ids.length ? h('span', { class: 'muted small' }, q.bed_ids.map(bedName).filter(Boolean).join(', ')) : null)))
        : h('p', { class: 'muted small' }, 'Nothing open.')),

    recent: () => h('section', { class: 'card' },
      h('h2', {}, 'Recent notes'),
      notes.length
        ? [h('ul', { class: 'plain-list' }, notes.slice(0, 3).map((n) => h('li', {},
          h('span', {}, n.text || (n.photos.length ? 'Photo' : TYPE_LABELS[n.type] || 'Note')),
          h('span', { class: 'muted small' }, [whenText(n.timestamp), ...n.bed_ids.map(bedName).filter(Boolean)].join(' · '))))),
          h('button', { onclick: () => go('#/notes') }, 'All notes')]
        : h('p', { class: 'muted small' }, 'No notes yet.')),

    backup: () => {
      const restoreInput = h('input', { type: 'file', accept: '.zip,application/zip', onchange: doRestore });
      return h('section', { class: 'card' },
        h('h2', {}, 'Backup'),
        h('p', { class: 'muted small' },
          `Last export: ${sinceText(settings.last_export)}. `,
          'One file with all your notes and photos, which you can save anywhere.'),
        exportButton('Export everything', 'primary'),
        h('label', { class: 'button file-label' }, 'Restore from a backup', restoreInput));
    },

    garden: async () => {
      const [sites, derby] = await Promise.all([listSites(), presetSite('derby')]);
      const frost = [
        site.last_frost && `last frost ${frostText(site.last_frost)}`,
        site.first_frost && `first frost ${frostText(site.first_frost)}`,
      ].filter(Boolean).join(', ');
      const derbyBtn = derby ? null : h('button', {
        onclick: () => busy(derbyBtn, 'Loading…', async () => {
          await loadPreset('derby');
          toast(`Loaded the ${PRESETS.derby.label}.`);
          go('#/');
        }),
      }, `Load the ${PRESETS.derby.label}`);
      return h('section', { class: 'card' },
        h('h2', {}, 'Garden setup'),
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
        ));
    },

    storage: async () => {
      const counts = {};
      for (const store of Object.keys(LABELS)) counts[store] = await db.count(store);
      const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
      const estimate = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
      const wipeBtn = h('button', {
        class: 'danger',
        onclick: async () => {
          if (!confirm('Delete every garden, note and photo on this phone? This cannot be undone. Export first if unsure.')) return;
          await db.clearAll();
          toast('Everything deleted.');
          go('#/welcome');
        },
      }, 'Delete everything on this phone');
      return h('section', { class: 'card' },
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
          wipeBtn));
    },
  };

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

  const cards = [];
  for (const section of layout.sections.filter((s) => s.on)) cards.push(await builders[section.id]());

  root.replaceChildren(...[
    h('h2', { class: 'site-title' }, 'Dashboard'),
    ...cards,
    cards.every((c) => !c) ? h('p', { class: 'muted empty' }, 'Nothing chosen to show here yet.') : null,
    h('a', { class: 'button', href: '#/dashboard?customise' }, 'Customise dashboard'),
  ].filter(Boolean));
}

function renderCustomise(root, initial) {
  let layout = initial;

  const save = async (next) => {
    layout = next;
    await saveLayout(layout);
    draw();
  };

  const row = (item, listKey, index, length, reorder) => h('li', { class: 'custom-row' },
    h('label', { class: 'switch' },
      h('input', {
        type: 'checkbox',
        checked: item.on,
        onchange: () => save({ ...layout, [listKey]: toggle(layout[listKey], item.id) }),
      }),
      h('span', {}, item.label)),
    reorder ? h('span', { class: 'order' },
      h('button', {
        type: 'button', class: 'icon', 'aria-label': `Move ${item.label} up`, disabled: index === 0,
        onclick: () => save({ ...layout, [listKey]: move(layout[listKey], item.id, -1) }),
      }, '↑'),
      h('button', {
        type: 'button', class: 'icon', 'aria-label': `Move ${item.label} down`, disabled: index === length - 1,
        onclick: () => save({ ...layout, [listKey]: move(layout[listKey], item.id, 1) }),
      }, '↓')) : null);

  function draw() {
    root.replaceChildren(
      h('h2', { class: 'site-title' }, 'Customise dashboard'),
      h('section', { class: 'card' },
        h('h2', {}, 'What shows, top to bottom'),
        h('p', { class: 'muted small' }, 'Tick what you want to see. Use the arrows to move things up or down.'),
        h('ul', { class: 'custom-list' },
          layout.sections.map((s, i) => row(s, 'sections', i, layout.sections.length, true))),
      ),
      h('section', { class: 'card' },
        h('h2', {}, 'Shortcuts'),
        h('p', { class: 'muted small' }, 'Big buttons at the top of the dashboard, in this order.'),
        h('ul', { class: 'custom-list' },
          layout.shortcuts.map((s, i) => row(s, 'shortcuts', i, layout.shortcuts.length, true))),
      ),
      h('a', { class: 'button primary', href: '#/dashboard' }, 'Done'),
    );
  }
  draw();
}
