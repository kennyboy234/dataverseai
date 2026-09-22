import assert from "node:assert/strict";
import test from "node:test";

import { GeminiService } from "./gemini.service.js";

test("Gemini service is not configured when no key is available", () => {
  const service = new GeminiService(undefined);

  assert.equal(service.isConfigured(), false);
  assert.rejects(
    () =>
      service.generateText("Give a concise answer.", {
        systemInstruction: "Be concise.",
      }),
    /AI service is not configured/i,
  );
});

test("Gemini structured schema is safe and valid for future AI Audit use", () => {
  const schema = GeminiService.getStructuredResponseSchema();

  assert.equal(schema.type, "OBJECT");
  assert.ok(schema.properties && typeof schema.properties === "object" && !Array.isArray(schema.properties));
  assert.ok(schema.properties.diagnosis && typeof schema.properties.diagnosis === "object");
});

test("Gemini AI audit schema includes diagnosis, explanation, and evidence references", () => {
  const schema = GeminiService.getAuditDiagnosisSchema();

  assert.equal(schema.type, "OBJECT");
  assert.ok(schema.properties && typeof schema.properties === "object" && !Array.isArray(schema.properties));
  assert.ok(schema.properties.diagnosis && typeof schema.properties.diagnosis === "object");
  assert.ok(schema.properties.explanation && typeof schema.properties.explanation === "object");
  assert.ok(schema.properties.recommendations && typeof schema.properties.recommendations === "object");
  assert.ok(schema.properties.evidenceReferences && typeof schema.properties.evidenceReferences === "object");
});

test("Gemini integration responds when a key is configured", { skip: !process.env.GEMINI_API_KEY }, async () => {
  const service = new GeminiService(process.env.GEMINI_API_KEY);

  const response = await service.generateText("Reply with the word READY only.", {
    systemInstruction: "Respond with exactly READY.",
    model: "gemini-2.0-flash",
  });

  assert.match(response.toUpperCase(), /READY/);
});
