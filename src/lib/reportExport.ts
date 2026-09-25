import type PptxGenJS from "pptxgenjs";

export type ReportMode = "academic" | "executive";

export interface ReportTable {
  number: number;
  title: string;
  headers: string[];
  rows: string[][];
  note: string;
}

export interface AcademicReportSection {
  number: string;
  title: string;
  paragraphs: string[];
  table?: ReportTable;
}

export interface AcademicReportModel {
  title: string;
  author: string;
  institution: string;
  date: string;
  dataset: string;
  totalRows: number;
  analyzedRows: number;
  columnCount: number;
  activeFilter: string | null;
  sections: AcademicReportSection[];
  summary: string;
}

export interface ExecutiveAnomaly {
  column: string;
  score: number;
  riskLevel: string;
  outliers: number;
  missing: number;
  negative: number;
}

export interface ExecutiveFinding {
  title: string;
  detail: string;
  recommendation: string;
  severity: string;
}

export interface CashFlowForecast {
  column: string;
  model: string;
  aic: number;
  nextForecast: number;
  lower: number;
  upper: number;
  direction: "upward" | "downward" | "stable";
  points: Array<{ step: number; forecast: number; lower: number; upper: number }>;
}

export interface ExecutiveReportModel {
  title: string;
  preparedFor: string;
  date: string;
  dataset: string;
  generatedAt: string;
  totalRows: number;
  scannedRows: number;
  columnCount: number;
  activeFilter: string | null;
  complianceScore: number;
  riskScore: number;
  riskLevel: string;
  auditStatus: string;
  coverage: number;
  summary: string;
  findings: ExecutiveFinding[];
  anomalies: ExecutiveAnomaly[];
  forecast: CashFlowForecast | null;
  actions: string[];
}

export const slugifyFileName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "dataverse-report";

const escapeMarkdownCell = (value: string): string =>
  value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

const tableToMarkdown = (table: ReportTable): string => {
  if (table.headers.length === 0) return "";
  const header = `| ${table.headers.map(escapeMarkdownCell).join(" | ")} |`;
  const divider = `| ${table.headers.map(() => "---").join(" | ")} |`;
  const rows = table.rows.map(
    (row) => `| ${table.headers.map((_, index) => escapeMarkdownCell(row[index] ?? "")).join(" | ")} |`
  );
  return [`**Table ${table.number}**`, `*${table.title}*`, header, divider, ...rows, `*Note.* ${table.note}`].join(
    "\n"
  );
};

export const academicReportToMarkdown = (report: AcademicReportModel): string => {
  const lines = [
    `# ${report.title}`,
    "",
    `**Author:** ${report.author || "Not specified"}  `,
    `**Institution:** ${report.institution || "Not specified"}  `,
    `**Date:** ${report.date}  `,
    `**Dataset:** ${report.dataset}`,
    "",
    "> Generated from the active DataVerse AI workspace. Statistical output should be reviewed against the source data and analysis design before publication.",
    "",
  ];

  for (const section of report.sections) {
    lines.push(`## ${section.number} ${section.title}`, "");
    for (const paragraph of section.paragraphs) {
      if (paragraph.trim()) lines.push(paragraph, "");
    }
    if (section.table) {
      lines.push(tableToMarkdown(section.table), "");
    }
  }

  lines.push("---", `*Prepared ${report.date} · ${report.analyzedRows.toLocaleString()} of ${report.totalRows.toLocaleString()} rows analyzed.*`);
  return lines.join("\n");
};

export const executiveReportToPlainText = (report: ExecutiveReportModel): string => {
  const lines = [
    report.title.toUpperCase(),
    `Prepared for: ${report.preparedFor || "Executive leadership"}`,
    `Dataset: ${report.dataset}`,
    `Date: ${report.date}`,
    "",
    "EXECUTIVE SUMMARY",
    report.summary,
    "",
    `FINANCIAL HEALTH: ${report.complianceScore.toFixed(0)}/100 compliance · ${report.riskScore.toFixed(
      0
    )}/100 risk · ${report.riskLevel} risk · ${report.auditStatus}`,
    `AUDIT COVERAGE: ${report.coverage.toFixed(1)}% (${report.scannedRows.toLocaleString()} of ${report.totalRows.toLocaleString()} rows)`,
    "",
    "PRIORITY FINDINGS",
  ];

  if (report.findings.length === 0) {
    lines.push("- No material forensic findings were raised.");
  } else {
    report.findings.forEach((finding, index) => {
      lines.push(`${index + 1}. ${finding.title} [${finding.severity.toUpperCase()}]`);
      lines.push(`   ${finding.detail}`);
      lines.push(`   Action: ${finding.recommendation}`);
    });
  }

  lines.push("", "ANOMALY WATCHLIST");
  if (report.anomalies.length === 0) {
    lines.push("- No financial anomaly measures were identified.");
  } else {
    report.anomalies.forEach((anomaly) => {
      lines.push(
        `- ${anomaly.column}: risk ${anomaly.score.toFixed(0)}/100 (${anomaly.riskLevel}); ${anomaly.outliers} outliers, ${anomaly.missing} missing, ${anomaly.negative} negative values.`
      );
    });
  }

  lines.push("", "CASH-FLOW OUTLOOK");
  if (report.forecast) {
    const forecast = report.forecast;
    lines.push(
      `${forecast.column}: ${forecast.model}; next-period forecast ${forecast.nextForecast.toFixed(2)} with a 95% interval of ${forecast.lower.toFixed(2)} to ${forecast.upper.toFixed(2)}. Direction: ${forecast.direction}.`
    );
  } else {
    lines.push("A defensible cash-flow projection was not available from the active numeric series.");
  }

  lines.push("", "RECOMMENDED ACTIONS");
  report.actions.forEach((action, index) => lines.push(`${index + 1}. ${action}`));
  lines.push("", "This briefing is a deterministic decision-support summary, not an audit opinion or financial advice.");
  return lines.join("\n");
};

const XML_AMPERSAND = String.fromCharCode(38);
const xmlEscape = (value: string): string =>
  value
    .replace(/&/g, XML_AMPERSAND + "amp;")
    .replace(/</g, XML_AMPERSAND + "lt;")
    .replace(/>/g, XML_AMPERSAND + "gt;");

const asArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const zipStore = (entries: ZipEntry[]): Blob => {
  const encoder = new TextEncoder();
  const localParts: BlobPart[] = [];
  const centralParts: BlobPart[] = [];
  let offset = 0;

  entries.forEach((entry) => {
    const name = encoder.encode(entry.name);
    const checksum = crc32(entry.data);
    const local = new Uint8Array(30 + name.byteLength);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 33, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, entry.data.byteLength, true);
    localView.setUint32(22, entry.data.byteLength, true);
    localView.setUint16(26, name.byteLength, true);
    localView.setUint16(28, 0, true);
    localParts.push(asArrayBuffer(local), asArrayBuffer(name), asArrayBuffer(entry.data));

    const central = new Uint8Array(46 + name.byteLength);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 33, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, entry.data.byteLength, true);
    centralView.setUint32(24, entry.data.byteLength, true);
    centralView.setUint16(28, name.byteLength, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralParts.push(asArrayBuffer(central), asArrayBuffer(name));
    offset += local.byteLength + name.byteLength + entry.data.byteLength;
  });

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralParts.reduce((sum, part) => sum + (part as ArrayBuffer).byteLength, 0), true);
  endView.setUint32(16, offset, true);

  return new Blob([...localParts, ...centralParts, asArrayBuffer(end)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
};

const docxRun = (text: string, bold = false, italic = false): string =>
  `<w:r><w:rPr>${bold ? "<w:b/>" : ""}${italic ? "<w:i/>" : ""}</w:rPr><w:t xml:space="preserve">${xmlEscape(
    text
  )}</w:t></w:r>`;

const docxParagraph = (
  text: string,
  options: { style?: string; align?: "left" | "center" | "right"; bold?: boolean; italic?: boolean } = {}
): string => {
  const properties = [
    options.style ? `<w:pStyle w:val="${options.style}"/>` : "",
    options.align ? `<w:jc w:val="${options.align}"/>` : "",
  ].join("");
  return `<w:p><w:pPr>${properties}</w:pPr>${docxRun(text, options.bold, options.italic)}</w:p>`;
};

const docxTable = (table: ReportTable): string => {
  if (table.headers.length === 0) return "";
  const allRows = [table.headers, ...table.rows];
  const width = Math.floor(9000 / table.headers.length);
  const borders = [
    ["top", "12"],
    ["bottom", "12"],
    ["insideH", "4"],
  ]
    .map(([edge, size]) => `<w:${edge} w:val="single" w:sz="${size}" w:color="000000"/>`)
    .join("");
  const rows = allRows
    .map((row, rowIndex) => {
      const cells = row
        .map(
          (cell) =>
            `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr>${docxParagraph(
              cell,
              rowIndex === 0 ? { bold: true } : {}
            )}</w:tc>`
        )
        .join("");
      const rowProperties = rowIndex === 0 ? "<w:trPr><w:tblHeader/></w:trPr>" : "";
      return `<w:tr>${rowProperties}${cells}</w:tr>`;
    })
    .join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${borders}</w:tblBorders></w:tblPr><w:tblGrid>${table.headers
    .map(() => `<w:gridCol w:w="${width}"/>`)
    .join("")}</w:tblGrid>${rows}</w:tbl>`;
};

const DOCX_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="240" w:line="480" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:pPr><w:jc w:val="center"/><w:spacing w:after="360"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:rPr><w:b/><w:sz w:val="30"/></w:rPr><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="180"/><w:outlineLvl w:val="0"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:rPr><w:b/><w:sz w:val="26"/></w:rPr><w:pPr><w:keepNext/><w:spacing w:before="300" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:rPr><w:b/><w:i/><w:sz w:val="24"/></w:rPr><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="100"/><w:outlineLvl w:val="2"/></w:pPr></w:style>
</w:styles>`;

export const createAcademicDocxBlob = (report: AcademicReportModel): Blob => {
  const body: string[] = [
    docxParagraph(report.title, { style: "Title", align: "center" }),
    docxParagraph(`Author: ${report.author || "Not specified"}`, { align: "center" }),
    docxParagraph(`Institution: ${report.institution || "Not specified"}`, { align: "center" }),
    docxParagraph(report.date, { align: "center" }),
    docxParagraph(
      `Dataset: ${report.dataset} · ${report.analyzedRows.toLocaleString()} of ${report.totalRows.toLocaleString()} rows analyzed${report.activeFilter ? ` · Filter: ${report.activeFilter}` : ""}.`,
      { italic: true }
    ),
  ];

  for (const section of report.sections) {
    body.push(docxParagraph(`${section.number} ${section.title}`, { style: "Heading1" }));
    for (const paragraph of section.paragraphs) {
      if (paragraph.trim()) body.push(docxParagraph(paragraph));
    }
    if (section.table) {
      body.push(docxParagraph(`Table ${section.table.number}`, { bold: true }));
      body.push(docxParagraph(section.table.title, { italic: true }));
      body.push(docxTable(section.table));
      body.push(docxParagraph(`Note. ${section.table.note}`, { italic: true }));
    }
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join(
    ""
  )}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const encoder = new TextEncoder();
  return zipStore([
    { name: "[Content_Types].xml", data: encoder.encode(contentTypes) },
    { name: "_rels/.rels", data: encoder.encode(rootRels) },
    { name: "word/document.xml", data: encoder.encode(documentXml) },
    { name: "word/styles.xml", data: encoder.encode(DOCX_STYLES) },
    { name: "word/_rels/document.xml.rels", data: encoder.encode(documentRels) },
  ]);
};

interface PdfLine {
  text: string;
  size: number;
  bold?: boolean;
  gapBefore?: number;
}

const wrapPlainText = (text: string, maxLength = 92): string[] => {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) current = word;
    else if (`${current} ${word}`.length <= maxLength) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
};

const executivePdfLines = (report: ExecutiveReportModel): PdfLine[] => {
  const lines: PdfLine[] = [
    { text: report.title.toUpperCase(), size: 17, bold: true, gapBefore: 0 },
    { text: `Prepared for ${report.preparedFor || "Executive leadership"} · ${report.date}`, size: 9 },
    { text: `Dataset: ${report.dataset} · Audit coverage ${report.coverage.toFixed(1)}%`, size: 9, gapBefore: 8 },
    { text: "EXECUTIVE SUMMARY", size: 11, bold: true, gapBefore: 12 },
  ];
  wrapPlainText(report.summary).forEach((text) => lines.push({ text, size: 9 }));

  lines.push({
    text: `HEALTH SIGNAL: ${report.complianceScore.toFixed(0)}/100 compliance | ${report.riskScore.toFixed(0)}/100 risk | ${report.riskLevel} | ${report.auditStatus}`,
    size: 10,
    bold: true,
    gapBefore: 8,
  });

  lines.push({ text: "PRIORITY FINDINGS", size: 11, bold: true, gapBefore: 12 });
  if (report.findings.length === 0) {
    lines.push({ text: "- No material forensic findings were raised.", size: 9 });
  } else {
    report.findings.slice(0, 3).forEach((finding) => {
      wrapPlainText(`${finding.title} [${finding.severity}]: ${finding.detail}`).forEach((text) =>
        lines.push({ text: `- ${text}`, size: 9 })
      );
    });
  }

  lines.push({ text: "ANOMALY WATCHLIST", size: 11, bold: true, gapBefore: 10 });
  if (report.anomalies.length === 0) {
    lines.push({ text: "- No financial anomaly measures were identified.", size: 9 });
  } else {
    report.anomalies.slice(0, 3).forEach((anomaly) =>
      lines.push({
        text: `- ${anomaly.column}: ${anomaly.score.toFixed(0)}/100 risk; ${anomaly.outliers} outliers; ${anomaly.missing} missing; ${anomaly.negative} negative.`,
        size: 9,
      })
    );
  }

  lines.push({ text: "CASH-FLOW OUTLOOK", size: 11, bold: true, gapBefore: 10 });
  if (report.forecast) {
    wrapPlainText(
      `${report.forecast.column} · ${report.forecast.model} · next ${report.forecast.nextForecast.toFixed(2)} (95% ${report.forecast.lower.toFixed(
        2
      )} to ${report.forecast.upper.toFixed(2)}) · ${report.forecast.direction}.`
    ).forEach((text) => lines.push({ text: `- ${text}`, size: 9 }));
  } else {
    lines.push({ text: "- A defensible projection was not available from the active series.", size: 9 });
  }

  lines.push({ text: "RECOMMENDED ACTIONS", size: 11, bold: true, gapBefore: 10 });
  report.actions.slice(0, 4).forEach((action) =>
    wrapPlainText(action).forEach((text) => lines.push({ text: `- ${text}`, size: 9 }))
  );
  lines.push({
    text: "Decision-support summary only. Validate source records before external use.",
    size: 8,
    gapBefore: 12,
  });
  return lines;
};

const pdfSafe = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "-")
    .replace(/([\\()])/g, "\\$1");

export const createExecutivePdfBlob = (report: ExecutiveReportModel): Blob => {
  const pageLines = executivePdfLines(report).slice(0, 58);
  let y = 756;
  const commands: string[] = [];
  pageLines.forEach((line) => {
    y -= line.gapBefore ?? 0;
    commands.push(
      `BT /F${line.bold ? 2 : 1} ${line.size} Tf 72 ${y.toFixed(2)} Td (${pdfSafe(line.text)}) Tj ET`
    );
    y -= line.size + 5;
  });
  const stream = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ];
  let pdf = "%PDF-1.4\n%DVRE\n";
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  const bytes = new Uint8Array(pdf.length);
  for (let index = 0; index < pdf.length; index += 1) bytes[index] = pdf.charCodeAt(index) & 0xff;
  return new Blob([asArrayBuffer(bytes)], { type: "application/pdf" });
};

const addSlideTitle = (
  slide: PptxGenJS.Slide,
  title: string,
  subtitle?: string
): void => {
  slide.addText(title, {
    x: 0.65,
    y: 0.45,
    w: 12,
    h: 0.55,
    fontFace: "Aptos Display",
    fontSize: 26,
    bold: true,
    color: "0F172A",
    margin: 0,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.65,
      y: 1.05,
      w: 12,
      h: 0.35,
      fontFace: "Aptos",
      fontSize: 12,
      color: "64748B",
      margin: 0,
    });
  }
};

const addSlideFooter = (
  slide: PptxGenJS.Slide,
  dataset: string,
  page: number
): void => {
  slide.addText(`${dataset} · DataVerse AI · ${page}`, {
    x: 0.65,
    y: 7.05,
    w: 12,
    h: 0.2,
    fontFace: "Aptos",
    fontSize: 8,
    color: "94A3B8",
    margin: 0,
  });
};

export const downloadExecutivePptx = async (
  report: ExecutiveReportModel,
  fileName: string
): Promise<void> => {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "DataVerse AI";
  pptx.company = "DataVerse AI";
  pptx.subject = "Executive financial health, anomaly, and cash-flow briefing";
  pptx.title = report.title;

  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: "0F172A" };
  titleSlide.addText("DATAVERSE AI", {
    x: 0.75,
    y: 0.7,
    w: 5,
    h: 0.3,
    fontFace: "Aptos",
    fontSize: 12,
    bold: true,
    color: "94A3B8",
    charSpacing: 2,
    margin: 0,
  });
  titleSlide.addText(report.title, {
    x: 0.75,
    y: 2,
    w: 11.5,
    h: 1.15,
    fontFace: "Aptos Display",
    fontSize: 34,
    bold: true,
    color: "FFFFFF",
    margin: 0,
  });
  titleSlide.addText(
    `${report.preparedFor || "Executive leadership"} · ${report.date}\n${report.dataset}`,
    {
      x: 0.75,
      y: 3.4,
      w: 10,
      h: 0.8,
      fontFace: "Aptos",
      fontSize: 16,
      color: "CBD5E1",
      margin: 0,
      breakLine: false,
    }
  );

  const signalSlide = pptx.addSlide();
  signalSlide.background = { color: "F8FAFC" };
  addSlideTitle(signalSlide, "Executive signal", "Financial health and forensic posture");
  const metrics = [
    ["Compliance", `${report.complianceScore.toFixed(0)}/100`],
    ["Risk", `${report.riskScore.toFixed(0)}/100`],
    ["Risk level", report.riskLevel.toUpperCase()],
    ["Audit status", report.auditStatus.toUpperCase()],
  ];
  metrics.forEach(([label, value], index) => {
    const x = 0.7 + index * 3.05;
    signalSlide.addText(label, {
      x,
      y: 1.75,
      w: 2.7,
      h: 0.3,
      fontFace: "Aptos",
      fontSize: 11,
      color: "64748B",
      margin: 0,
    });
    signalSlide.addText(value, {
      x,
      y: 2.1,
      w: 2.7,
      h: 0.55,
      fontFace: "Aptos Display",
      fontSize: 25,
      bold: true,
      color: index === 1 ? "B91C1C" : "0F172A",
      margin: 0,
    });
  });
  signalSlide.addText("SUMMARY", {
    x: 0.7,
    y: 3.25,
    w: 3,
    h: 0.3,
    fontFace: "Aptos",
    fontSize: 11,
    bold: true,
    color: "475569",
    margin: 0,
  });
  signalSlide.addText(report.summary, {
    x: 0.7,
    y: 3.65,
    w: 11.9,
    h: 2.2,
    fontFace: "Aptos",
    fontSize: 18,
    color: "334155",
    breakLine: false,
    margin: 0.04,
  });
  addSlideFooter(signalSlide, report.dataset, 2);

  const riskSlide = pptx.addSlide();
  riskSlide.background = { color: "F8FAFC" };
  addSlideTitle(riskSlide, "Risk and anomaly watchlist", "Highest-priority evidence for leadership review");
  const riskBullets =
    report.findings.length > 0
      ? report.findings.slice(0, 4).map((finding) => `${finding.title} [${finding.severity}] — ${finding.detail}`)
      : ["No material forensic findings were raised."];
  riskBullets.forEach((bullet, index) => {
    riskSlide.addText(`• ${bullet}`, {
      x: 0.8,
      y: 1.65 + index * 1.12,
      w: 11.7,
      h: 0.82,
      fontFace: "Aptos",
      fontSize: 16,
      color: "334155",
      margin: 0.03,
    });
  });
  if (report.anomalies.length > 0) {
    riskSlide.addText(
      `Anomaly measures: ${report.anomalies
        .slice(0, 4)
        .map((anomaly) => `${anomaly.column} ${anomaly.score.toFixed(0)}/100`)
        .join(" · ")}`,
      {
        x: 0.8,
        y: 6.2,
        w: 11.7,
        h: 0.5,
        fontFace: "Aptos",
        fontSize: 11,
        color: "64748B",
        margin: 0,
      }
    );
  }
  addSlideFooter(riskSlide, report.dataset, 3);

  const forecastSlide = pptx.addSlide();
  forecastSlide.background = { color: "F8FAFC" };
  addSlideTitle(forecastSlide, "Cash-flow outlook", "Model-based projection from the active numeric series");
  if (report.forecast) {
    const forecast = report.forecast;
    const forecastBullets = [
      `${forecast.column} · ${forecast.model} · AIC ${forecast.aic.toFixed(2)}`,
      `Next-period point forecast: ${forecast.nextForecast.toFixed(2)}`,
      `95% interval: ${forecast.lower.toFixed(2)} to ${forecast.upper.toFixed(2)}`,
      `Direction: ${forecast.direction}`,
    ];
    forecastBullets.forEach((bullet, index) => {
      forecastSlide.addText(`• ${bullet}`, {
        x: 0.85,
        y: 1.75 + index * 0.85,
        w: 11.5,
        h: 0.55,
        fontFace: "Aptos",
        fontSize: 20,
        color: "334155",
        margin: 0,
      });
    });
    forecastSlide.addText(
      forecast.points
        .slice(0, 6)
        .map((point) => `H+${point.step}: ${point.forecast.toFixed(2)}`)
        .join("   ·   "),
      {
        x: 0.85,
        y: 5.45,
        w: 11.5,
        h: 0.65,
        fontFace: "Aptos",
        fontSize: 13,
        color: "64748B",
        margin: 0,
      }
    );
  } else {
    forecastSlide.addText("A defensible projection was not available from the active series.", {
      x: 0.85,
      y: 2.1,
      w: 11.5,
      h: 1,
      fontFace: "Aptos",
      fontSize: 24,
      color: "64748B",
      margin: 0,
    });
  }
  addSlideFooter(forecastSlide, report.dataset, 4);

  const actionSlide = pptx.addSlide();
  actionSlide.background = { color: "0F172A" };
  actionSlide.addText("Recommended actions", {
    x: 0.75,
    y: 0.65,
    w: 11.5,
    h: 0.6,
    fontFace: "Aptos Display",
    fontSize: 28,
    bold: true,
    color: "FFFFFF",
    margin: 0,
  });
  report.actions.slice(0, 5).forEach((action, index) => {
    actionSlide.addText(`${index + 1}`, {
      x: 0.85,
      y: 1.65 + index * 0.92,
      w: 0.5,
      h: 0.45,
      fontFace: "Aptos Display",
      fontSize: 20,
      bold: true,
      color: "94A3B8",
      margin: 0,
    });
    actionSlide.addText(action, {
      x: 1.45,
      y: 1.6 + index * 0.92,
      w: 10.8,
      h: 0.65,
      fontFace: "Aptos",
      fontSize: 17,
      color: "E2E8F0",
      margin: 0,
    });
  });
  actionSlide.addText("Decision-support summary only · validate source records before external use", {
    x: 0.75,
    y: 6.75,
    w: 11.5,
    h: 0.3,
    fontFace: "Aptos",
    fontSize: 9,
    color: "64748B",
    margin: 0,
  });

  await pptx.writeFile({ fileName, compression: true });
};

export const downloadBlob = (blob: Blob, fileName: string): void => {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
};

export const copyTextToClipboard = async (text: string): Promise<void> => {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    throw new Error("Clipboard access is not available in this browser.");
  }
  await navigator.clipboard.writeText(text);
};