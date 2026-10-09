// Display metadata for facility categories and statuses. Facility data itself comes from the API.

export const CATEGORIES = {
  toilet: {
    key: 'toilet',
    label: 'Public Toilets',
    singular: 'Toilet',
    color: '#1b3a5c',
  },
  waste: {
    key: 'waste',
    label: 'Waste Disposal',
    singular: 'Waste Disposal Point',
    color: '#dd9a2b',
  },
  water: {
    key: 'water',
    label: 'Water Points',
    singular: 'Water Point',
    color: '#2f8ad6',
  },
  health: {
    key: 'health',
    label: 'Health Services',
    singular: 'Clinic / Pharmacy',
    color: '#23a382',
  },
};

export const STATUS = {
  clean: { key: 'clean', label: 'Clean', tone: 'success' },
  operational: { key: 'operational', label: 'Operational', tone: 'success' },
  open: { key: 'open', label: 'Open', tone: 'success' },
  filling: { key: 'filling', label: 'Filling Up', tone: 'warning' },
  full: { key: 'full', label: 'Full', tone: 'warning' },
  broken: { key: 'broken', label: 'Broken', tone: 'danger' },
  closed: { key: 'closed', label: 'Closed', tone: 'muted' },
  unverified: { key: 'unverified', label: 'Not yet verified', tone: 'muted' },
  dirty: { key: 'dirty', label: 'Needs Cleaning', tone: 'warning' },
  seasonal: { key: 'seasonal', label: 'Seasonal', tone: 'warning' },
};
