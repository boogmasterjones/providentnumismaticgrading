/**
 * The site's line symbols (drawn as inline SVG in src/components/Mark.astro). Editors pick one by name in Keystatic.
 * Labels are what the editor shows in the drop-down.
 */
export const MARKS = [
  { value: 'none', label: 'No symbol' },
  { value: 'intake', label: 'Parcel (receipt, intake)' },
  { value: 'authenticate', label: 'Shield (authentication)' },
  { value: 'attribute', label: 'Open catalogue (attribution)' },
  { value: 'grade', label: 'Scale dial (grading)' },
  { value: 'review', label: 'Double check (quality control)' },
  { value: 'holder', label: 'Holder (encapsulation)' },
  { value: 'label', label: 'Label' },
  { value: 'registry', label: 'Registry records' },
  { value: 'return', label: 'Envelope (return shipping)' },
  { value: 'balance', label: 'Balance (weight, fairness)' },
  { value: 'coin', label: 'Coin' },
  { value: 'laurel', label: 'Laurel (ancient coins)' },
  { value: 'globe', label: 'Globe (world coins)' },
  { value: 'medal', label: 'Medal (tokens and medals)' },
  { value: 'seal', label: 'Seal (tamper evidence)' },
  { value: 'aperture', label: 'Aperture (imaging)' },
  { value: 'column', label: 'Column (the company)' },
  { value: 'pen', label: 'Pen (design)' },
] as const;

export type MarkName = (typeof MARKS)[number]['value'];
