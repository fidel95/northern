# Client contracts

> **Draft: have an Indiana attorney review this agreement before the first job
> is signed on it.** It was written to follow the Indiana Home Improvement
> Contracts Act (IC 24-5-11), the FTC Cooling-Off Rule (16 CFR 429) and
> Indiana's home solicitation rules, but it is not legal advice. Pay particular
> attention to Section 15 (insurance claims), Section 16 (liens) and the
> warranty terms in Section 12.

## For reps: the contract page

**https://npconstructionservices.com/internal/contract/**

It works on a phone, tablet or laptop. Fill in the form; the contract next to
it updates as you type. Then:

- **Download Word (.docx)** gives you a Word file to edit further or email.
- **Print or save PDF** opens the print dialog. Choose "Save as PDF" to get a PDF.

The page lists anything Indiana requires that is still blank, and it works out
the cancel-by date for the Notice of Cancellation (three business days,
skipping Sundays and federal holidays).

Drafts are saved in that browser only, and nothing is sent to our server. A
draft started on a phone won't show up on a laptop. Delete each draft once the
signed copy is filed.

The page isn't linked from the website, and search engines are told not to
index it, but anyone who has the address can open it. That's fine for a blank
form, because customer details never leave the rep's browser. To put a
password on it, add a Cloudflare Access policy for `/internal/*`.

Leave the customer a signed copy of the whole agreement, including both Notice
of Cancellation pages.

## For the office: one-time setup

Until these are filled in, they print as yellow `[PLACEHOLDERS]` on every
contract, and the page lists which ones are missing. Fill them in
`js/contract/company.js`:

- The office street address and ZIP.
- The contractor registration number(s).
- The customer contact name.
- The usual lender and the financing approval window.
- Late-payment terms, the punch-list holdback, and any card fee.
- The workmanship warranty term.
- The county for disputes.
- The hidden-damage unit prices.

Also confirm that the windows warranty wording in Section 12 matches what you
actually offer.

Then run `node tools/make-contract.mjs` to refresh the blank Word copy below.

## `Northern-Pines-Home-Improvement-Agreement.docx`

The same agreement as a blank Word file, for writing a contract by hand or
when there's no signal. Every field is a yellow `[PLACEHOLDER]`.
`tools/make-contract.mjs` generates it, so don't edit it directly: to change
the wording, edit `js/contract/content.js`, which updates the page, the
printout and this file together.

When filling the blank by hand:

- Search for `[` to jump to the next blank.
- To print a clean copy, select all, then set Text Highlight Color to *No Color*.
- On both Notice of Cancellation pages, enter the signing date and the cancel-by
  date: midnight of the third business day after signing. Saturdays count;
  Sundays and federal holidays don't. If the customer signs on Thursday, the
  cancel-by date is Monday.

`.assetsignore` keeps this directory off the public website.
