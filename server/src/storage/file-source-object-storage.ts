import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import {
  SourceObjectNotFoundError,
  sourceBytesToArrayBuffer,
  type SourceObjectStorage
} from "./source-object-storage.js";

export class FileSourceObjectStorage implements SourceObjectStorage {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  async putObject(input: {
    key: string;
    bytes: Uint8Array | ArrayBuffer | Blob;
    contentType?: string;
    metadata?: Record<string, string>;
  }): Promise<{ key: string; sizeBytes: number }> {
    const path = this.objectPath(input.key);
    const bytes = await sourceBytesToArrayBuffer(input.bytes);
    await mkdir(dirname(path), { recursive: true });
    const temporaryPath = `${path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, new Uint8Array(bytes));
      await rename(temporaryPath, path);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
    return { key: input.key, sizeBytes: bytes.byteLength };
  }

  async getObject(key: string): Promise<{ bytes: ArrayBuffer; sizeBytes?: number }> {
    const path = this.objectPath(key);
    try {
      const bytes = await readFile(path);
      return {
        bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        sizeBytes: bytes.byteLength
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new SourceObjectNotFoundError(key);
      }
      throw error;
    }
  }

  async headObject(key: string): Promise<{ exists: boolean; sizeBytes?: number }> {
    try {
      const info = await stat(this.objectPath(key));
      return { exists: info.isFile(), sizeBytes: info.size };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { exists: false };
      throw error;
    }
  }

  async deleteObject(key: string): Promise<{ deleted: boolean }> {
    try {
      await unlink(this.objectPath(key));
      return { deleted: true };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { deleted: false };
      throw error;
    }
  }

  private objectPath(key: string): string {
    if (!key || key.includes("\\") || key.split("/").some((part) => !part || part === "." || part === "..")) {
      throw new Error("Source object key must be a relative path without traversal segments");
    }
    const path = resolve(this.root, ...key.split("/"));
    if (!path.startsWith(`${this.root}${sep}`)) {
      throw new Error("Source object key escapes the storage root");
    }
    return path;
  }
}
