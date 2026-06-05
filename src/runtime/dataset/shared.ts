export type ActorKind = "human" | "bot";
export interface Actor { login: string; avatarUrl: string; kind: ActorKind; }
export interface Label { name: string; color: string; }   // color = hex without '#'
export interface CheckStatus { state: "pass" | "fail" | "pending"; conflicts: boolean; }

export type PermalinkKind = "pr" | "issue" | "pkg" | "advisory" | "alert";
export interface Permalink { provider: string; href: string; kind: PermalinkKind; label?: string; }

export type RelationType = "fixes" | "references" | "duplicates";
export interface Relation { fromId: string; toId: string; type: RelationType; }
