// src/runtime/core/provider-registry.ts
import type { ProviderManifest } from "./manifest";

const providers = new Map<string, ProviderManifest>();

export function registerProvider(m: ProviderManifest): void { providers.set(m.id, m); }
export function getProvider(id: string): ProviderManifest | undefined { return providers.get(id); }
export function listProviders(): ProviderManifest[] { return [...providers.values()]; }
