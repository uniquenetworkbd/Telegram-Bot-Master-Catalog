(() => {
  'use strict';

  const repository = window.TBMC && window.TBMC.catalogRepository;
  if (!repository) throw new Error('Search Engine requires the Storage API');

  function normalize(value) {
    return String(value === undefined || value === null ? '' : value).trim().toLowerCase();
  }

  function filter(records, filters = {}) {
    if (!Array.isArray(records)) throw new TypeError('Search Engine records must be an array');
    const query = normalize(filters.query);
    const category = String(filters.category || '');
    const api = String(filters.api || '');
    const automation = String(filters.automation || '');
    const sort = String(filters.sort || '');

    const result = records.filter(record =>
      (!query || Object.values(record).join(' ').toLowerCase().includes(query)) &&
      (!category || record['English Category'] === category) &&
      (!api || (api === 'yes'
        ? repository.isApi(record['API Required?'])
        : !repository.isApi(record['API Required?']))) &&
      (!automation || String(record['Automation Potential'] || '').trim() === automation)
    );

    if (sort === 'name-asc') result.sort((a, b) => a['Bot Name'].localeCompare(b['Bot Name']));
    if (sort === 'name-desc') result.sort((a, b) => b['Bot Name'].localeCompare(a['Bot Name']));
    if (sort === 'category') {
      result.sort((a, b) =>
        (a['English Category'] || '').localeCompare(b['English Category'] || '') ||
        a['Bot Name'].localeCompare(b['Bot Name'])
      );
    }
    return result;
  }

  function getFacets(records) {
    if (!Array.isArray(records)) throw new TypeError('Search Engine records must be an array');
    return {
      categories: [...new Set(records.map(record => record['English Category']).filter(Boolean))].sort(),
      automation: [...new Set(records.map(record => String(record['Automation Potential'] || '').trim()).filter(Boolean))].sort(),
      apiRequired: ['yes', 'no']
    };
  }

  window.TBMC.searchEngine = Object.freeze({
    version: '1.0.0',
    normalize,
    filter,
    getFacets
  });
})();
