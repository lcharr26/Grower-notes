// App entry: a tiny hash router over the screens in js/views, plus the
// always-visible capture button.

import { onNoteSaved, openCapture } from './capture.js';
import { currentSite, upgradeSampleSites } from './garden.js';
import { inboxNotes } from './notes.js';
import { releasePhotoUrls } from './photos.js';
import { go, h } from './ui.js';
import * as beds from './views/beds.js';
import * as home from './views/home.js';
import * as notes from './views/notes.js';
import * as settings from './views/settings.js';
import * as site from './views/site.js';
import * as welcome from './views/welcome.js';

const app = document.getElementById('app');
const settingsLink = document.getElementById('settings-link');
const inboxLink = document.getElementById('inbox-link');
const captureBtn = document.getElementById('capture-btn');

const ROUTES = {
  '': () => home.render(app),
  welcome: () => welcome.render(app),
  'site/new': () => site.render(app, { isNew: true }),
  site: () => site.render(app, { isNew: false }),
  beds: (q) => beds.render(app, { setup: q.has('setup') }),
  inbox: () => notes.render(app, { inbox: true }),
  notes: () => notes.render(app, { inbox: false }),
  settings: () => settings.render(app),
};

// Screens shown before a garden exists, without the garden controls.
const SETUP_ROUTES = ['welcome', 'site/new'];

async function updateInboxLink(siteId) {
  const n = siteId ? (await inboxNotes(siteId)).length : 0;
  inboxLink.textContent = n ? `Inbox ${n}` : 'Inbox';
  inboxLink.classList.toggle('has-items', n > 0);
}

async function route() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const show = ROUTES[path] || ROUTES[''];
  releasePhotoUrls();
  try {
    const current = await currentSite();
    // Nobody should land on a garden screen before a garden exists.
    if (!current && !SETUP_ROUTES.includes(path)) {
      location.replace('#/welcome');
      return;
    }
    const setup = SETUP_ROUTES.includes(path);
    settingsLink.hidden = inboxLink.hidden = captureBtn.hidden = setup;
    settingsLink.setAttribute('aria-current', path === 'settings' ? 'page' : 'false');
    inboxLink.setAttribute('aria-current', path === 'inbox' || path === 'notes' ? 'page' : 'false');
    await updateInboxLink(current?.id);
    await show(new URLSearchParams(query));
  } catch (err) {
    console.error(err);
    app.replaceChildren(h('p', { class: 'warn' }, 'Something went wrong opening this screen: ', err.message));
  }
  window.scrollTo(0, 0);
}

captureBtn.addEventListener('click', () => openCapture());
// Refresh whatever is underneath so the new note shows straight away.
onNoteSaved(() => go(location.hash || '#/'));

// Ask the browser not to clear our data when the phone is short of space.
if (navigator.storage?.persist) {
  navigator.storage.persisted().then((ok) => ok || navigator.storage.persist()).catch(() => {});
}

window.addEventListener('hashchange', route);
upgradeSampleSites().catch(console.error).finally(route);
