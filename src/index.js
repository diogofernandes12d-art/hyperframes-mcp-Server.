import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const app = express();
app.use(express.json({ limit: "1mb" }));

function makeServer() {
  const server = new McpServer(
    { name: "hyperframes-video-helper", version: "1.0.0" },
    { instructions: "Ajude a planejar vídeos para HyperFrames em microcenas com duração precisa. Estas ferramentas criam roteiros e arquivos-base; não renderizam MP4 nem executam o HyperFrames." }
  );

  server.registerTool("plan_video", {
    title: "Planejar vídeo",
    description: "Divide a duração total de um vídeo em microcenas com tempos equilibrados.",
    inputSchema: {
      title: z.string().min(1),
      total_seconds: z.number().int().min(1).max(600),
      style: z.string().default("realista"),
      scene_count: z.number().int().min(1).max(100).default(10)
    }
  }, async ({ title, total_seconds, style, scene_count }) => {
    const base = Math.floor(total_seconds / scene_count);
    const remainder = total_seconds % scene_count;
    const scenes = Array.from({ length: scene_count }, (_, i) => ({
      scene: i + 1,
      duration_seconds: base + (i < remainder ? 1 : 0),
      prompt: `Cena ${i + 1} de "${title}", estilo ${style}. Descreva enquadramento, ação, cenário, iluminação e movimento de câmera.`
    }));
    return { content: [{ type: "text", text: JSON.stringify({ title, total_seconds, style, scene_count, scenes }, null, 2) }] };
  });

  server.registerTool("make_hyperframes_starter", {
    title: "Criar base de projeto",
    description: "Monta dados JSON e uma página HTML simples com as cenas fornecidas.",
    inputSchema: {
      title: z.string().min(1),
      scenes: z.array(z.object({
        description: z.string().min(1),
        duration_seconds: z.number().positive()
      })).min(1).max(100)
    }
  }, async ({ title, scenes }) => {
    const total = scenes.reduce((sum, s) => sum + s.duration_seconds, 0);
    const project = { title, total_duration_seconds: total, scenes: scenes.map((s, i) => ({ id: i + 1, ...s })) };
    const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{margin:0;background:#111;color:#fff;font:16px system-ui}main{max-width:900px;margin:40px auto;padding:24px}.scene{padding:20px;margin:12px 0;background:#222;border:1px solid #444;border-radius:12px}small{color:#aaa}</style></head><body><main><h1>${escapeHtml(title)}</h1><p>${scenes.length} cenas · ${total} segundos</p>${scenes.map((s,i)=>`<section class="scene"><small>CENA ${i+1} · ${s.duration_seconds}s</small><p>${escapeHtml(s.description)}</p></section>`).join("")}</main></body></html>`;
    return { content: [{ type: "text", text: "project.json\n" + JSON.stringify(project, null, 2) + "\n\nindex.html\n" + html + "\n\nNota: arquivos-base; a renderização real depende do runtime HyperFrames em ambiente compatível." }] };
  });

  return server;
}

app.get("/health", (_req, res) => res.status(200).json({ ok: true, service: "hyperframes-mcp-server" }));
app.post("/mcp", async (req, res) => {
  const server = makeServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => { transport.close().catch(() => {}); server.close().catch(() => {}); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP request failed:", error);
    if (!res.headersSent) res.status(500).json({ error: "MCP request failed" });
  }
});
app.get("/mcp", (_req, res) => res.status(405).send("Use POST for MCP requests."));
app.delete("/mcp", (_req, res) => res.status(405).send("Stateless MCP endpoint."));

const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () => console.log(`HyperFrames MCP listening on ${port}`));
