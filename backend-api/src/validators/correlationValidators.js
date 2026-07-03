export function validateCorrelationPayload(body) {
  const { columns, matrix } = body || {};

  if (!Array.isArray(columns) || columns.length < 2) {
    return {
      ok: false,
      status: 400,
      payload: {
        error: "Invalid columns",
        details: "columns must be an array with at least 2 items",
      },
    };
  }

  if (!Array.isArray(matrix) || matrix.length !== columns.length) {
    return {
      ok: false,
      status: 400,
      payload: {
        error: "Invalid matrix",
        details: "matrix must be a square array with the same size as columns",
      },
    };
  }

  const validSquare = matrix.every((row) => Array.isArray(row) && row.length === columns.length);
  if (!validSquare) {
    return {
      ok: false,
      status: 400,
      payload: {
        error: "Invalid matrix shape",
        details: "each matrix row must have the same size as columns",
      },
    };
  }

  return { ok: true };
}
