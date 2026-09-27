    // backend/src/modules/datasets/datasets.service.ts

import { supabase } from "../../lib/supabase.js";
import { logger } from "../../lib/logger.js";

import { ApiError } from "../../utils/apiError.js";
import { HTTP_STATUS } from "../../utils/constants.js";
import { successResponse } from "../../utils/apiResponse.js";

import { DATASET_MESSAGES } from "./datasets.constants.js";

import type { CreateDatasetInput } from "./datasets.validation.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class DatasetsService {
  async createDataset(userId: string, input: CreateDatasetInput) {
    const { data: dataset, error } = await supabase
      .from("datasets")
      .insert({
        user_id: userId,
        name: input.name,
        file_name: input.file_name,
        sheet_name: input.sheet_name ?? null,
        sheets: input.sheets,
        active_sheet_id: input.active_sheet_id,
        filters: input.filters ?? [],
        calculated_columns: input.calculated_columns ?? [],
      })
      .select("id, name, file_name, sheet_name, created_at, updated_at")
      .single();

    if (error) {
      logger.error(error);

      throw new ApiError(
        DATASET_MESSAGES.DATASET_SAVE_FAILED,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    return successResponse(DATASET_MESSAGES.DATASET_SAVED, { dataset });
  }

  async listDatasets(userId: string) {
    const { data: datasets, error } = await supabase
      .from("datasets")
      .select("id, name, file_name, sheet_name, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      logger.error(error);

      throw new ApiError(
        DATASET_MESSAGES.DATASETS_FETCH_FAILED,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    return successResponse(DATASET_MESSAGES.DATASETS_FETCHED, {
      datasets: datasets ?? [],
    });
  }

  async getDatasetById(userId: string, datasetId: string) {
    if (!UUID_REGEX.test(datasetId)) {
      throw new ApiError(
        DATASET_MESSAGES.DATASET_NOT_FOUND,
        HTTP_STATUS.NOT_FOUND,
      );
    }

    const { data: dataset, error } = await supabase
      .from("datasets")
      .select(
        "id, name, file_name, sheet_name, sheets, active_sheet_id, filters, calculated_columns, created_at, updated_at",
      )
      .eq("id", datasetId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      logger.error(error);

      throw new ApiError(
        DATASET_MESSAGES.DATASET_FETCH_FAILED,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    if (!dataset) {
      throw new ApiError(
        DATASET_MESSAGES.DATASET_NOT_FOUND,
        HTTP_STATUS.NOT_FOUND,
      );
    }

    return successResponse(DATASET_MESSAGES.DATASET_FETCHED, { dataset });
  }

  async updateDataset(
    userId: string,
    datasetId: string,
    input: Partial<CreateDatasetInput>,
  ) {
    if (!UUID_REGEX.test(datasetId)) {
      throw new ApiError(
        DATASET_MESSAGES.DATASET_NOT_FOUND,
        HTTP_STATUS.NOT_FOUND,
      );
    }

    const { data: dataset, error } = await supabase
      .from("datasets")
      .update(input)
      .eq("id", datasetId)
      .eq("user_id", userId)
      .select(
        "id, name, file_name, sheet_name, sheets, active_sheet_id, filters, calculated_columns, created_at, updated_at",
      )
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw new ApiError(
          DATASET_MESSAGES.DATASET_NOT_FOUND,
          HTTP_STATUS.NOT_FOUND,
        );
      }

      logger.error(error);

      throw new ApiError(
        DATASET_MESSAGES.DATASET_UPDATE_FAILED,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    if (!dataset) {
      throw new ApiError(
        DATASET_MESSAGES.DATASET_NOT_FOUND,
        HTTP_STATUS.NOT_FOUND,
      );
    }

    return successResponse(DATASET_MESSAGES.DATASET_UPDATED, { dataset });
  }

  async deleteDataset(userId: string, datasetId: string) {
    if (!UUID_REGEX.test(datasetId)) {
      throw new ApiError(
        DATASET_MESSAGES.DATASET_NOT_FOUND,
        HTTP_STATUS.NOT_FOUND,
      );
    }

    const { error } = await supabase
      .from("datasets")
      .delete()
      .eq("id", datasetId)
      .eq("user_id", userId);

    if (error) {
      logger.error(error);

      throw new ApiError(
        DATASET_MESSAGES.DATASET_DELETE_FAILED,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    return successResponse(DATASET_MESSAGES.DATASET_DELETED, {
      id: datasetId,
    });
  }
}

export const datasetsService = new DatasetsService();