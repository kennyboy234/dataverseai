import { GoogleGenAI, Type } from "@google/genai";

export interface GeminiRequestOptions {
  model?: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GeminiStructuredResponse {
  diagnosis?: string;
  likelyCause?: string;
  impact?: string;
  recommendedInvestigation?: string;
  recommendedAction?: string;
  limitations?: string;
  confidence?: number;
}

export interface GeminiAuditDiagnosis {
  diagnosis: string;
  explanation: string;
  impact: string;
  recommendations: string[];
  limitations: string[];
  confidence: number;
  evidenceReferences: string[];
}

export class GeminiService {
  private readonly client: GoogleGenAI | null;
  private static readonly DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  constructor(apiKey?: string) {
    const key = apiKey?.trim();

    if (!key) {
      this.client = null;
      return;
    }

    this.client = new GoogleGenAI({ apiKey: key });
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  static getStructuredResponseSchema() {
    return {
      type: Type.OBJECT,
      properties: {
        diagnosis: { type: Type.STRING },
        likelyCause: { type: Type.STRING },
        impact: { type: Type.STRING },
        recommendedInvestigation: { type: Type.STRING },
        recommendedAction: { type: Type.STRING },
        limitations: { type: Type.STRING },
        confidence: { type: Type.NUMBER },
      },
      required: [
        "diagnosis",
        "likelyCause",
        "impact",
        "recommendedInvestigation",
        "recommendedAction",
        "limitations",
        "confidence",
      ],
    };
  }

  static getAuditDiagnosisSchema() {
    return {
      type: Type.OBJECT,
      properties: {
        diagnosis: { type: Type.STRING },
        explanation: { type: Type.STRING },
        impact: { type: Type.STRING },
        recommendations: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        limitations: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        confidence: { type: Type.NUMBER },
        evidenceReferences: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: [
        "diagnosis",
        "explanation",
        "impact",
        "recommendations",
        "limitations",
        "confidence",
        "evidenceReferences",
      ],
    };
  }

  async generateText(
    prompt: string,
    options: GeminiRequestOptions = {},
  ): Promise<string> {
    if (!this.client) {
      throw new Error("AI service is not configured.");
    }

    const model = options.model ?? GeminiService.DEFAULT_MODEL;
    const systemInstruction = options.systemInstruction ?? "You are a helpful data intelligence assistant.";

    const response = await this.client.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: options.temperature ?? 0.2,
        maxOutputTokens: options.maxOutputTokens ?? 1024,
      },
    });

    const text = response.text?.trim();

    if (!text) {
      throw new Error("AI response was empty.");
    }

    return text;
  }

  async generateStructuredResponse(
    prompt: string,
    options: GeminiRequestOptions = {},
  ): Promise<GeminiStructuredResponse> {
    if (!this.client) {
      throw new Error("AI service is not configured.");
    }

    const model = options.model ?? GeminiService.DEFAULT_MODEL;
    const systemInstruction =
      options.systemInstruction ??
      "Return a JSON object with diagnosis, likelyCause, impact, recommendedInvestigation, recommendedAction, limitations, and confidence.";

    const response = await this.client.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: options.temperature ?? 0.2,
        maxOutputTokens: options.maxOutputTokens ?? 1024,
        responseMimeType: "application/json",
        responseSchema: GeminiService.getStructuredResponseSchema(),
      },
    });

    const raw = response.text?.trim();

    if (!raw) {
      throw new Error("AI response was empty.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("AI response was not valid JSON.");
    }

    if (!parsed || typeof parsed !== "object") {
      throw new Error("AI response was not a structured object.");
    }

    const structured = parsed as Record<string, unknown>;
    const confidence = typeof structured.confidence === "number" ? structured.confidence : Number(structured.confidence ?? 0);

    return {
      diagnosis: typeof structured.diagnosis === "string" ? structured.diagnosis : "",
      likelyCause: typeof structured.likelyCause === "string" ? structured.likelyCause : "",
      impact: typeof structured.impact === "string" ? structured.impact : "",
      recommendedInvestigation:
        typeof structured.recommendedInvestigation === "string"
          ? structured.recommendedInvestigation
          : "",
      recommendedAction:
        typeof structured.recommendedAction === "string" ? structured.recommendedAction : "",
      limitations: typeof structured.limitations === "string" ? structured.limitations : "",
      confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(100, confidence)) : 0,
    };
  }

  async generateAuditDiagnosis(
    prompt: string,
    options: GeminiRequestOptions = {},
  ): Promise<GeminiAuditDiagnosis> {
    if (!this.client) {
      throw new Error("AI service is not configured.");
    }

    const model = options.model ?? GeminiService.DEFAULT_MODEL;
    const systemInstruction =
      options.systemInstruction ??
      "You are a cautious DataVerse AI audit analyst. Use only the stated evidence. Do not invent missing data. Distinguish between data-entry issues, legitimate anomalies, and business events. Return a JSON object with diagnosis, explanation, impact, recommendations, limitations, confidence, and evidenceReferences.";

    const response = await this.client.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: options.temperature ?? 0.2,
        maxOutputTokens: options.maxOutputTokens ?? 1500,
        responseMimeType: "application/json",
        responseSchema: GeminiService.getAuditDiagnosisSchema(),
      },
    });

    const raw = response.text?.trim();

    if (!raw) {
      throw new Error("AI response was empty.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("AI response was not valid JSON.");
    }

    if (!parsed || typeof parsed !== "object") {
      throw new Error("AI response was not a structured object.");
    }

    const structured = parsed as Record<string, unknown>;
    const confidence = typeof structured.confidence === "number" ? structured.confidence : Number(structured.confidence ?? 0);

    const recommendations = Array.isArray(structured.recommendations)
      ? structured.recommendations
          .filter((value): value is string => typeof value === "string")
          .slice(0, 5)
      : [];

    const limitations = Array.isArray(structured.limitations)
      ? structured.limitations
          .filter((value): value is string => typeof value === "string")
          .slice(0, 5)
      : [];

    const evidenceReferences = Array.isArray(structured.evidenceReferences)
      ? structured.evidenceReferences
          .filter((value): value is string => typeof value === "string")
          .slice(0, 10)
      : [];

    return {
      diagnosis: typeof structured.diagnosis === "string" ? structured.diagnosis : "",
      explanation: typeof structured.explanation === "string" ? structured.explanation : "",
      impact: typeof structured.impact === "string" ? structured.impact : "",
      recommendations,
      limitations,
      confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(100, confidence)) : 0,
      evidenceReferences,
    };
  }
}

export const geminiService = new GeminiService(process.env.GEMINI_API_KEY);
