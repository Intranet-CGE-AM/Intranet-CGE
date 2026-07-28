# Importação de pessoas por CSV

O arquivo deve usar UTF-8, vírgula como separador e este cabeçalho exato:

```csv
matricula,nome,nome_preferido,data_nascimento,aniversario_visivel,categoria,unidade_codigo,unidade_nome,cargo,data_inicio,ativo
```

Exemplo:

```csv
12345,Ana Silva,Ana,1988-04-12,sim,Servidor efetivo,CGTI,Tecnologia da Informação,Analista,2020-01-02,sim
```

Regras:

- datas usam `AAAA-MM-DD`;
- booleanos aceitam `sim/não`, `true/false` ou `1/0`;
- matrícula é obrigatória e identifica atualização ou desativação;
- matrículas repetidas no mesmo arquivo são rejeitadas;
- categoria é localizada pelo nome;
- unidade é localizada pelo código e tem o nome atualizado;
- `ativo=não` encerra vínculo já existente;
- aniversário só aparece no widget quando `aniversario_visivel=sim`.

Sempre execute **Validar** antes de **Aplicar importação**. A prévia não altera
pessoas. A aplicação aceita linhas válidas mesmo quando outras falham, registra
erros por linha, checksum SHA-256, resumo e evento de auditoria.

O CSV não define chefia nem elegibilidade de férias. Configure ambos na
interface depois da importação.
