# HyperFrames MCP Server

Servidor MCP remoto via Streamable HTTP para conectar ao Claude.

## Ferramentas
- `plan_video`: divide a duração em microcenas com tempos equilibrados.
- `make_hyperframes_starter`: gera dados JSON e HTML-base a partir das cenas.
- `minimax_generate_video`: envia um pedido de geração de vídeo à API MiniMax.
- `minimax_check_video`: consulta o andamento e, quando pronto, retorna o link temporário do MP4.

## Configuração MiniMax no Render
No serviço do Render, abra **Environment** e adicione:

- `MINIMAX_API_KEY`: sua chave secreta da plataforma MiniMax.
- `MINIMAX_API_BASE` (opcional): padrão global `https://api.minimax.io/v1`. Para conta da China continental, use `https://api.minimaxi.com/v1`.

Salve as alterações e faça um novo deploy. Nunca coloque a chave no GitHub, no código ou em mensagens.

A geração é assíncrona: primeiro chame `minimax_generate_video`, guarde o `task_id` e depois chame `minimax_check_video` até o status ser `Success`. O link de download pode ser temporário. A API pode consumir créditos conforme o plano MiniMax.

## Parâmetros de geração
- Modelos: `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-02`, `T2V-01-Director`, `T2V-01`.
- Duração aceita nesta integração: 6 ou 10 segundos.
- Resolução: 720P, 768P ou 1080P.
- `first_frame_image` opcional: URL pública da imagem inicial, se suportada pelo modelo/conta.

## Limite HyperFrames
As ferramentas HyperFrames organizam roteiros e geram arquivos-base. Elas não instalam nem executam o runtime/CLI HyperFrames e não renderizam MP4 por si só.

## Deploy no Render
Conecte este repositório no Render como Web Service. O arquivo `render.yaml` configura o serviço. Após o deploy, teste `https://SEU-SERVICO.onrender.com/health`; a URL MCP será `https://SEU-SERVICO.onrender.com/mcp`.

## Claude
Em Settings → Connectors → Add custom connector, informe a URL terminada em `/mcp`.
