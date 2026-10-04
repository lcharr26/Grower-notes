// Harvest log: every harvest, newest first.

import { deleteHarvest, harvestsForSite } from '../crops.js';
import { bedsForSite, currentSite } from '../garden.js';
import { tagContext } from '../tags.js';
import { dayText, go, h, toast } from '../ui.js';

export async function render(root) {
  const site = await currentSite();
  if (!site) return go('#/welcome');
  const [harvests, beds, tags] = await Promise.all([harvestsForSite(site.id), bedsForSite(site.id), tagContext(site.id)]);
  const bedName = (id) => beds.find((b) => b.id === id)?.name;

  const row = (hv) => {
    const crop = hv.planting_id ? tags.plantingLabel(hv.planting_id) : null;
    const del = h('button', {
      class: 'danger',
      onclick: async () => {
        if (!confirm('Delete this harvest?')) return;
        await deleteHarvest(hv.id);
        toast('Deleted.');
        go(location.hash);
      },
    }, 'Delete');
    return h('li', {},
      h('span', {}, [crop || 'Harvest', hv.amount].filter(Boolean).join(': ')),
      // The crop label already names its bed.
      h('span', { class: 'muted small' }, crop ? dayText(hv.date) : [dayText(hv.date), bedName(hv.bed_id)].filter(Boolean).join(' · ')),
      hv.notes ? h('span', { class: 'small' }, hv.notes) : null,
      h('details', { class: 'row-more' }, h('summary', {}, 'More'), del));
  };

  root.replaceChildren(
    h('h2', { class: 'site-title' }, 'Harvest log'),
    h('a', { class: 'button primary', href: '#/harvest' }, 'Log a harvest'),
    harvests.length
      ? h('section', { class: 'card' }, h('ul', { class: 'plain-list' }, harvests.map(row)))
      : h('p', { class: 'muted empty' }, 'No harvests logged yet.'),
  );
}
