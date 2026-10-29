# CRM Closer

CRM local para closer digital: funil de leads, vendas, comissão e controle de ganhos (fixo + %).

Roda **no seu PC**, sem internet e sem depender de Node.js instalado no sistema. Os dados ficam num banco SQLite local.

---

## Como abrir

Clique no atalho **CRM Closer** no Desktop. Ele abre o CRM numa janela do Chrome em modo aplicativo, em `http://127.0.0.1:3200`.

O servidor também inicia sozinho com o Windows, em segundo plano. Fechar a janela do CRM **não** para o servidor; para parar, use **Menu Iniciar → CRM Closer → Parar CRM Closer**.

---

## Instalação (uma vez)

1. Dê um duplo clique em **`instalar.bat`** na pasta do projeto.
2. Aceite o UAC do Windows (**Sim**).
3. O instalador:
   - instala o programa em `C:\Program Files\CRM Closer`;
   - copia o **Node.js embutido** para a pasta do programa;
   - migra o banco atual para `%LOCALAPPDATA%\CRM Closer\data`;
   - cria o atalho **CRM Closer** no Desktop e no Menu Iniciar;
   - configura a inicialização automática com o Windows;
   - libera as portas **3200–3209** no firewall para redes privadas;
   - registra o CRM em **Aplicativos instalados** com desinstalador.
4. No fim, responda **S** para abrir o CRM na hora.

> O executável não tem assinatura digital. Se o Windows exibir um aviso do SmartScreen, clique em **Mais informações → Executar assim mesmo**.

> Requisito: Windows 10/11 e permissão de administrador para instalar em Program Files e liberar o firewall. O Node.js já vai embutido.

A porta padrão é **3200**. Se estiver ocupada, o CRM tenta 3201, 3202... O endereço correto fica em `%LOCALAPPDATA%\CRM Closer\data\url.txt`.

---

## Acessar pelo celular

1. O PC e o celular precisam estar na **mesma rede Wi-Fi**.
2. No CRM, abra **Config → Acesso pelo celular** e copie o endereço (ex.: `http://192.168.0.10:3200`).
3. Abra esse endereço no navegador do celular.
4. Recomendado: em **Config → Segurança**, defina um **PIN de 4 dígitos**. Sem PIN, qualquer aparelho da rede consegue abrir.

Limitações: o PC precisa estar ligado e o Windows não pode estar dormindo. A regra de firewall é criada para redes **privadas**; se a rede estiver como **Pública**, mude para Privada nas configurações do Windows.

Se precisar recriar a regra manualmente (PowerShell como administrador):

```powershell
netsh advfirewall firewall add rule name="CRM Closer" dir=in action=allow protocol=TCP localport=3200-3209 profile=private
```

---

## Como usar

### Leads (funil)

- **+ Lead** no topo para cadastrar.
- Arraste os cartões entre as colunas: Novo → Contato → Agendado → Call realizada → Proposta → Fechado / Perdido.
- No celular, arrastar pode ser difícil: toque no cartão e troque a **Etapa** no formulário.
- **Próximo follow-up** fica vermelho quando atrasa e aparece no Dashboard.
- Use o botão **Lista** para ver tudo em formato de lista.
- O botão **Registrar venda** dentro do lead já cria a venda vinculada e marca o lead como fechado.

### Vendas

- **+ Venda** no topo. Informe valor, data e percentual.
- A comissão é calculada automaticamente: `valor × percentual`.
- O percentual padrão é **5%**, configurável em Config e editável em cada venda.
- Status **Recebida** ou **Pendente**: clique no selo da tabela para alternar.
- O botão **+ Venda** no celular fica no topo (ícone).

### Financeiro

- Mostra **fixo do mês + comissões** (recebidas e pendentes).
- O **Total do mês** soma o fixo com toda a comissão gerada, inclusive a que ainda está pendente.
- O fixo padrão é **R$ 3.000**; você pode ajustar mês a mês (o histórico é preservado).
- Tabela com os últimos 12 meses: fixo, vendido, comissão, recebido, pendente e total.

### Metas

- Defina meta de vendas e de comissão para o mês selecionado.
- O Dashboard mostra o progresso e quanto falta.

### Mês de referência

O seletor **Mês** no topo muda o Dashboard, Vendas, Financeiro e Metas. Leads são sempre todos.

---

## Backup e restauração

- **Backup automático**: ao iniciar o sistema e uma vez por dia enquanto ele estiver aberto, uma cópia do banco é gravada em `%LOCALAPPDATA%\CRM Closer\data\backups` (mantém as 7 mais recentes).
- **Backup completo (JSON)**: Config → Dados e backup → *Backup completo*.
- **Backup do banco**: Config → *Backup agora* (gera um `.db` na pasta de backups).
- **Exportar CSV**: vendas e leads, abertos no Excel.
- **Restaurar**: Config → *Importar backup* e escolha o `.json`. Isso substitui todos os dados atuais.

Guarde os backups fora do PC (Google Drive, pendrive) de vez em quando.

---

## Estrutura

Programa instalado:

```
C:\Program Files\CRM Closer\
├─ CRMCloser.exe       launcher com ícone
├─ server.js           servidor local (API + arquivos)
├─ runtime\node.exe    Node.js embutido
├─ public\             interface (HTML, CSS, JS)
├─ crm.ico             ícone
├─ desinstalar.ps1     desinstalador
└─ LEIA-ME.md
```

Dados do usuário:

```
%LOCALAPPDATA%\CRM Closer\data\
├─ crm.db              seus dados
├─ backups\            backups automáticos e manuais
├─ server.log          log do servidor
├─ launcher.log        log do atalho/launcher
└─ url.txt             endereço local e de rede
```

A pasta onde você extraiu o projeto é a pasta de desenvolvimento/origem. O programa instalado não depende dela.

---

## Solução de problemas

**O atalho não abre / página em branco**
Abra **Menu Iniciar → CRM Closer → Parar CRM Closer**, depois clique no atalho do Desktop novamente. Veja os logs em `%LOCALAPPDATA%\CRM Closer\data\server.log` e `launcher.log`.

**Celular não acessa**
- Confirme que está no mesmo Wi-Fi.
- Confirme que a rede do Windows está como **Privada**.
- Teste `http://IP-DO-PC:3200` no navegador do celular.
- Redes de convidados costumam bloquear a comunicação entre aparelhos.

**Esqueci o PIN**
Pare o CRM pelo Menu Iniciar e rode no PowerShell:

```powershell
$env:CRM_DB = "$env:LOCALAPPDATA\CRM Closer\data\crm.db"
@'
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(process.env.CRM_DB);
db.prepare("UPDATE config SET valor = '' WHERE chave = 'pin'").run();
console.log('PIN removido.');
'@ | & "C:\Program Files\CRM Closer\runtime\node.exe" -
```

Depois abra o CRM novamente.

**Porta ocupada**
O próprio CRM escolhe a próxima porta livre entre 3200 e 3209. O endereço correto aparece em `%LOCALAPPDATA%\CRM Closer\data\url.txt`.

---

## Desinstalar

**Menu Iniciar → CRM Closer → Desinstalar CRM Closer** (ou Aplicativos instalados → CRM Closer → Desinstalar).

O desinstalador remove o programa, atalhos, inicialização automática, regra de firewall e o registro em Aplicativos instalados. Por segurança, ele **mantém os dados** em `%LOCALAPPDATA%\CRM Closer`; se quiser apagar também, responda **S** quando perguntado.

---

## Privacidade

Tudo fica no seu computador. Nenhum dado é enviado para a internet. O CRM só aceita conexões da sua rede local (e apenas com o PIN, se ativado).
