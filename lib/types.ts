import { FileBag } from "./sources/fileBag.ts";

export type {
  LoadResponse,
  LoadResponseModule,
  Module,
  ModuleGraph,
  ResolveResult,
} from "https://deno.land/x/deno_graph@0.41.0/lib/types.d.ts";

export type { Policy } from "https://deno.land/x/cache@0.2.13/mod.ts";
export type { GlobToRegExpOptions } from "https://deno.land/std@0.176.0/path/glob.ts";

export type {
  ImportMap,
  ParsedImportMap,
  SpecifierMap,
} from "https://esm.sh/v103/@import-maps/resolve@1.0.1";

export type SourceProcessor = (
  sources: FileBag,
) => Promise<FileBag> | FileBag;

export type Target = "browser" | "deno";
