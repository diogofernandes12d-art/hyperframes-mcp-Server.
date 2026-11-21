import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const app = express();
app.use(express.json({ limit: "1mb" }));

const minimaxBase = (process.env.MINIMAX_API_BASE || "https://api.minimax.io/v1").replace(/\/$/, "");
async function minimaxRequest(path, options = {}) {
  const key = process.env.MINIMAX_API_KEY;
  if (!key) throw new Error("MINIMAX_API_KEY não configurada no Render. Adicione a chave nas Environment Variables.");
  const response = await fetch(`${minimaxBase}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`MiniMax API (${response.status}): ${data.base_resp?.status_msg || data.message || JSON.stringify(data)}`);
  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax API: ${data.base_resp.status_msg || "Erro desconhecido"} (código ${data.base_resp.status_code})`);
  }
  return data;
}

function makeServer() {
  const server = new McpServer(
    { name: "hyperframes-video-helper", version: "1.1.0" },
    { instructions: "Planeje vídeos em microcenas e gere vídeos pela API MiniMax. A geração MiniMax exige MINIMAX_API_KEY e pode consumir créditos. As ferramentas HyperFrames criam roteiros e arquivos-base; não renderizam MP4 por si só." }
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
    description: "Monta dados JSON e HTML simples com as cenas fornecidas.",
    inputSchema: {
      title: z.string().min(1),
      scenes: z.array(z.object({ description: z.string().min(1), duration_seconds: z.number().positive() })).min(1).max(100)
    }
  }, async ({ title, scenes }) => {
    const total = scenes.reduce((sum, s) => sum + s.duration_seconds, 0);
    const project = { title, total_duration_seconds: total, scenes: scenes.map((s, i) => ({ id: i + 1, ...s })) };
    const esc = v => String(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>body{margin:0;background:#111;color:#fff;font:16px system-ui}main{max-width:900px;margin:40px auto;padding:24px}.scene{padding:20px;margin:12px 0;background:#222;border:1px solid #444;border-radius:12px}small{color:#aaa}</style></head><body><main><h1>${esc(title)}</h1><p>${scenes.length} cenas · ${total} segundos</p>${scenes.map((s,i)=>`<section class="scene"><small>CENA ${i+1} · ${s.duration_seconds}s</small><p>${esc(s.description)}</p></section>`).join("")}</main></body></html>`;
    return { content: [{ type: "text", text: "project.json\n" + JSON.stringify(project, null, 2) + "\n\nindex.html\n" + html + "\n\nNota: arquivos-base; a renderização depende do runtime HyperFrames em ambiente compatível." }] };
  });

  server.registerTool("minimax_generate_video", {
    title: "Gerar vídeo com MiniMax",
    description: "Envia uma tarefa de geração de vídeo para a API oficial MiniMax. Retorna um task_id; depois use minimax_check_video para obter o link do MP4. Requer MINIMAX_API_KEY e pode consumir créditos.",
    inputSchema: {
      prompt: z.string().min(1).max(2000),
      model: z.enum(["MiniMax-Hailuo-2.3", "MiniMax-Hailuo-02", "T2V-01-Director", "T2V-01"]).default("MiniMax-Hailuo-2.3"),
      duration: z.number().int().refine(v => [6, 10].includes(v), "Use 6 ou 10 segundos").default(6),
      resolution: z.enum(["720P", "768P", "1080P"]).default("768P"),
      prompt_optimizer: z.boolean().default(true),
      first_frame_image: z.string().url().optional()
    }
  }, async ({ prompt, model, duration, resolution, prompt_optimizer, first_frame_image }) => {
    const payload = { model, prompt, duration, resolution, prompt_optimizer };
    if (first_frame_image) payload.first_frame_image = first_frame_image;
    const data = await minimaxRequest("/video_generation", { method: "POST", body: JSON.stringify(payload) });
    if (!data.task_id) throw new Error("MiniMax não retornou task_id: " + JSON.stringify(data));
    return { content: [{ type: "text", text: JSON.stringify({
      message: "Tarefa enviada à MiniMax. A geração é assíncrona; consulte o status com minimax_check_video.",
      task_id: data.task_id, model, duration, resolution, status: data.status || "Submitted"
    }, null, 2) }] };
  });

  server.registerTool("minimax_check_video", {
    title: "Consultar vídeo MiniMax",
    description: "Consulta uma tarefa MiniMax. Quando estiver concluída, tenta recuperar o link temporário de download do MP4.",
    inputSchema: { task_id: z.string().min(1) }
  }, async ({ task_id }) => {
    const data = await minimaxRequest(`/query/video_generation?task_id=${encodeURIComponent(task_id)}`, { method: "GET" });
    const status = data.status || "Unknown";
    let download_url = null;
    if (status.toLowerCase() === "success" && data.file_id) {
      const fileData = await minimaxRequest(`/files/retrieve?file_id=${encodeURIComponent(data.file_id)}`, { method: "GET" });
      download_url = fileData.file?.download_url || null;
    }
    return { content: [{ type: "text", text: JSON.stringify({
      task_id, status, file_id: data.file_id || null, download_url,
      message: download_url ? "Vídeo pronto. Baixe pelo link; ele pode expirar." : status.toLowerCase() === "fail" ? "A geração falhou. Consulte os detalhes da resposta." : "Vídeo ainda em processamento; consulte novamente mais tarde."
    }, null, 2) }] };
  });

  return server;
}

app.get("/health", (_req, res) => res.status(200).json({ ok: true, service: "hyperframes-mcp-server", minimaxConfigured: Boolean(process.env.MINIMAX_API_KEY) }));
app.post("/mcp", async (req, res) => {
  const server = makeServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => { transport.close().catch(() => {}); server.close().catch(() => {}); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.status(500).json({ error: "MCP request failed" });
  }
});
app.get("/mcp", (_req, res) => res.status(405).send("Use POST for MCP requests."));
app.delete("/mcp", (_req, res) => res.status(405).send("Stateless MCP endpoint."));
const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () => console.log(`HyperFrames MCP listening on ${port}`));
