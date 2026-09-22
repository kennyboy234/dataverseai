import { supabase } from "../../lib/supabase.js";
import { successResponse } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/apiError.js";
import { HTTP_STATUS } from "../../utils/constants.js";
import { auditEngine } from "./audit.engine.js";
import { geminiService } from "../ai/gemini.service.js";

import type { AuditDiagnosis, AuditFinding, AuditRun, AuditTest } from "./audit.types.js";
import type { CreateAuditRunInput } from "./audit.types.js";

interface AuditStoreEntry {
  run: AuditRun;
  tests: AuditTest[];
  findings: AuditFinding[];
}

const auditStore = new Map<string, AuditStoreEntry>();

function isDatabaseUnavailabilityError(error: unknown): boolean {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: string }).message ?? "")
      : "";

  return /does not exist|42P01|relation .* does not exist|permission denied/i.test(message);
}

class AuditService {
  private async verifyDatasetOwnership(userId: string, datasetId: string) {
    const { data: dataset, error } = await supabase
      .from("datasets")
      .select("id, user_id")
      .eq("id", datasetId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new ApiError(
        "Unable to verify dataset ownership.",
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    if (!dataset) {
      throw new ApiError("Dataset not found or access denied.", HTTP_STATUS.NOT_FOUND);
    }

    return dataset;
  }

  private async persistAuditRun(run: AuditRun, tests: AuditTest[], findings: AuditFinding[]) {
    const persistedRun = {
      id: run.id,
      user_id: run.userId,
      dataset_id: run.datasetId,
      status: run.status,
      score: run.overallScore,
      total_tests: tests.length,
      passed_count: tests.filter((test) => test.status === "passed").length,
      warning_count: tests.filter((test) => test.status === "warning").length,
      failed_count: tests.filter((test) => test.status === "failed").length,
      critical_count: tests.filter((test) => test.severity === "critical").length,
      created_at: run.createdAt,
      completed_at: run.completedAt ?? null,
      source_snapshot_version: run.sourceSnapshotVersion || run.versionLabel || "v1",
      previous_audit_run_id: run.previousAuditRunId ?? null,
      error_message: null,
    };

    const { error: runError } = await supabase.from("audit_runs").upsert(persistedRun).select();

    if (runError) {
      if (isDatabaseUnavailabilityError(runError)) {
        throw new ApiError(
          "Audit persistence is unavailable because the audit tables are not yet created in the database.",
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
        );
      }

      throw new ApiError(
        "Unable to persist the audit run.",
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    if (tests.length > 0) {
      const { error: testError } = await supabase.from("audit_test_results").upsert(
        tests.map((test) => ({
          id: test.id,
          audit_run_id: run.id,
          test_id: test.id,
          test_name: test.testName,
          category: test.category,
          status: test.status,
          severity: test.severity,
          description: test.details,
          metrics: test.metrics ?? {},
          recommendation: test.recommendation ?? null,
          created_at: new Date().toISOString(),
        })),
        { onConflict: "id" },
      );

      if (testError) {
        if (isDatabaseUnavailabilityError(testError)) {
          throw new ApiError(
            "Audit test persistence is unavailable because the audit tables are not yet created in the database.",
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
          );
        }

        throw new ApiError(
          "Unable to persist audit test results.",
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
        );
      }
    }

    if (findings.length > 0) {
      const { error: findingError } = await supabase.from("audit_findings").upsert(
        findings.map((finding) => ({
          id: finding.id,
          audit_run_id: run.id,
          test_id: finding.testId,
          severity: finding.severity,
          title: finding.title,
          description: finding.description,
          evidence: finding.evidence ?? [],
          recommendation: finding.recommendedAction ?? null,
          created_at: new Date().toISOString(),
        })),
        { onConflict: "id" },
      );

      if (findingError) {
        if (isDatabaseUnavailabilityError(findingError)) {
          throw new ApiError(
            "Audit finding persistence is unavailable because the audit tables are not yet created in the database.",
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
          );
        }

        throw new ApiError(
          "Unable to persist audit findings.",
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
        );
      }
    }

    auditStore.set(run.id, { run, tests, findings });
  }

  async createAuditRun(userId: string, input: CreateAuditRunInput) {
    if (!input.datasetId?.trim()) {
      throw new ApiError("Dataset ID is required.", HTTP_STATUS.BAD_REQUEST);
    }

    await this.verifyDatasetOwnership(userId, input.datasetId);

    const { data: history, error: historyError } = await supabase
      .from("audit_runs")
      .select("id, source_snapshot_version")
      .eq("dataset_id", input.datasetId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (historyError) {
      throw new ApiError("Unable to load audit history for the dataset.", HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    const previousAuditRunId = history?.[0]?.id ?? null;
    const previousVersion = history?.[0]?.source_snapshot_version ?? "v0";
    const numericVersion = Number.parseInt(String(previousVersion).replace(/[^\d]/g, ""), 10) || 0;
    const nextVersionSuffix = Math.max(1, numericVersion + 1);
    const nextVersion = `v${nextVersionSuffix}`;

    const shell = auditEngine.createRunShell(
      userId,
      input.datasetId,
      nextVersion,
      input.summary,
    );

    shell.run.previousAuditRunId = previousAuditRunId;
    shell.run.versionLabel = nextVersion;

    await this.persistAuditRun(shell.run, shell.tests, shell.findings);

    return successResponse("Audit run created successfully.", {
      run: shell.run,
      tests: shell.tests,
      findings: shell.findings,
    });
  }

  async listAuditRuns(userId: string) {
    const { data: runs, error } = await supabase
      .from("audit_runs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      if (isDatabaseUnavailabilityError(error)) {
        return successResponse("Audit runs fetched successfully.", {
          runs: Array.from(auditStore.values())
            .filter((entry) => entry.run.userId === userId)
            .map((entry) => entry.run),
        });
      }

      throw new ApiError(
        "Unable to fetch audit runs.",
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    return successResponse("Audit runs fetched successfully.", { runs: runs ?? [] });
  }

  async getAuditRun(userId: string, auditRunId: string) {
    const { data: run, error: runError } = await supabase
      .from("audit_runs")
      .select("*")
      .eq("id", auditRunId)
      .eq("user_id", userId)
      .maybeSingle();

    if (runError) {
      if (isDatabaseUnavailabilityError(runError)) {
        const cached = auditStore.get(auditRunId);
        if (!cached || cached.run.userId !== userId) {
          throw new ApiError("Audit run not found.", HTTP_STATUS.NOT_FOUND);
        }

        return successResponse("Audit run fetched successfully.", {
          run: cached.run,
          tests: cached.tests,
          findings: cached.findings,
        });
      }

      throw new ApiError("Unable to fetch audit run.", HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    if (!run) {
      throw new ApiError("Audit run not found.", HTTP_STATUS.NOT_FOUND);
    }

    const { data: tests, error: testError } = await supabase
      .from("audit_test_results")
      .select("*")
      .eq("audit_run_id", auditRunId);

    const { data: findings, error: findingError } = await supabase
      .from("audit_findings")
      .select("*")
      .eq("audit_run_id", auditRunId);

    if (testError || findingError) {
      throw new ApiError(
        "Unable to fetch full audit details.",
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    return successResponse("Audit run fetched successfully.", {
      run,
      tests: tests ?? [],
      findings: findings ?? [],
    });
  }

  async generateAuditDiagnosis(userId: string, auditRunId: string) {
    const { data: runRow, error: runRowError } = await supabase
      .from("audit_runs")
      .select("*")
      .eq("id", auditRunId)
      .eq("user_id", userId)
      .maybeSingle();

    if (runRowError) {
      if (isDatabaseUnavailabilityError(runRowError)) {
        const cached = auditStore.get(auditRunId);
        if (!cached || cached.run.userId !== userId) {
          throw new ApiError("Audit run not found.", HTTP_STATUS.NOT_FOUND);
        }

        return this.generateAuditDiagnosisFromCache(userId, cached);
      }

      throw new ApiError("Unable to load the audit run.", HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    if (!runRow) {
      throw new ApiError("Audit run not found.", HTTP_STATUS.NOT_FOUND);
    }

    const { data: tests, error: testError } = await supabase
      .from("audit_test_results")
      .select("*")
      .eq("audit_run_id", auditRunId);

    const { data: findings, error: findingError } = await supabase
      .from("audit_findings")
      .select("*")
      .eq("audit_run_id", auditRunId);

    if (testError || findingError) {
      throw new ApiError("Unable to load audit evidence for diagnosis.", HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    const cached = { run: {
      id: runRow.id,
      datasetId: runRow.dataset_id,
      userId: runRow.user_id,
      status: runRow.status,
      createdAt: runRow.created_at ?? new Date().toISOString(),
      startedAt: runRow.created_at ?? null,
      completedAt: runRow.completed_at ?? null,
      overallScore: Number(runRow.score ?? 0),
      overallConfidence: Number(runRow.score ?? 0),
      summary: runRow.summary ?? "Audit run",
      sourceSnapshotVersion: runRow.source_snapshot_version ?? "v1",
    }, tests: (tests ?? []) as AuditTest[], findings: (findings ?? []) as AuditFinding[] };

    return this.generateAuditDiagnosisFromCache(userId, cached);
  }

  private async generateAuditDiagnosisFromCache(userId: string, entry: AuditStoreEntry) {
    if (entry.run.userId !== userId) {
      throw new ApiError("Audit run not found.", HTTP_STATUS.NOT_FOUND);
    }

    if (!geminiService.isConfigured()) {
      throw new ApiError("Gemini AI audit analysis is not configured on the server.", HTTP_STATUS.SERVICE_UNAVAILABLE ?? 503);
    }

    const findings = entry.findings.length > 0 ? entry.findings : [];
    const testsById = new Map(entry.tests.map((test) => [test.id, test]));
    const evidenceSummary = findings
      .slice(0, 8)
      .map((finding) => {
        const test = testsById.get(finding.testId);
        const evidence = (finding.evidence ?? []).slice(0, 3).map((item) => JSON.stringify(item)).join(" | ");

        return {
          title: finding.title,
          severity: finding.severity,
          description: finding.description,
          testName: test?.testName ?? "audit_test",
          recommendation: finding.recommendedAction ?? "No recommendation provided.",
          evidence: evidence || "No supporting evidence payload was captured.",
        };
      });

    const prompt = [
      "You are a cautious DataVerse AI audit analyst.",
      "Use only the deterministic audit findings and evidence below.",
      "Do not invent missing values, rows, counts, or statistics.",
      "If the evidence is ambiguous, say so and describe the uncertainty.",
      "Distinguish between likely data quality issues, legitimate business events, and uncertain findings.",
      "",
      "Audit summary:",
      JSON.stringify({
        runStatus: entry.run.status,
        overallScore: entry.run.overallScore,
        summary: entry.run.summary,
      }, null, 2),
      "",
      "Findings:",
      JSON.stringify(evidenceSummary, null, 2),
      "",
      "Instruction: Return a JSON object with diagnosis, explanation, impact, recommendations, limitations, confidence, and evidenceReferences. Keep recommendations practical and grounded in the evidence. Evidence references should be short labels such as 'finding:Missing values in revenue' or 'test:Duplicate Rows'."
    ].join("\n");

    const diagnosis: AuditDiagnosis = await geminiService.generateAuditDiagnosis(prompt, {
      model: "gemini-2.0-flash",
      systemInstruction:
        "You are DataVerse AI's audit analyst. Interpret deterministic findings conservatively and never claim a result without evidence.",
      temperature: 0.2,
      maxOutputTokens: 1500,
    });

    const evidenceReferences = diagnosis.evidenceReferences.length > 0
      ? diagnosis.evidenceReferences
      : evidenceSummary.map((item) => `finding:${item.title}`);

    const finalDiagnosis: AuditDiagnosis = {
      ...diagnosis,
      evidenceReferences,
      recommendations: diagnosis.recommendations.length > 0 ? diagnosis.recommendations : [
        "Verify the flagged records and confirm whether the issue is a true data defect, a legitimate business event, or a measurement anomaly.",
      ],
      limitations: diagnosis.limitations.length > 0 ? diagnosis.limitations : [
        "The diagnosis is based only on the available deterministic audit evidence and may not capture business context beyond that evidence.",
      ],
    };

    return successResponse("AI audit diagnosis generated successfully.", {
      run: entry.run,
      diagnosis: finalDiagnosis,
      findings: entry.findings,
      tests: entry.tests,
    });
  }

  async executeAuditRun(userId: string, auditRunId: string) {
    const { data: runRow, error: runRowError } = await supabase
      .from("audit_runs")
      .select("*")
      .eq("id", auditRunId)
      .eq("user_id", userId)
      .maybeSingle();

    if (runRowError) {
      if (isDatabaseUnavailabilityError(runRowError)) {
        const cached = auditStore.get(auditRunId);
        if (!cached || cached.run.userId !== userId) {
          throw new ApiError("Audit run not found.", HTTP_STATUS.NOT_FOUND);
        }

        return this.executeAuditRunFromCache(userId, cached);
      }

      throw new ApiError("Unable to load the audit run.", HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    if (!runRow) {
      throw new ApiError("Audit run not found.", HTTP_STATUS.NOT_FOUND);
    }

    const { data: dataset, error: datasetError } = await supabase
      .from("datasets")
      .select("id, user_id, columns, rows, filters, calculated_columns")
      .eq("id", runRow.dataset_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (datasetError) {
      throw new ApiError("Unable to load the dataset for audit execution.", HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    if (!dataset) {
      throw new ApiError("Dataset not found or access denied.", HTTP_STATUS.NOT_FOUND);
    }

    const result = auditEngine.executeDatasetAudit(
      {
        id: dataset.id,
        user_id: dataset.user_id ?? userId,
        columns: Array.isArray(dataset.columns) ? dataset.columns : [],
        rows: Array.isArray(dataset.rows) ? dataset.rows : [],
        filters: Array.isArray(dataset.filters) ? dataset.filters : [],
        calculated_columns: Array.isArray(dataset.calculated_columns)
          ? dataset.calculated_columns
          : [],
      },
      auditRunId,
    );

    const updatedRun: AuditRun = {
      id: runRow.id,
      datasetId: runRow.dataset_id,
      userId: runRow.user_id,
      status: result.critical > 0 ? "failed" : "completed",
      createdAt: runRow.created_at ?? new Date().toISOString(),
      startedAt: runRow.created_at ?? new Date().toISOString(),
      completedAt: new Date().toISOString(),
      overallScore: result.score,
      overallConfidence: Math.max(0, Math.min(100, result.score)),
      summary: `${result.totalTests} deterministic audit checks executed with ${result.warnings} warnings and ${result.failed} failed checks.`,
      sourceSnapshotVersion: runRow.source_snapshot_version ?? "v1",
    };

    await this.persistAuditRun(updatedRun, result.tests, result.findings);

    return successResponse("Audit run executed successfully.", {
      run: updatedRun,
      tests: result.tests,
      findings: result.findings,
      score: result.score,
      summary: result.summary,
    });
  }

  private async executeAuditRunFromCache(userId: string, entry: AuditStoreEntry) {
    if (entry.run.userId !== userId) {
      throw new ApiError("Audit run not found.", HTTP_STATUS.NOT_FOUND);
    }

    const { data: dataset, error } = await supabase
      .from("datasets")
      .select("id, user_id, columns, rows, filters, calculated_columns")
      .eq("id", entry.run.datasetId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !dataset) {
      throw new ApiError("Dataset not found or access denied.", HTTP_STATUS.NOT_FOUND);
    }

    const result = auditEngine.executeDatasetAudit({
      id: dataset.id,
      user_id: dataset.user_id ?? userId,
      columns: Array.isArray(dataset.columns) ? dataset.columns : [],
      rows: Array.isArray(dataset.rows) ? dataset.rows : [],
      filters: Array.isArray(dataset.filters) ? dataset.filters : [],
      calculated_columns: Array.isArray(dataset.calculated_columns) ? dataset.calculated_columns : [],
    }, entry.run.id);

    entry.run.status = result.critical > 0 ? "failed" : "completed";
    entry.run.overallScore = result.score;
    entry.run.overallConfidence = Math.max(0, Math.min(100, result.score));
    entry.run.completedAt = new Date().toISOString();
    entry.run.summary = `${result.totalTests} deterministic audit checks executed with ${result.warnings} warnings and ${result.failed} failed checks.`;

    auditStore.set(entry.run.id, { run: entry.run, tests: result.tests, findings: result.findings });

    return successResponse("Audit run executed successfully.", {
      run: entry.run,
      tests: result.tests,
      findings: result.findings,
      score: result.score,
      summary: result.summary,
    });
  }
}

export const auditService = new AuditService();
