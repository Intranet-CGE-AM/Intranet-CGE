# Design system compartilhado

`packages/ui` é a única fonte dos componentes fundamentais e da identidade
visual. Módulos não devem copiar Button, Input, Dialog, Card, Table, Badge,
Alert, estados vazios ou skeletons.

Uso:

```tsx
import { Button, Card, FormField, Input } from "@cge/ui";
```

O aplicativo raiz importa uma vez:

```css
@import "@cge/ui/styles.css";
```

Os tokens vivem em `packages/ui/src/styles.css`: teal institucional, verde de
ação, canvas cinza frio, superfícies brancas, bordas discretas, estados
semânticos e foco. Componentes usam essas variáveis, portanto uma mudança de
marca não exige editar cada módulo.

Regras para novos módulos:

- reutilize componentes de `@cge/ui`;
- acrescente uma primitiva somente quando dois usos reais precisarem dela;
- mantenha rótulos, erros e foco acessíveis;
- preserve `prefers-reduced-motion`;
- não invente números, alertas ou controles sem comportamento;
- use dados reais, loading, vazio e erro explícitos;
- valide desktop e 390 px;
- consulte `/dev/ui` em desenvolvimento para revisar as primitivas.

O layout foi extraído das referências fornecidas: controles compactos, raios de
12–16 px, hierarquia tipográfica firme, uma superfície dominante por seção e
uso restrito do teal para orientação e ação.
