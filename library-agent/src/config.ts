// Config is read from environment variables, by name, once, here — every
// other module reads through this. Names match the dependency wiring in
// specs/design/components/library-agent/design.json exactly; nothing here is
// a literal address or credential.

export interface ModelSettings {
  format: string;
  baseURL: string;
  apiKey: string;
  modelName: string;
  keyHeader?: string;
  authScheme?: string;
}

export const config = {
  port: Number(process.env.PORT ?? 9090),

  // library-api — the `component` dependency this agent calls as tools.
  libraryApiUrl: process.env.LIBRARY_API_URL,

  // library-agent-memory-db — the postgres-cnpg dependency backing the
  // conversation store. Absence is not a fault: it means the in-memory
  // backing is used instead (local runs, build-time evaluation).
  memoryDbHost: process.env.LIBRARY_AGENT_MEMORY_DB_HOST,
  memoryDbPort: process.env.LIBRARY_AGENT_MEMORY_DB_PORT,
  memoryDbName: process.env.LIBRARY_AGENT_MEMORY_DB_DBNAME,
  memoryDbUser: process.env.LIBRARY_AGENT_MEMORY_DB_USER,
  memoryDbPassword: process.env.LIBRARY_AGENT_MEMORY_DB_PASSWORD,

  // The org's model connection. All four are required for the agent to serve
  // a turn; /healthz reports whichever is unset.
  modelEndpoint: process.env.MODEL_ENDPOINT,
  modelName: process.env.MODEL_NAME,
  modelApiKey: process.env.MODEL_API_KEY,
  modelApiFormat: process.env.MODEL_API_FORMAT,
  modelApiAuthScheme: process.env.MODEL_API_AUTH_SCHEME,
  modelApiKeyHeader: process.env.MODEL_API_KEY_HEADER,
};

export function modelSettings(): ModelSettings {
  return {
    format: config.modelApiFormat ?? "",
    baseURL: config.modelEndpoint ?? "",
    apiKey: config.modelApiKey ?? "",
    modelName: config.modelName ?? "",
    keyHeader: config.modelApiKeyHeader,
    authScheme: config.modelApiAuthScheme,
  };
}

// Required for the agent to serve any turn — reported by name in /healthz's
// `missing`. LIBRARY_AGENT_MEMORY_DB_* is deliberately absent from this list:
// an agent run without it is correctly configured for the in-memory backing.
export function missingEnv(): string[] {
  const required: [string, string | undefined][] = [
    ["MODEL_ENDPOINT", config.modelEndpoint],
    ["MODEL_NAME", config.modelName],
    ["MODEL_API_KEY", config.modelApiKey],
    ["MODEL_API_FORMAT", config.modelApiFormat],
  ];
  return required.filter(([, value]) => !value).map(([name]) => name);
}

// From x-aep.attachments in agent.afm.md.
export const ATTACHMENTS: { types: string[]; maxFiles: number; maxFileSizeMB: number } = {
  types: ["image/jpeg", "image/png"],
  maxFiles: 1,
  maxFileSizeMB: 5,
};
