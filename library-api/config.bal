import ballerina/os;

// Postgres connection settings for the `library-db` platform-resource
// dependency (design.json's dependencies[] -> wiring.envBindings). Each reads
// its platform-injected env var by exact name; db.bal falls back to a local
// default for any that arrive empty so the service still STARTS with no
// required environment variables.
configurable string libraryDbHost = os:getEnv("LIBRARY_DB_HOST");
configurable string libraryDbPort = os:getEnv("LIBRARY_DB_PORT");
configurable string libraryDbUser = os:getEnv("LIBRARY_DB_USER");
configurable string libraryDbPassword = os:getEnv("LIBRARY_DB_PASSWORD");
configurable string libraryDbName = os:getEnv("LIBRARY_DB_DBNAME");
