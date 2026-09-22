// backend\src\server.ts

import app from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";

const PORT = env.PORT;

try {
  app.listen(PORT, () => {
    logger.info("================================");
    logger.info("🚀 DataVerse AI Backend Started");
    logger.info(`🌍 Environment : ${env.NODE_ENV}`);
    logger.info(`🚪 Port        : ${PORT}`);
    logger.info("================================");
  });
} catch (error) {
  logger.error(error);
  process.exit(1);
}