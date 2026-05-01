export type V4ModuleName =
  | "analytics"
  | "contracts"
  | "payrolls"
  | "ingestion"
  | "events"
  | "quality"
  | "storage"
  | "connectors";

export interface V4ScaffoldModule {
  name: V4ModuleName;
  owner: "v4";
}
