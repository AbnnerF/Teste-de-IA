// ============================================================
  // COLE SUA CHAVE DA GROQ AQUI EMBAIXO, ENTRE AS ASPAS:
  // (pegue grátis em console.groq.com -> API Keys)
  const MINHA_CHAVE_FIXA = "";
  // Exemplo: const MINHA_CHAVE_FIXA = "gsk_xxxxxxxxxxxxxxxxxxxxxxxx";
  // ============================================================

  // ============================================================
  // COLE SUA CHAVE DA HUGGING FACE AQUI (usada pra gerar imagens de verdade):
  // (pegue grátis em huggingface.co -> Settings -> Access Tokens)
  const CHAVE_HUGGINGFACE = "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";
  // Exemplo: const CHAVE_HUGGINGFACE = "hf_xxxxxxxxxxxxxxxxxxxxxxxx";
  // ============================================================

  // ============================================================
  // SENHA PRA PROTEGER O NICK "AbnnerF" (só quem souber essa senha
  // consegue se identificar como AbnnerF e ver o Painel Admin):
  const SENHA_ABNNERF = "Katy 3010";
  // ⚠️ Aviso importante: como esse site é só HTML/JS rodando no navegador,
  // essa senha fica visível pra quem olhar o código-fonte da página.
  // Isso barra qualquer pessoa comum de "roubar" o nick por engano ou
  // curiosidade, mas não é uma segurança à prova de gente que sabe mexer
  // em código. Pra segurança de verdade, precisaria de um servidor.
  // ============================================================

  // ============================================================
  // FIREBASE — usado só pra receber denúncias de conversas encerradas
  // por mau uso, direto no Painel Admin, de qualquer aparelho.
  const firebaseConfig = {
    apiKey: "AIzaSyDxZHBi42WtjpCnYUkacE24Fc84_D5HlUM",
    authDomain: "abnners-ia.firebaseapp.com",
    projectId: "abnners-ia",
    storageBucket: "abnners-ia.firebasestorage.app",
    messagingSenderId: "512111490306",
    appId: "1:512111490306:web:0df59be63378c031f83e1b",
    measurementId: "G-FXCF69LG4L"
  };
  let db = null;
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
  } catch (e) {
    console.error("Firebase não carregou:", e);
    // "db" fica null; as funções que usam denúncias/Firestore já checam isso antes de tentar usar.
  }
  const sessionId = "sess_" + Math.random().toString(36).slice(2, 12);
  // ============================================================

  // ===== Estado persistido no navegador (localStorage) =====
  // Isso funciona porque o site roda direto no seu celular/navegador, fora do Claude.
  // Se MINHA_CHAVE_FIXA estiver preenchida acima, ela tem prioridade e você
  // nunca mais precisa colar a chave na tela.
  let apiKey = MINHA_CHAVE_FIXA || localStorage.getItem("groq_api_key") || "";
  let chats = JSON.parse(localStorage.getItem("chats") || "[]");
  let currentChatId = localStorage.getItem("current_chat_id") || null;

  const chatListEl = document.getElementById("chatList");
  const chatEl = document.getElementById("chat");
  const chatTitleEl = document.getElementById("chatTitle");
  const inputEl = document.getElementById("userInput");
  const sendBtn = document.getElementById("sendBtn");
  const apiKeyInput = document.getElementById("apiKeyInput");
  const saveKeyBtn = document.getElementById("saveKeyBtn");
  const keyStatus = document.getElementById("keyStatus");
  const newChatBtn = document.getElementById("newChatBtn");
  const menuBtn = document.getElementById("menuBtn");
  const sidebar = document.getElementById("sidebar");
  const sidebarBackdrop = document.getElementById("sidebarBackdrop");
  const attachBtn = document.getElementById("attachBtn");
  const fileInput = document.getElementById("fileInput");
  const imagePreviewBar = document.getElementById("imagePreviewBar");
  const imagePreviewThumb = document.getElementById("imagePreviewThumb");
  const removeImageBtn = document.getElementById("removeImageBtn");

  let imagemAnexada = null; // guarda a imagem (em base64) pronta pra enviar

  attachBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Escolha um arquivo de imagem.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Redimensiona a imagem pra não pesar demais (máx. 1024px no lado maior)
        const MAX = 1024;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) {
            height = Math.round(height * (MAX / width));
            width = MAX;
          } else {
            width = Math.round(width * (MAX / height));
            height = MAX;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        imagemAnexada = canvas.toDataURL("image/jpeg", 0.75);

        imagePreviewThumb.src = imagemAnexada;
        imagePreviewBar.style.display = "flex";
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    fileInput.value = "";
  });

  removeImageBtn.addEventListener("click", () => {
    imagemAnexada = null;
    imagePreviewBar.style.display = "none";
  });

  // ===== Gravação e transcrição de áudio (usa o Whisper da Groq) =====
  const micBtn = document.getElementById("micBtn");
  const recordBar = document.getElementById("recordBar");
  const recordTexto = document.getElementById("recordTexto");

  let mediaRecorder = null;
  let audioChunks = [];
  let gravando = false;
  let cronometro = null;
  let segundosGravando = 0;

  function formatarTempo(s) {
    const m = Math.floor(s / 60);
    const seg = s % 60;
    return m + ":" + String(seg).padStart(2, "0");
  }

  async function iniciarGravacao() {
    if (!apiKey) {
      alert("Cole sua chave da Groq no rodapé da barra lateral e clique em Salvar chave.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.addEventListener("dataavailable", (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      });
      mediaRecorder.addEventListener("stop", () => {
        stream.getTracks().forEach(t => t.stop());
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        transcreverAudio(audioBlob);
      });
      mediaRecorder.start();

      gravando = true;
      micBtn.classList.add("gravando");
      segundosGravando = 0;
      recordTexto.textContent = "Gravando... 0:00";
      recordBar.style.display = "flex";
      cronometro = setInterval(() => {
        segundosGravando++;
        recordTexto.textContent = "Gravando... " + formatarTempo(segundosGravando);
      }, 1000);
    } catch (err) {
      alert("Não consegui acessar o microfone (" + err.name + "). Verifique se o app/navegador tem permissão de microfone ativada nas configurações do Android.");
    }
  }

  function pararGravacao() {
    if (mediaRecorder && gravando) {
      mediaRecorder.stop();
    }
    gravando = false;
    micBtn.classList.remove("gravando");
    clearInterval(cronometro);
  }

  micBtn.addEventListener("click", () => {
    if (gravando) {
      pararGravacao();
    } else {
      iniciarGravacao();
    }
  });

  async function transcreverAudio(audioBlob) {
    recordTexto.textContent = "🎙️ Transcrevendo áudio...";

    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "audio.webm");
      formData.append("model", "whisper-large-v3-turbo");
      formData.append("language", "pt");
      formData.append("response_format", "json");

      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { "Authorization": "Bearer " + apiKey },
        body: formData
      });

      const data = await response.json();
      recordBar.style.display = "none";

      if (data.error) {
        alert("Erro ao transcrever: " + data.error.message);
        return;
      }

      const textoTranscrito = (data.text || "").trim();
      if (textoTranscrito) {
        inputEl.value = (inputEl.value ? inputEl.value + " " : "") + textoTranscrito;
        inputEl.style.height = "auto";
        inputEl.style.height = inputEl.scrollHeight + "px";
        inputEl.focus();
      }
    } catch (err) {
      recordBar.style.display = "none";
      alert("Falha ao transcrever o áudio: " + err.message);
    }
  }

  function abrirSidebar() {
    sidebar.classList.add("open");
    sidebarBackdrop.classList.add("open");
  }
  function fecharSidebar() {
    sidebar.classList.remove("open");
    sidebarBackdrop.classList.remove("open");
  }
  function alternarSidebar() {
    sidebar.classList.contains("open") ? fecharSidebar() : abrirSidebar();
  }

  function salvarChats() {
    localStorage.setItem("chats", JSON.stringify(chats));
    localStorage.setItem("current_chat_id", currentChatId || "");
  }

  function novoChat() {
    const id = Date.now().toString();
    chats.unshift({ id, title: "Nova conversa", messages: [] });
    currentChatId = id;
    salvarChats();
    renderSidebar();
    renderChat();
    fecharSidebar();
    inputEl.focus();
  }

  function excluirChat(id, ev) {
    ev.stopPropagation();
    chats = chats.filter(c => c.id !== id);
    if (currentChatId === id) {
      currentChatId = chats.length ? chats[0].id : null;
    }
    salvarChats();
    renderSidebar();
    renderChat();
  }

  function selecionarChat(id) {
    currentChatId = id;
    salvarChats();
    renderSidebar();
    renderChat();
    fecharSidebar();
  }

  function getChatAtual() {
    return chats.find(c => c.id === currentChatId) || null;
  }

  function renderSidebar() {
    chatListEl.innerHTML = "";
    chats.forEach(c => {
      const div = document.createElement("div");
      div.className = "chatItem" + (c.id === currentChatId ? " active" : "");
      div.innerHTML = `<span class="title"></span><span class="delBtn">✕</span>`;
      div.querySelector(".title").textContent = c.title;
      div.addEventListener("click", () => selecionarChat(c.id));
      div.querySelector(".delBtn").addEventListener("click", (ev) => excluirChat(c.id, ev));
      chatListEl.appendChild(div);
    });
  }

  function renderChat() {
    chatEl.innerHTML = "";
    const chat = getChatAtual();
    if (!chat) {
      chatTitleEl.textContent = nomeIA;
      const empty = document.createElement("div");
      empty.id = "emptyState";
      empty.textContent = 'Clique em "Novo chat" para começar.';
      chatEl.appendChild(empty);
      aplicarEstadoChatEncerrado();
      return;
    }
    chatTitleEl.textContent = chat.title;
    chat.messages.forEach(m => addMessageEl(m.role === "user" ? "user" : "ai", m.content));
    chatEl.scrollTop = chatEl.scrollHeight;
    aplicarEstadoChatEncerrado();
  }

  function addMessageEl(tipo, conteudo) {
    const div = document.createElement("div");
    div.className = "msg " + tipo;
    chatEl.appendChild(div);

    if (Array.isArray(conteudo)) {
      // mensagem do usuário com imagem (formato: [{type:"text",...}, {type:"image_url",...}])
      const textoParte = conteudo.find(p => p.type === "text");
      const imagemParte = conteudo.find(p => p.type === "image_url");
      if (textoParte && textoParte.text) {
        const p = document.createElement("div");
        p.textContent = textoParte.text;
        div.appendChild(p);
      }
      if (imagemParte) {
        const img = document.createElement("img");
        img.className = "msgImage";
        img.src = imagemParte.image_url.url;
        div.appendChild(img);
      }
    } else if (tipo === "ai") {
      renderMensagemIA(div, "", conteudo);
    } else if (tipo === "ai loading") {
      const rotulo = conteudo === "pesquisando" ? '<span class="loadingLabel">🔎 Pesquisando...</span>' : "";
      div.innerHTML = rotulo + '<span class="typingDots"><span></span><span></span><span></span></span>';
    } else {
      div.textContent = conteudo;
    }

    chatEl.scrollTop = chatEl.scrollHeight;
    return div;
  }

  // Detecta blocos ```linguagem ... ``` no texto e monta o HTML,
  // separando texto normal de blocos de código (com botão de copiar).
  // Separa o bloco de raciocínio (<think>...</think>) do restante da resposta,
  // e monta uma caixinha expansível "🤔 Pensando..." com o que a IA raciocinou.
  function renderMensagemIA(container, pensamento, resposta, cachePersonagens) {
    container.innerHTML = "";
    pensamento = pensamento || "";
    resposta = resposta || "";
    const pensamentoFechado = resposta.trim().length > 0; // se já começou a resposta, o pensamento terminou

    if (pensamento.trim()) {
      const details = document.createElement("details");
      details.className = "thinkBox";
      details.open = !pensamentoFechado; // fica aberta enquanto ainda tá pensando, fecha quando termina

      const summary = document.createElement("summary");
      summary.textContent = pensamentoFechado ? "✅ Pensou antes de responder" : "🤔 Pensando...";
      details.appendChild(summary);

      const corpo = document.createElement("div");
      corpo.className = "thinkText";
      corpo.textContent = pensamento.trim();
      details.appendChild(corpo);

      container.appendChild(details);
    }

    if (resposta.trim()) {
      const respostaDiv = document.createElement("div");
      renderConteudoComCodigo(respostaDiv, resposta.replace(/^\n+/, ""), cachePersonagens);
      container.appendChild(respostaDiv);
    }
  }

  // Detecta o marcador [IMAGEM: descrição] no texto e troca por uma <img> de verdade,
  // gerada na hora pelo Pollinations.ai (gratuito, sem precisar de chave).
  function renderTextoComImagens(container, texto) {
    const regex = /\[IMAGEM:\s*([^\]]+)\]/g;
    let ultimoIndex = 0;
    let match;
    let teveConteudo = false;

    while ((match = regex.exec(texto)) !== null) {
      if (match.index > ultimoIndex) {
        const trecho = texto.slice(ultimoIndex, match.index);
        if (trecho.trim()) {
          const p = document.createElement("div");
          p.style.whiteSpace = "pre-wrap";
          p.innerHTML = formatarMarkdown(trecho);
          container.appendChild(p);
          teveConteudo = true;
        }
      }

      const descricao = match[1].trim();
      const wrapper = document.createElement("div");
      wrapper.className = "imgGeradaWrapper";

      const img = document.createElement("img");
      img.className = "imgGerada";
      img.alt = descricao;
      img.loading = "lazy";
      img.src = "https://image.pollinations.ai/prompt/" + encodeURIComponent(descricao) + "?width=768&height=768&nologo=true&seed=" + Math.floor(Math.random() * 100000);

      const legenda = document.createElement("div");
      legenda.className = "imgGeradaLegenda";
      legenda.textContent = "🎨 " + descricao;

      wrapper.appendChild(img);
      wrapper.appendChild(legenda);
      container.appendChild(wrapper);
      teveConteudo = true;

      ultimoIndex = match.index + match[0].length;
    }

    if (ultimoIndex < texto.length) {
      const resto = texto.slice(ultimoIndex);
      if (resto.trim()) {
        const p = document.createElement("div");
        p.style.whiteSpace = "pre-wrap";
        p.innerHTML = formatarMarkdown(resto);
        container.appendChild(p);
        teveConteudo = true;
      }
    }

    return teveConteudo;
  }

  // Busca a foto real de um personagem na Wikipédia (gratuito, sem chave).
  // Tenta primeiro títulos "qualificados" (com a série no nome) em inglês e português —
  // esses são confiáveis. Só no final tenta o nome sozinho, que é arriscado (pode bater
  // com uma pessoa real por coincidência de nome), então esse exige uma validação extra.
  // Interpreta um markdown básico que a IA costuma usar: **negrito**, *itálico*, `código inline`.
  // Escapa HTML antes, pra não virar brecha de segurança, e só depois aplica as tags.
  function formatarMarkdown(texto) {
    let seguro = texto
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    seguro = seguro.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    seguro = seguro.replace(/__(.+?)__/g, "<strong>$1</strong>");
    seguro = seguro.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");
    seguro = seguro.replace(/`([^`]+?)`/g, '<code class="inlineCode">$1</code>');

    return seguro;
  }

  async function buscarImagemPersonagem(nome, serie) {
    const tentativas = [
      { titulo: nome + " (" + serie + ")", exigirValidacao: false },
      { titulo: nome + " (character)", exigirValidacao: false },
      { titulo: nome + " (personagem)", exigirValidacao: false },
      { titulo: nome, exigirValidacao: true }
    ];
    const dominios = ["en.wikipedia.org", "pt.wikipedia.org"];

    for (const tentativa of tentativas) {
      for (const dominio of dominios) {
        try {
          const resp = await fetch("https://" + dominio + "/api/rest_v1/page/summary/" + encodeURIComponent(tentativa.titulo));
          if (resp.ok) {
            const data = await resp.json();
            if (data.thumbnail && data.thumbnail.source) {
              if (tentativa.exigirValidacao) {
                const textoCheck = ((data.description || "") + " " + (data.extract || "")).toLowerCase();
                const pareceFiccional = /personagem|ficç|fictíci|anime|mangá|character|fictional|manga|quadrinho|comic|vilão|herói|villain|hero/.test(textoCheck);
                if (!pareceFiccional) continue; // não parece ser o personagem certo, tenta o próximo
              }
              return { imagem: data.thumbnail.source, descricao: data.extract || "" };
            }
          }
        } catch (e) { /* tenta o próximo */ }
      }
    }

    // Se a Wikipédia não achou nada, tenta o Openverse (banco de imagens livres, sem chave)
    try {
      const query = encodeURIComponent(nome + " " + serie);
      const resp = await fetch("https://api.openverse.org/v1/images/?q=" + query + "&page_size=1");
      if (resp.ok) {
        const data = await resp.json();
        if (data.results && data.results.length > 0) {
          const item = data.results[0];
          const urlImagem = item.thumbnail || item.url;
          if (urlImagem) {
            return { imagem: urlImagem, descricao: "" };
          }
        }
      }
    } catch (e) { /* sem sorte também */ }

    return null;
  }

  // Busca uma imagem "bonita" e ALEATÓRIA entre várias opções — usada quando a pessoa
  // pede diretamente pra ver a imagem de um personagem (não é o jogo de adivinhar).
  // Cada pedido tende a trazer uma foto diferente, mesmo pro mesmo personagem.
  // Prioriza arte/ilustração (fanart, desenhos) e filtra resultados que não tenham
  // nada a ver com o nome do personagem (pra evitar coisas aleatórias tipo bonecos, objetos etc.)
  async function buscarFotoBonita(nome, serie) {
    try {
      const query = encodeURIComponent(nome + " " + serie + " art");
      const resp = await fetch(
        "https://api.openverse.org/v1/images/?q=" + query +
        "&page_size=20&mature=false&category=illustration,digitized_artwork"
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data.results && data.results.length > 0) {
          const nomeMinusculo = nome.toLowerCase();

          // só aceita se o título ou as tags mencionarem o nome do personagem
          const relevantes = data.results.filter(r => {
            const titulo = (r.title || "").toLowerCase();
            const tags = (r.tags || []).map(t => (t.name || "").toLowerCase()).join(" ");
            return titulo.includes(nomeMinusculo) || tags.includes(nomeMinusculo);
          });

          // entre as relevantes, prioriza as maiores/mais n