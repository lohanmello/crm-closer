# CRM Closer

CRM local para closer digital: funil de leads, vendas, comissão e controle de ganhos (**fixo + %**).

Roda **no próprio PC**, sem nuvem e sem depender de uma conta externa. Os dados ficam em um banco SQLite local. A instalação para Windows inclui o Node.js necessário, então não é preciso instalar Node para usar.

> **Uso local:** este projeto não é um SaaS. O GitHub hospeda o código e o instalador; cada pessoa roda o CRM no próprio computador.

---

## Baixar e instalar (Windows 10/11)

1. Abra a aba **Releases** deste repositório.
2. Baixe `CRM-Closer-Windows.zip`.
3. Extraia o ZIP em uma pasta de sua preferência.
4. Execute **`instalar.bat`**.
5. Aceite o UAC do Windows (**Sim**).
6. Ao final, responda **S** para abrir o CRM.

> O executável não tem assinatura digital. Se o Windows exibir um aviso do SmartScreen, clique em **Mais informações → Executar assim mesmo**.

O instalador:

- instala o programa em `C:\Program Files\CRM Closer`;
- copia o Node.js embutido para a instalação;
- cria os atalhos no Desktop, Menu Iniciar e Inicialização do Windows;
- configura a inicialização automática no login;
- libera as portas **3200–3209** no firewall para redes privadas;
- registra o app em **Aplicativos instalados**, com desinstalador.

O CRM abre em `http://127.0.0.1:3200`. Se a porta estiver ocupada, ele tenta 3201, 3202 e assim por diante.

Para instruções detalhadas, veja **[LEIA-ME.md](LEIA-ME.md)**.

---

## Acessar pelo celular

1. O PC e o celular precisam estar na **mesma rede Wi-Fi**.
2. No CRM, abra **Config → Acesso pelo celular** e copie o endereço, por exemplo `http://192.168.0.10:3200`.
3. Defina um **PIN de 4 dígitos** em **Config → Segurança** antes de liberar o acesso.

> O CRM usa HTTP na rede local. **Não** faça redirecionamento de porta no roteador nem exponha a porta 3200 para a internet.

---

## Dados e backup

- No Windows instalado: `%LOCALAPPDATA%\CRM Closer\data`
- Banco: `crm.db`
- Backups automáticos: `backups\`
- Logs: `server.log`
- Endereço local: `url.txt`

Os dados **não** vão para o GitHub. A pasta `db/` e os arquivos `.db`, `.log` e `backups/` estão no `.gitignore`.

Faça backup pelo próprio CRM em **Config → Backup**, ou copie a pasta `backups` para OneDrive/Google Drive.

---

## Rodar a partir do código

Requisitos: **Node.js 26+** (o projeto usa `node:sqlite`, sem dependências externas).

```bash
git clone URL-DO-REPOSITORIO
cd crm-closer
npm start
```

Por padrão o servidor usa a porta `3000`. Para usar outra porta:

**PowerShell:**

```powershell
$env:PORT=3200
npm start
```

**Prompt de comando:**

```bat
set PORT=3200
npm start
```

Abra `http://127.0.0.1:3200`.

### Gerar o iniciador Windows

O `CRMCloser.exe` é um launcher nativo em C#. Para recompilar:

```bat
cd build
compilar.bat
```

O script usa o `csc.exe` do .NET Framework 4.x e gera `build\CRMCloser.exe` com o ícone do app. O executável e o `runtime/node.exe` são necessários apenas para o instalador; ambos ficam fora do Git e entram no ZIP da Release.

---

## Funcionalidades

- Funil de leads em Kanban: Novo, Contato, Agendado, Call realizada, Proposta, Fechado e Perdido.
- Cadastro de leads com origem, produto, ticket estimado e follow-up.
- Registro de vendas com valor, percentual de comissão, data e status (recebida/pendente).
- Dashboard com vendido, comissão, fixo, **total do mês (fixo + comissão)** e valores a receber.
- Financeiro com histórico mensal.
- Metas de vendas e de comissão.
- Backup automático diário, exportação CSV e importação de backup JSON.
- Interface em português, tema claro/escuro e acesso mobile na rede local.
- PIN opcional para acesso pelo celular.

---

## Estrutura

```text
.
├── server.js              # servidor HTTP + SQLite (Node.js)
├── public/                # interface (HTML, CSS e JS)
├── build/
│   ├── compilar.bat       # compila o launcher Windows
│   └── launcher.cs        # fonte do iniciador Windows (CRMCloser.exe)
├── instalar-app.ps1       # instalador Windows
├── instalar.bat           # atalho para o instalador
├── desinstalar.ps1        # desinstalador
├── crm.ico                # ícone do aplicativo
├── licenses/
│   └── LICENSE-node.txt   # licença do Node.js distribuído no release
└── LEIA-ME.md             # manual do usuário
```

O `runtime/node.exe` e o `build/CRMCloser.exe` são incluídos apenas no ZIP da Release, não no repositório.

---

## Segurança

- O CRM é feito para uso **local** ou em uma rede privada de confiança.
- O PIN é uma proteção simples de 4 dígitos; não substitui autenticação forte.
- Não exponha o servidor diretamente à internet.
- Se for usar em uma rede compartilhada, mantenha o PIN ativo e revise o firewall.

---

## Licença

Distribuído sob a licença **MIT**. Veja [LICENSE](LICENSE).

O Node.js embutido no pacote de release é distribuído sob a licença do Node.js; veja [licenses/LICENSE-node.txt](licenses/LICENSE-node.txt).
