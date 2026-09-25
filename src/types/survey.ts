export interface SurveyQuestion {
  id: string;
  prompt: string;
  required: boolean;
}

export interface SurveyDefinition {
  id: string;
  title: string;
  description: string;
  scaleMin: number;
  scaleMax: number;
  minLabel: string;
  maxLabel: string;
  questions: SurveyQuestion[];
  createdAt: string;
  active: boolean;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  answers: Record<string, number>;
  submittedAt: string;
}

export interface SurveyDistribution {
  questionId: string;
  prompt: string;
  values: number[];
}

export interface SurveyEvaluation {
  responseCount: number;
  questionCount: number;
  averageScore: number | null;
  standardDeviation: number | null;
  favorableRate: number | null;
  completionRate: number;
  cronbachAlpha: number | null;
  reliabilityLabel: string;
  distributions: SurveyDistribution[];
}

export interface SurveyPayloadResponse {
  survey: SurveyDefinition;
  responses: SurveyResponse[];
}