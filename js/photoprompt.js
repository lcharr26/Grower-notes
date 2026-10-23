// "Does this photo answer any of these?" After a photo is saved to (or
// tagged with) a bed that has open questions, show them. No AI: the grower
// looks and decides. Each question can be marked answered (linked to the
// photo), get a note added, or be left as it is.

import { photoBlob, updateNote } from './notes.js';
import { photoUrl } from './photos.js';
import { openQuestionsForNote, resolveQuestion } from './questions.js';
import { tagContext } from './tags.js';
import { busy, h, showPhoto, toast } from './ui.js';

// Resolves when the prompt is closed (or straight away if there's nothing to ask).
export async function photoPrompt(note) {
  if (!note.photos.length) return;
  const questions = await openQuestionsForNote(note);
  if (!questions.length) return;
  const tags = await tagContext(note.site_id);
  let current = note;

  const thumbs = [];
  for (const id of note.photos) {
    const blob = await photoBlob(id);
    if (!blob) continue;
    const url = photoUrl(blob);
    thumbs.push(h('button', { type: 'button', class: 'thumb-btn', 'aria-label': 'View photo', onclick: () => showPhoto(url) },
      h('img', { src: url, alt: '' })));
  }

  return new Promise((resolve) => {
    const where = (q) => [...q.bed_ids.map((id) => tags.bedById.get(id)?.name), ...q.planting_ids.map(tags.plantingLabel)]
      .filter(Boolean).join(', ');

    const card = (q) => {
      const box = h('div', { class: 'card prompt-q' });
      const head = [h('p', { class: 'q-text' }, q.text), where(q) ? h('p', { class: 'muted small' }, where(q)) : null];

      const showButtons = () => box.replaceChildren(...head.filter(Boolean),
        h('div', { class: 'two' },
          h('button', { class: 'primary', onclick: showAnswer }, 'Yes, answered'),
          h('button', { onclick: showNote }, 'Add a note')));

      function showAnswer() {
        const answer = h('input', { type: 'text', placeholder: 'The answer, in a line (optional)', 'aria-label': 'Answer', autocomplete: 'off' });
        const save = h('button', {
          class: 'primary',
          onclick: () => busy(save, 'Saving…', async () => {
            await resolveQuestion(q, { note: answer.value, byNoteId: current.id });
            box.replaceChildren(...head.filter(Boolean), h('p', { class: 'done-line' }, `✓ Answered${answer.value.trim() ? `: ${answer.value.trim()}` : ''}`));
          }),
        }, 'Mark answered');
        answer.addEventListener('keydown', (e) => { if (e.key === 'Enter') save.click(); });
        box.replaceChildren(...head.filter(Boolean), answer, save, h('button', { onclick: showButtons }, 'Back'));
        answer.focus();
      }

      // Not answered yet, but worth a word: it goes on the photo's note,
      // which sits in the bed's history right next to the photo.
      function showNote() {
        const line = h('input', { type: 'text', placeholder: 'e.g. No sign yet, keep watching', 'aria-label': 'Note', autocomplete: 'off' });
        const save = h('button', {
          class: 'primary',
          onclick: () => busy(save, 'Saving…', async () => {
            const words = line.value.trim();
            if (!words) { toast('Type a few words first.'); return; }
            const addition = `${q.text}: ${words}`;
            current = await updateNote(current, { text: current.text ? `${current.text}\n${addition}` : addition });
            box.replaceChildren(...head.filter(Boolean), h('p', { class: 'done-line' }, `Note added: ${words}`));
          }),
        }, 'Add note');
        line.addEventListener('keydown', (e) => { if (e.key === 'Enter') save.click(); });
        box.replaceChildren(...head.filter(Boolean), line, save, h('button', { onclick: showButtons }, 'Back'));
        line.focus();
      }

      showButtons();
      return box;
    };

    const close = () => {
      sheet.remove();
      document.body.classList.remove('sheet-open');
      resolve();
    };

    const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Does this photo answer any of these?' },
      h('div', { class: 'sheet-head' },
        h('h2', {}, 'Does this photo answer any of these?'),
        h('button', { type: 'button', class: 'close', 'aria-label': 'Close', onclick: close }, '×')),
      h('div', { class: 'sheet-body' },
        thumbs.length ? h('div', { class: 'photos' }, thumbs) : null,
        questions.map(card)),
      h('div', { class: 'sheet-foot' },
        h('button', { class: 'save', onclick: close }, 'Done')));
    document.body.append(sheet);
    document.body.classList.add('sheet-open');
  });
}
