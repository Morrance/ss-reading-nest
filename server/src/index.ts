import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 8787);
createApp().listen(port, () => {
  console.log(`我和萧遥的小书房 MCP server: http://localhost:${port}/mcp`);
});
