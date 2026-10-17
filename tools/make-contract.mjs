// Writes the office's blank Home Improvement Agreement from the same source
// the contract page uses (js/contract/content.js), so the two never drift.
//
//   node tools/make-contract.mjs
//
// Every field comes out as a highlighted [PLACEHOLDER]; company details filled
// in js/contract/company.js come out filled.

import { writeFileSync } from 'node:fs';
import { blankContract } from '../js/contract/model.js';
import { contractDocx } from '../js/contract/docx.js';

const out = new URL('../contracts/Northern-Pines-Home-Improvement-Agreement.docx', import.meta.url);
writeFileSync(out, contractDocx(blankContract(), { blank: true }));
console.log('wrote', out.pathname);
