// App entry: a tiny hash router over the screens in js/views, plus the
// always-visible capture button.

import { onNoteSaved, openCapture } from './capture.js';
import { currentSite, upgradeSampleSites } from './garden.js';
import { inboxNotes } from './notes.js';
import { releasePhotoUrls } from './photos.js';
import { go, h } from './ui.js';
import * as bed from './views/bed.js';
import * as beds from './views/beds.js';
import * as customise from './views/customise.js';
import * as home from './views/home.js';
import * as notes from './views/notes.js';
import * as settings from './views/settings.js';
import * as site from './views/site.js';
import * as welcome from './views/welcome.js';

const app = document.getElementById('app');
const settingsLink = document.getElementById('settings-link');
const tasksLink = document.getElementById('tasks-link');
const captureBtn = document.getElementById('capture-btn');

const ROUTES = {
  '': () => home.render(app),
  welcome: () => welcome.render(app),
  'site/new': () => site.render(app, { isNew: true }),
  site: () => site.render(app, { isNew: false }),
  bed: (q) => bed.render(app, { id: q.get('id') }),
  beds: (q) => beds.render(app, { setup: q.has('setup'), edit: q.get('edit') }),
  tasks: () => notes.render(app, { tasks: true }),
  notes: () => notes.render(app, { tasks: false }),
  settings: () => settings.render(app),
  customise: () => customise.render(app),
  // Old addresses, in case they're bookmarked.
  inbox: () => location.replace('#/tasks'),
  dashboard: () => location.replace('#/'),
};

// Screens shown before a garden exists, without the garden controls.
const SETUP_ROUTES = ['welcome', 'site/new'];

async function updateTasksLink(siteId) {
  const n = siteId ? (await inboxNotes(siteId)).length : 0;
  tasksLink.textContent = n ? `Tasks ${n}` : 'Tasks';
  tasksLink.classList.toggle('has-items', n > 0);
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
    settingsLink.hidden = tasksLink.hidden = captureBtn.hidden = setup;
    settingsLink.setAttribute('aria-current', path === 'settings' || path === 'customise' ? 'page' : 'false');
    tasksLink.setAttribute('aria-current', path === 'tasks' ? 'page' : 'false');
    await updateTasksLink(current?.id);
    await show(new URLSearchParams(query));
  } catch (err) {
    console.error(err);
    app.replaceChildren(h('p', { class: 'warn' }, 'Something went wrong opening this screen: ', err.message));
  }
  window.scrollTo(0, 0);
}

// On a bed's page, a new note starts tagged with that bed.
captureBtn.addEventListener('click', () => {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const bedId = path === 'bed' ? new URLSearchParams(query).get('id') : null;
  openCapture({ bed_ids: bedId ? [bedId] : [] });
});
// Refresh whatever is underneath so the new note shows straight away.
onNoteSaved(() => go(location.hash || '#/'));

// Ask the browser not to clear our data when the phone is short of space.
if (navigator.storage?.persist) {
  navigator.storage.persisted().then((ok) => ok || navigator.storage.persist()).catch(() => {});
}

window.addEventListener('hashchange', route);
upgradeSampleSites().catch(console.error).finally(route);
