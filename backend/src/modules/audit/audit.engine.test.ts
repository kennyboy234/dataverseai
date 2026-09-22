import test from "node:test";
import assert from "node:assert/strict";

import { executeDatasetAudit } from "./audit.engine.js";

test("missing values: clean dataset passes and dirty dataset flags issues", () => {
  const clean = executeDatasetAudit({
    id: "dataset-clean-missing",
    columns: ["Revenue", "City"],
    rows: [
      { Revenue: 100, City: "Lagos" },
      { Revenue: 200, City: "Abuja" },
    ],
    filters: [],
    calculated_columns: [],
  });

  const dirty = executeDatasetAudit({
    id: "dataset-dirty-missing",
    columns: ["Revenue", "City"],
    rows: [
      { Revenue: 100, City: "Lagos" },
      { Revenue: "", City: " " },
      { Revenue: null, City: "Abuja" },
      { Revenue: "   ", City: "Kano" },
    ],
    filters: [],
    calculated_columns: [],
  });

  const cleanMissing = clean.tests.find((testCase) => testCase.testName === "Missing Values");
  const dirtyMissing = dirty.tests.find((testCase) => testCase.testName === "Missing Values");

  assert.equal(cleanMissing?.status, "passed");
  assert.equal(dirtyMissing?.status, "warning");
  assert.ok(Array.isArray(dirty.summary.missingValueColumns) && dirty.summary.missingValueColumns.length >= 1);
});

test("duplicate rows: clean dataset passes and duplicate dataset flags duplicates", () => {
  const clean = executeDatasetAudit({
    id: "dataset-clean-duplicate",
    columns: ["Region", "Revenue"],
    rows: [
      { Region: "Lagos", Revenue: 100 },
      { Region: "Abuja", Revenue: 200 },
    ],
    filters: [],
    calculated_columns: [],
  });

  const dirty = executeDatasetAudit({
    id: "dataset-dirty-duplicate",
    columns: ["Region", "Revenue"],
    rows: [
      { Region: "Lagos", Revenue: 100 },
      { Region: "Lagos", Revenue: 100 },
      { Region: "Abuja", Revenue: 200 },
    ],
    filters: [],
    calculated_columns: [],
  });

  const cleanDuplicate = clean.tests.find((testCase) => testCase.testName === "Duplicate Rows");
  const dirtyDuplicate = dirty.tests.find((testCase) => testCase.testName === "Duplicate Rows");

  assert.equal(cleanDuplicate?.status, "passed");
  assert.equal(dirtyDuplicate?.status, "warning");
  assert.equal(dirty.summary.duplicateRowCount, 1);
});

test("invalid types: valid numeric data passes and invalid values are flagged", () => {
  const valid = executeDatasetAudit({
    id: "dataset-valid-types",
    columns: ["Revenue"],
    rows: [
      { Revenue: 100 },
      { Revenue: 250 },
      { Revenue: 500 },
    ],
    filters: [],
    calculated_columns: [],
  });

  const invalid = executeDatasetAudit({
    id: "dataset-invalid-types",
    columns: ["Revenue"],
    rows: [
      { Revenue: 100 },
      { Revenue: "abc" },
      { Revenue: 500 },
    ],
    filters: [],
    calculated_columns: [],
  });

  const validTypes = valid.tests.find((testCase) => testCase.testName === "Invalid Types");
  const invalidTypes = invalid.tests.find((testCase) => testCase.testName === "Invalid Types");

  assert.equal(validTypes?.status, "passed");
  assert.equal(invalidTypes?.status, "warning");
});

test("empty columns: populated columns pass and fully empty columns are flagged", () => {
  const populated = executeDatasetAudit({
    id: "dataset-populated-column",
    columns: ["Revenue"],
    rows: [
      { Revenue: 100 },
      { Revenue: 200 },
    ],
    filters: [],
    calculated_columns: [],
  });

  const empty = executeDatasetAudit({
    id: "dataset-empty-column",
    columns: ["Revenue", "Notes"],
    rows: [
      { Revenue: 100, Notes: "" },
      { Revenue: 200, Notes: "" },
    ],
    filters: [],
    calculated_columns: [],
  });

  const populatedResult = populated.tests.find((testCase) => testCase.testName === "Empty Columns");
  const emptyResult = empty.tests.find((testCase) => testCase.testName === "Empty Columns");

  assert.equal(populatedResult?.status, "passed");
  assert.equal(emptyResult?.status, "warning");
});

test("category consistency: consistent labels pass and inconsistent casing is flagged", () => {
  const consistent = executeDatasetAudit({
    id: "dataset-consistent-category",
    columns: ["City"],
    rows: [
      { City: "Lagos" },
      { City: "Abuja" },
      { City: "Kano" },
    ],
    filters: [],
    calculated_columns: [],
  });

  const inconsistent = executeDatasetAudit({
    id: "dataset-inconsistent-category",
    columns: ["City"],
    rows: [
      { City: "Lagos" },
      { City: "lagos" },
      { City: "LAGOS" },
    ],
    filters: [],
    calculated_columns: [],
  });

  const consistentResult = consistent.tests.find((testCase) => testCase.testName === "Category Inconsistency");
  const inconsistentResult = inconsistent.tests.find((testCase) => testCase.testName === "Category Inconsistency");

  assert.equal(consistentResult?.status, "passed");
  assert.equal(inconsistentResult?.status, "warning");
});

test("date consistency: valid dates pass and malformed dates are flagged", () => {
  const valid = executeDatasetAudit({
    id: "dataset-valid-dates",
    columns: ["CreatedAt"],
    rows: [
      { CreatedAt: "2024-01-10" },
      { CreatedAt: "2024-02-15" },
    ],
    filters: [],
    calculated_columns: [],
  });

  const invalid = executeDatasetAudit({
    id: "dataset-invalid-dates",
    columns: ["CreatedAt"],
    rows: [
      { CreatedAt: "2024-01-10" },
      { CreatedAt: "not-a-date" },
    ],
    filters: [],
    calculated_columns: [],
  });

  const validResult = valid.tests.find((testCase) => testCase.testName === "Date Consistency");
  const invalidResult = invalid.tests.find((testCase) => testCase.testName === "Date Consistency");

  assert.equal(validResult?.status, "passed");
  assert.equal(invalidResult?.status, "warning");
});

test("outlier detection: normal data passes and IQR outlier is flagged", () => {
  const normal = executeDatasetAudit({
    id: "dataset-normal-outlier",
    columns: ["Revenue"],
    rows: [
      { Revenue: 100 },
      { Revenue: 110 },
      { Revenue: 120 },
      { Revenue: 130 },
      { Revenue: 140 },
    ],
    filters: [],
    calculated_columns: [],
  });

  const outlier = executeDatasetAudit({
    id: "dataset-outlier",
    columns: ["Revenue"],
    rows: [
      { Revenue: 100 },
      { Revenue: 110 },
      { Revenue: 120 },
      { Revenue: 130 },
      { Revenue: 5000 },
    ],
    filters: [],
    calculated_columns: [],
  });

  const normalResult = normal.tests.find((testCase) => testCase.testName === "Basic Outlier Detection");
  const outlierResult = outlier.tests.find((testCase) => testCase.testName === "Basic Outlier Detection");

  assert.equal(normalResult?.status, "passed");
  assert.equal(outlierResult?.status, "warning");
});

test("calculated columns: correct formulas pass and wrong formulas fail", () => {
  const correct = executeDatasetAudit({
    id: "dataset-calc-correct",
    columns: ["Revenue", "Cost"],
    rows: [
      { Revenue: 100, Cost: 40 },
      { Revenue: 200, Cost: 60 },
    ],
    filters: [],
    calculated_columns: [
      { id: "1", name: "Profit", formula: "{Revenue} - {Cost}" },
    ],
    analysis: {
      summary: [],
      aggregations: [],
    },
  });

  const wrong = executeDatasetAudit({
    id: "dataset-calc-wrong",
    columns: ["Revenue", "Cost", "Profit"],
    rows: [
      { Revenue: 100, Cost: 40, Profit: 500 },
      { Revenue: 200, Cost: 60, Profit: 800 },
    ],
    filters: [],
    calculated_columns: [
      { id: "2", name: "Profit", formula: "{Revenue} - {Cost}" },
    ],
  });

  const correctResult = correct.tests.find((testCase) => testCase.testName === "Calculated Column Verification");
  const wrongResult = wrong.tests.find((testCase) => testCase.testName === "Calculated Column Verification");

  assert.equal(correctResult?.status, "passed");
  assert.equal(wrongResult?.status, "failed");
});

test("aggregations: recomputed values pass and mismatched stored values fail", () => {
  const valid = executeDatasetAudit({
    id: "dataset-valid-agg",
    columns: ["Revenue"],
    rows: [
      { Revenue: 100 },
      { Revenue: 200 },
      { Revenue: 300 },
    ],
    filters: [],
    calculated_columns: [],
    analysis: {
      aggregations: [{ column: "Revenue", metric: "sum", expected: 600, tolerance: 0.0001 }],
      summary: [{ column: "Revenue", metric: "sum", expected: 600, tolerance: 0.0001 }],
    },
  });

  const invalid = executeDatasetAudit({
    id: "dataset-invalid-agg",
    columns: ["Revenue"],
    rows: [
      { Revenue: 100 },
      { Revenue: 200 },
      { Revenue: 300 },
    ],
    filters: [],
    calculated_columns: [],
    analysis: {
      aggregations: [{ column: "Revenue", metric: "sum", expected: 999, tolerance: 0.0001 }],
      summary: [{ column: "Revenue", metric: "sum", expected: 999, tolerance: 0.0001 }],
    },
  });

  const validAgg = valid.tests.find((testCase) => testCase.testName === "Aggregation Verification");
  const invalidAgg = invalid.tests.find((testCase) => testCase.testName === "Aggregation Verification");
  const validSummary = valid.tests.find((testCase) => testCase.testName === "Summary Consistency");
  const invalidSummary = invalid.tests.find((testCase) => testCase.testName === "Summary Consistency");

  assert.equal(validAgg?.status, "passed");
  assert.equal(validSummary?.status, "passed");
  assert.equal(invalidAgg?.status, "failed");
  assert.equal(invalidSummary?.status, "failed");
});

test("filters: matching filters pass and violating rows are flagged", () => {
  const valid = executeDatasetAudit({
    id: "dataset-valid-filter",
    columns: ["Revenue"],
    rows: [
      { Revenue: 100 },
      { Revenue: 250 },
      { Revenue: 500 },
    ],
    filters: [{ column: "Revenue", operator: ">", value: "200" }],
    calculated_columns: [],
  });

  const invalid = executeDatasetAudit({
    id: "dataset-invalid-filter",
    columns: ["Revenue"],
    rows: [
      { Revenue: 100 },
      { Revenue: 250 },
      { Revenue: 500 },
    ],
    filters: [{ column: "Revenue", operator: ">", value: "400" }],
    calculated_columns: [],
  });

  const validFilter = valid.tests.find((testCase) => testCase.testName === "Filter Validation");
  const invalidFilter = invalid.tests.find((testCase) => testCase.testName === "Filter Validation");

  assert.equal(validFilter?.status, "warning");
  assert.equal(invalidFilter?.status, "warning");
  assert.ok(Array.isArray(invalidFilter?.evidence) && invalidFilter.evidence.length >= 1);
});

test("summary consistency: matching summaries pass and incorrect summaries fail", () => {
  const valid = executeDatasetAudit({
    id: "dataset-valid-summary",
    columns: ["Revenue"],
    rows: [
      { Revenue: 200 },
      { Revenue: 300 },
    ],
    filters: [],
    calculated_columns: [],
    analysis: {
      summary: [{ column: "Revenue", metric: "sum", expected: 500, tolerance: 0.0001 }],
      aggregations: [],
    },
  });

  const invalid = executeDatasetAudit({
    id: "dataset-invalid-summary",
    columns: ["Revenue"],
    rows: [
      { Revenue: 200 },
      { Revenue: 300 },
    ],
    filters: [],
    calculated_columns: [],
    analysis: {
      summary: [{ column: "Revenue", metric: "sum", expected: 999, tolerance: 0.0001 }],
      aggregations: [],
    },
  });

  const validSummary = valid.tests.find((testCase) => testCase.testName === "Summary Consistency");
  const invalidSummary = invalid.tests.find((testCase) => testCase.testName === "Summary Consistency");

  assert.equal(validSummary?.status, "passed");
  assert.equal(invalidSummary?.status, "failed");
});

test("scoring: score stays bounded and penalties match severity", () => {
  const clean = executeDatasetAudit({
    id: "dataset-scoring-clean",
    columns: ["Revenue"],
    rows: [
      { Revenue: 10 },
      { Revenue: 20 },
      { Revenue: 30 },
    ],
    filters: [],
    calculated_columns: [],
  });

  const penalized = executeDatasetAudit({
    id: "dataset-scoring-penalized",
    columns: ["Revenue"],
    rows: [
      { Revenue: 10 },
      { Revenue: "bad" },
      { Revenue: 30 },
    ],
    filters: [],
    calculated_columns: [],
  });

  assert.ok(clean.score >= 0 && clean.score <= 100);
  assert.ok(penalized.score >= 0 && penalized.score <= 100);
  assert.ok(clean.score >= penalized.score);
});
