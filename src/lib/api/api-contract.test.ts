import { describe, it, expect } from "vitest";
import { successResponse, errorResponse, ApiError } from "./api-contract";

describe("API Contract Helpers", () => {
  describe("successResponse", () => {
    it("should return data with null error", () => {
      const result = successResponse({ id: "123", name: "test" });
      expect(result).toEqual({
        data: { id: "123", name: "test" },
        error: null,
        meta: {},
      });
    });

    it("should include meta when provided", () => {
      const result = successResponse({ items: [] }, { page: 1, total: 10 });
      expect(result.meta).toEqual({ page: 1, total: 10 });
    });

    it("should handle null data", () => {
      const result = successResponse(null);
      expect(result.data).toBeNull();
      expect(result.error).toBeNull();
    });
  });

  describe("errorResponse", () => {
    it("should return null data with error", () => {
      const result = errorResponse("NOT_FOUND", "Resource not found");
      expect(result).toEqual({
        data: null,
        error: {
          code: "NOT_FOUND",
          message: "Resource not found",
        },
        meta: {},
      });
    });

    it("should include details when provided", () => {
      const result = errorResponse("VALIDATION_ERROR", "Invalid input", {
        field: "email",
      });
      expect(result.error).toEqual({
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details: { field: "email" },
      });
    });
  });

  describe("ApiError", () => {
    it("should create error with code and message", () => {
      const err = new ApiError("FORBIDDEN", "Access denied");
      expect(err.code).toBe("FORBIDDEN");
      expect(err.message).toBe("Access denied");
      expect(err.details).toBeUndefined();
    });

    it("should include optional details", () => {
      const err = new ApiError("VALIDATION_ERROR", "Invalid", { field: "email" });
      expect(err.details).toEqual({ field: "email" });
    });

    it("should convert to Response with correct status", () => {
      const err = new ApiError("NOT_FOUND", "Not found");
      const response = err.toResponse();
      expect(response.status).toBe(404);
    });

    it("should map UNAUTHORIZED to 401", () => {
      const err = new ApiError("UNAUTHORIZED", "Unauthorized");
      expect(err.toResponse().status).toBe(401);
    });

    it("should map VALIDATION_ERROR to 400", () => {
      const err = new ApiError("VALIDATION_ERROR", "Bad request");
      expect(err.toResponse().status).toBe(400);
    });

    it("should map RATE_LIMITED to 429", () => {
      const err = new ApiError("RATE_LIMITED", "Too many requests");
      expect(err.toResponse().status).toBe(429);
    });

    it("should map INTERNAL_ERROR to 500", () => {
      const err = new ApiError("INTERNAL_ERROR", "Server error");
      expect(err.toResponse().status).toBe(500);
    });
  });
});
