// Writes the contract blocks from content.js as a Word .docx: WordprocessingML
// by hand, packed in a stored (uncompressed) ZIP. No library, so the page
// loads nothing it doesn't use and the same code runs under Node for the
// office's blank copy (tools/make-contract.mjs).

import { buildContract, footerParts } from './content.js';

const PINE = '1F3A2E';
const MUTED = '5A5A5A';
const TINT = 'EEF2EF';
const W = 9360; // text width in twentieths of a point: 8.5in less two 1in margins
const COLORS = { pine: PINE, muted: MUTED };

const xesc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function run(text, o = {}) {
  const pr = (o.sym ? '<w:rFonts w:ascii="MS Gothic" w:eastAsia="MS Gothic" w:hAnsi="MS Gothic"/>' : '')
    + (o.bold ? '<w:b/><w:bCs/>' : '')
    + (o.color ? `<w:color w:val="${o.color}"/>` : '')
    + (o.spaced ? '<w:spacing w:val="40"/>' : '')
    + (o.size ? `<w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/>` : '')
    + (o.hl ? '<w:highlight w:val="yellow"/>' : '');
  const body = String(text).split('\t').map((s) => (s ? `<w:t xml:space="preserve">${xesc(s)}</w:t>` : '')).join('<w:tab/>');
  return `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}${body}</w:r>`;
}

const box = (on, o) => run(on ? '☒' : '☐', { ...o, sym: true });

function runs(parts, o = {}) {
  return [].concat(parts).map((x) => {
    if (x === null || x === undefined || x === '') return '';
    if (typeof x === 'string') return run(x, o);
    if ('box' in x) return box(x.box, o);
    if ('ph' in x) {
      const bold = o.bold || x.b;
      return x.v ? run(x.v, { ...o, bold }) : run(`[${x.ph}]`, { ...o, bold, hl: true });
    }
    return run(x.b, { ...o, bold: true });
  }).join('');
}

const border = (side, size = 8, space = 6) => `<w:${side} w:val="single" w:sz="${size}" w:space="${space}" w:color="000000"/>`;

function para(inner, o = {}) {
  const pr = (o.style ? `<w:pStyle w:val="${o.style}"/>` : '')
    + (o.keepNext ? '<w:keepNext/>' : '')
    + (o.pageBreak ? '<w:pageBreakBefore/>' : '')
    + (o.bullet ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' : '')
    + (o.box ? `<w:pBdr>${['top', 'left', 'bottom', 'right'].map((s) => border(s)).join('')}</w:pBdr>`
      : o.rule ? `<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="8" w:color="${PINE}"/></w:pBdr>`
        : o.line ? '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="000000"/></w:pBdr>' : '')
    + (o.tabs ? `<w:tabs>${o.tabs.map(([kind, pos]) => `<w:tab w:val="${kind}" w:pos="${pos}"/>`).join('')}</w:tabs>` : '')
    + (o.before !== undefined || o.after !== undefined ? `<w:spacing${o.before !== undefined ? ` w:before="${o.before}"` : ''}${o.after !== undefined ? ` w:after="${o.after}"` : ''}/>` : '')
    + (o.align ? `<w:jc w:val="${o.align === 'right' ? 'right' : 'center'}"/>` : '');
  return `<w:p>${pr ? `<w:pPr>${pr}</w:pPr>` : ''}${inner}</w:p>`;
}

const NO_BORDERS = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="nil"/>`).join('') + '</w:tblBorders>';
const THIN_BORDERS = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="9AA59E"/>`).join('') + '</w:tblBorders>';

function tbl(widths, rows, borders, margins = true) {
  const pr = `<w:tblPr><w:tblW w:w="${widths.reduce((a, b) => a + b, 0)}" w:type="dxa"/>${borders}<w:tblLayout w:type="fixed"/>`
    + (margins ? '<w:tblCellMar><w:top w:w="70" w:type="dxa"/><w:left w:w="110" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:right w:w="110" w:type="dxa"/></w:tblCellMar>'
      : '<w:tblCellMar><w:left w:w="60" w:type="dxa"/><w:right w:w="60" w:type="dxa"/></w:tblCellMar>')
    + '</w:tblPr>';
  return `<w:tbl>${pr}<w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows.join('')}</w:tbl>`;
}
const cellXML = (width, inner, fill) =>
  `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ''}</w:tcPr>${inner}</w:tc>`;
const rowXML = (cells, header) => `<w:tr><w:trPr><w:cantSplit/>${header ? '<w:tblHeader/>' : ''}</w:trPr>${cells.join('')}</w:tr>`;
const SPACER = '<w:p><w:pPr><w:spacing w:after="0" w:line="120" w:lineRule="exact"/></w:pPr></w:p>';

function dataTable(b) {
  const rows = b.rows.map((r, i) => {
    const header = b.header && i === 0;
    const total = b.total && i === b.rows.length - 1;
    return rowXML(r.map((content, j) => {
      const label = (b.labels === 'first' && j === 0) || (b.labels === 'even' && j % 2 === 0);
      const o = { bold: header || total || label, color: header ? 'FFFFFF' : undefined };
      const fill = header ? PINE : total || label ? TINT : undefined;
      return cellXML(b.widths[j], para(runs(content, o), { after: 0, align: b.right && b.right.includes(j) ? 'right' : undefined }), fill);
    }), header);
  });
  return tbl(b.widths, rows, THIN_BORDERS) + SPACER;
}

// A line to sign on with a caption under it; a known name is typed on the line.
const sigCell = (width, caption, value = '') => cellXML(width,
  para(value ? run(value) : '', { line: true, before: 380, after: 0 })
  + para(run(caption, { size: 16, color: MUTED }), { after: 0 }));

function block(b) {
  switch (b.t) {
    case 'title': return para(run(b.text), { style: 'Title', align: 'center' });
    case 'h': return para(run(b.text), { style: 'Heading1' });
    case 'p': {
      const o = b.o;
      return para(runs(b.parts, { size: o.size, color: COLORS[o.color], spaced: o.spaced }), {
        align: o.align, keepNext: o.keepNext, pageBreak: o.pageBreak, rule: o.rule, box: o.box,
        before: o.before ?? (o.box ? 120 : undefined), after: o.after ?? (o.box ? 160 : 100)
      });
    }
    case 'ul': return b.items.map((it) => para(runs(it), { bullet: true, after: 60 })).join('');
    case 'check': return para(box(b.on) + run('  ') + runs(b.parts), { after: 80 });
    case 'checkrow': return para(b.items.map((it, i) => (i ? run('\t') : '') + box(it.on) + run('  ' + it.label)).join(''),
      { tabs: b.items.slice(1).map((_, i) => ['left', 1560 * (i + 1)]), after: 140 });
    case 'table': return dataTable(b);
    case 'signer': {
      const cw = [4380, 600, 4380];
      return para(run(b.title, { bold: true }), { keepNext: true, before: 160, after: 0 })
        + tbl(cw, [
          rowXML([sigCell(cw[0], 'Signature'), cellXML(cw[1], para('')), sigCell(cw[2], 'Date')]),
          rowXML([sigCell(cw[0], 'Printed name', String(b.name || '').trim()), cellXML(cw[1], para('')), sigCell(cw[2], b.second)])
        ], NO_BORDERS, false);
    }
    case 'sigline': {
      const widths = b.cols.map(([w]) => w);
      return tbl(widths, [rowXML(b.cols.map(([w, cap]) => (cap ? sigCell(w, cap) : cellXML(w, para('')))))], NO_BORDERS, false);
    }
    default: return '';
  }
}

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const STYLES = `${HEAD}<w:styles ${NS}>
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="200"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="${PINE}"/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="280" w:after="100"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="${PINE}"/><w:sz w:val="23"/><w:szCs w:val="23"/></w:rPr></w:style>
</w:styles>`;

const NUMBERING = `${HEAD}<w:numbering ${NS}>
<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="260"/></w:pPr></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;

function footerXML(c) {
  const o = { size: 16, color: MUTED };
  const field = (instr) => `<w:fldSimple w:instr=" ${instr} ">${run('1', o)}</w:fldSimple>`;
  const p = para(runs(footerParts(c), o) + run('   ·   Page ', o) + field('PAGE') + run(' of ', o) + field('NUMPAGES') + run('\tCustomer initials ______  ______', o),
    { tabs: [['right', W]], after: 0 }).replace('<w:pPr>', '<w:pPr><w:pBdr><w:top w:val="single" w:sz="4" w:space="6" w:color="9AA59E"/></w:pBdr>');
  return `${HEAD}<w:ftr ${NS}>${p}</w:ftr>`;
}

function documentXML(blocks) {
  const sect = '<w:sectPr><w:footerReference w:type="default" r:id="rId3"/><w:pgSz w:w="12240" w:h="15840"/>'
    + '<w:pgMar w:top="1080" w:right="1440" w:bottom="1080" w:left="1440" w:header="720" w:footer="500" w:gutter="0"/></w:sectPr>';
  // Word expects the body to end on a paragraph, not the signature table.
  return `${HEAD}<w:document ${NS}><w:body>${blocks.map(block).join('')}${para('', { after: 0 })}${sect}</w:body></w:document>`;
}

export function contractDocx(c, opts = {}) {
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  return zip([
    ['[Content_Types].xml', `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`],
    ['_rels/.rels', `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`],
    ['docProps/core.xml', `${HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>Home Improvement Agreement</dc:title><dc:creator>Northern Pines Construction Services</dc:creator>
<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`],
    ['word/_rels/document.xml.rels', `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`],
    ['word/document.xml', documentXML(buildContract(c, opts))],
    ['word/styles.xml', STYLES],
    ['word/numbering.xml', NUMBERING],
    ['word/footer1.xml', footerXML(c)]
  ]);
}

// --- ZIP (stored entries) -------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(entries) {
  const enc = new TextEncoder();
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const parts = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of entries) {
    const n = enc.encode(name);
    const data = enc.encode(text);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, time, 2], [12, date, 2], [14, crc, 4],
      [18, data.length, 4], [22, data.length, 4], [26, n.length, 2], [28, 0, 2]]
      .forEach(([at, v, size]) => (size === 4 ? local.setUint32(at, v, true) : local.setUint16(at, v, true)));
    const cen = new DataView(new ArrayBuffer(46));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, time, 2], [14, date, 2], [16, crc, 4],
      [20, data.length, 4], [24, data.length, 4], [28, n.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, offset, 4]]
      .forEach(([at, v, size]) => (size === 4 ? cen.setUint32(at, v, true) : cen.setUint16(at, v, true)));
    parts.push(new Uint8Array(local.buffer), n, data);
    central.push(new Uint8Array(cen.buffer), n);
    offset += 30 + n.length + data.length;
  }
  const size = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, entries.length, 2], [10, entries.length, 2], [12, size, 4], [16, offset, 4], [20, 0, 2]]
    .forEach(([at, v, s]) => (s === 4 ? end.setUint32(at, v, true) : end.setUint16(at, v, true)));
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
  let at = 0;
  for (const a of all) { out.set(a, at); at += a.length; }
  return out;
}
