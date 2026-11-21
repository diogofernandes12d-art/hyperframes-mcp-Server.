# HyperFrames MCP Server

Servidor MCP remoto via Streamable HTTP para conectar ao Claude.

## Ferramentas
- `plan_video`: divide a duração em microcenas com tempos equilibrados.
- `make_hyperframes_starter`: gera dados JSON e HTML-base a partir das cenas.

## Limite
Este projeto organiza roteiros e gera arquivos-base. Não instala nem executa o HyperFrames e não renderiza MP4. Para renderização, é necessário integrar o runtime/CLI HyperFrames em um ambiente compatível.

## Deploy no Render
Conecte este repositório no Render como Web Service. O arquivo `render.yaml` configura o serviço. Após o deploy, teste `https://SEU-SERVICO.onrender.com/health`; a URL MCP será `https://SEU-SERVICO.onrender.com/mcp`.

## Claude
Em Settings → Connectors → Add custom connector, informe a URL terminada em `/mcp`.
