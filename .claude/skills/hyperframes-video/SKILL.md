---
name: hyperframes-video
description: Planeja vídeos em microcenas e usa o servidor HyperFrames MCP para estruturar projetos de vídeo. Use quando o usuário pedir roteiro visual, storyboard, microcenas, estrutura HyperFrames ou geração de vídeo integrada ao MiniMax.
---

# HyperFrames Video

Use esta skill para transformar pedidos de vídeo em cenas curtas, organizadas e coerentes, usando o servidor HyperFrames MCP conectado ao Claude.

## Servidor MCP

- Endpoint MCP: https://hyperframes-mcp-server-4zc3.onrender.com/mcp
- Se o conector não estiver configurado, orientar o usuário a adicioná-lo em Claude → Settings → Connectors → Add custom connector.
- Não afirmar que a skill conecta o MCP automaticamente. A conexão MCP é configurada separadamente.

## Fluxo de trabalho

1. Entenda o objetivo, formato, duração, proporção, estilo visual e público do vídeo. Pergunte apenas o que for indispensável.
2. Construa uma sequência com muitas microcenas quando isso melhorar a continuidade. Distribua a duração de forma equilibrada e preserve o ritmo solicitado.
3. Chame `plan_video` para dividir o vídeo em cenas temporizadas.
4. Revise a ordem, duração e continuidade das cenas. Evite cortes arbitrários, aceleração artificial, objetos deformados, cenários inconsistentes e movimentos impossíveis.
5. Chame `make_hyperframes_starter` para gerar os dados JSON e o HTML-base a partir das cenas.
6. Entregue os arquivos/conteúdo gerados e explique o próximo passo de execução/renderização. Não diga que um MP4 foi renderizado se só foram criados dados e HTML-base.

## Geração com MiniMax

Quando o usuário pedir geração efetiva de clipes e as ferramentas MiniMax estiverem disponíveis:

1. Explique que a geração é assíncrona e pode consumir créditos conforme a conta/plano.
2. Use `minimax_generate_video` com prompt visual claro, modelo, duração e resolução compatíveis.
3. Guarde o `task_id` retornado.
4. Consulte `minimax_check_video` usando esse identificador até o status indicar conclusão ou falha.
5. Só forneça link de vídeo quando a ferramenta retornar um link. Avise que links podem ser temporários.

Nunca solicite nem exponha a chave de API no chat ou em arquivos versionados. A variável `MINIMAX_API_KEY` deve ser configurada como segredo no ambiente do serviço. A base padrão é `https://api.minimax.io/v1`; a alternativa para contas da China continental é `https://api.minimaxi.com/v1`.

## Regras de qualidade

- Respeite exatamente a duração pedida; não acelere o vídeo para caber.
- Prefira microcenas com transições suaves e continuidade espacial e temporal.
- Mantenha personagens, roupas, objetos, iluminação e cenário consistentes entre cenas.
- Descreva enquadramento, movimento de câmera, ação e estado final de cada cena.
- Evite portas, paredes, móveis, mãos e objetos tortos ou deformados.
- Não invente recursos que o servidor não oferece.
- As ferramentas HyperFrames deste servidor planejam cenas e geram JSON/HTML-base; elas não instalam nem executam o runtime/CLI HyperFrames e não renderizam MP4 sozinhas.

## Modelos e parâmetros MiniMax

A integração documentada aceita os modelos `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-02`, `T2V-01-Director` e `T2V-01`, com duração de 6 ou 10 segundos e resoluções 720P, 768P ou 1080P. A disponibilidade depende da API e da conta conectada.