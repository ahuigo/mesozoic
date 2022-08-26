import { ISourceFile } from "./interfaces.ts";

/**
 * A SourceFileBag holds ISourceFile
 */
export class SourceFileBag {
  items: Map<string, ISourceFile>;

  constructor() {
    this.items = new Map();
  }

  private static create(items: ISourceFile[]): SourceFileBag {
    const fileBag = new SourceFileBag();
    if (items) {
      for (const item of items) {
        fileBag.add(item);
      }
    }
    return fileBag;
  }

  /**
   * Merge this SourceFileBag with another
   * @param other
   * @returns A new SourceFileBag with the merged result
   */
  merge(other: SourceFileBag) {
    const sources = new SourceFileBag();

    for (const source of this.values()) {
      sources.add(source);
    }

    for (const source of other.values()) {
      sources.add(source);
    }

    return sources;
  }

  find(predicate: (file: ISourceFile) => boolean) {
    return this.toArray().find(predicate);
  }

  filter(predicate: (file: ISourceFile) => boolean) {
    return SourceFileBag.create(this.toArray().filter(predicate));
  }

  add(value: ISourceFile) {
    this.items.set(value.path(), value);
    return this;
  }

  has(key: string) {
    return this.items.has(key);
  }

  get(key: string) {
    return this.items.get(key);
  }

  get size() {
    return this.items.size;
  }

  values() {
    return this.items.values();
  }

  toArray() {
    return Array.from(this.values());
  }
}
