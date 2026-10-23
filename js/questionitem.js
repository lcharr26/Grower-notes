// One question, answered with a tap: Yes or No, or another answer in a line.
// Edit in place too. Also the small form for asking a new one.

import { GAP_QUESTION } from './crops.js';
import { addQuestion, deleteQuestion, reopenQuestion, resolveQuestion, updateQuestion } from './questions.js';
import { busy, dayText, go, h, multiChips, toast } from './ui.js';

// where: bed / crop names, or an element (e.g. a link to the bed).
// onChange: called after anything is saved, to refresh the screen.
export function questionItem(q, { where = null, onChange }) {
  const li = h('li', { class: 'question' });
  // replaceChildren would print null as text, so drop the gaps.
  const item = { replaceChildren: (...kids) => li.replaceChildren(...kids.filter((k) => k != null && k !== '')) };

  async function answer(text) {
    await resolveQuestion(q, { note: text });
    // "Plant something in the gap?" Yes: straight to adding a crop there.
    if (q.text === GAP_QUESTION && text === 'Yes' && q.bed_ids[0]) {
      go(`#/planting?bed=${encodeURIComponent(q.bed_ids[0])}`);
      return;
    }
    toast(`Answered: ${text}.`);
    onChange();
  }

  function showOpen() {
    const yes = h('button', { class: 'primary yes-no', onclick: () => busy(yes, '…', () => answer('Yes')) }, 'Yes');
    const no = h('button', { class: 'yes-no', onclick: () => busy(no, '…', () => answer('No')) }, 'No');
    item.replaceChildren(
      h('span', { class: 'q-text' }, q.text),
      where ? h('span', { class: 'muted small' }, where) : null,
      h('div', { class: 'two q-yes-no' }, yes, no),
      h('div', { class: 'q-actions' },
        h('button', { class: 'small-btn quiet', onclick: showAnswer }, 'Other answer'),
        h('button', { class: 'small-btn quiet', onclick: showEdit }, 'Edit')),
    );
  }

  function showAnswer() {
    const text = h('input', { type: 'text', placeholder: 'The answer, in a line', 'aria-label': 'Answer', autocomplete: 'off' });
    const save = h('button', {
      class: 'primary',
      onclick: () => {
        if (!text.value.trim()) { toast('Type the answer first, or use Yes / No.'); text.focus(); return; }
        busy(save, 'Saving…', () => answer(text.value.trim()));
      },
    }, 'Save answer');
    text.addEventListener('keydown', (e) => { if (e.key === 'Enter') save.click(); });
    item.replaceChildren(
      h('span', { class: 'q-text' }, q.text),
      text, save,
      h('button', { onclick: showOpen }, 'Cancel'),
    );
    text.focus();
  }

  function showEdit() {
    const text = h('textarea', { value: q.text, rows: 2, 'aria-label': 'Question' });
    const save = h('button', {
      class: 'primary',
      onclick: () => busy(save, 'Saving…', async () => {
        await updateQuestion(q, { text: text.value });
        toast('Saved.');
        onChange();
      }),
    }, 'Save');
    const del = h('button', {
      class: 'danger',
      onclick: async () => {
        if (!confirm('Delete this question?')) return;
        await deleteQuestion(q.id);
        toast('Deleted.');
        onChange();
      },
    }, 'Delete question');
    item.replaceChildren(text, save, h('button', { onclick: showOpen }, 'Cancel'), del);
  }

  function showResolved() {
    const reopen = h('button', {
      class: 'small-btn',
      onclick: async () => { await reopenQuestion(q); toast('Reopened.'); onChange(); },
    }, 'Reopen');
    item.replaceChildren(
      h('span', { class: 'q-text' }, q.text),
      q.resolution_note ? h('span', { class: 'q-answer' }, q.resolution_note) : null,
      h('span', { class: 'muted small' }, [where, q.resolved ? `answered ${dayText(q.resolved)}` : null].filter((x) => x && typeof x === 'string').join(' · ')),
      h('div', { class: 'q-actions' }, reopen),
    );
  }

  if (q.status === 'open') showOpen(); else showResolved();
  return li;
}

// Ask a new question. tags: from tagContext(); bed_ids: preselected beds.
export function questionForm(siteId, tags, { bed_ids = [], onSaved, onCancel }) {
  const text = h('textarea', { rows: 2, placeholder: 'Something to decide or keep an eye on, e.g. Any spider mite on the cucumbers?', 'aria-label': 'Question' });
  const hint = h('p', { class: 'muted small' }, 'Asking it as a yes/no question means you can answer it with one tap later.');
  const beds = multiChips(tags.bedOptions, bed_ids);
  const cropOptions = tags.plantingOptions();
  const crops = cropOptions.length ? multiChips(cropOptions) : null;
  const save = h('button', {
    class: 'primary',
    onclick: () => busy(save, 'Saving…', async () => {
      await addQuestion(siteId, { text: text.value, bed_ids: beds.values, planting_ids: crops ? crops.values : [] });
      toast('Question added.');
      onSaved();
    }),
  }, 'Add question');
  const form = h('div', { class: 'editor question-form' },
    text,
    hint,
    tags.bedOptions.length ? [h('h3', {}, 'Bed'), beds.el] : null,
    crops ? [h('h3', {}, 'Crop'), crops.el] : null,
    save,
    onCancel ? h('button', { onclick: onCancel }, 'Cancel') : null);
  setTimeout(() => text.focus());
  return form;
}
