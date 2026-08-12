import express from "express";

export function createSystemRouter() {
  const router = express.Router();

  router.get("/health", (req, res) => {
    res.json({
      status: "ok",
      service: "bigintensive-backend-api",
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
