(() => {
  'use strict';

  const repository = window.TBMC && window.TBMC.catalogRepository;
  if (!repository) throw new Error('Analytics Engine requires the Storage API');

  function isHighAutomation(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'high' || normalized === 'উচ্চ';
  }

  function summarize(records) {
    if (!Array.isArray(records)) throw new TypeError('Analytics Engine records must be an array');
    const categoryCounts = repository.categoryCounts(records);
    const automationCounts = repository.automationCounts(records);
    const apiRequired = records.filter(record => repository.isApi(record['API Required?'])).length;
    const highAutomation = records.filter(record => isHighAutomation(record['Automation Potential'])).length;
    return {
      totalRecords: records.length,
      totalCategories: Object.keys(categoryCounts).length,
      apiRequired,
      highAutomation,
      categoryCounts: { ...categoryCounts },
      automationCounts: { ...automationCounts }
    };
  }

  window.TBMC.analyticsEngine = Object.freeze({
    version: '1.0.0',
    isHighAutomation,
    summarize
  });
})();
