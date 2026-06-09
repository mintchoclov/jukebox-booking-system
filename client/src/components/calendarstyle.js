export const slotStyles = {
  mine: 'bg-primary border-2 border-navy cursor-pointer hover:opacity-80',
  band: 'bg-pink border border-pinkDark cursor-pointer hover:opacity-80',
  individualPrimary: 'bg-primarySoft border border-primary cursor-pointer hover:opacity-80',
  individualExtra: 'bg-cream border border-primary cursor-pointer hover:opacity-80',
  available: 'bg-white border border-beige cursor-pointer hover:bg-primarySoft hover:border-primary',
  unavailable: 'bg-beige border border-beigeDark opacity-40 cursor-not-allowed',
}

export const legendItems = [
  { style: slotStyles.mine, label: 'My booking' },
  { style: slotStyles.band, label: 'Band' },
  { style: slotStyles.individualPrimary, label: 'Individual (primary)' },
  { style: slotStyles.individualExtra, label: 'Individual (extra)' },
  { style: slotStyles.available, label: 'Available' },
  { style: slotStyles.unavailable, label: 'Unavailable' },
]