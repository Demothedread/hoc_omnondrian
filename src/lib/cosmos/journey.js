// DESCRIPTION: Converts CMS résumé sections into uniquely addressed map stations.
// INPUTS: Résumé sections and entries including optional type, commentary and destination.
// OUTPUTS: Journey items and a flattened ordered station list with stable routes.
// DEPENDENCIES: None; pure content mapping.
const slug = (value) => String(value ?? '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'station';
export function journeySections(resume = {}) {
  const used = new Set();
  let index = 0;
  return (resume.sections ?? []).map((section) => {
    const key = slug(section.id || section.heading);
    let id = key, ordinal = 2;
    while (used.has(id)) id = `${key}-${ordinal++}`;
    used.add(id);
    const entryIds = new Set();
    return { id, title: section.heading || 'Journey', kind: 'journey', stations: (section.entries ?? []).map((entry, i) => {
      const preferred = entry.id ? slug(entry.id) : `${slug(entry.title)}-${i + 1}`;
      let stationId = preferred, suffix = 2;
      while (entryIds.has(stationId)) stationId = `${preferred}-${suffix++}`;
      entryIds.add(stationId);
      return {
      id: stationId, title: entry.title || 'Untitled station', org: entry.org ?? '', dates: entry.dates ?? '', note: entry.note ?? '',
      type: entry.type === 'personal' ? 'personal' : 'professional', commentary: entry.commentary ?? '', destination: String(entry.destination ?? '').replace(/^\/+|\/+$/g, ''), index: index++,
    }; }) };
  });
}
export function journeyStations(modules) {
  return (modules.find((m) => m.id === 'resume')?.items ?? []).flatMap((section) => (section.stations ?? []).map((station) => ({ ...station, section: section.title, route: `resume/${section.id}/${station.id}` })));
}
