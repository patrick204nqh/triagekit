export class NotFoundError extends Error {
  readonly code = "ERR_NOT_FOUND";
  constructor(readonly entityType: string, readonly entityId: string) {
    super(`${entityType} not found: ${entityId}`);
    this.name = "NotFoundError";
  }
}

export class StoreError extends Error {
  readonly code = "ERR_STORE";
  constructor(message: string) {
    super(message);
    this.name = "StoreError";
  }
}

export class ConfigError extends Error {
  readonly code = "ERR_CONFIG";
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export class ProviderError extends Error {
  readonly code = "ERR_PROVIDER";
  constructor(readonly providerId: string, action: string, detail: string) {
    super(`provider "${providerId}" ${action}: ${detail}`);
    this.name = "ProviderError";
  }
}

export class CatalogError extends Error {
  readonly code = "ERR_CATALOG";
  constructor(message: string) {
    super(message);
    this.name = "CatalogError";
  }
}
