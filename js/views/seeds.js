// Seed library: varieties by crop, with supplier, optional stock and notes.

import { addVariety, deleteVariety, suppliersForSite, updateVariety, varietiesForSite, varietyUsage } from '../crops.js';
import { currentSite } from '../garden.js';
import { busy, go, h, toast } from '../ui.js';

export async function render(root) {
  const site = await currentSite();
  if (!site) return go('#/welcome');
  const [varieties, suppliers] = await Promise.all([varietiesForSite(site.id), suppliersForSite(site.id)]);

  function editor(v, onClose) {
    const crop = h('input', { type: 'text', value: v?.crop, placeholder: 'Crop, e.g. Potato', 'aria-label': 'Crop', autocomplete: 'off' });
    const name = h('input', { type: 'text', value: v?.variety, placeholder: 'Variety, e.g. Charlotte (optional)', 'aria-label': 'Variety', autocomplete: 'off' });
    const supplier = h('input', { type: 'text', value: v?.supplier, placeholder: 'Supplier (optional)', 'aria-label': 'Supplier', autocomplete: 'off' });
    const supplierChips = suppliers.length ? h('div', { class: 'chips' }, suppliers.map((s) => h('button', {
      type: 'button', class: 'chip', onclick: () => { supplier.value = s; },
    }, s))) : null;
    const stock = h('input', { type: 'text', value: v?.stock ?? '', placeholder: 'Seed left (optional), e.g. half a packet', 'aria-label': 'Stock', autocomplete: 'off' });
    const notes = h('textarea', { value: v?.notes, placeholder: 'Notes (optional)' });
    const save = h('button', {
      class: 'primary',
      onclick: () => busy(save, 'Saving…', async () => {
        const fields = { crop: crop.value, variety: name.value, supplier: supplier.value, stock: stock.value, notes: notes.value };
        if (v) await updateVariety(v, fields); else await addVariety(site.id, fields);
        toast('Saved.');
        go(location.hash);
      }),
    }, v ? 'Save' : 'Add variety');
    const del = v ? h('button', {
      class: 'danger',
      onclick: () => busy(del, 'Checking…', async () => {
        if (await varietyUsage(v.id)) { toast('This variety has been planted, so it stays as part of the history.'); return; }
        if (!confirm(`Delete ${v.crop} ${v.variety}?`)) return;
        await deleteVariety(v.id);
        toast('Deleted.');
        go(location.hash);
      }),
    }, 'Delete') : null;
    return h('div', { class: 'editor' }, crop, name, supplier, supplierChips, stock, notes, save,
      h('button', { onclick: onClose }, 'Cancel'), del);
  }

  const groups = new Map();
  for (const v of varieties) {
    if (!groups.has(v.crop)) groups.set(v.crop, []);
    groups.get(v.crop).push(v);
  }

  const row = (v) => {
    const button = h('button', { class: 'row-button' },
      h('span', { class: 'seed-name' },
        h('span', {}, v.variety || v.crop),
        h('span', { class: 'muted small' }, [v.supplier, v.stock ? `stock: ${v.stock}` : null].filter(Boolean).join(' · '))),
      h('span', { class: 'muted small' }, 'Edit'));
    const wrap = h('div', { class: 'bed-row' }, button);
    button.addEventListener('click', () => {
      const ed = editor(v, () => ed.replaceWith(button));
      button.replaceWith(ed);
    });
    return wrap;
  };

  const addBox = h('div', {});
  const addBtn = h('button', {
    class: 'primary',
    onclick: () => {
      const ed = editor(null, () => ed.replaceWith(addBtn));
      addBtn.replaceWith(ed);
    },
  }, 'Add a variety');
  addBox.append(addBtn);

  root.replaceChildren(
    h('h2', { class: 'site-title' }, 'Seed library'),
    h('section', { class: 'card' }, addBox),
    varieties.length
      ? h('section', { class: 'card' }, [...groups].map(([crop, list]) => h('div', { class: 'bed-group' },
        h('h3', {}, crop), list.map(row))))
      : h('p', { class: 'muted empty' }, 'No varieties yet.'),
  );
}
