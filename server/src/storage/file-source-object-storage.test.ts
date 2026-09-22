import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileSourceObjectStorage } from "./file-source-object-storage.js";

describe("FileSourceObjectStorage", () => {
  it("persists objects across storage instances", async () => {
    const directory = await mkdtemp(join(tmpdir(), "reading-nest-source-"));
    try {
      const first = new FileSourceObjectStorage(directory);
      await first.putObject({ key: "private/sources/id/source.txt", bytes: new TextEncoder().encode("hello") });

      const second = new FileSourceObjectStorage(directory);
      const restored = await second.getObject("private/sources/id/source.txt");
      expect(new TextDecoder().decode(restored.bytes)).toBe("hello");
      expect(await second.headObject("private/sources/id/source.txt")).toEqual({
        exists: true,
        sizeBytes: 5
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects path traversal keys", async () => {
    const storage = new FileSourceObjectStorage(join(tmpdir(), "reading-nest-source"));
    await expect(storage.getObject("../outside.txt")).rejects.toThrow("without traversal");
  });
});
