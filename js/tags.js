// Options for the bed / crop / kind chips used when capturing and tagging.

import * as db from './db.js';
import { bedsForSite } from './garden.js';
import { NOTE_TYPES } from './model.js';

export const TYPE_LABELS = {
  observation: 'Observation', feed: 'Feed', task: 'Task', pest: 'Pest', harvest: 'Harvest', other: 'Other',
};
export const TYPE_OPTIONS = NOTE_TYPES.map((t) => [t, TYPE_LABELS[t]]);

export function varietyName(v) {
  if (!v) return 'Unknown crop';
  return v.variety ? `${v.crop} ${v.variety}`.trim() : v.crop || 'Unnamed variety';
}

// Everything needed to show and pick tags for one site.
export async function tagContext(siteId) {
  const [beds, plantings, varieties] = await Promise.all([
    bedsForSite(siteId),
    db.getByIndex('plantings', 'site_id', siteId),
    db.getByIndex('varieties', 'site_id', siteId),
  ]);
  const bedById = new Map(beds.map((b) => [b.id, b]));
  const varietyById = new Map(varieties.map((v) => [v.id, v]));
  const plantingLabel = (p) => {
    const bed = bedById.get(p.bed_id);
    return `${varietyName(varietyById.get(p.variety_id))}${bed ? ` (${bed.name})` : ''}`;
  };
  return {
    beds,
    bedById,
    bedOptions: beds.map((b) => [b.id, b.name]),
    // Only crops still in the ground are offered as new tags.
    plantingOptions: (keep = []) => plantings
      .filter((p) => p.status !== 'finished' || keep.includes(p.id))
      .map((p) => [p.id, plantingLabel(p)]),
    plantingLabel: (id) => {
      const p = plantings.find((x) => x.id === id);
      return p ? plantingLabel(p) : null;
    },
  };
}
