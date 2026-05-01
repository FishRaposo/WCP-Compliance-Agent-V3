import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Ensure VITE_MOCK_API is true for tests
vi.stubEnv('VITE_MOCK_API', 'true');
