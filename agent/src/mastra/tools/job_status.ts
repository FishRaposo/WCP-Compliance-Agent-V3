import { httpClient } from "../../utils/http-client.js";

export async function jobStatusTool(jobId: string) {
  return httpClient.get(`/jobs/${jobId}`);
}
