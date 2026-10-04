import { loadPreset } from '../garden.js';
import { PRESETS } from '../presets.js';
import { busy, go, h, toast } from '../ui.js';

export async function render(root) {
  const derbyBtn = h('button', {
    class: 'primary',
    onclick: () => busy(derbyBtn, 'Loading…', async () => {
      await loadPreset('derby');
      toast('Your garden is ready.');
      go('#/');
    }),
  }, `Start with the ${PRESETS.derby.label}`);

  root.replaceChildren(
    h('section', { class: 'card intro' },
      h('h2', {}, 'Welcome'),
      h('p', {}, 'A quick place to jot down what’s happening in the garden: a photo, a few words, done. You can tidy up and tag things later.'),
      h('p', { class: 'muted small' }, 'The Derby garden comes with its beds, seeds and open questions already filled in. Everything stays on this phone.'),
      derbyBtn,
      h('button', { onclick: () => go('#/site/new') }, 'Set up a different garden'),
    ),
  );
}
