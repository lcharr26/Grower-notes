// One bed: open questions first (they resurface whenever the bed is opened),
// what's in the ground now, then everything that's happened, newest first.

import * as db from '../db.js';
import { bedHistory } from '../bedview.js';
import { openCapture } from '../capture.js';
import { LOCATION_LABELS, currentSite } from '../garden.js';
import { noteCard } from '../notecard.js';
import { tagContext } from '../tags.js';
import { dayText, go, h } from '../ui.js';
import { METHOD_LABELS, STATUS_LABELS } from './planting.js';

// A small line in the history for things that aren't notes.
function eventRow(event) {
  const line = (icon, text, extra) => h('div', { class: 'event' },
    h('span', { class: 'event-icon', 'aria-hidden': 'true' }, icon),
    h('span', { class: 'event-body' },
      h('span', {}, text),
      extra ? h('span', { class: 'muted small' }, extra) : null,
      h('span', { class: 'muted small' }, dayText(event.at))));
  switch (event.kind) {
    case 'sown': return line('•', `Sown: ${event.crop}`, event.planting.method ? METHOD_LABELS[event.planting.method] : null);
    case 'planted': return line('•', `Planted out: ${event.crop}`);
    case 'harvest': {
      const { amount, notes } = event.harvest;
      return line('✓', `Harvested${event.crop ? `: ${event.crop}` : ''}${amount ? `, ${amount}` : ''}`, notes || null);
    }
    case 'asked': return line('?', `Question raised: ${event.question.text}`);
    case 'resolved': return line('✓', `Answered: ${event.question.text}`, event.question.resolution_note || null);
    default: return null;
  }
}

export async function render(root, { id }) {
  const site = await currentSite();
  if (!site) return go('#/welcome');
  const bed = id ? await db.get('beds', id) : null;
  if (!bed || bed.site_id !== site.id) return go('#/');

  const [history, tags] = await Promise.all([bedHistory(site.id, bed.id), tagContext(site.id)]);
  const { crops, openQuestions, events } = history;

  const items = [];
  for (const event of events) {
    items.push(event.kind === 'note' ? await noteCard(event.note, tags, { hereBedId: bed.id }) : eventRow(event));
  }

  root.replaceChildren(...[
    h('a', { class: 'back', href: '#/' }, '‹ All beds'),
    h('h2', { class: 'site-title' }, bed.name),
    h('p', { class: 'muted small' }, LOCATION_LABELS[bed.location_type], bed.notes ? ` · ${bed.notes}` : ''),

    openQuestions.length ? h('section', { class: 'card questions-card' },
      h('h2', {}, `Open question${openQuestions.length > 1 ? 's' : ''}`),
      h('ul', { class: 'plain-list' }, openQuestions.map((q) => h('li', {}, q.text))),
    ) : null,

    h('section', { class: 'card' },
      h('h2', {}, 'In the ground'),
      crops.length
        ? h('ul', { class: 'plain-list' }, crops.map((c) => h('li', {},
          h('a', { class: 'list-link', href: `#/planting?id=${encodeURIComponent(c.id)}` },
            h('span', {}, c.name),
            h('span', { class: 'muted small' }, [
              STATUS_LABELS[c.status],
              c.planting.planted ? `planted ${dayText(c.planting.planted)}` : c.planting.sown ? `sown ${dayText(c.planting.sown)}` : null,
            ].filter(Boolean).join(' · '))))))
        : h('p', { class: 'muted small' }, 'No crops logged here at the moment.'),
      h('div', { class: 'two' },
        h('a', { class: 'button', href: `#/planting?bed=${encodeURIComponent(bed.id)}` }, 'Add a crop'),
        h('a', { class: 'button', href: `#/harvest?bed=${encodeURIComponent(bed.id)}` }, 'Log a harvest'),
      ),
    ),

    h('button', { class: 'primary', onclick: () => openCapture({ bed_ids: [bed.id] }) }, `Add a note for ${bed.name}`),

    h('h3', { class: 'history-title' }, 'History'),
    items.length
      ? h('div', { class: 'history' }, items)
      : h('p', { class: 'muted empty' }, 'Nothing logged here yet.'),

    h('a', { class: 'button quiet', href: `#/beds?edit=${encodeURIComponent(bed.id)}` }, 'Edit this bed'),
  ].filter(Boolean));
}
