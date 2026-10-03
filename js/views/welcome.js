import { loadSample } from '../garden.js';
import { busy, go, h, toast } from '../ui.js';

export async function render(root) {
  const sampleBtn = h('button', {
    onclick: () => busy(sampleBtn, 'Loading…', async () => {
      await loadSample();
      toast('Sample garden loaded. You can remove it any time in Settings.');
      go('#/');
    }),
  }, 'Look around a sample garden first');

  root.replaceChildren(
    h('section', { class: 'card intro' },
      h('h2', {}, 'Welcome'),
      h('p', {}, 'A quick place to jot down what’s happening in the garden: a photo, a few words, done. You can tidy up and tag things later.'),
      h('p', { class: 'muted small' }, 'Setting up takes a minute: name your garden, then add your beds. Everything stays on this phone.'),
      h('button', { class: 'primary', onclick: () => go('#/site/new') }, 'Set up my garden'),
      sampleBtn,
    ),
  );
}
