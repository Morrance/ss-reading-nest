import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";

describe("server app", () => {
  it("reports health without requiring an API key", async () => {
    const response = await request(createApp()).get("/health");
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toEqual({ ok: true, app: "我和萧遥的小书房", version: "0.3.34" });
  });

  it("accepts Sealos public hostnames", async () => {
    const response = await request(createApp()).get("/health").set("host", "reading.example.sealos.run");
    expect(response.status).toBe(200);
  });

  it("accepts an MCP initialize request", async () => {
    const response = await request(createApp())
      .post("/mcp")
      .set("accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" }
        }
      });

    expect(response.status).toBe(200);
    expect(response.headers["mcp-session-id"]).toBeTruthy();
  });

  it("protects the hosted MCP path and persists uploaded sources", async () => {
    const dataDirectory = await mkdtemp(join(tmpdir(), "reading-nest-app-"));
    try {
      const app = createApp({ dataDirectory, token: "private-token" });
      const publicMcp = await request(app).post("/mcp").send({});
      expect(publicMcp.status).toBe(404);

      const upload = await request(app)
        .post("/source/private-token/upload")
        .send({
          title: "持久化测试",
          sourceKind: "pasted_text",
          sourceText: "第一段。\n\n第二段。"
        });
      expect(upload.status).toBe(200);
      expect(upload.body.session.id).toBeTruthy();

      const restartedApp = createApp({ dataDirectory, token: "private-token" });
      const restore = await request(restartedApp)
        .post("/source/private-token/restore")
        .send({ sessionId: upload.body.session.id });
      expect(restore.status).toBe(200);
      expect(restore.body.sourceText).toBe("第一段。\n\n第二段。");
    } finally {
      await rm(dataDirectory, { recursive: true, force: true });
    }
  });
});
