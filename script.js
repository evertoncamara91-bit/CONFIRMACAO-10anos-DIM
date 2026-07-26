/* =========================================================
   RSVP — 10 Anos do Quartel
   Lógica do formulário público + painel admin + envio ao
   Google Sheets via Apps Script.

   COMO FUNCIONA O ARMAZENAMENTO DAS CONFIGURAÇÕES:
   Tudo que você ajusta no painel Admin (textos, campos,
   imagem de fundo, URL de conexão, senha) é salvo no
   localStorage do navegador. Ou seja, fica salvo no
   computador/navegador onde você fez a alteração.
   Isso é o suficiente para o uso de um administrador único.
   ========================================================= */

const PATENTES = {
  mb: ['Almirante','Almirante-de-Esquadra','Vice-Almirante','Contra-Almirante','Capitão-de-Mar-e-Guerra','Capitão-de-Fragata','Capitão-de-Corveta','Capitão-Tenente','1º Tenente','2º Tenente','Guarda-Marinha','Suboficial','1º Sargento','2º Sargento','3º Sargento','Cabo','Marinheiro'],
  eb: ['Marechal','General-de-Exército','General-de-Divisão','General-de-Brigada','Coronel','Tenente-Coronel','Major','Capitão','1º Tenente','2º Tenente','Aspirante-a-Oficial','Subtenente','1º Sargento','2º Sargento','3º Sargento','Cabo','Soldado'],
  fab: ['Marechal-do-Ar','Tenente-Brigadeiro-do-Ar','Major-Brigadeiro','Brigadeiro','Coronel','Tenente-Coronel','Major','Capitão','1º Tenente','2º Tenente','Aspirante-a-Oficial','Subtenente','1º Sargento','2º Sargento','3º Sargento','Cabo','Soldado']
};

const STORAGE_KEY = 'rsvp_quartel_config';
const PWD_KEY = 'rsvp_quartel_admin_pwd';
const BG_KEY = 'rsvp_quartel_bg_image';

const DEFAULT_CONFIG = {
  submitbtn: 'Enviar confirmação',
  footer: 'Todos os campos são obrigatórios. Dados usados exclusivamente para organização do evento.',
  spacer: 24,
  webhookUrl: '',
  fields: [
    { id:'nome', label:'Nome completo', type:'text', placeholder:'Digite seu nome completo', required:true, enabled:true },
    { id:'nomeguerra', label:'Nome de guerra', type:'text', placeholder:'Ex: Silva, Rodrigues...', required:true, enabled:true },
    { id:'tel', label:'Telefone', type:'tel', placeholder:'(21) 99999-9999', required:true, enabled:true },
    { id:'email', label:'E-mail', type:'email', placeholder:'seu@email.com', required:true, enabled:true },
    { id:'militar', label:'Você é militar?', type:'toggle-militar', required:true, enabled:true }
  ]
};

let config = loadConfig();
let adminPwd = localStorage.getItem(PWD_KEY) || '1234';
let isMilitar = null;
let confirma = null;

/* ---------- PERSISTÊNCIA ---------- */

function loadConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // mescla com default para garantir que novas chaves futuras não quebrem configs antigas
      return Object.assign({}, DEFAULT_CONFIG, parsed);
    }
  } catch (e) {
    console.warn('Não foi possível carregar configuração salva, usando padrão.', e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

function saveConfig() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/* ---------- RENDERIZAÇÃO DO FORMULÁRIO PÚBLICO ---------- */

function renderPublicForm() {
  document.getElementById('pub-submit-btn').textContent = config.submitbtn;
  document.getElementById('pub-footer').textContent = config.footer;
  document.getElementById('top-spacer').style.height = (config.spacer || 0) + 'px';

  const container = document.getElementById('fields-render');
  container.innerHTML = '';
  const enabled = config.fields.filter(f => f.enabled);

  const personalFields = enabled.filter(f => f.type !== 'toggle-militar');
  const militarField = enabled.find(f => f.type === 'toggle-militar');

  if (personalFields.length) {
    const lbl = document.createElement('div');
    lbl.className = 'sec-label';
    lbl.textContent = 'Dados pessoais';
    container.appendChild(lbl);

    const textFields = personalFields.filter(f => ['text','tel','email'].includes(f.type));
    const nome = textFields.find(f => f.id === 'nome');
    const guerra = textFields.find(f => f.id === 'nomeguerra');
    const tel = textFields.find(f => f.id === 'tel');
    const email = textFields.find(f => f.id === 'email');
    const outros = textFields.filter(f => !['nome','nomeguerra','tel','email'].includes(f.id));

    if (nome) container.appendChild(makeTextField(nome));
    if (guerra) container.appendChild(makeTextField(guerra));
    if (tel || email) {
      const g = document.createElement('div');
      g.className = 'grid2';
      if (tel) g.appendChild(makeTextField(tel));
      if (email) g.appendChild(makeTextField(email));
      container.appendChild(g);
    }
    outros.forEach(f => container.appendChild(makeTextField(f)));
  }

  if (militarField) {
    const sep = document.createElement('div');
    sep.className = 'sep';
    container.appendChild(sep);
    const lbl = document.createElement('div');
    lbl.className = 'sec-label';
    lbl.textContent = 'Perfil do convidado';
    container.appendChild(lbl);
    container.appendChild(makeMilitarBlock(militarField));
    attachMilitarHandlers();
  }
}

function makeTextField(f) {
  const div = document.createElement('div');
  div.className = 'f';
  const reqSpan = f.required ? ' <span class="req">*</span>' : '';
  div.innerHTML =
    '<label>' + escapeHtml(f.label) + reqSpan + '</label>' +
    '<input type="' + f.type + '" id="pub-' + f.id + '" placeholder="' + escapeHtml(f.placeholder || '') + '">' +
    '<div class="emsg" id="err-pub-' + f.id + '">Campo obrigatório.</div>';
  return div;
}

function makeMilitarBlock(f) {
  const wrap = document.createElement('div');
  const reqSpan = f.required ? ' <span class="req">*</span>' : '';
  wrap.innerHTML =
    '<label style="font-size:12px;color:rgba(240,234,214,0.6);font-weight:500;display:block;margin-bottom:6px;">' +
      escapeHtml(f.label) + reqSpan +
    '</label>' +
    '<div class="toggle-row">' +
      '<button class="tbtn" id="btn-mil-sim" type="button">Sim, sou militar</button>' +
      '<button class="tbtn" id="btn-mil-nao" type="button">Não, sou civil</button>' +
    '</div>' +
    '<div class="emsg" id="err-militar" style="margin-top:-6px;margin-bottom:10px;">Selecione uma opção.</div>' +
    '<div class="cond-block hidden" id="bloco-militar">' +
      '<div class="f" style="margin-bottom:0.75rem;">' +
        '<label>Força / Instituição <span class="req">*</span></label>' +
        '<select id="pub-forca">' +
          '<option value="">Selecione</option>' +
          '<option value="mb">Marinha do Brasil</option>' +
          '<option value="eb">Exército Brasileiro</option>' +
          '<option value="fab">Força Aérea Brasileira</option>' +
          '<option value="outro">Outra instituição</option>' +
        '</select>' +
        '<div class="emsg" id="err-forca">Selecione a força ou instituição.</div>' +
      '</div>' +
      '<div class="f hidden" id="campo-patente" style="margin-bottom:0.75rem;">' +
        '<label>Posto / Graduação <span class="req">*</span></label>' +
        '<select id="pub-patente"><option value="">Selecione</option></select>' +
        '<div class="emsg" id="err-patente">Selecione o posto ou graduação.</div>' +
      '</div>' +
      '<div class="f hidden" id="campo-outra" style="margin-bottom:0;">' +
        '<label>Nome da instituição <span class="req">*</span></label>' +
        '<input type="text" placeholder="Digite o nome da instituição" id="pub-outra">' +
        '<div class="emsg" id="err-outra">Informe o nome da instituição.</div>' +
      '</div>' +
    '</div>';
  return wrap;
}

function attachMilitarHandlers() {
  document.getElementById('btn-mil-sim').addEventListener('click', () => setMilitar(true));
  document.getElementById('btn-mil-nao').addEventListener('click', () => setMilitar(false));
  document.getElementById('pub-forca').addEventListener('change', (e) => setForca(e.target.value));
}

function setMilitar(val) {
  isMilitar = val;
  document.getElementById('btn-mil-sim').classList.toggle('on', val);
  document.getElementById('btn-mil-nao').classList.toggle('on', !val);
  document.getElementById('bloco-militar').classList.toggle('hidden', !val);
  document.getElementById('err-militar').classList.remove('v');
  if (!val) {
    document.getElementById('campo-patente').classList.add('hidden');
    document.getElementById('campo-outra').classList.add('hidden');
    document.getElementById('pub-forca').value = '';
  }
}

function setForca(v) {
  const cp = document.getElementById('campo-patente');
  const co = document.getElementById('campo-outra');
  const sel = document.getElementById('pub-patente');
  document.getElementById('err-forca').classList.remove('v');
  document.getElementById('pub-forca').classList.remove('err');
  if (v === 'outro') {
    cp.classList.add('hidden');
    co.classList.remove('hidden');
  } else if (PATENTES[v]) {
    co.classList.add('hidden');
    sel.innerHTML = '<option value="">Selecione</option>' + PATENTES[v].map(p => '<option>' + p + '</option>').join('');
    cp.classList.remove('hidden');
  } else {
    cp.classList.add('hidden');
    co.classList.add('hidden');
  }
}

function setConfirm(val) {
  confirma = val;
  document.getElementById('cbtn-sim').classList.toggle('on', val);
  document.getElementById('cbtn-nao').classList.toggle('on', !val);
  document.getElementById('err-confirma').classList.remove('v');
}

/* ---------- VALIDAÇÃO E ENVIO ---------- */

function validarFormulario() {
  let ok = true;

  config.fields.filter(f => f.enabled && f.type !== 'toggle-militar').forEach(f => {
    const el = document.getElementById('pub-' + f.id);
    if (!el) return;
    if (!f.required) { el.classList.remove('err'); return; }
    if (!el.value.trim()) {
      el.classList.add('err');
      const e = document.getElementById('err-pub-' + f.id);
      if (e) e.classList.add('v');
      ok = false;
    } else {
      el.classList.remove('err');
      const e = document.getElementById('err-pub-' + f.id);
      if (e) e.classList.remove('v');
    }
  });

  const mf = config.fields.find(f => f.type === 'toggle-militar' && f.enabled);
  if (mf) {
    if (isMilitar === null) {
      document.getElementById('err-militar').classList.add('v');
      ok = false;
    }
    if (isMilitar) {
      const forca = document.getElementById('pub-forca').value;
      if (!forca) {
        document.getElementById('pub-forca').classList.add('err');
        document.getElementById('err-forca').classList.add('v');
        ok = false;
      }
      if (forca === 'outro') {
        const o = document.getElementById('pub-outra').value.trim();
        if (!o) {
          document.getElementById('pub-outra').classList.add('err');
          document.getElementById('err-outra').classList.add('v');
          ok = false;
        }
      } else if (PATENTES[forca]) {
        if (!document.getElementById('pub-patente').value) {
          document.getElementById('pub-patente').classList.add('err');
          document.getElementById('err-patente').classList.add('v');
          ok = false;
        }
      }
    }
  }

  if (confirma === null) {
    document.getElementById('err-confirma').classList.add('v');
    ok = false;
  }

  return ok;
}

function coletarDadosFormulario() {
  const dados = {};
  config.fields.filter(f => f.enabled && f.type !== 'toggle-militar').forEach(f => {
    const el = document.getElementById('pub-' + f.id);
    if (el) dados[f.id] = el.value.trim();
  });

  dados.militar = isMilitar ? 'Sim' : 'Não';
  if (isMilitar) {
    const forca = document.getElementById('pub-forca').value;
    const labels = { mb: 'Marinha do Brasil', eb: 'Exército Brasileiro', fab: 'Força Aérea Brasileira', outro: 'Outra instituição' };
    dados.forca = labels[forca] || forca;
    if (forca === 'outro') {
      dados.instituicao = document.getElementById('pub-outra').value.trim();
      dados.posto = '';
    } else {
      dados.instituicao = labels[forca] || '';
      dados.posto = document.getElementById('pub-patente').value;
    }
  } else {
    dados.forca = '';
    dados.instituicao = '';
    dados.posto = '';
  }

  dados.confirmacao = confirma ? 'Confirmou presença' : 'Não poderá comparecer';
  dados.dataEnvio = new Date().toLocaleString('pt-BR');

  return dados;
}

function enviarFormulario() {
  if (!validarFormulario()) return;

  const dados = coletarDadosFormulario();

  if (!config.webhookUrl) {
    // Sem conexão configurada: ainda mostra sucesso ao convidado,
    // mas avisa no console (não trava o uso do site em produção).
    console.warn('URL do Google Sheets não configurada. Os dados não foram enviados:', dados);
    mostrarSucesso(dados);
    return;
  }

  mostrarTela('loading');

  fetch(config.webhookUrl, {
    method: 'POST',
    mode: 'no-cors', // necessário para Apps Script Web Apps a partir de outro domínio
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(dados)
  })
    .then(() => {
      // mode: 'no-cors' não permite ler a resposta, então tratamos o fetch
      // sem erro de rede como sucesso.
      mostrarSucesso(dados);
    })
    .catch((err) => {
      console.error('Erro ao enviar para o Google Sheets:', err);
      mostrarTela('error');
    });
}

function mostrarTela(nome) {
  document.getElementById('form-card').style.display = (nome === 'form') ? 'block' : 'none';
  document.getElementById('success-screen').style.display = (nome === 'success') ? 'block' : 'none';
  document.getElementById('loading-screen').style.display = (nome === 'loading') ? 'block' : 'none';
  document.getElementById('error-screen').style.display = (nome === 'error') ? 'block' : 'none';
}

function mostrarSucesso(dados) {
  mostrarTela('success');
  const nomeExibido = dados.nomeguerra || dados.nome || '';
  document.getElementById('nome-confirmado').textContent = nomeExibido;
}

/* ---------- ADMIN: LOGIN ---------- */

function openAdminLogin() {
  document.getElementById('login-modal').classList.add('v');
  document.getElementById('login-pwd').value = '';
  document.getElementById('login-err').classList.remove('v');
  setTimeout(() => document.getElementById('login-pwd').focus(), 100);
}
function closeLogin() {
  document.getElementById('login-modal').classList.remove('v');
}
function doLogin() {
  const val = document.getElementById('login-pwd').value;
  if (val === adminPwd) {
    closeLogin();
    openAdmin();
  } else {
    document.getElementById('login-err').classList.add('v');
    document.getElementById('login-pwd').value = '';
  }
}

/* ---------- ADMIN: NAVEGAÇÃO ---------- */

function openAdmin() {
  document.getElementById('form-page').style.display = 'none';
  document.getElementById('admin-page').classList.add('v');
  loadAdminValues();
  renderFieldsEditor();
  loadBgPreview();
}
function closeAdmin() {
  document.getElementById('admin-page').classList.remove('v');
  document.getElementById('form-page').style.display = 'block';
}
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === name);
  });
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
}

/* ---------- ADMIN: TEXTOS ---------- */

function loadAdminValues() {
  document.getElementById('cfg-submitbtn').value = config.submitbtn;
  document.getElementById('cfg-footer').value = config.footer;
  document.getElementById('cfg-spacer').value = config.spacer;
  document.getElementById('cfg-webhook').value = config.webhookUrl || '';
}

function salvarTextos() {
  config.submitbtn = document.getElementById('cfg-submitbtn').value || DEFAULT_CONFIG.submitbtn;
  config.footer = document.getElementById('cfg-footer').value || DEFAULT_CONFIG.footer;
  config.spacer = parseInt(document.getElementById('cfg-spacer').value, 10) || 0;
  saveConfig();
  renderPublicForm();
  showToast('Textos salvos com sucesso!');
}

function salvarWebhook() {
  config.webhookUrl = document.getElementById('cfg-webhook').value.trim();
  saveConfig();
  const msg = document.getElementById('webhook-saved-msg');
  msg.classList.add('v');
  setTimeout(() => msg.classList.remove('v'), 3000);
}

/* ---------- ADMIN: CAMPOS ---------- */

function renderFieldsEditor() {
  const c = document.getElementById('fields-editor');
  c.innerHTML = '';
  const typeLabels = { text: 'Texto', tel: 'Telefone', email: 'E-mail', 'toggle-militar': 'Bloco militar' };

  config.fields.forEach((f, i) => {
    const badgeClass = f.type === 'toggle-militar' ? 'badge-toggle' : (f.type === 'text' ? 'badge-text' : 'badge-select');
    const item = document.createElement('div');
    item.className = 'field-item';

    let html =
      '<div class="field-item-header">' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
          '<span class="field-badge ' + badgeClass + '">' + (typeLabels[f.type] || f.type) + '</span>' +
          '<span style="font-size:13px;font-weight:600;color:#1a1d23;">' + escapeHtml(f.label) + '</span>' +
        '</div>' +
        '<label class="toggle-switch">' +
          '<div class="sw">' +
            '<input type="checkbox" data-idx="' + i + '" data-action="toggle-enabled" ' + (f.enabled ? 'checked' : '') + '>' +
            '<div class="sw-track"></div><div class="sw-thumb"></div>' +
          '</div>' +
          '<span class="sw-label">Ativo</span>' +
        '</label>' +
      '</div>' +
      '<div class="field-grid">' +
        '<div class="afield">' +
          '<label>Rótulo do campo</label>' +
          '<input type="text" data-idx="' + i + '" data-action="update-label" value="' + escapeHtml(f.label) + '">' +
        '</div>';

    if (f.type !== 'toggle-militar') {
      html +=
        '<div class="afield">' +
          '<label>Placeholder</label>' +
          '<input type="text" data-idx="' + i + '" data-action="update-placeholder" value="' + escapeHtml(f.placeholder || '') + '">' +
        '</div>';
    } else {
      html += '<div></div>';
    }
    html += '</div>';

    if (f.type !== 'toggle-militar') {
      html +=
        '<label class="toggle-switch" style="margin-top:4px;">' +
          '<div class="sw">' +
            '<input type="checkbox" data-idx="' + i + '" data-action="toggle-required" ' + (f.required ? 'checked' : '') + '>' +
            '<div class="sw-track"></div><div class="sw-thumb"></div>' +
          '</div>' +
          '<span class="sw-label">Obrigatório</span>' +
        '</label>';
    }

    item.innerHTML = html;
    c.appendChild(item);
  });

  const saveBtn = document.createElement('button');
  saveBtn.className = 'save-btn';
  saveBtn.style.marginTop = '1rem';
  saveBtn.type = 'button';
  saveBtn.textContent = '✓ Salvar campos e aplicar';
  saveBtn.addEventListener('click', () => {
    saveConfig();
    renderPublicForm();
    showToast('Campos salvos!');
  });
  c.appendChild(saveBtn);

  // listeners dos inputs/checkboxes criados dinamicamente
  c.querySelectorAll('[data-action]').forEach(el => {
    const idx = parseInt(el.dataset.idx, 10);
    const action = el.dataset.action;
    const evt = el.type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(evt, () => {
      if (action === 'toggle-enabled') config.fields[idx].enabled = el.checked;
      if (action === 'toggle-required') config.fields[idx].required = el.checked;
      if (action === 'update-label') config.fields[idx].label = el.value;
      if (action === 'update-placeholder') config.fields[idx].placeholder = el.value;
    });
  });
}

/* ---------- ADMIN: IMAGEM DE FUNDO ---------- */

// Nomes aceitos para a imagem no repositório (tenta cada um em ordem)
const BG_FILENAMES = ['background.jpg', 'background.jpeg', 'background.png', 'background.webp'];

function carregarImagemDoRepositorio() {
  // Tenta cada extensão possível até encontrar uma que exista
  function tentarProximo(index) {
    if (index >= BG_FILENAMES.length) return; // nenhuma encontrada, sem imagem
    const url = BG_FILENAMES[index];
    const img = new Image();
    img.onload = () => applyBgToForm(url); // achou! aplica
    img.onerror = () => tentarProximo(index + 1); // não existe, tenta próxima
    img.src = url + '?v=' + Date.now(); // ?v= evita cache antigo
  }
  tentarProximo(0);
}

function loadBgPreview() {
  // No painel admin, mostra preview se houver imagem no repositório
  BG_FILENAMES.forEach(name => {
    const img = new Image();
    img.onload = () => showBgPreview(name);
    img.src = name + '?v=' + Date.now();
  });
}

function showBgPreview(url) {
  document.getElementById('preview-img').src = url;
  document.getElementById('upload-zone').style.display = 'none';
  document.getElementById('upload-preview').style.display = 'block';
}

function applyBgToForm(url) {
  const overlay = document.getElementById('bg-overlay');
  const artHeader = document.getElementById('art-header');

  if (url) {
    overlay.style.backgroundImage = 'url(' + url + ')';
    overlay.classList.add('has-image');
    artHeader.style.backgroundImage = 'url(' + url + ')';
    artHeader.classList.add('has-image');
    document.getElementById('bg-pattern').style.display = 'none';
  } else {
    overlay.style.backgroundImage = 'none';
    overlay.classList.remove('has-image');
    artHeader.style.backgroundImage = 'none';
    artHeader.classList.remove('has-image');
    document.getElementById('bg-pattern').style.display = 'block';
  }
}

function handleImageUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    alert('A imagem deve ter no máximo 5 MB.');
    return;
  }
  // Mostra preview local imediato no admin
  const reader = new FileReader();
  reader.onload = (e) => {
    showBgPreview(e.target.result);
    applyBgToForm(e.target.result);
    // Instrui o admin sobre o próximo passo
    alert('Prévia aplicada! Para que a imagem apareça para todos os convidados, faça o upload do arquivo como "background.jpg" (ou .png) diretamente no seu repositório do GitHub.');
  };
  reader.readAsDataURL(file);
}

function removeImage() {
  document.getElementById('bg-file').value = '';
  document.getElementById('preview-img').src = '';
  document.getElementById('upload-preview').style.display = 'none';
  document.getElementById('upload-zone').style.display = 'block';
  localStorage.removeItem(BG_KEY);
  applyBgToForm(null);
}

/* ---------- ADMIN: SENHA ---------- */

function salvarSenha() {
  const atual = document.getElementById('pwd-atual').value;
  const nova = document.getElementById('pwd-nova').value;
  const conf = document.getElementById('pwd-conf').value;
  const msg = document.getElementById('pwd-msg');

  if (atual !== adminPwd) {
    msg.style.color = '#dc2626';
    msg.textContent = 'Senha atual incorreta.';
    return;
  }
  if (nova.length < 6) {
    msg.style.color = '#dc2626';
    msg.textContent = 'A nova senha deve ter ao menos 6 caracteres.';
    return;
  }
  if (nova !== conf) {
    msg.style.color = '#dc2626';
    msg.textContent = 'As senhas não coincidem.';
    return;
  }

  adminPwd = nova;
  localStorage.setItem(PWD_KEY, adminPwd);
  msg.style.color = '#059669';
  msg.textContent = 'Senha alterada com sucesso!';
  document.getElementById('pwd-atual').value = '';
  document.getElementById('pwd-nova').value = '';
  document.getElementById('pwd-conf').value = '';
}

/* ---------- UTILITÁRIOS ---------- */

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function showToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1D9E75;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;font-family:inherit;z-index:999;box-shadow:0 4px 12px rgba(0,0,0,0.2);';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

/* ---------- INICIALIZAÇÃO E LISTENERS ---------- */

document.addEventListener('DOMContentLoaded', () => {
  renderPublicForm();

  // carrega imagem de fundo do repositório (funciona em qualquer dispositivo)
  carregarImagemDoRepositorio();

  // botões do formulário público
  document.getElementById('cbtn-sim').addEventListener('click', () => setConfirm(true));
  document.getElementById('cbtn-nao').addEventListener('click', () => setConfirm(false));
  document.getElementById('pub-submit-btn').addEventListener('click', enviarFormulario);
  document.getElementById('retry-btn').addEventListener('click', enviarFormulario);

  // admin: abrir/fechar
  document.getElementById('open-admin-btn').addEventListener('click', openAdminLogin);
  document.getElementById('close-admin-btn').addEventListener('click', closeAdmin);
  document.getElementById('login-submit-btn').addEventListener('click', doLogin);
  document.getElementById('login-cancel-btn').addEventListener('click', closeLogin);
  document.getElementById('login-pwd').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin();
  });

  // admin: abas
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // admin: textos
  document.getElementById('save-textos-btn').addEventListener('click', salvarTextos);

  // admin: conexão (webhook)
  document.getElementById('save-webhook-btn').addEventListener('click', salvarWebhook);

  // admin: imagem de fundo
  document.getElementById('upload-zone').addEventListener('click', () => {
    document.getElementById('bg-file').click();
  });
  document.getElementById('bg-file').addEventListener('change', (e) => handleImageUpload(e.target));
  document.getElementById('remove-img-btn').addEventListener('click', removeImage);

  // admin: senha
  document.getElementById('save-pwd-btn').addEventListener('click', salvarSenha);
});
