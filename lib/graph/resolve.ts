import { crayon, importMapResolve, parseImportMap, sprintf } from "../deps.ts";
import { type LoggerImpl } from "../logger.ts";
import { FileBag } from "../sources/fileBag.ts";
import { ImportMap, ResolveResult } from "../types.ts";
import { wrapFn } from "../utils.ts";
import { isBareSpecifier, isRemoteSpecifier } from "./specifiers.ts";

export type Resolver = (specifier: string, referrer: string) => string;
export type BareSpecifiersMap = Map<string, string>;

type CreateLoaderOptions = {
  importMap: ImportMap;
  sources: FileBag;
  bareSpecifiers: BareSpecifiersMap;
  baseURL: URL;
};

export const resolverCache = new Map<string, string>();

export function createResolver(options: CreateLoaderOptions): Resolver {
  const { importMap, sources, bareSpecifiers, baseURL } = options;

  const importMapResolver = createImportMapResolver(importMap, baseURL);
  const localResolver = createLocalResolver(sources);

  return (specifier: string, referrer: string): string => {
    const cacheKey = [specifier, referrer].join(":");

    if (resolverCache.has(cacheKey)) {
      return resolverCache.get(cacheKey)!;
    }

    let resolved = resolve(specifier, referrer);

    const importMapResolved = importMapResolver(
      specifier,
      referrer,
    );

    /**
     * If we get a resolved match from the importMap
     * we use that over anything else.
     */
    if (importMapResolved) {
      resolved = importMapResolved;
      bareSpecifiers.set(specifier, resolved);
    } else if (resolved.startsWith("file://")) {
      try {
        resolved = localResolver(resolved, referrer);
      } catch (error) {
        throw error;
      }
    }

    resolverCache.set(cacheKey, resolved);

    return resolved;
  };
}

export function createImportMapResolver(
  importMap: ImportMap,
  baseURL: URL,
) {
  const parsedImportMap = parseImportMap(importMap, baseURL);

  return function importMapResolver(specifier: string, referrer: string) {
    const resolved = importMapResolve(
      specifier,
      parsedImportMap,
      new URL(referrer),
    );

    if (resolved.matched) {
      return resolved.resolvedImport.href;
    }
  };
}

export function createLocalResolver(sources: FileBag) {
  return function localResolver(specifier: string, referrer: string) {
    /**
     * This is a local source file, attempt to find it within the sources FileBag
     */
    const url = new URL(specifier, referrer);
    const source = sources.find((source) => String(source.url()) === String(url));

    if (source) {
      return String(source.url());
    } else {
      throw new Error(
        sprintf(
          "failed to resolve local source %s from %s",
          specifier,
          referrer,
        ),
      );
    }
  };
}

export function wrapResolverWithLogging(
  resolver: Resolver,
  logger: LoggerImpl,
): Resolver {
  const before = (specifier: string, referrer: string) =>
    logger.debug(
      sprintf(
        "%s %s from %s",
        crayon.lightBlue("Resolve"),
        specifier,
        referrer,
      ),
    );

  const after = (resolved: string, specifier: string) =>
    logger?.debug(
      sprintf(
        "%s %s to %s",
        crayon.green("Resolved"),
        specifier,
        resolved,
      ),
    );

  return wrapFn(resolver, before, after);
}

export function resolve(specifier: string, referrer: string) {
  let resolvedSpecifier: string | ResolveResult = specifier;

  try {
    if (isBareSpecifier(specifier)) {
      if (specifier.startsWith("/") && isRemoteSpecifier(referrer)) {
        resolvedSpecifier = String(new URL(specifier, referrer));
      } else {
        resolvedSpecifier = specifier;
      }
    } else {
      const url = new URL(specifier, referrer);
      resolvedSpecifier = String(url);
    }
  } catch {
    throw new Error(
      sprintf("could not resolve %s from %s", specifier, referrer),
    );
  }

  return resolvedSpecifier;
}

export function resolveBareSpecifierRedirects(
  specifiers: BareSpecifiersMap,
  redirects: Record<string, string>,
) {
  for (const [specifier, resolved] of specifiers.entries()) {
    if (redirects[resolved]) {
      specifiers.set(specifier, redirects[resolved]);
    }
  }

  return specifiers;
}
