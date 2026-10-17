// The words of the Home Improvement Agreement, as a list of blocks that both
// the HTML sheet (html.js) and the Word writer (docx.js) render. Change the
// contract here and the preview, the printout and the .docx all follow.
//
// Inline parts are a string, { b } for bold, or { v, ph } for a filled-in
// value: an empty v prints as a highlighted [PH] to type over.
//
// With { blank: true } it builds the office's printable blank: every optional
// line keeps its placeholder instead of being left out.

import { COMPANY as K } from './company.js';
import { SERVICES, parseMoney, fmtMoney, showMoney, totals, payments, fmtDate, cancelBy } from './model.js';

const f = (v, ph, bold) => ({ v: String(v ?? '').trim(), ph, b: bold });
const B = (text) => ({ b: text });
const money = (n, ph = '$0.00') => f(n === null || n === undefined ? '' : fmtMoney(n), ph);
const date = (s, ph) => f(fmtDate(s), ph);

const p = (parts, o = {}) => ({ t: 'p', parts: [].concat(parts), o });
const h = (text) => ({ t: 'h', text });
const ul = (...items) => ({ t: 'ul', items: items.filter(Boolean).map((x) => [].concat(x)) });
const check = (on, parts, o = {}) => ({ t: 'check', on: !!on, parts: [].concat(parts), o });

export const FTC_STATEMENT = 'You, the buyer, may cancel this transaction at any time prior to midnight of the third business day after the date of this transaction. See the attached notice of cancellation form for an explanation of this right.';

export function footerParts(c) {
  return ['Northern Pines Home Improvement Agreement no. ', f(c.no, 'AGREEMENT NO.')];
}

export function buildContract(c, { blank = false } = {}) {
  const t = totals(c);
  const pay = payments(c);
  const lines = c.lines.filter((l) => l.item.trim() || l.spec.trim() || l.qty.trim() || l.price.trim());
  const office = [f(K.street, 'STREET ADDRESS'), ` · ${K.city}, ${K.state} `, f(K.zip, 'ZIP')];
  const pctCell = (v) => [f(v, '__'), '%'];
  const extra = (text, ph) => {
    const rows = String(text || '').split('\n').map((s) => s.trim()).filter(Boolean);
    if (rows.length) return rows;
    return blank ? [[f('', ph)]] : [];
  };

  const lineRows = lines.length
    ? lines.map((l, i) => [String(i + 1), [f(l.item, 'ITEM')], [f(l.spec, 'PRODUCT / SPECIFICATIONS')], [f(l.qty, 'QTY')], [f(showMoney(l.price), '$0.00')]])
    : [['1', [f('', 'ITEM')], [f('', 'PRODUCT / SPECIFICATIONS')], [f('', 'QTY')], [f('', '$0.00')]]];
  if (blank) for (let i = lineRows.length; i < 6; i++) lineRows.push([String(i + 1), '', '', '', '']);

  const unitRows = K.unitPrices.map((u) => [u.repair, u.unit, [f(showMoney(u.price), '$0.00')]]);
  if (blank) unitRows.push([[f('', 'OTHER REPAIR')], [f('', 'UNIT')], [f('', '$0.00')]]);

  const blocks = [
    p(B(K.name.toUpperCase()), { align: 'center', size: 22, color: 'pine', spaced: true, after: 40 }),
    p([...office, ` · ${K.phone} · ${K.email}`], { align: 'center', size: 17, color: 'muted', after: 40 }),
    p(['Indiana contractor registration no. ', f(K.registration, 'REGISTRATION NO(S).')], { align: 'center', size: 17, color: 'muted', after: 200, rule: true }),
    { t: 'title', text: 'Home Improvement Agreement' },
    { t: 'table', widths: [2340, 2340, 2340, 2340], labels: 'even', rows: [
      ['Agreement no.', [f(c.no, 'AGREEMENT NO.')], 'Date given to customer', [date(c.submitted, 'DATE SUBMITTED')]],
      ['Sales representative', [f(c.repName, 'REP NAME')], 'Rep phone', [f(c.repPhone, 'REP PHONE')]]
    ] },
    p(['This offer is open until ', date(c.expires, 'OFFER EXPIRES DATE'), '. After that date the price and schedule may change, and Northern Pines will give you a new written proposal.'], { before: 160 }),
    p(['Questions or problems with this Agreement or your project go to ', f(K.contactName, 'CUSTOMER CONTACT NAME', true), ' at ', f(K.contactPhone, 'CONTACT PHONE'), ' or ', f(K.contactEmail, 'CONTACT EMAIL'), '.']),
    p('In this Agreement, “you” means each customer who signs below, and “Northern Pines,” “we” and “us” mean Northern Pines Construction Services.'),

    h('1. Customer and project address'),
    { t: 'table', widths: [2600, 6760], labels: 'first', rows: [
      ['Customer name', [f(c.cust1, 'CUSTOMER 1 FULL NAME')]],
      ['Second customer (if any)', blank ? [f('', 'CUSTOMER 2 FULL NAME')] : [c.cust2.trim() ? f(c.cust2) : 'None']],
      ['Mailing address', [f(c.mailing, 'STREET, CITY, STATE ZIP')]],
      ['Project address', blank ? [f('', 'SAME AS ABOVE, OR STREET, CITY, IN ZIP')] : c.projectSame ? (c.mailing.trim() ? ['Same as mailing address'] : [f('', 'PROJECT ADDRESS')]) : [f(c.project, 'PROJECT ADDRESS')]],
      ['Phone', [f(c.phone, 'PHONE')]],
      ['Email', [f(c.email, 'EMAIL')]]
    ] },

    h('2. Scope of work'),
    p('Northern Pines will supply the labor, materials and equipment to complete the following work at the project address.'),
    p(B('Services in this Agreement:'), { keepNext: true }),
    { t: 'checkrow', items: SERVICES.map((s) => ({ on: c.services.includes(s), label: s })) },
    { t: 'table', widths: [520, 2560, 4040, 840, 1400], header: true, right: [4], rows: [
      ['#', 'Item', 'Product and specifications (brand, series, size, color, finish)', 'Qty', 'Price'],
      ...lineRows
    ] },
    p(['Attached pages: ', blank ? f('', 'NONE / NUMBER OF PAGES') : c.attached.trim() ? f(c.attached) : 'none', '.'], { size: 18, color: 'muted', before: 80 }),
    p([B('Specifications. '), 'If any specification for the work (brand, series, size, color or finish) is not written above, Northern Pines will give it to you in writing before any work begins, and this Agreement is subject to your separate written and dated approval of those specifications.']),
    p(B('Included in the price:'), { keepNext: true }),
    ul('Removal and disposal of the existing materials being replaced.',
      'Building permits the work requires (see Section 10).',
      'Protection of floors, landscaping and the path to the work area, and daily and final cleanup.',
      ...extra(c.inclusions, 'OTHER INCLUSIONS, OR DELETE THIS LINE')),
    p(B('Not included unless listed in the table above:'), { keepNext: true, before: 80 }),
    ul('Interior painting, or drywall and plaster repair beyond the trim around the work.',
      'Electrical, plumbing or HVAC work.',
      'Repairs to hidden damage, which are handled under Section 7.',
      ...extra(c.exclusions, 'OTHER EXCLUSIONS, OR DELETE THIS LINE')),
    p(B('Who does the work:'), { keepNext: true, before: 80 }),
    check(!blank && !c.sub, 'All work is done by Northern Pines crews.'),
    check(c.sub, ['Some work is done by a subcontractor or supplier: ', f(c.subWork, 'WORK AND COMPANY NAME'), '.']),

    h('3. Contract price'),
    { t: 'table', widths: [6960, 2400], total: true, right: [1], rows: [
      ['Labor and materials (total of Section 2)', [money(t && t.subtotal)]],
      ['Indiana sales tax', [t ? money(t.tax) : f(showMoney(c.tax), '$0.00')]],
      ['Total contract price', [money(t && t.total)]]
    ] },
    p('The contract price covers everything described in Section 2. It changes only through a signed change order (Section 8).', { before: 80 }),

    h('4. Payment schedule'),
    { t: 'table', widths: [3000, 3640, 1100, 1620], header: true, total: true, right: [2, 3], rows: [
      ['Payment', 'When it is due', '% of price', 'Amount'],
      ['1. Deposit', 'When you sign this Agreement', pctCell(c.pct.deposit), [money(pay && pay[0])]],
      ['2. Materials payment', 'When materials are delivered to the project address', pctCell(c.pct.materials), [money(pay && pay[1])]],
      ['3. Final balance', 'When the work is complete and we have done the final walkthrough with you', pctCell(c.pct.final), [money(pay && pay[2])]],
      ['Total', '', '100%', [money(t && t.total)]]
    ] },
    ul(['We accept check, ACH bank transfer and card.', ...(K.cardFee ? [' ' + K.cardFee] : blank ? [' ', f('', 'CARD FEE, IF ANY, OR DELETE THIS SENTENCE')] : [])],
      'If you cancel within the three-business-day cancellation period (Section 18), your deposit is refunded in full.',
      ['If a small punch-list item is still open at the final walkthrough, you may hold back ', f(K.holdback, '$ HOLDBACK AMOUNT'), ' of the final balance until it is finished, and pay the rest when it is due.'],
      ['A payment more than ', f(K.lateDays, '__'), ' days late accrues interest at ', f(K.lateRate, '__'), '% per month, never more than Indiana law allows.']),

    h('5. How you are paying'),
    p('Check one.'),
    check(c.method === 'cash', [B('Cash, check, ACH or card.'), ' You pay according to the schedule in Section 4.']),
    check(c.method === 'finance', [B('Financing through '), f(c.lender, 'LENDER NAME', true), B('.'), ' Plan: ', f(c.plan, 'PLAN / PROMOTION'), '. Amount financed: ', f(showMoney(c.financed), '$0.00'), '. Amount you pay directly: ',
      c.method === 'finance' && t && parseMoney(c.financed) !== null ? money(Math.max(0, Math.round((t.total - parseMoney(c.financed)) * 100) / 100)) : f('', '$0.00'), '.']),
    p(B('If you choose financing:'), { keepNext: true, before: 100 }),
    ul('The lender, not Northern Pines, provides the financing. The lender decides whether you are approved, and sets your rate, term and monthly payment, based on your credit score and its own criteria. Northern Pines cannot promise approval or a particular rate.',
      'Your loan is governed by the lender’s own credit agreement and disclosures, which the lender gives you separately. This Agreement is not a loan agreement. Read the lender’s documents before you sign them.',
      'The lender pays Northern Pines directly, on the lender’s schedule. Any part of the price that is not financed is due under Section 4.',
      [B('Financing contingency. '), 'Nothing is ordered until your financing is approved. If the lender does not approve you within ', f(K.financingDays, '__'), ' days after you sign, or approves you on terms you do not accept, you may (a) pay under the cash schedule in Section 4, (b) apply with another lender, or (c) cancel this Agreement in writing, and Northern Pines will refund any payment you made within 10 business days.']),

    h('6. Schedule'),
    { t: 'table', widths: [4680, 4680], labels: 'first', rows: [
      ['Approximate start date', [date(c.start, 'START DATE')]],
      ['Approximate completion date', [date(c.finish, 'COMPLETION DATE')]]
    ] },
    p('Before anything is ordered, a Northern Pines technician comes back for a production measure. If that visit turns up damage or a condition that changes the price, we tell you in writing before anything is ordered.', { before: 120 }),
    p(B('Things that could materially change the completion date:'), { keepNext: true }),
    ul('Weather that makes the work unsafe or would harm its quality.',
      'Manufacturing or delivery delays, and back-ordered products.',
      'The time it takes to get permits, inspections or homeowners’ association approval.',
      'Hidden conditions found during the work (Section 7), and change orders (Section 8).',
      'Waiting on financing approval, or not being able to get into the work area.',
      'Other causes outside Northern Pines’ reasonable control.'),
    p('If one of these moves your dates, we will tell you promptly and give you a new estimate.'),

    h('7. Hidden conditions'),
    p('Some damage can’t be seen until the old material comes off, such as rotted roof decking, rotted window sills or jambs, or damaged wall sheathing. If we find it, we stop, show you, and explain what it changes. We repair it at the unit prices below only with your approval, given on a signed change order. If waiting would leave your home open to the weather, your verbal approval is enough to go ahead, and we bring you a written change order within 2 business days.'),
    { t: 'table', widths: [5160, 2100, 2100], header: true, right: [2], rows: [['Repair', 'Unit', 'Price per unit'], ...unitRows] },

    h('8. Change orders'),
    p('Any change to the work, price or schedule must be written on a change order that describes the change, its effect on the price and schedule, and is signed by you and by Northern Pines before the changed work begins (except as Section 7 allows). No salesperson, installer or office employee can change this Agreement verbally.'),

    h('9. Custom-ordered products'),
    p('Windows, doors and some other products are built to your home’s measurements and can’t be returned once ordered. If you end this Agreement after the cancellation period in Section 18 ends and after products are ordered, for a reason that is not Northern Pines’ fault, you owe for the custom products already ordered and the work already done, less any payments you have made. Northern Pines will give you an itemized statement.'),

    h('10. Permits, codes and approvals'),
    ul('Northern Pines gets the building permits the work requires, and their cost is included in the price.',
      'All work will meet the building codes that apply at the project address. If code requires extra work that neither of us could reasonably have foreseen, it is handled with a change order.'),
    check(c.hoa, ['HOA approval is required, and will be obtained by:   ', { box: c.hoa && c.hoaBy === 'customer' }, ' Customer    ', { box: c.hoa && c.hoaBy === 'company' }, ' Northern Pines']),

    h('11. Your responsibilities'),
    ul('Give our crews clear access to the work area during working hours, and access to electricity and an outdoor water spigot.',
      'For window and door work, take down window treatments and move furniture about three feet from the walls. Tell us in advance if you’d like us to move furniture.',
      'Keep children and pets away from the work area while we are working.',
      'Tell us before work starts about sprinkler lines, invisible pet fences, septic systems, or anything else buried in or near the work area.',
      'Remove fragile items from walls and shelves next to the work. Roofing and siding work can shake interior walls.'),

    h('12. Warranty'),
    ul([B('Workmanship. '), 'Northern Pines warrants its installation workmanship for ', f(K.workmanshipWarranty, 'WORKMANSHIP WARRANTY TERM'), ' from the completion date.'],
      [B('Windows. '), 'Windows installed by Northern Pines carry a lifetime warranty on glass, frame and labor. We administer it ourselves, and it transfers once to a new owner of the home.'],
      [B('Manufacturer warranties. '), 'Products also carry their manufacturers’ warranties, which we pass on to you. We give you copies when the work is done.'],
      [B('What the warranty does not cover: '), 'damage from misuse, accidents, fire, or storms beyond the product’s rating; settling or structural movement of the house; repairs or changes made by others; normal wear; and failure to follow the care instructions we provide.'],
      `The warranty takes effect when the contract price has been paid in full. To make a claim, call ${K.phone} and ask for service. Have your agreement number handy if you can.`,
      'This warranty is in addition to any other rights you have under Indiana law.'),

    h('13. Cleanup and site protection'),
    p(['We clean up the work area at the end of each day and do a final cleanup when the work is finished, including a magnetic sweep for nails after roofing work. The dumpster or trailer will be placed at ', f(c.dumpster, 'DUMPSTER LOCATION'), ', on boards to protect the pavement. Any damage we cause to your property is ours to repair.']),

    h('14. Insurance and registration'),
    p('Northern Pines carries general liability insurance and workers’ compensation insurance, and will give you certificates on request. Northern Pines is a registered contractor wherever the county or city requires it, under the registration number(s) at the top of this Agreement.'),

    h('15. Insurance-claim projects'),
    check(c.claim, ['This project is being paid for, in whole or in part, from a property insurance claim. Insurer: ', f(c.claim || blank ? c.insurer : 'n/a', 'INSURANCE COMPANY'), '. Claim number: ', f(c.claim || blank ? c.claimNo : 'n/a', 'CLAIM NO.'), '.']),
    p('If the box above is checked:', { keepNext: true }),
    ul([B('If your insurer tells you in writing that all or part of your claim is denied, you may cancel this Agreement within three business days after you receive that notice. '), 'To cancel, give written notice to Northern Pines at the address at the top of this Agreement. Any payment you made will be refunded.'],
      'Northern Pines is not a public adjuster and will not negotiate your claim with your insurer for you.',
      'Northern Pines will not pay, waive, rebate or absorb any part of your insurance deductible.',
      'The price in Section 3 is the price for the work. If your insurer approves additional work, it is added only through a signed change order.'),

    h('16. Liens and project photos'),
    p([B('Liens. '), 'Indiana law lets contractors, subcontractors and suppliers who furnish labor or materials for your home record a mechanic’s lien against the property if they are not paid. Northern Pines pays its suppliers and any subcontractors on this project out of the payments you make. When you make your final payment, you may ask for a written lien waiver from Northern Pines and from any subcontractor or supplier on the job.']),
    p([B('Project photos. '), 'Check one.'], { keepNext: true }),
    check(c.photos === 'yes', 'Northern Pines may use before-and-after photos of the outside of my home in its marketing (website, reviews and social media). Photos will not show my house number, street sign or any people.'),
    check(c.photos === 'no', 'Photos may be taken for job records only, and not used in marketing.'),

    h('17. General terms'),
    ul([B('Whole agreement. '), 'This Agreement, any attached pages and any signed change orders are the entire agreement between you and Northern Pines. They replace any earlier estimate, proposal or conversation.'],
      [B('Ending the agreement for breach. '), 'If either party seriously fails to do what this Agreement requires and doesn’t fix it within 10 days after written notice, the other party may end this Agreement in writing.'],
      [B('Disputes. '), 'If a problem comes up, tell us in writing first and give us 30 days to make it right. If we can’t resolve it together, either of us may go to the courts in ', f(K.county, 'COUNTY'), ' County, Indiana, including small claims court.'],
      [B('Governing law. '), 'This Agreement is governed by the laws of the State of Indiana.'],
      [B('Severability. '), 'If a court finds any part of this Agreement unenforceable, the rest still applies.'],
      [B('Notices. '), 'Written notices go to the addresses in this Agreement, by hand, mail or email.']),

    h('18. Your right to cancel'),
    p('You have three business days after the day you sign to cancel this Agreement for any reason, without penalty. Two copies of the Notice of Cancellation are attached to this Agreement and explain how.', { keepNext: true }),
    p(B(FTC_STATEMENT), { box: true, size: 22, keepNext: true }),
    p('By signing below, you confirm that you received a completed copy of this Agreement before you signed it, that you received two copies of the Notice of Cancellation, and that you have read and agree to this Agreement.', { keepNext: true }),
    { t: 'signer', title: 'Customer', name: c.cust1, second: 'Phone or email' },
    { t: 'signer', title: 'Second customer (if any)', name: c.cust2, second: 'Phone or email' },
    { t: 'signer', title: 'Northern Pines Construction Services, by its authorized representative', name: c.repName, second: 'Title' }
  ];

  const deadline = cancelBy(c);
  const notice = (label) => [
    p(label, { align: 'right', size: 16, color: 'muted', pageBreak: true, after: 120 }),
    { t: 'title', text: 'Notice of Cancellation' },
    p([B('Agreement no. '), f(c.no, 'AGREEMENT NO.', true)], { align: 'center', after: 240 }),
    p([f(fmtDate(c.signed), 'DATE OF TRANSACTION', true)], { after: 0, size: 21 }),
    p('(Date)', { size: 16, color: 'muted', after: 240 }),
    ...[
      'YOU MAY CANCEL THIS TRANSACTION, WITHOUT ANY PENALTY OR OBLIGATION, WITHIN THREE BUSINESS DAYS FROM THE ABOVE DATE.',
      'IF YOU CANCEL, ANY PROPERTY TRADED IN, ANY PAYMENTS MADE BY YOU UNDER THE CONTRACT OR SALE, AND ANY NEGOTIABLE INSTRUMENT EXECUTED BY YOU WILL BE RETURNED WITHIN TEN BUSINESS DAYS FOLLOWING RECEIPT BY THE SELLER OF YOUR CANCELLATION NOTICE, AND ANY SECURITY INTEREST ARISING OUT OF THE TRANSACTION WILL BE CANCELLED.',
      'IF YOU CANCEL, YOU MUST MAKE AVAILABLE TO THE SELLER AT YOUR RESIDENCE, IN SUBSTANTIALLY AS GOOD CONDITION AS WHEN RECEIVED, ANY GOODS DELIVERED TO YOU UNDER THIS CONTRACT OR SALE, OR YOU MAY, IF YOU WISH, COMPLY WITH THE INSTRUCTIONS OF THE SELLER REGARDING THE RETURN SHIPMENT OF THE GOODS AT THE SELLER’S EXPENSE AND RISK.',
      'IF YOU DO MAKE THE GOODS AVAILABLE TO THE SELLER AND THE SELLER DOES NOT PICK THEM UP WITHIN 20 DAYS OF THE DATE OF YOUR NOTICE OF CANCELLATION, YOU MAY RETAIN OR DISPOSE OF THE GOODS WITHOUT ANY FURTHER OBLIGATION. IF YOU FAIL TO MAKE THE GOODS AVAILABLE TO THE SELLER, OR IF YOU AGREE TO RETURN THE GOODS TO THE SELLER AND FAIL TO DO SO, THEN YOU REMAIN LIABLE FOR PERFORMANCE OF ALL OBLIGATIONS UNDER THE CONTRACT.'
    ].map((s) => p(B(s), { size: 21, after: 160 })),
    p([B(`TO CANCEL THIS TRANSACTION, MAIL OR DELIVER A SIGNED AND DATED COPY OF THIS CANCELLATION NOTICE OR ANY OTHER WRITTEN NOTICE, OR SEND A TELEGRAM, TO ${K.name.toUpperCase()}, AT `),
      f(K.street.toUpperCase(), 'STREET ADDRESS', true), B(`, ${K.city.toUpperCase()}, ${K.state} `), f(K.zip, 'ZIP', true),
      B(', NOT LATER THAN MIDNIGHT OF '), f(fmtDate(deadline, true).toUpperCase(), 'CANCEL-BY DATE', true), B('.')], { size: 21, after: 160 }),
    p(B('I HEREBY CANCEL THIS TRANSACTION.'), { size: 21, before: 240, after: 0 }),
    { t: 'sigline', cols: [[3480, '(Date)'], [600, null], [5280, '(Buyer’s signature)']] }
  ];
  blocks.push(...notice('Copy 1 of 2: keep this copy'), ...notice('Copy 2 of 2: sign and send this copy to cancel'));
  return blocks;
}
