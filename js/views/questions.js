// All questions: open ones first (answer, edit, or ask a new one), then the
// answered ones, which can be reopened.

import { currentSite } from '../garden.js';
import { questionForm, questionItem } from '../questionitem.js';
import { questionsForSite } from '../questions.js';
import { tagContext } from '../tags.js';
import { go, h } from '../ui.js';

export async function render(root) {
  const site = await currentSite();
  if (!site) return go('#/welcome');
  const [questions, tags] = await Promise.all([questionsForSite(site.id), tagContext(site.id)]);
  const open = questions.filter((q) => q.status === 'open');
  const answered = questions.filter((q) => q.status === 'resolved')
    .sort((a, b) => (b.resolved || '').localeCompare(a.resolved || ''));
  const refresh = () => go(location.hash);

  const where = (q) => {
    const names = [...q.bed_ids.map((id) => tags.bedById.get(id)?.name), ...q.planting_ids.map(tags.plantingLabel)].filter(Boolean);
    if (!names.length) return null;
    const bedId = q.bed_ids.find((id) => tags.bedById.has(id));
    return bedId ? h('a', { class: 'q-where', href: `#/bed?id=${encodeURIComponent(bedId)}` }, names.join(', ')) : names.join(', ');
  };
  const whereText = (q) => [...q.bed_ids.map((id) => tags.bedById.get(id)?.name), ...q.planting_ids.map(tags.plantingLabel)].filter(Boolean).join(', ');

  const askBox = h('section', { class: 'card' });
  const askBtn = h('button', {
    class: 'primary',
    onclick: () => askBox.replaceChildren(questionForm(site.id, tags, { onSaved: refresh, onCancel: () => askBox.replaceChildren(askBtn) })),
  }, 'Ask a question');
  askBox.append(askBtn);

  root.replaceChildren(...[
    h('h2', { class: 'site-title' }, 'Questions'),
    askBox,
    h('section', { class: 'card questions-card' },
      h('h2', {}, `Open (${open.length})`),
      open.length
        ? h('ul', { class: 'plain-list' }, open.map((q) => questionItem(q, { where: where(q), onChange: refresh })))
        : h('p', { class: 'muted small' }, 'Nothing open.')),
    answered.length ? h('details', { class: 'card' },
      h('summary', {}, `Answered (${answered.length})`),
      h('ul', { class: 'plain-list' }, answered.map((q) => questionItem(q, { where: whereText(q), onChange: refresh })))) : null,
  ].filter(Boolean));
}
