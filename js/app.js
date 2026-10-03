// App entry: a tiny hash router over the screens in js/views.

import { currentSite } from './garden.js';
import { h } from './ui.js';
import * as beds from './views/beds.js';
import * as home from './views/home.js';
import * as settings from './views/settings.js';
import * as site from './views/site.js';
import * as welcome from './views/welcome.js';

const app = document.getElementById('app');
const settingsLink = document.getElementById('settings-link');

const ROUTES = {
  '': (q) => home.render(app, q),
  welcome: () => welcome.render(app),
  'site/new': () => site.render(app, { isNew: true }),
  site: () => site.render(app, { isNew: false }),
  beds: (q) => beds.render(app, { setup: q.has('setup') }),
  settings: () => settings.render(app),
};

async function route() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const show = ROUTES[path] || ROUTES[''];
  try {
    // Nobody should land on a garden screen before a garden exists.
    if (!(await currentSite()) && !['welcome', 'site/new'].includes(path)) {
      location.replace('#/welcome');
      return;
    }
    settingsLink.hidden = path === 'welcome' || path === 'site/new';
    settingsLink.setAttribute('aria-current', path === 'settings' ? 'page' : 'false');
    await show(new URLSearchParams(query));
  } catch (err) {
    console.error(err);
    app.replaceChildren(h('p', { class: 'warn' }, 'Something went wrong opening this screen: ', err.message));
  }
  window.scrollTo(0, 0);
}

// Ask the browser not to clear our data when the phone is short of space.
if (navigator.storage?.persist) {
  navigator.storage.persisted().then((ok) => ok || navigator.storage.persist()).catch(() => {});
}

window.addEventListener('hashchange', route);
route();
