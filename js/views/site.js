// Create or edit a site. Only the name matters; everything else can wait.

import { createSite, currentSite, updateSite } from '../garden.js';
import { busy, frostToInput, go, h, inputToFrost, toast } from '../ui.js';

export async function render(root, { isNew }) {
  const site = isNew ? null : await currentSite();
  if (!isNew && !site) return go('#/welcome');

  const name = h('input', { type: 'text', id: 'site-name', placeholder: 'e.g. Allotment plot 12', value: site?.name, autocomplete: 'off' });
  const where = h('input', { type: 'text', id: 'site-where', placeholder: 'Town or area (optional)', value: site?.location, autocomplete: 'off' });
  const lastFrost = h('input', { type: 'date', id: 'site-last-frost', value: frostToInput(site?.last_frost) });
  const firstFrost = h('input', { type: 'date', id: 'site-first-frost', value: frostToInput(site?.first_frost) });

  const save = h('button', {
    class: 'primary',
    onclick: () => busy(save, 'Saving…', async () => {
      const fields = {
        name: name.value.trim() || 'My garden',
        location: where.value.trim(),
        last_frost: inputToFrost(lastFrost.value),
        first_frost: inputToFrost(firstFrost.value),
      };
      if (isNew) {
        await createSite(fields);
        go('#/beds?setup');
      } else {
        await updateSite(site, fields);
        toast('Saved.');
        go('#/settings');
      }
    }),
  }, isNew ? 'Next: add your beds' : 'Save');

  root.replaceChildren(
    h('section', { class: 'card' },
      h('h2', {}, isNew ? 'Your garden' : 'Garden details'),
      h('label', { class: 'field', for: 'site-name' }, 'What do you call it?'),
      name,
      h('label', { class: 'field', for: 'site-where' }, 'Where is it?'),
      where,
      h('p', { class: 'muted small' }, 'Average frost dates for your area. Optional; add them later if you like.'),
      h('div', { class: 'two' },
        h('div', {}, h('label', { class: 'field', for: 'site-last-frost' }, 'Last spring frost'), lastFrost),
        h('div', {}, h('label', { class: 'field', for: 'site-first-frost' }, 'First autumn frost'), firstFrost),
      ),
      save,
      isNew ? null : h('button', { onclick: () => go('#/settings') }, 'Cancel'),
    ),
  );
  if (isNew) name.focus();
}
