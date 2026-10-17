// Company details every contract carries. Fill these in once; anything left
// empty prints on the contract as a highlighted [PLACEHOLDER] to type over.
// Reps can't change these from the form; edit this file and redeploy.

export const COMPANY = {
  name: 'Northern Pines Construction Services',
  street: '306 Jones Avenue',
  city: 'Crawfordsville',
  state: 'IN',
  zip: '47933',
  phone: '(765) 376-1197',
  email: 'sales@npconstructionservices.com',
  registration: '',

  // Who homeowners contact with problems (Indiana requires one on the contract).
  contactName: '',
  contactPhone: '(765) 376-1197',
  contactEmail: 'sales@npconstructionservices.com',

  // Cash jobs are paid in full at signing. Insurance-claim jobs pay in three
  // parts; these are the starting percentages, and reps can change them per job.
  payment: { deposit: '33', materials: '33', final: '34' },
  cardFee: '',          // e.g. 'Card payments carry a 3% processing fee.' Empty leaves the sentence out.

  // Late fees, as a percentage of the overdue amount: the first once a payment
  // is `days` late, a second once it is `moreDays` late. Always capped at what
  // Indiana law allows.
  lateFee: { days: '10', pct: '10', moreDays: '30', morePct: '10' },
  returnedPaymentPct: '25',  // fee on a bounced check or returned ACH payment, likewise capped

  lender: 'Hearth',     // the usual financing partner; reps can change it per job

  county: '',           // county whose courts hear disputes, e.g. 'Montgomery'

  // Section 7. Empty prices print as placeholders.
  unitPrices: [
    { repair: 'Roof decking replacement', unit: '4 × 8 sheet', price: '' },
    { repair: 'Fascia or rake board replacement', unit: 'Linear foot', price: '' },
    { repair: 'Window sill or jamb rot repair', unit: 'Opening', price: '' },
    { repair: 'Wall sheathing replacement', unit: '4 × 8 sheet', price: '' }
  ]
};
