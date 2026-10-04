// Customise home: tick which cards and shortcuts show, and reorder them.

import { loadLayout, move, saveLayout, toggle } from '../homelayout.js';
import { h } from '../ui.js';

export async function render(root) {
  let layout = await loadLayout();

  const save = async (next) => {
    layout = next;
    await saveLayout(layout);
    draw();
  };

  const row = (item, listKey, index, length) => h('li', { class: 'custom-row' },
    h('label', { class: 'switch' },
      h('input', {
        type: 'checkbox',
        checked: item.on,
        onchange: () => save({ ...layout, [listKey]: toggle(layout[listKey], item.id) }),
      }),
      h('span', {}, item.label)),
    h('span', { class: 'order' },
      h('button', {
        type: 'button', class: 'icon', 'aria-label': `Move ${item.label} up`, disabled: index === 0,
        onclick: () => save({ ...layout, [listKey]: move(layout[listKey], item.id, -1) }),
      }, '↑'),
      h('button', {
        type: 'button', class: 'icon', 'aria-label': `Move ${item.label} down`, disabled: index === length - 1,
        onclick: () => save({ ...layout, [listKey]: move(layout[listKey], item.id, 1) }),
      }, '↓')));

  function draw() {
    root.replaceChildren(
      h('h2', { class: 'site-title' }, 'Customise home'),
      h('section', { class: 'card' },
        h('h2', {}, 'What shows, top to bottom'),
        h('p', { class: 'muted small' }, 'Tick what you want to see. Cards with nothing to report stay hidden until they do.'),
        h('ul', { class: 'custom-list' },
          layout.sections.map((s, i) => row(s, 'sections', i, layout.sections.length))),
      ),
      h('section', { class: 'card' },
        h('h2', {}, 'Shortcuts'),
        h('p', { class: 'muted small' }, 'Big buttons on Home, in this order.'),
        h('ul', { class: 'custom-list' },
          layout.shortcuts.map((s, i) => row(s, 'shortcuts', i, layout.shortcuts.length))),
      ),
      h('a', { class: 'button primary', href: '#/' }, 'Done'),
    );
  }
  draw();
}
