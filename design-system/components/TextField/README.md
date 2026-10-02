# TextField

A labeled input for the estimate and contact forms: `.np-field` > `.np-label` + `.np-input` (input or textarea) + optional `.np-help`.

- Every field has a visible label; mark optional fields with `.np-label__opt` "(optional)" instead of starring required ones.
- Errors: add `.np-field--error` and `aria-invalid="true"`, and rewrite the helper text to say how to fix it.
- Inputs are 44px tall with 16px text, so phones don't zoom in.

Consumer provides: label text, input name and type, placeholder (a real example, not the label repeated), helper or error text.
