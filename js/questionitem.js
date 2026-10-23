// One question, with "Mark answered" (and an optional one-line answer) and
// "Edit" in place. Also the small form for asking a new one.

import { addQuestion, deleteQuestion, reopenQuestion, resolveQuestion, updateQuestion } from './questions.js';
import { busy, dayText, h, multiChips, toast } from './ui.js';

// where: bed / crop names, or an element (e.g. a link to the bed).
// onChange: called after anything is saved, to refresh the screen.
export function questionItem(q, { where = null, onChange }) {
  const li = h('li', { class: 'question' });
  // replaceChildren would print null as text, so drop the gaps.
  const item = { replaceChildren: (...kids) => li.replaceChildren(...kids.filter((k) => k != null && k !== '')) };

  function showOpen() {
    const answerBtn = h('button', { class: 'primary small-btn', onclick: showAnswer }, 'Mark answered');
    const editBtn = h('button', { class: 'small-btn', onclick: showEdit }, 'Edit');
    item.replaceChildren(
      h('span', { class: 'q-text' }, q.text),
      where ? h('span', { class: 'muted small' }, where) : null,
      h('div', { class: 'q-actions' }, answerBtn, editBtn),
    );
  }

  function showAnswer() {
    const answer = h('input', { type: 'text', placeholder: 'The answer, in a line (optional)', 'aria-label': 'Answer', autocomplete: 'off' });
    const save = h('button', {
      class: 'primary',
      onclick: () => busy(save, 'Saving…', async () => {
        await resolveQuestion(q, { note: answer.value });
        toast('Marked answered.');
        onChange();
      }),
    }, 'Mark answered');
    answer.addEventListener('keydown', (e) => { if (e.key === 'Enter') save.click(); });
    item.replaceChildren(
      h('span', { class: 'q-text' }, q.text),
      answer, save,
      h('button', { onclick: showOpen }, 'Cancel'),
    );
    answer.focus();
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
  const text = h('textarea', { rows: 2, placeholder: 'What do you want to keep an eye on or decide? e.g. Watch the cucumbers for spider mite', 'aria-label': 'Question' });
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
    tags.bedOptions.length ? [h('h3', {}, 'Bed'), beds.el] : null,
    crops ? [h('h3', {}, 'Crop'), crops.el] : null,
    save,
    onCancel ? h('button', { onclick: onCancel }, 'Cancel') : null);
  setTimeout(() => text.focus());
  return form;
}
