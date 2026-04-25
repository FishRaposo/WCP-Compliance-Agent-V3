// Mock Python backend for integration tests — runs an in-process HTTP server.

export function createMockPythonServer() {
  // TODO: implement using MSW or a lightweight Hono server
  // Mocks: POST /extract, POST /validate, GET /dbwd/*, POST /search, POST /decisions
  throw new Error("Not implemented");
}
