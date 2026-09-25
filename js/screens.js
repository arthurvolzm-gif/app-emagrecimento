/* =========================================================
   TELAS — cada função devolve o HTML de uma tela
   ========================================================= */

const Telas = {

  /* ============ INÍCIO (dashboard) ============ */
  inicio() {
    const p = Store.db.perfil;
    const t = Store.totaisDoDia();
    const nv = Store.nivel();
    const ms = Store.metasSemana();
    const streak = Store.streak();

    const pctKcal = Math.min(100, Math.round((t.kcal / p.meta_kcal) * 100));
    const pctAgua = Math.min(100, Math.round((t.agua / p.meta_agua) * 100));
    const pctSono = Math.min(100, Math.round((t.sono / p.meta_sono) * 100));
    const treinoHoje = App.treinoDeHoje();

    return `
      <div class="topo">
        <div>
          <div class="topo-saud">${App.saudacao()}</div>
          <div class="topo-nome display">
            ${p.nome.split(' ')[0]}
            ${streak > 0 ? `<span class="streak-badge" title="${streak} ${streak === 1 ? 'dia seguido' : 'dias seguidos'} ativo">🔥 ${streak}</span>` : ''}
          </div>
        </div>
        <button class="sino-btn" onclick="App.ir('notificacoes')" aria-label="Notificações">
          ${Ic.sino(21)}
          ${Notif.naoLidas().length ? `<span class="sino-bolha">${Notif.naoLidas().length}</span>` : ''}
        </button>
      </div>

      <div class="tela stagger">

        ${Store.resumoPendente() ? Telas._chamadaResumo() : ''}
        ${Telas._perdidas()}

        <div class="card nivel-card">
          <div class="nivel-topo">
            <div>
              <div class="nivel-n">Nível ${nv.n}</div>
              <div class="nivel-nome">${nv.nome}</div>
            </div>
            <div class="nivel-pts">
              <b>${nv.pontos}</b>
              <span>pontos</span>
            </div>
          </div>
          <div class="nivel-barra"><i style="width:${nv.pct}%"></i></div>
          <div class="nivel-falta">${nv.proximo
            ? `Faltam <b>${nv.faltam} pontos</b> para ${nv.proximo.nome}`
            : 'Nível máximo alcançado. Você chegou lá.'}</div>
        </div>

        <div class="card">
          <div class="card-tt">${Ic.alvo(20)} Meta de hoje</div>
          <div class="anel-wrap">
            ${Comp.anel(pctKcal, t.kcal, 'kcal')}
            <div class="anel-info">
              <div class="meta-grande">Meta diária</div>
              <div class="meta-val">${p.meta_kcal} kcal</div>
              <div class="mini-stat"><span class="k">Proteína</span><span class="v">${t.prot}g <small style="color:var(--cinza-c)">/ ${p.meta_prot}g</small></span></div>
              <div class="mini-stat"><span class="k">Refeições</span><span class="v">${t.refeicoes}/${t.refeicoesTotal}</span></div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-tt">${Ic.barras(20)} Metas do dia</div>

          <div class="meta-linha">
            <div class="meta-ic agua">${Ic.gota(21)}</div>
            <div class="meta-corpo">
              <div class="meta-topo">
                <span class="meta-nome">Água</span>
                <span class="meta-num ${t.agua >= p.meta_agua ? '' : 'pendente'}">${(t.agua/1000).toFixed(1)}L / ${(p.meta_agua/1000).toFixed(1)}L</span>
              </div>
              <div class="barra azul"><i style="width:${pctAgua}%"></i></div>
            </div>
            <button class="btn-mini" onclick="App.agua(-250)">−</button>
            <button class="btn-mini" onclick="App.agua(250)">+</button>
          </div>

          <div class="meta-linha">
            <div class="meta-ic sono">${Ic.lua(21)}</div>
            <div class="meta-corpo">
              <div class="meta-topo">
                <span class="meta-nome">Sono</span>
                <span class="meta-num ${t.sono >= p.meta_sono ? '' : 'pendente'}">${t.sono ? t.sono + 'h' : '—'} / ${p.meta_sono}h</span>
              </div>
              <div class="barra roxo"><i style="width:${pctSono}%"></i></div>
            </div>
            <button class="btn-mini" onclick="App.abrirSono()">${Ic.lapis(17)}</button>
          </div>

          <div class="meta-linha">
            <div class="meta-ic treino">${Ic.halter(21)}</div>
            <div class="meta-corpo">
              <div class="meta-topo">
                <span class="meta-nome">${treinoHoje.descanso ? 'Dia de descanso' : 'Treino: ' + treinoHoje.foco}</span>
                <span class="meta-num ${t.treino ? '' : 'pendente'}">${t.treino ? 'Concluído' : (treinoHoje.descanso ? 'Livre' : 'Pendente')}</span>
              </div>
              <div class="barra"><i style="width:${t.treino ? 100 : 0}%"></i></div>
            </div>
            ${treinoHoje.descanso || t.treino ? '' : `<button class="btn-mini cheio" onclick="App.marcarTreino()">${Ic.visto(17)}</button>`}
          </div>
        </div>

        ${Telas._semana(ms)}

        <h3 class="secao-tt">Continuar de onde parou</h3>
        <div class="card" style="padding:0;overflow:hidden">
          ${Comp.atalho(Ic.talher(19), 'Alimentação de hoje', `${t.marcados} de ${t.total} alimentos marcados`, 'alimentacao')}
          ${Comp.atalho(Ic.halter(19), treinoHoje.descanso ? 'Dia de descanso' : treinoHoje.foco, treinoHoje.descanso ? 'Aproveite para recuperar' : `${treinoHoje.exercicios.length} exercícios hoje`, 'treinos')}
          ${Comp.atalho(Ic.barras(19), 'Seu progresso', 'Resumo da semana e do mês', 'progresso', true)}
        </div>
      </div>`;
  },

  /* ============ ALIMENTAÇÃO ============ */
  /* ---------- dia fora da rotina ----------
     Aniversário, viagem, almoço de domingo. Sem isso a pessoa não marca
     nada, vê o dia vazio e se sente fracassada, e é aí que desinstala.

     Encolhido por padrão, como as refeições: abre na seta. Vale uma vez
     por semana (Store.podeForaDaRotina). */
  _foraDaRotina() {
    const marcadoHoje = Store.foraDaRotina();
    const usadoEm = Store.foraDaRotinaNaSemana();
    const jaFoi = usadoEm && usadoEm !== Store.hoje();
    const aberta = App.foraAberta;

    return `
      <div class="ref fora-ref ${aberta ? 'aberta' : ''}">
        <div class="ref-cab" onclick="App.abrirFora()">
          <div class="ref-ic">${Ic.festa(21)}</div>
          <div>
            <div class="ref-nome">Dia fora da rotina</div>
            <div class="ref-meta">${marcadoHoje
              ? 'Ativo hoje · conta como cumprido'
              : jaFoi
                ? 'Já usado em ' + App.dataCurta(usadoEm)
                : 'Uma vez por semana'}</div>
          </div>
          <div class="ref-dir">
            ${marcadoHoje ? `<div class="ref-prog">✓ Hoje</div>` : ''}
          </div>
          <div class="ref-seta">▾</div>
        </div>

        <div class="ref-corpo">
          <p class="fora-txt">Marcando esta opção, você fica livre para se alimentar fora da dieta. E o dia já entra como cumprido nas metas.</p>
          <p class="fora-aviso">Atenção: essa opção só poderá ser marcada uma vez por semana.</p>

          ${marcadoHoje
            ? `<button class="btn sec" onclick="App.marcarForaDaRotina()">Desmarcar: hoje é um dia normal</button>`
            : jaFoi
              ? `<button class="btn" disabled>Usar Hoje</button>
                 <p class="fora-bloqueado">Você já usou esta semana, em ${App.dataCurta(usadoEm)}. Libera de novo na segunda.</p>`
              : `<button class="btn" onclick="App.marcarForaDaRotina()">Usar Hoje</button>`}
        </div>
      </div>`;
  },

  /* ---------- sua semana ----------
     Sete bolinhas que enchem e reiniciam no domingo, no lugar da
     sequência que zerava. Dia fora da rotina conta como cumprido e
     aparece em azul: é uma escolha, não uma falha. */
  _semana(ms) {
    const sp = Store.semanaPerfeita();
    const plano = Store.planoTreino();
    const alvo = Number(String(plano.frequencia).match(/\d+/)?.[0]) || 5;

    return `
      <div class="card">
        <div class="card-tt">${Ic.calendario(20)} Sua semana<span class="n">${sp.feitos} de 7 dias</span></div>
        <div class="sem-fila">
          ${sp.dias.map((d, i) => `
            <div class="sem-dia ${d.fora ? 'fora' : d.ativo ? 'on' : ''} ${d.hoje ? 'hoje' : ''} ${d.futuro ? 'futuro' : ''}">
              <span class="b">${d.fora ? '~' : d.ativo ? '✓' : ''}</span>
              <span class="d">${['S','T','Q','Q','S','S','D'][i]}</span>
            </div>`).join('')}
        </div>
        <p class="sem-txt">
          ${sp.feitos >= sp.passados
            ? 'Semana limpa até aqui. A contagem reinicia toda segunda.'
            : `Faltou marcar ${sp.passados - sp.feitos} ${sp.passados - sp.feitos === 1 ? 'dia' : 'dias'}. Sem problema: a semana reinicia na segunda e o que passou não conta contra você.`}
        </p>
        <div class="sem-nums">
          <div><b>${ms.treino}<small>/${alvo}</small></b><span>Treinos</span></div>
          <div><b>${ms.dieta}<small>/7</small></b><span>Dietas completas</span></div>
          <div><b>${ms.agua}<small>/7</small></b><span>Metas de água</span></div>
        </div>
      </div>`;
  },

  /* o que o lembrete não conseguiu avisar com o app fechado: ao voltar,
     mostra as refeições que já passaram e não foram marcadas */
  _perdidas() {
    if (!Lembretes.ligado()) return '';
    const l = Lembretes.perdidasHoje();
    if (!l.length) return '';
    return `
      <button class="card perdidas" onclick="App.ir('alimentacao')">
        <span class="fb-ic">${Ic.sino(21)}</span>
        <div>
          <div class="fb-t">${l.length === 1 ? '1 refeição ainda sem marcar' : `${l.length} refeições ainda sem marcar`}</div>
          <div class="fb-s">${l.map(r => r.nome).join(', ')}</div>
        </div>
        <span class="lista-seta">›</span>
      </button>`;
  },

  /* chamada do resumo de domingo, no topo da tela inicial */
  _chamadaResumo() {
    return `
      <button class="card resumo-chamada" onclick="App.ir('resumo')">
        <span class="rc-ic">${Ic.barras(21)}</span>
        <div>
          <div class="rc-t">Sua semana fechou</div>
          <div class="rc-s">Veja o que você bateu e o foco da próxima</div>
        </div>
        <span class="lista-seta">›</span>
      </button>`;
  },

  /* ---------- resumo da semana (domingo) ----------
     Fecha o ciclo e dá motivo pra abrir o app num dia em que ninguém
     treina. Sem número inventado: tudo sai do que foi registrado. */
  resumo() {
    const r = Store.resumoDaSemana();
    const p = Store.db.perfil;

    return `
      <div class="topo">
        <div>
          <h1 class="display">Sua semana</h1>
          <div class="topo-sub">Fechamento de domingo, ${p.nome.split(' ')[0]}</div>
        </div>
      </div>

      <div class="tela stagger">
        <div class="card res-abre">
          <div class="res-n display">${r.diasAtivos}<small>/7</small></div>
          <div class="res-l">dias em que você apareceu</div>
          ${r.variacao !== null ? `
            <div class="res-peso ${r.variacao < 0 ? 'bom' : ''}">
              ${r.variacao < 0 ? '−' : '+'}${Math.abs(r.variacao)} kg na balança esta semana
            </div>` : `
            <div class="res-peso">Sem pesagem esta semana. Registre uma no domingo e a próxima já compara.</div>`}
        </div>

        ${r.bateu.length ? `
          <h3 class="secao-tt">O que você bateu</h3>
          <div class="card">
            ${r.bateu.map(i => `
              <div class="lista-item">
                <span class="lista-ic">${i.ic}</span>
                <div><div class="lista-t">${i.nome}</div></div>
                <span class="lista-v" style="color:var(--verde-esc)">${i.feito} de ${i.alvo}</span>
              </div>`).join('')}
          </div>` : ''}

        ${r.escapou.length ? `
          <h3 class="secao-tt">O que escapou</h3>
          <div class="card">
            ${r.escapou.map(i => `
              <div class="res-linha">
                <div class="lista-item" style="border:none;padding:0 0 8px">
                  <span class="lista-ic">${i.ic}</span>
                  <div><div class="lista-t">${i.nome}</div></div>
                  <span class="lista-v">${i.feito} de ${i.alvo}</span>
                </div>
                <div class="barra"><i style="width:${i.pct}%"></i></div>
              </div>`).join('')}
          </div>` : ''}

        <h3 class="secao-tt">Foco da próxima semana</h3>
        <div class="card res-foco">
          <div class="rf-t">${r.focoNome}</div>
          <p class="rf-txt">${r.foco}</p>
        </div>

        <button class="btn" onclick="App.fecharResumo()">Começar a semana</button>
      </div>`;
  },

  /* ---------- fotos de progresso ----------
     A balança mente mais que o espelho: água, ciclo e intestino movem o
     número sem mover o corpo. Uma foto por semana, no mesmo lugar, é o
     que segura quem ia cancelar na terceira semana.
     Tudo em IndexedDB, só neste aparelho — ver js/fotos.js.
     A tela é montada de forma assíncrona (App.abrirFotos): aqui fica só
     o esqueleto, que App.pintarFotos preenche quando o banco responde. */
  fotos() {
    return `
      <div class="topo">
        <div>
          <h1 class="display">Suas fotos</h1>
          <div class="topo-sub">Só neste aparelho, nunca enviadas</div>
        </div>
        <button class="btn-mini" style="width:40px;height:40px" onclick="App.ir('progresso')">✕</button>
      </div>

      <div class="tela">
        <div class="card foto-add">
          <div class="card-tt">${Ic.camera(20)} Foto da semana</div>
          <p class="foto-txt">
            Tire sempre no mesmo lugar, com a mesma luz e a mesma roupa. É a
            repetição que faz a diferença aparecer.
          </p>
          <label class="btn foto-label">
            ${Ic.camera(18)} Tirar foto agora
            <input type="file" accept="image/*" capture="environment"
                   onchange="App.salvarFoto(this)" hidden>
          </label>
          <label class="btn sec foto-label foto-galeria">
            ${Ic.prancheta(18)} Escolher da galeria
            <input type="file" accept="image/*"
                   onchange="App.salvarFoto(this)" hidden>
          </label>
          <p class="foto-aviso">
            🔒 As fotos ficam guardadas só neste celular. Não vão para a nuvem,
            não entram no backup da conta e ninguém além de você vê.
          </p>
        </div>

        <div id="foto-lista"><div class="rev-vazio">Carregando…</div></div>
      </div>`;
  },

  /* montado por App.pintarFotos com o que veio do IndexedDB */
  _fotosConteudo(lista, urls) {
    if (!lista.length) return `
      <div class="card">
        <div class="rev-vazio">
          <div class="em">${Ic.camera(34)}</div>
          <p>Nenhuma foto ainda.<br>A primeira é a mais importante: é com ela que<br>todas as outras vão ser comparadas.</p>
        </div>
      </div>`;

    const primeira = lista[0], ultima = lista[lista.length - 1];
    const comparar = lista.length >= 2;

    return `
      ${comparar ? `
        <h3 class="secao-tt">Primeira e mais recente</h3>
        <div class="card foto-par">
          <figure>
            <img src="${urls[primeira.data]}" alt="Primeira foto">
            <figcaption>${App.dataBr(primeira.data)}${primeira.peso ? ` · ${primeira.peso} kg` : ''}</figcaption>
          </figure>
          <figure>
            <img src="${urls[ultima.data]}" alt="Foto mais recente">
            <figcaption>${App.dataBr(ultima.data)}${ultima.peso ? ` · ${ultima.peso} kg` : ''}</figcaption>
          </figure>
        </div>
        ${primeira.peso && ultima.peso ? `
          <p class="foto-dif">${(ultima.peso - primeira.peso) < 0 ? '−' : '+'}${Math.abs(Math.round((ultima.peso - primeira.peso) * 10) / 10)} kg entre as duas</p>` : ''}
      ` : ''}

      <h3 class="secao-tt">Todas as fotos</h3>
      <div class="foto-grade">
        ${lista.slice().reverse().map(f => `
          <figure class="foto-item">
            <img src="${urls[f.data]}" alt="Foto de ${App.dataBr(f.data)}">
            <button class="foto-x" onclick="App.apagarFoto('${f.data}')" aria-label="Apagar">✕</button>
            <figcaption>
              <span class="fi-data">${App.dataBr(f.data)}</span>
              ${f.peso ? `<span class="fi-peso">${f.peso} kg</span>` : ''}
            </figcaption>
            <div class="foto-acoes">
              <button onclick="App.baixarFoto('${f.data}')">${Ic.prancheta(16)} Salvar</button>
              <button onclick="App.compartilharFoto('${f.data}')">${Ic.chat(16)} Compartilhar</button>
            </div>
          </figure>`).join('')}
      </div>`;
  },

  /* ---------- boas-vindas ----------
     Camada por cima da tela inicial, que fica escurecida atrás: a tela já
     está montada, mas bloqueada até a pessoa continuar. É a primeira coisa
     que ela vê, e existe principalmente pra ensinar onde fica o suporte —
     quem não acha ajuda no primeiro dia pede reembolso no segundo. */
  boasVindas(p) {
    return `
      <div class="bv-caixa" role="dialog" aria-modal="true" aria-labelledby="bv-tt">
        <div class="bv-marca">${Ic.alvo(26)}</div>
        <h2 class="bv-tt display" id="bv-tt">${App.gen('Bem-vinda', 'Bem-vindo')}, ${p.nome.split(' ')[0]}</h2>
        <p class="bv-txt">
          Seu plano já está montado a partir das suas respostas: o cardápio, o treino
          e as metas do dia. Marque o que for cumprindo e o app acompanha o resto.
        </p>
        <p class="bv-txt">
          <b>Precisa de ajuda?</b> Fale com a gente no WhatsApp pelo botão abaixo. Ele
          fica sempre disponível na aba <b>Perfil</b>, em “Ajuda e suporte”.
        </p>
        <a class="btn sec bv-sup" href="${CONFIG.SUPORTE_WHATS}" target="_blank" rel="noopener">
          ${Ic.chat(19)} Falar com o suporte
        </a>
        <button class="btn" onclick="App.fecharBoasVindas()">Continuar</button>
      </div>`;
  },

  alimentacao() {
    const p = Store.db.perfil;
    const t = Store.totaisDoDia();
    const plano = Store.planoAlimentar();
    const pct = Math.min(100, Math.round((t.kcal / p.meta_kcal) * 100));

    return `
      <div class="topo">
        <div>
          <h1 class="display">Alimentação</h1>
          <div class="topo-sub">Seu cardápio de hoje, montado para a sua meta</div>
        </div>
        ${Telas._btnReceitas()}
      </div>

      <div class="tela stagger">
        <div class="card">
          <div class="meta-topo" style="margin-bottom:10px">
            <span class="meta-nome" style="font-size:15px">${t.kcal} de ${p.meta_kcal} kcal</span>
            <span class="meta-num">${pct}%</span>
          </div>
          <div class="barra" style="height:9px"><i style="width:${pct}%"></i></div>
          <div style="display:flex;gap:18px;margin-top:14px">
            <div><div style="font-size:11px;color:var(--cinza);font-weight:800;text-transform:uppercase;letter-spacing:.05em">Proteína</div>
              <div style="font-family:'Bricolage Grotesque';font-size:19px;font-weight:800;margin-top:3px">${t.prot}<small style="font-size:12px;color:var(--cinza)">g</small></div></div>
            <div><div style="font-size:11px;color:var(--cinza);font-weight:800;text-transform:uppercase;letter-spacing:.05em">Restam</div>
              <div style="font-family:'Bricolage Grotesque';font-size:19px;font-weight:800;margin-top:3px">${Math.max(0, p.meta_kcal - t.kcal)}<small style="font-size:12px;color:var(--cinza)">kcal</small></div></div>
            <div><div style="font-size:11px;color:var(--cinza);font-weight:800;text-transform:uppercase;letter-spacing:.05em">Alimentos</div>
              <div style="font-family:'Bricolage Grotesque';font-size:19px;font-weight:800;margin-top:3px">${t.marcados}<small style="font-size:12px;color:var(--cinza)">/${t.total}</small></div></div>
          </div>
        </div>

        <button class="btn sec" style="margin-bottom:14px" onclick="App.ir('cardapio')">
          ${Ic.prancheta(19)} Ver cardápio completo e lista de compras
        </button>

        ${Telas._foraDaRotina()}

        ${plano.map(r => Telas._refeicao(r)).join('')}

        <p style="font-size:12px;color:var(--cinza-c);line-height:1.55;font-weight:600;text-align:center;margin-top:4px">
          As gramagens são calculadas a partir do seu peso, altura, idade e objetivo.
        </p>
      </div>`;
  },

  /* ============ CARDÁPIO COMPLETO + LISTA DE COMPRAS ============ */
  cardapio() {
    const plano = Store.planoAlimentar();
    const p = Store.db.perfil;
    const compras = Store.listaCompras();
    const verCompras = App.abaCardapio === 'compras';

    const kcalTotal = plano.reduce((s, r) =>
      s + r.alimentos.reduce((x, a) => x + (a.opcional ? 0 : a.kcal), 0), 0);

    return `
      <div class="topo">
        <div>
          <h1 class="display">Cardápio</h1>
          <div class="topo-sub">${verCompras
            ? 'Quantidades para 7 dias, já somadas'
            : App.rotuloObjetivo() + ' · ' + kcalTotal + ' kcal por dia'}</div>
        </div>
        <button class="btn-mini" style="width:40px;height:40px" onclick="App.ir('alimentacao')">✕</button>
      </div>

      <div class="tela">
        <div class="toggle">
          <button class="${!verCompras ? 'on' : ''}" onclick="App.setAbaCardapio('cardapio')">Cardápio</button>
          <button class="${verCompras ? 'on' : ''}" onclick="App.setAbaCardapio('compras')">Compras</button>
        </div>

        ${verCompras ? `
          <div class="aviso">
            Lista baseada no seu cardápio, multiplicada por 7 dias. Ajuste conforme as trocas que você costuma fazer.
          </div>

          <div class="card">
            ${compras.map(item => {
              const idx = item.trocadoDe ? Store.indiceTrocavel(item.trocadoDe) : Store.indiceTrocavel(item.nome);
              return `
                <div class="compra-item">
                  <div style="flex:1;min-width:0">
                    <div class="ci-nome">${item.nome}</div>
                    ${item.trocadoDe ? `<div class="ci-sub">no lugar de ${item.trocadoDe}</div>` : ''}
                  </div>
                  ${idx >= 0 ? `<button class="ci-troca" onclick="App.abrirTroca(${idx})">trocar</button>` : ''}
                  <span class="ci-qtd">${item.texto}</span>
                </div>`;
            }).join('')}
          </div>

          <p style="font-size:12px;color:var(--cinza-c);line-height:1.55;font-weight:600;text-align:center">
            Itens "à vontade" são saladas e legumes: compre o que você gosta,<br>sem precisar pesar.
          </p>
        ` : `
          ${plano.map(r => {
            const kcalRef = r.alimentos.reduce((s, a) => s + (a.opcional ? 0 : a.kcal), 0);
            return `
              <div class="card">
                <div class="card-tt">${Ic.refeicao(r.id, 20)} ${r.nome} · ${r.horario}<span class="n">${kcalRef} kcal</span></div>
                ${r.variacao ? `<div class="var-nome">${r.variacao}</div>` : ''}
                ${r.alimentos.map(a => `
                  <div class="cardapio-item ${a.opcional ? 'opc' : ''}">
                    <div style="flex:1;min-width:0">
                      <div class="cai-nome">${a.nome}${a.opcional ? ' <span class="tag-opc">opcional</span>' : ''}</div>
                      <div class="cai-det">
                        ${a.trocado ? `no lugar de ${a.nomeOriginal}` : (/vontade|se quiser/i.test(a.un) ? a.un : a.g + 'g · ' + a.un)}
                      </div>
                      ${Array.isArray(a.alt) && a.alt.length ? Comp.botaoTroca(a) : ''}
                    </div>
                    <div class="cai-kcal">${a.kcal}<span>kcal</span></div>
                  </div>`).join('')}
              </div>`;
          }).join('')}
        `}
      </div>`;
  },

  _refeicao(r) {
    const [m, total] = Store.progressoRefeicao(r);
    const kcalRef = r.alimentos.reduce((s, a) => s + a.kcal, 0);
    const aberta = App.refAberta === r.id;
    const completa = m === total;

    return `
      <div class="ref ${aberta ? 'aberta' : ''}">
        <div class="ref-cab" onclick="App.abrirRef('${r.id}')">
          <div class="ref-ic">${Ic.refeicao(r.id, 21)}</div>
          <div style="flex:1;min-width:0">
            <div class="ref-nome">${r.nome}</div>
            <div class="ref-meta">${r.variacao ? r.variacao : r.horario + ' · ' + total + ' alimentos'}</div>
          </div>
          <div class="ref-dir">
            <div class="ref-kcal">${kcalRef}<span> kcal</span></div>
            <div class="ref-prog ${m === 0 ? 'zero' : ''}">${completa ? '✓ Completa' : m + '/' + total}</div>
          </div>
          <div class="ref-seta">▾</div>
        </div>

        <div class="ref-corpo">
          ${r.alimentos.map(a => {
            const feito = Store.alimentoMarcado(r.id, a.id);
            const trocas = Array.isArray(a.alt) ? a.alt : (a.alt ? [a.alt] : []);
            return `
              <div class="alim ${feito ? 'feito' : ''} ${a.opcional ? 'opcional' : ''}" onclick="App.marcarAlimento('${r.id}','${a.id}')">
                <div class="check">${feito ? '✓' : ''}</div>
                <div class="alim-corpo">
                  <div class="alim-nome">
                    ${a.nome}
                    ${a.opcional ? '<span class="tag-opc">opcional</span>' : ''}
                  </div>
                  <div class="alim-det">
                    ${a.trocado ? `no lugar de ${a.nomeOriginal}` : (/vontade|se quiser/i.test(a.un) ? a.un : a.g + 'g · ' + a.un)}
                  </div>
                  ${trocas.length ? Comp.botaoTroca(a) : ''}
                </div>
                <div class="alim-kcal">${a.kcal}<span>${a.prot}g prot</span></div>
              </div>`;
          }).join('')}

          <div class="ref-acoes">
            <button class="btn-ref p" onclick="event.stopPropagation();App.refeicaoToda('${r.id}',true)">Marcar tudo</button>
            <button class="btn-ref" onclick="event.stopPropagation();App.refeicaoToda('${r.id}',false)">Limpar</button>
          </div>
        </div>
      </div>`;
  },

  /* ============ TREINOS ============ */
  /* ============ NOTIFICAÇÕES ============
     A caixa do sininho. Tudo aqui sai de fato que já aconteceu nos
     dados dela (ver js/notificacoes.js) — caixa que vira mural de
     propaganda a pessoa aprende a ignorar, e aí a notificação de
     verdade também não é lida.                                     */
  notificacoes() {
    const lista = Notif.lista();
    const lidas = Notif.lidas();

    return `
      <div class="topo">
        <div>
          <h1 class="display">Notificações</h1>
          <div class="topo-sub">${lista.length ? Notif.naoLidas().length + ' sem ler' : 'Tudo em dia'}</div>
        </div>
        <button class="btn-mini" style="width:40px;height:40px" onclick="App.ir('inicio')">✕</button>
      </div>

      <div class="tela stagger">
        ${lista.length ? lista.map(n => {
          const lida = lidas.indexOf(n.id) >= 0;
          return `
          <div class="notif ${n.tom} ${lida ? 'lida' : ''}">
            <div class="notif-ic">${(Ic[n.ic] || Ic.sino)(20)}</div>
            <div class="notif-txt">
              <div class="notif-t">${n.titulo}</div>
              <div class="notif-s">${n.texto}</div>
              <button class="notif-acao" onclick="Notif.marcarLida('${n.id}');${n.acao}">${n.rotulo} ›</button>
            </div>
            ${lida ? '' : '<span class="notif-ponto"></span>'}
          </div>`;
        }).join('') : `
          <div class="vazio">
            <div class="em">${Ic.sino(34)}</div>
            <p>Nada por aqui.<br>A gente só avisa quando tem motivo.</p>
          </div>`}

        ${Notif.naoLidas().length ? `
          <button class="btn sec" style="margin-top:6px" onclick="App.lerTodasNotif()">Marcar todas como lidas</button>` : ''}
      </div>`;
  },

  /* ============ REAJUSTE MENSAL ============
     A virada de mês. Aparece uma vez por mês, no primeiro acesso, e
     mostra o que mudou no plano dela e por quê.

     Todo número aqui sai de dado que ela mesma registrou: as pesagens,
     a meta recalculada, a fase do treino. Nada inventado — é o que
     torna a tela uma prova de que a assinatura está viva, em vez de
     mais uma notificação.                                            */
  reajuste() {
    const r = App.reajusteDados;
    if (!r) return '';
    const p = Store.db.perfil;
    const nome = (p.nome || '').split(' ')[0];
    const perdeu = r.difPeso < 0;

    /* usa o `liberado` já decidido no fechamento deste mês (r.agora.liberado),
       não uma nova chamada a Store.reajusteLiberado(): a essa altura o
       retrato deste mês já foi empilhado em Store.reajustes(), e chamar de
       novo mudaria a resposta bem no mês em que ela é grátis (o primeiro),
       trancando a tela que deveria estar liberada. */
    if (!r.agora.liberado) return this._reajusteTrancado(r, nome, perdeu);

    return `
      <div class="tela-login tela-reajuste">
        <div class="login-content">
          <div class="reaj-selo">Plano de ${r.mesNome}</div>
          <h1 class="login-h1 esq">${nome ? nome + ', seu' : 'Seu'} plano foi reajustado</h1>
          <p class="login-sub esq">${r.primeiro
            ? (CONFIG.CHECKOUT_URL_REAJUSTE
                ? 'Todo mês o app refaz as suas contas com o que você registrou. Este primeiro reajuste é por nossa conta.'
                : 'Todo mês o app refaz as suas contas com o que você registrou.')
            : 'Refizemos as contas com o que você registrou desde o mês passado.'}</p>

          ${r.primeiro && CONFIG.CHECKOUT_URL_REAJUSTE ? `
            <div class="reaj-card" style="background:var(--ambar-tint);border-color:var(--ambar-borda)">
              <div class="reaj-rot" style="color:var(--ambar-tx)">A partir do mês que vem</div>
              <div class="reaj-nota">Esse reajuste saiu grátis só desta vez, pra você ver o que muda. Do próximo mês em diante, continuar reajustando o plano custa ${CONFIG.PRECO_REAJUSTE || 'R$9,90'}/mês.</div>
            </div>` : ''}

          ${r.difPeso !== 0 ? `
            <div class="reaj-card destaque">
              <div class="reaj-rot">Seu peso</div>
              <div class="reaj-linha">
                <span class="de">${r.antes.peso} kg</span>
                <span class="seta">→</span>
                <span class="para">${r.agora.peso} kg</span>
              </div>
              <div class="reaj-nota ${perdeu ? 'bom' : ''}">${perdeu
                ? Math.abs(r.difPeso) + ' kg a menos que no último reajuste.'
                : r.difPeso + ' kg a mais. Acontece, e o plano já se ajustou a isso.'}</div>
            </div>` : `
            <div class="reaj-card">
              <div class="reaj-rot">Seu peso</div>
              <div class="reaj-linha"><span class="para">${r.agora.peso} kg</span></div>
              <div class="reaj-nota">Sem mudança desde o último reajuste. ${Store.db.pesagens.length < 2
                ? 'Registre a pesagem mais vezes pro app acertar melhor as suas contas.'
                : 'O plano segue calibrado no mesmo ponto.'}</div>
            </div>`}

          <div class="reaj-card">
            <div class="reaj-rot">Sua meta de calorias</div>
            <div class="reaj-linha">
              ${r.difKcal !== 0 ? `<span class="de">${r.antes.meta_kcal} kcal</span><span class="seta">→</span>` : ''}
              <span class="para">${r.agora.meta_kcal} kcal</span>
            </div>
            <div class="reaj-nota">${r.difKcal === 0
              ? 'Continua na mesma, porque o seu peso e os seus dados não mudaram.'
              : (r.difKcal < 0
                ? Math.abs(r.difKcal) + ' kcal a menos. Corpo mais leve gasta menos, então a conta acompanha.'
                : '+' + r.difKcal + ' kcal. A sua meta subiu junto com os seus números.')}</div>
          </div>

          ${r.pctPorcao !== 0 ? `
            <div class="reaj-card">
              <div class="reaj-rot">O seu cardápio</div>
              <div class="reaj-linha"><span class="para">${r.pctPorcao > 0 ? '+' : ''}${r.pctPorcao}%</span></div>
              <div class="reaj-nota">As gramagens de todas as refeições já foram ajustadas. Abra a aba Comida e confira: os pesos estão diferentes dos do mês passado.</div>
            </div>` : ''}

          <div class="reaj-card">
            <div class="reaj-rot">Seu treino agora é fase ${r.fase.n}</div>
            <div class="reaj-linha">
              ${r.faseAntes.nome !== r.fase.nome ? `<span class="de">${r.faseAntes.nome}</span><span class="seta">→</span>` : ''}
              <span class="para">${r.fase.nome}</span>
            </div>
            <div class="reaj-nota">${r.fase.detalhe}</div>
            <div class="reaj-fases">
              ${FASES_TREINO.map(f => `<span class="${f.n === r.fase.n ? 'on' : ''}">${f.n}</span>`).join('')}
            </div>
            <div class="reaj-nota" style="margin-top:10px">Os exercícios continuam os mesmos de propósito: é assim que você enxerga a carga subindo. O que muda é o estímulo.</div>
          </div>

          ${this._reajusteCargas()}

          <button class="login-btn" style="margin-top:22px" onclick="App.fecharReajuste()">Ver meu plano de ${r.mesNome}</button>
          <div class="reaj-card" style="margin-top:14px">
            <div class="reaj-rot">Quer mudar alguma coisa?</div>
            <div class="reaj-nota">Se esse reajuste não fez sentido pra você, ou se quiser ajustar algo na mão, é só chamar o suporte.</div>
            <a class="btn sec" style="margin-top:14px" href="${CONFIG.SUPORTE_WHATS}" target="_blank" rel="noopener">Falar com o suporte</a>
          </div>
        </div>
      </div>`;
  },

  /* ---------- a versão trancada (R$9,90/mês) ----------
     Mostra o que é DELA de graça (o peso que ela mesma registrou e há
     quanto tempo o plano está parado) e tranca o que a assinatura
     entrega: as metas recalculadas, a fase nova do treino e as cargas.

     O que NÃO está aqui, de propósito: nada que ela já tinha. As
     calorias e as gramagens do cardápio seguem se reajustando a cada
     pesagem pra todo mundo. Tirar isso de quem não paga seria piorar
     o produto que ela já comprou, e vira cancelamento.             */
  _reajusteTrancado(r, nome, perdeu) {
    const naLoja = window.NO_APP_DA_LOJA;
    const dias = Store.diasSemReajuste();

    return `
      <div class="tela-login tela-reajuste">
        <div class="login-content">
          <div class="reaj-selo">Virada de ${r.mesNome}</div>
          <h1 class="login-h1 esq">${nome ? nome + ', seu' : 'Seu'} plano pode ser reajustado</h1>
          <p class="login-sub esq">Você está há ${Store.frasedias(dias)} com o mesmo plano. O seu corpo mudou desde que ele foi montado.</p>

          ${r.difPeso !== 0 ? `
            <div class="reaj-card destaque">
              <div class="reaj-rot">Seu peso</div>
              <div class="reaj-linha">
                <span class="de">${r.antes.peso} kg</span>
                <span class="seta">→</span>
                <span class="para">${r.agora.peso} kg</span>
              </div>
              <div class="reaj-nota ${perdeu ? 'bom' : ''}">${perdeu
                ? Math.abs(r.difPeso) + ' kg a menos. Isso muda as contas do seu plano.'
                : r.difPeso + ' kg a mais desde o último reajuste.'}</div>
            </div>` : ''}

          <div class="reaj-card trancado">
            <div class="reaj-cad">${Ic.cadeado(24)}</div>
            <div class="reaj-rot">O que o reajuste faz</div>
            <div class="reaj-item">${Ic.alvo(18)}<div><b>Recalcula as suas metas</b> com o peso de hoje, não com o de quando você começou.</div></div>
            <div class="reaj-item">${Ic.halter(18)}<div><b>Evolui o seu treino de fase</b>: volume, intensidade e descanso mudam mês a mês, nos mesmos exercícios.</div></div>
            <div class="reaj-item">${Ic.barras(18)}<div><b>Diz quais cargas subir</b>, exercício por exercício, a partir do que você registrou.</div></div>
            <div class="reaj-item">${Ic.calendario(18)}<div><b>Um relatório todo mês</b> mostrando o que mudou e por quê.</div></div>
          </div>

          ${naLoja ? `
            <div class="reaj-card">
              <div class="reaj-rot">Como liberar</div>
              <div class="reaj-nota">O reajuste mensal não faz parte do seu plano atual. Fale com o suporte que a gente te explica.</div>
              <a class="btn sec" style="margin-top:14px" href="${CONFIG.SUPORTE_WHATS}" target="_blank" rel="noopener">Falar com o suporte</a>
            </div>
          ` : `
            <div class="reaj-card preco">
              ${CONFIG.CHECKOUT_URL_REAJUSTE_ANUAL ? `
                <div class="reaj-planos">
                  <button class="reaj-plano destaque" onclick="App.comprarReajuste('anual')">
                    <span class="selo">Economize 2 meses</span>
                    <span class="v">${CONFIG.PRECO_REAJUSTE_ANUAL || 'R$97'}<small>/ano</small></span>
                    <span class="s">Sai por R$8,08 por mês</span>
                  </button>
                  <button class="reaj-plano" onclick="App.comprarReajuste('mensal')">
                    <span class="v">${CONFIG.PRECO_REAJUSTE || 'R$9,90'}<small>/mês</small></span>
                    <span class="s">Cancele quando quiser</span>
                  </button>
                </div>
                <div class="reaj-val-sub" style="margin:14px 0 0">O seu plano atual continua funcionando do mesmo jeito.</div>
              ` : `
                <div class="reaj-val">${CONFIG.PRECO_REAJUSTE || 'R$9,90'}<span>/mês</span></div>
                <div class="reaj-val-sub">Cancele quando quiser. O seu plano atual continua funcionando do mesmo jeito.</div>
                <button class="login-btn" onclick="App.comprarReajuste('mensal')">Liberar o reajuste mensal</button>
              `}
              <button class="corrida-japaguei" onclick="App.verificarReajuste()">Já paguei, liberar meu acesso</button>
            </div>
          `}

          <button class="reaj-depois" onclick="App.fecharReajuste()">Agora não, continuar com o plano atual</button>
        </div>
      </div>`;
  },

  /* as cargas que já dá pra subir, tiradas do histórico dela.
     Só aparece se houver exercício com registro suficiente. */
  _reajusteCargas() {
    const vistos = {};
    Store.planoTreino().dias.forEach(d => {
      if (d.descanso || !d.exercicios) return;
      d.exercicios.forEach(e => {
        if (vistos[e.ex]) return;
        const hist = Store.cargas(e.ex);
        const sug = Store.cargaSugerida(e.ex);
        if (sug) vistos[e.ex] = { atual: hist[hist.length - 1].peso, sug };
      });
    });

    const lista = Object.keys(vistos).slice(0, 5);
    if (!lista.length) return '';

    return `
      <div class="reaj-card">
        <div class="reaj-rot">Dá pra subir a carga</div>
        ${lista.map(ex => `
          <div class="reaj-carga">
            <span class="ex">${ex}</span>
            <span class="v"><b>${vistos[ex].atual}</b> → <b class="alvo">${vistos[ex].sug} kg</b></span>
          </div>`).join('')}
        <div class="reaj-nota" style="margin-top:12px">Sugestão a partir do que você registrou. Se a última série sair sem esforço, suba. Se a execução piorar, fique onde está mais um mês.</div>
      </div>`;
  },

  /* ============ MODO CORRIDA ============
     Registro de corrida: cronômetro, distância, ritmo e calorias.
     Vive dentro da aba Treinos, atrás do botão "Corrida".
     - comprado     -> o painel com o botão de iniciar e o histórico
     - não comprado -> a tela de venda com o preço
     - dentro do app da Play Store -> nem venda nem preço, só o aviso,
       porque o Google não deixa app da loja mandar pagar fora dela. */
  corrida() {
    const liberado = App.temCorrida();
    const r = liberado ? Store.resumoCorridas() : null;

    return `
      <div class="topo">
        <div>
          <h1 class="display">Treinos</h1>
          <div class="topo-sub">${liberado
            ? (r.total ? r.total + (r.total === 1 ? ' corrida registrada' : ' corridas registradas') : 'Modo Corrida')
            : 'Modo Corrida'}</div>
        </div>
        ${Telas._btnBiblioteca()}
      </div>

      <div class="tela stagger">
        ${this._abasTreino()}
        ${liberado ? this._corridaPainel(r) : this._corridaVenda()}
      </div>`;
  },

  /* ---------- painel de quem comprou ---------- */
  _corridaPainel(r) {
    const lista = Store.corridas().slice().reverse();

    return `
      <button class="btn corrida-iniciar" onclick="App.iniciarCorrida()">
        ${Ic.corrida(22)} Iniciar corrida
      </button>

      <div class="grid2" style="margin-top:14px">
        <div class="stat"><div class="ic">${Ic.alvo(19)}</div>
          <div class="n">${App.km(r.metros, 1)}<small>km</small></div>
          <div class="l">Distância total</div></div>
        <div class="stat"><div class="ic">${Ic.lua(19)}</div>
          <div class="n">${App.duracaoCurta(r.segundos)}</div>
          <div class="l">Tempo correndo</div></div>
        <div class="stat"><div class="ic">${Ic.raio(19)}</div>
          <div class="n">${r.melhor ? App.paceTexto(r.melhor) : '--'}<small>/km</small></div>
          <div class="l">Melhor ritmo</div></div>
        <div class="stat"><div class="ic">${Ic.fogo(19)}</div>
          <div class="n">${r.kcal}<small>kcal</small></div>
          <div class="l">Calorias estimadas</div></div>
      </div>

      ${r.semanaQtd ? `
        <div class="card" style="margin-top:14px">
          <div class="card-tt">${Ic.calendario(20)} Esta semana</div>
          <p class="corrida-papel" style="margin:0">${r.semanaQtd} ${r.semanaQtd === 1 ? 'corrida' : 'corridas'} · ${App.km(r.semanaMetros, 1)} km</p>
        </div>` : ''}

      <h3 class="secao-tt">Suas corridas</h3>
      ${lista.length ? `
        <div class="card" style="padding:6px 18px">
          ${lista.slice(0, 20).map(c => `
            <div class="lista-item">
              <span class="lista-ic">${Ic.corrida(19)}</span>
              <div>
                <div class="lista-t">${App.km(c.metros)} km · ${App.duracaoCurta(c.segundos)}</div>
                <div class="lista-s">${App.dataCurta(c.data)} · ${c.ritmo ? App.paceTexto(c.ritmo) + '/km' : 'sem distância'} · ${c.kcal} kcal${c.gps ? '' : ' · distância digitada'}</div>
              </div>
              <button class="corrida-apagar" onclick="App.apagarCorrida('${c.quando}')" aria-label="Apagar">&times;</button>
            </div>`).join('')}
        </div>` : `
        <div class="card"><div class="vazio" style="padding:26px 16px">
          <div class="em">${Ic.corrida(34)}</div>
          <p>Nenhuma corrida ainda.<br>Toque em iniciar e o app conta o resto.</p>
        </div></div>`}

      <p class="corrida-rodape">As calorias são uma estimativa, calculada pelo seu peso e pela intensidade. Sem medir frequência cardíaca não existe número exato.</p>`;
  },

  _abasTreino() {
    return `
      <div class="toggle duas">
        <button class="${App.abaTreinos === 'treino' ? 'on' : ''}" onclick="App.setAbaTreinos('treino')">Treino</button>
        <button class="${App.abaTreinos === 'corrida' ? 'on' : ''}" onclick="App.setAbaTreinos('corrida')">Corrida</button>
      </div>`;
  },

  /* o botão da biblioteca, no canto do cabeçalho de Treinos. Trancado,
     ganha o cadeado e abre a camada de venda em vez da lista.

     ⚠️ TIRADO DO AR POR ENQUANTO, a pedido do usuário: o botão some do
     cabeçalho, mas o resto fica de pé — a rota 'biblioteca', a camada
     de venda, os handlers de compra/verificação. Pra voltar, é só tirar
     o "return '';" abaixo. */
  _btnBiblioteca() {
    return '';

    const trancada = !App.temVideos();
    return `
      <button class="bib-link" onclick="App.abrirBiblioteca()">
        ${trancada ? '🔒 ' : ''}Biblioteca de Exercícios
      </button>`;
  },

  /* ============ BIBLIOTECA DE EXERCÍCIOS ============
     O botão mora no canto do cabeçalho de Treinos, onde sempre esteve.
     Liberada, abre a lista. Trancada, abre esta camada por cima da
     tela, no mesmo formato da mensagem de boas-vindas. */
  bibliotecaCamada() {
    const naLoja = window.NO_APP_DA_LOJA;
    const temLink = !naLoja && CONFIG.CHECKOUT_URL_BIBLIOTECA;

    return `
      <div class="bv-caixa" role="dialog" aria-modal="true" aria-labelledby="bib-tt">
        <div class="bv-marca">${Ic.livro(26)}</div>
        <h2 class="bv-tt display" id="bib-tt">Biblioteca Exercícios</h2>
        <p class="bv-txt" style="text-align:center">
          Os ${BIBLIOTECA.length} exercícios do seu treino com o vídeo da execução,
          pra você ver o movimento antes de fazer.
        </p>

        <div class="bib-razoes">
          <div><span>${Ic.camera(17)}</span><div><b>Ver antes de fazer.</b> Texto explica; vídeo mostra. Postura, amplitude e ritmo você só entende vendo.</div></div>
          <div><span>${Ic.halter(17)}</span><div><b>Direto do seu treino.</b> O botão aparece dentro de cada exercício do dia, sem precisar procurar.</div></div>
          <div><span>${Ic.check(17)}</span><div><b>Pagamento único.</b> Não é mensalidade. Paga uma vez e fica enquanto você for assinante.</div></div>
        </div>

        ${temLink ? `
          <div class="bib-preco">${CONFIG.PRECO_BIBLIOTECA || 'R$9,90'}<span>pagamento único</span></div>
          <button class="btn" onclick="App.comprarBiblioteca()">Liberar a biblioteca</button>
          <button class="corrida-japaguei" onclick="App.verificarBiblioteca()">Já paguei, liberar meu acesso</button>
        ` : `
          <p class="bv-txt" style="text-align:center">
            ${naLoja
              ? 'A biblioteca não faz parte do seu plano atual. Fale com o suporte que a gente te explica.'
              : 'A biblioteca é oferecida na hora da assinatura. Se você não levou e quer agora, chame o suporte.'}
          </p>
          <a class="btn sec bv-sup" href="${CONFIG.SUPORTE_WHATS}" target="_blank" rel="noopener">
            ${Ic.chat(19)} Falar com o suporte
          </a>
        `}

        <button class="bib-depois" onclick="App.fecharCamada()">Agora não</button>
      </div>`;
  },

/* o botão das receitas, no canto do cabeçalho de Alimentação. Mesmo
     padrão da Biblioteca em Treinos: trancado ganha o cadeado e abre a
     camada de venda em vez do e-book. */
  _btnReceitas() {
    const trancada = !App.temReceitas();
    return `
      <button class="bib-link" onclick="App.abrirReceitas()">
        ${trancada ? '🔒 ' : ''}Receitas
      </button>`;
  },

  /* ============ RECEITAS + LISTA DE COMPRAS (e-book) ============
     ⚠️ O nome é "Receitas", não "Lista de Compras": o app já tem uma
     lista de compras GRÁTIS (Cardápio → aba Compras), automática a
     partir do cardápio calculado. É outra coisa — aqui é a lista de
     ingredientes de cada receita do e-book. O texto abaixo existe pra
     deixar essa diferença óbvia e evitar "já tenho isso" no suporte. */
  receitasCamada() {
    const naLoja = window.NO_APP_DA_LOJA;
    const temLink = !naLoja && CONFIG.CHECKOUT_URL_RECEITAS;

    return `
      <div class="bv-caixa" role="dialog" aria-modal="true" aria-labelledby="rec-tt">
        <div class="bv-marca">${Ic.maca(26)}</div>
        <h2 class="bv-tt display" id="rec-tt">Receitas</h2>
        <p class="bv-txt" style="text-align:center">
          Um e-book de receitas dentro das suas metas de hoje, com a lista de
          ingredientes de cada uma pronta pra levar ao mercado.
        </p>

        <div class="bib-razoes">
          <div><span>${Ic.talher(17)}</span><div><b>Acaba o "o que eu como?".</b> Receitas prontas, sem precisar inventar nem contar caloria na mão.</div></div>
          <div><span>${Ic.prancheta(17)}</span><div><b>Lista de compras de cada receita.</b> Diferente da lista automática que o app já te dá: esta é o ingrediente de cada prato.</div></div>
          <div><span>${Ic.check(17)}</span><div><b>Pagamento único.</b> Não é mensalidade. Paga uma vez e o e-book é seu.</div></div>
        </div>

        ${temLink ? `
          <div class="bib-preco">${CONFIG.PRECO_RECEITAS || 'R$19,90'}<span>pagamento único</span></div>
          <button class="btn" onclick="App.comprarReceitas()">Liberar as receitas</button>
          <button class="corrida-japaguei" onclick="App.verificarReceitas()">Já paguei, liberar meu acesso</button>
        ` : `
          <p class="bv-txt" style="text-align:center">
            ${naLoja
              ? 'As receitas não fazem parte do seu plano atual. Fale com o suporte que a gente te explica.'
              : 'As receitas são oferecidas na hora da assinatura. Se você não levou e quer agora, chame o suporte.'}
          </p>
          <a class="btn sec bv-sup" href="${CONFIG.SUPORTE_WHATS}" target="_blank" rel="noopener">
            ${Ic.chat(19)} Falar com o suporte
          </a>
        `}

        <button class="bib-depois" onclick="App.fecharCamada()">Agora não</button>
      </div>`;
  },

  _bibliotecaConteudo() {
    const busca = App.busca.toLowerCase();
    const lista = BIBLIOTECA.filter(e =>
      (App.cat === 'Todos' || e.cat === App.cat) &&
      (!busca || e.nome.toLowerCase().includes(busca) || e.musc.join(' ').toLowerCase().includes(busca))
    );

    return `
      <input class="busca" placeholder="Buscar exercício ou músculo..." value="${App.busca}"
             oninput="App.buscar(this.value)">

      <div class="cats">
        ${CATEGORIAS.map(c => `
          <button class="cat ${App.cat === c ? 'on' : ''}" onclick="App.setCat('${c}')">
            ${c}${c === 'Todos' ? ` (${BIBLIOTECA.length})` : ` (${BIBLIOTECA.filter(e => e.cat === c).length})`}
          </button>`).join('')}
      </div>

      ${lista.length ? lista.map(e => `
        <div class="bib-item">
          <div class="bib-topo">
            <div class="bib-ic">${App.iconeCat(e.cat)}</div>
            <div>
              <div class="bib-nome">${e.nome}</div>
              <div class="bib-cat">${e.cat}</div>
            </div>
          </div>
          <div class="bib-desc">${e.desc}</div>
          <div class="bib-musc">${e.musc.map(m => `<span class="musc">${m}</span>`).join('')}</div>
          ${Video.tem(e.nome) ? `
            <button class="video-btn" onclick="App.verVideo('${e.nome.replace(/'/g, "\\'")}')">
              ${Ic.camera(17)} Ver execução
            </button>` : ''}
        </div>`).join('') : `
        <div class="vazio">
          <div class="em">🔍</div>
          <p>Nenhum exercício encontrado para essa busca.</p>
        </div>`}`;
  },

  /* ---------- a tela de venda ---------- */
  _corridaVenda() {
    const naLoja = window.NO_APP_DA_LOJA;

    return `
      <div class="card corrida-capa">
        <div class="corrida-cad">${Ic.corrida(30)}</div>
        <h3>Modo Corrida</h3>
        <p>Cronômetro, distância, ritmo e calorias de cada corrida sua, dentro do mesmo app do seu plano.</p>
        <span class="corrida-selo">${Ic.cadeado(13)} Ainda não liberado</span>
      </div>

      <h3 class="secao-tt">O que vem no Modo Corrida</h3>
      <div class="card" style="padding:6px 18px">
        ${CORRIDA_BENEFICIOS.map(([ic, tt, txt]) => `
          <div class="lista-item" style="align-items:flex-start">
            <span class="lista-ic">${Telas._icCorrida(ic)}</span>
            <div><div class="lista-t">${tt}</div><div class="lista-s">${txt}</div></div>
          </div>`).join('')}
      </div>

      ${naLoja ? `
        <div class="card">
          <div class="card-tt">${Ic.chat(20)} Como liberar</div>
          <p class="corrida-nota" style="margin:0">O Modo Corrida não faz parte do seu plano atual. Fale com o suporte que a gente te explica como funciona.</p>
          <div style="height:12px"></div>
          <a class="btn sec" href="${CONFIG.SUPORTE_WHATS}" target="_blank" rel="noopener">Falar com o suporte</a>
        </div>
      ` : `
        <div class="card corrida-preco">
          <div class="corrida-val">${CONFIG.PRECO_CORRIDA || 'R$19,90'}<small>/ano</small></div>
          <div class="corrida-val-sub">Um ano de acesso, cobrado uma vez.</div>
          ${CONFIG.CHECKOUT_URL_CORRIDA
            ? `<button class="btn" onclick="App.comprarCorrida()">Liberar o Modo Corrida</button>`
            : `<div class="aviso" style="margin:0">O link de pagamento do Modo Corrida ainda não foi configurado em config.js.</div>`}
        </div>
      `}`;
  },

  _icCorrida(nome) {
    const mapa = { calendario:'calendario', relogio:'lua', alvo:'alvo', fogo:'fogo', barras:'barras', trofeu:'festa' };
    const fn = Ic[mapa[nome]] || Ic.alvo;
    return fn(19);
  },

  /* ---------- tela cheia: contagem 3-2-1 e corrida em andamento ---------- */
  corridaAtiva() {
    const c = App.corridaEstado;
    if (!c) return '';

    if (c.contagem > 0) return `
      <div class="corrida-tela contando">
        <div class="corrida-num" key="${c.contagem}">${c.contagem}</div>
        <div class="corrida-prep">Prepare-se</div>
      </div>`;

    const ritmo = Store.ritmo(c.metros, c.segundos);

    return `
      <div class="corrida-tela">
        <div id="cr-gps" class="corrida-gps ${c.gpsOk ? 'on' : ''}">${c.gpsOk ? 'GPS ativo' : (c.gpsErro || 'Procurando GPS...')}</div>

        <div id="cr-tempo" class="corrida-crono">${App.duracaoLonga(c.segundos)}</div>
        <div class="corrida-crono-l">${c.pausado ? 'Pausado' : 'Tempo em movimento'}</div>

        <div class="corrida-linhas">
          <div><b id="cr-km">${App.km(c.metros)}</b><span>km</span></div>
          <div><b id="cr-ritmo">${ritmo ? App.paceTexto(ritmo) : '--:--'}</b><span>min/km</span></div>
          <div><b id="cr-kcal">${Store.caloriasCorrida(c.metros, c.segundos)}</b><span>kcal</span></div>
        </div>

        <div class="corrida-acoes">
          <button class="btn ${c.pausado ? '' : 'sec'}" onclick="App.pausarCorrida()">${c.pausado ? 'Retomar' : 'Pausar'}</button>
          <button class="btn perigo" onclick="App.finalizarCorrida()">Finalizar</button>
        </div>

        <p class="corrida-aviso-tela">Mantenha esta tela aberta. Com o celular bloqueado o percurso para de ser medido.</p>
      </div>`;
  },

  /* ============ TREINOS ============ */
  treinos() {
    if (App.abaTreinos === 'corrida') return Telas.corrida();
    const plano = Store.planoTreino();
    const dias = Store.diasTreino();
    const dia = dias[App.diaTreino];
    const hojeIdx = App.indiceHoje();
    const ehHoje = App.diaTreino === hojeIdx;
    const feito = Store.dia().treino;

    return `
      <div class="topo">
        <div>
          <h1 class="display">Treinos</h1>
          <div class="topo-sub">${plano.frequencia} · ${Store.db.perfil.local === 'casa' ? 'Em casa' : 'Academia'}</div>
        </div>
        ${Telas._btnBiblioteca()}
      </div>

      <div class="tela stagger">
        ${Telas._abasTreino()}

        <h3 class="secao-tt">Seu mês</h3>
        ${Telas._calendarioTreino()}

        ${Telas._lidaEsforco()}

        <div class="dias-fila">
          ${dias.map((d, i) => `
            <button class="dia-chip ${i === App.diaTreino ? 'ativo' : ''} ${i === hojeIdx ? 'hoje' : ''}" onclick="App.selDia(${i})">
              <div class="d">${d.dia}</div>
              <div class="p"></div>
            </button>`).join('')}
        </div>

        ${dia.descanso ? `
          <div class="card">
            <div class="descanso">
              <div class="em">${Ic.lua(40)}</div>
              <h3>Dia de Descanso</h3>
              <p>${dia.sugestao}</p>
            </div>
          </div>
          ${Telas._cardio(true)}` : `
          <div class="card">
            <div class="card-tt">${Ic.halter(20)} ${dia.foco}<span class="n">${dia.exercicios.length} exercícios</span></div>
            ${dia.exercicios.map((e, i) => Telas._exercicio(e, i)).join('')}
          </div>

          ${Telas._cardio(false)}

          ${ehHoje ? (feito
            ? `<div class="treino-feito">✓ Treino concluído hoje</div>`
            : `<button class="btn" onclick="App.marcarTreino()">Marcar treino como concluído</button>`) : `
            <div class="aviso">Este é o treino de ${dia.diaLongo}. Você só marca como concluído no dia.</div>`}
        `}

        ${Telas._organizarSemana(plano, dias)}

        ${Telas._agendaTreino()}
      </div>`;
  },

  /* uma linha de switch de lembrete. Os três do Perfil são iguais em
     tudo menos no texto, então vale uma função só. */
  _switchLembrete(tipo, icone, titulo, ligadoTxt) {
    const on = Lembretes.ligado(tipo) && Lembretes.permitido();
    return `
      <div class="tema-linha">
        <div class="tema-ic">${icone}</div>
        <div class="tema-txt">
          <div class="t">${titulo}</div>
          <div class="s">${on ? 'Ligado. ' + ligadoTxt : 'Desligado.'}</div>
        </div>
        <button class="switch ${on ? 'on' : ''}"
                onclick="App.alternarLembrete('${tipo}')" aria-label="Alternar ${titulo}"><i></i></button>
      </div>`;
  },

  /* ---------- camada de venda do Plano Duo ----------
     Mesmo formato da biblioteca: por cima da tela, sem tirar ela do
     lugar. Quem já tem a segunda vaga nunca chega aqui (ver Notif._podeDuo). */
  duoCamada() {
    const naLoja = window.NO_APP_DA_LOJA;
    const temLink = !naLoja && CONFIG.CHECKOUT_URL_DUO;

    return `
      <div class="bv-caixa" role="dialog" aria-modal="true" aria-labelledby="duo-tt">
        <div class="bv-marca">${Ic.pessoa(26)}</div>
        <h2 class="bv-tt display" id="duo-tt">Plano Duo</h2>
        <p class="bv-txt" style="text-align:center">
          Uma segunda vaga na sua assinatura, para quem você quiser chamar.
        </p>

        <div class="bib-razoes">
          <div><span>${Ic.pessoa(17)}</span><div><b>O plano é dela, não o seu.</b> A pessoa responde as perguntas dela e recebe as metas dela, do tamanho dela.</div></div>
          <div><span>${Ic.cadeado(17)}</span><div><b>Cada uma vê só o que é seu.</b> Peso, fotos e registros não cruzam entre as duas contas.</div></div>
          <div><span>${Ic.festa(17)}</span><div><b>Ninguém desiste sozinho.</b> Fazer junto com alguém é o que mais segura gente no plano depois do primeiro mês.</div></div>
        </div>

        ${temLink ? `
          <div class="bib-preco">${CONFIG.PRECO_DUO || 'R$14,90'}<span>por mês, junto da sua assinatura</span></div>
          <button class="btn" onclick="App.comprarDuo()">Abrir a segunda vaga</button>
          <button class="corrida-japaguei" onclick="App.verificarDuo()">Já paguei, liberar minha vaga</button>
        ` : `
          <p class="bv-txt" style="text-align:center">
            ${naLoja
              ? 'O Plano Duo não faz parte do seu plano atual. Fale com o suporte que a gente te explica.'
              : 'O Plano Duo é oferecido na hora da assinatura. Se você não levou e quer agora, chame o suporte.'}
          </p>
          <a class="btn sec bv-sup" href="${CONFIG.SUPORTE_WHATS}" target="_blank" rel="noopener">
            ${Ic.chat(19)} Falar com o suporte
          </a>
        `}

        <button class="bib-depois" onclick="App.fecharCamada()">Agora não</button>
      </div>`;
  },

  /* depois da compra do Duo: a vaga existe, falta a pessoa. Sem isto a
     compra fica parada, porque nada no app diz que falta um passo. */
  duoVagaCamada() {
    return `
      <div class="bv-caixa" role="dialog" aria-modal="true" aria-labelledby="dv-tt">
        <div class="bv-marca">${Ic.festa(26)}</div>
        <h2 class="bv-tt display" id="dv-tt">Sua segunda vaga está aberta</h2>
        <p class="bv-txt" style="text-align:center">
          Falta só dizer quem vai usar. Você digita o e-mail da pessoa e ela entra no app
          com esse mesmo e-mail, responde as perguntas dela e recebe o plano dela.
        </p>
        <button class="btn" onclick="App.irConvidarDuo()">Chamar a pessoa agora</button>
        <button class="bib-depois" onclick="App.fecharCamada()">Faço isso depois</button>
      </div>`;
  },

  /* ---------- a agenda do treino ----------
     O lembrete de treino no celular e o horário que ele usa. Fica no
     topo da aba, acima do calendário, porque é o que dá sentido a ele:
     sem horário marcado, o calendário é só um histórico. */
  _agendaTreino() {
    const pos = App.indiceHoje();
    const hoje = Store.diasTreino()[pos];
    const hora = Store.horaTreino(pos);
    const ligado = Lembretes.ligado('treino') && Lembretes.permitido();
    const salvas = Object.values(Store.horasTreino());
    const marcados = salvas.length;
    /* o campo mostra o horário de hoje; num dia de descanso mostra o que
       ela já usa nos outros dias, senão pareceria que nada foi salvo */
    const noCampo = hora || salvas[0] || HORA_TREINO_PADRAO;

    return `
      <div class="card agenda-card">
        <div class="tema-linha">
          <div class="tema-ic">${Ic.sino(20)}</div>
          <div class="tema-txt">
            <div class="t">Lembrete de treino</div>
            <div class="s">${!marcados
              ? 'Escolha o seu horário abaixo e o app avisa na hora do treino.'
              : ligado
                ? (hoje && hoje.descanso
                    ? 'Ligado. Hoje é descanso, então não vai tocar.'
                    : hora ? `Ligado. Hoje toca às ${hora}.` : 'Ligado. Hoje não tem horário marcado.')
                : 'Desligado.'}</div>
          </div>
          <button class="switch ${ligado ? 'on' : ''}"
                  onclick="App.alternarLembrete('treino')" aria-label="Alternar lembrete de treino"><i></i></button>
        </div>

        <div class="agenda-hora">
          <label for="ag-hora">Meu horário de treino</label>
          <input id="ag-hora" type="time" value="${noCampo}"
                 onchange="App.salvarHoraTreinoTodos(this.value)">
        </div>
        <p class="agenda-nota">Vale para todos os dias de treino da semana. Para mudar um dia só, toque nele no calendário.</p>
      </div>`;
  },

  /* ---------- calendário do mês ----------
     Cada dia mostra o que é: treino feito, treino marcado que ainda vai
     acontecer, treino que ela deixou passar, ou descanso. O dia de hoje
     é o círculo verde. Tocar em qualquer dia abre o que é o treino dele
     e o horário. */
  _calendarioTreino() {
    const base = App.mesCalendario();
    const ano = base.getFullYear(), mes = base.getMonth();
    const hojeIso = Store.hoje();
    const criado = (Store.db.perfil && Store.db.perfil.criado_em) || '';

    const primeiro = new Date(ano, mes, 1);
    const inicio = (primeiro.getDay() + 6) % 7;        /* quantas casas vazias antes do dia 1 */
    const ultimo = new Date(ano, mes + 1, 0).getDate();

    const celulas = [];
    for (let i = 0; i < inicio; i++) celulas.push('<div class="cal-vazio"></div>');

    for (let d = 1; d <= ultimo; d++) {
      const iso = Store.iso(new Date(ano, mes, d));
      const t = Store.treinoDaData(iso);
      const descanso = !t || t.descanso;
      const feito = Store.treinoFeitoEm(iso);
      const hora = descanso ? '' : Store.horaTreino(t.pos);
      const ehHoje = iso === hojeIso;
      const passou = iso < hojeIso;
      /* antes de ela existir no app não há treino perdido: marcar de
         vermelho o mês inteiro que antecede o cadastro é cobrar alguém
         por um plano que ainda não tinha */
      const antesDoPlano = criado && iso < criado;

      const estado = feito ? 'feito'
                   : antesDoPlano ? 'antes'
                   : descanso ? 'descanso'
                   : passou ? 'perdido'
                   : 'previsto';

      celulas.push(`
        <button class="cal-dia ${estado} ${ehHoje ? 'hoje' : ''}"
                ${antesDoPlano ? 'disabled' : `onclick="App.abrirDataTreino('${iso}')"`}
                aria-label="${d} de ${MESES_PT[mes]}">
          <span class="cd-n">${d}</span>
          <span class="cd-p"></span>
          ${hora && !feito && !passou ? `<span class="cd-h">${hora}</span>` : ''}
        </button>`);
    }

    return `
      <div class="card cal-card">
        <div class="cal-topo">
          <button class="cal-nav" onclick="App.mudarMes(-1)" aria-label="Mês anterior">‹</button>
          <div class="cal-mes">${MESES_PT[mes].charAt(0).toUpperCase() + MESES_PT[mes].slice(1)} de ${ano}</div>
          <button class="cal-nav" onclick="App.mudarMes(1)" aria-label="Próximo mês">›</button>
        </div>

        <div class="cal-grade cal-cab">
          ${DIAS_SEMANA.map(d => `<div>${d}</div>`).join('')}
        </div>

        <div class="cal-grade">${celulas.join('')}</div>

        <div class="cal-legenda">
          <span class="cl feito">Feito</span>
          <span class="cl previsto">A fazer</span>
          <span class="cl perdido">Passou</span>
          <span class="cl descanso">Descanso</span>
        </div>
      </div>`;
  },

  /* o que o app entendeu das respostas de "como foi o treino". Só aparece
     quando já há histórico suficiente pra dizer algo — ver lidaDoEsforco. */
  _lidaEsforco() {
    const l = Store.lidaDoEsforco();
    if (!l) return '';
    const ic = { leve: Ic.halter(20), ponto: Ic.check(20), pesado: Ic.sino(20) };
    return `
      <div class="card esforco-lida ${l.tom}">
        <span class="el-ic">${ic[l.tom]}</span>
        <p class="el-txt">${l.texto}</p>
      </div>`;
  },

  /* cardio prescrito pelo objetivo — muda entre dia de treino e de descanso */
  _cardio(ehDescanso) {
    const c = CARDIO_POR_OBJETIVO[Store.db.perfil.objetivo] || CARDIO_POR_OBJETIVO.manutencao;
    const bloco = ehDescanso ? c.descanso : c.treino;
    const semCardio = ehDescanso && Store.db.perfil.objetivo === 'hipertrofia';

    return `
      <div class="card cardio-card ${semCardio ? 'off' : ''}">
        <div class="card-tt" style="margin-bottom:10px">
          ${semCardio ? Ic.cama(20) : Ic.corrida(20)} ${bloco.titulo}
          <span class="n">${c.frequencia}</span>
        </div>
        <p class="cardio-txt">${bloco.texto}</p>
        <p class="cardio-dica">${bloco.dica}</p>
      </div>`;
  },

  /* linha do exercício, com seta que abre o registro de carga */
  /* Uma linha por SÉRIE do exercício: 3x12 vira três pares de carga e
     repetições. Antes era um par só pro exercício inteiro, o que obrigava
     a pessoa a escolher qual série anotar (e quase todo mundo anota a
     mais pesada, que era o que o campo acabava virando).

     Cada linha já vem sugerida com o que ela fez na mesma série da última
     vez; registro antigo, que tinha um valor só, sugere esse valor em
     todas. As repetições do plano ficam de placeholder. */
  _cargaForm(e, i, ultima) {
    const series = Math.max(1, Math.min(10, Number(e.series) || 1));
    const anteriores = Store.seriesDe(ultima);
    const repsPlano = String(e.reps).replace(/\D/g, '') || '12';

    return `
      <div class="carga-form">
        <div class="carga-cab">
          <span>Série</span><span>Carga (kg)</span><span>Repetições</span>
        </div>
        ${Array.from({ length: series }, (_, k) => {
          const ant = anteriores[k] || anteriores[anteriores.length - 1] || null;
          return `
          <div class="carga-serie">
            <span class="cs-n">${k + 1}</span>
            <input id="carga-peso-${k}" type="number" inputmode="decimal" step="0.5"
                   placeholder="0" value="${ant && ant.peso ? ant.peso : ''}"
                   onclick="event.stopPropagation()">
            <input id="carga-reps-${k}" type="number" inputmode="numeric"
                   placeholder="${repsPlano}" value="${ant && ant.reps ? ant.reps : ''}"
                   onclick="event.stopPropagation()">
          </div>`;
        }).join('')}
        <button class="carga-btn" onclick="event.stopPropagation();App.salvarCarga(${i}, ${series})">Salvar</button>
      </div>`;
  },

  _exercicio(e, i) {
    const nome = e.ex;
    const aberto = App.exAberto === nome;
    const ultima = Store.ultimaCarga(nome);
    const hist = Store.cargas(nome);
    const anterior = hist.length > 1 ? hist[hist.length - 2] : null;
    const subiu = ultima && anterior && ultima.peso > anterior.peso;

    return `
      <div class="ex-bloco ${aberto ? 'aberto' : ''}">
        <div class="ex" onclick="App.abrirEx(${i})">
          <div class="ex-n">${i + 1}</div>
          <div style="flex:1;min-width:0">
            <div class="ex-nome">${nome}</div>
            <div class="ex-det">
              Descanso: ${e.desc}
              ${ultima ? ` · <b style="color:var(--verde-esc)">${ultima.peso}kg${ultima.reps ? ' × ' + ultima.reps : ''}</b>${subiu ? ' ↑' : ''}` : ''}
            </div>
          </div>
          <div class="ex-serie">${e.series}×${e.reps}</div>
          <div class="ex-seta">▾</div>
        </div>

        <div class="ex-corpo">
          ${hist.length ? `
            <div class="carga-hist">
              ${hist.slice(-6).map(r => `
                <div class="carga-pt">
                  <div class="cp-peso">${r.peso}<span>kg</span></div>
                  <div class="cp-data">${App.dataCurta(r.data)}</div>
                </div>`).join('')}
            </div>` : `
            <p class="carga-vazio">Ainda sem registro. Anote a carga de hoje para acompanhar sua evolução.</p>`}

          ${Telas._cargaForm(e, i, ultima)}

          ${Video.tem(nome) ? `
            <button class="video-btn" onclick="event.stopPropagation();App.verVideo('${nome.replace(/'/g, "\\'")}')">
              ${Ic.camera(17)} Ver execução
            </button>` : ''}
        </div>
      </div>`;
  },

  /* organizador: define qual treino cai em cada dia da semana */
  _organizarSemana(plano, dias) {
    const ordem = Store.ordemTreino();
    const padrao = ordem.every((v, i) => v === i);

    /* rótulo de cada opção; numera os descansos para não ficarem iguais */
    let nDesc = 0;
    const rotulos = plano.dias.map(d => d.descanso ? `Descanso ${++nDesc}` : d.foco);

    return `
      <h3 class="secao-tt">Organize a sua semana</h3>
      <div class="card">
        <p style="font-size:13px;color:var(--cinza);line-height:1.55;font-weight:600;margin-bottom:4px">
          Escolha o que fica em cada dia. Ao mover um treino, ele <b>troca de lugar</b>
          com o que estava naquele dia, então a semana continua com o mesmo volume.
        </p>

        ${dias.map((d, i) => `
          <div class="dia-org">
            <div class="dia-org-lbl">
              ${d.diaLongo}
              ${i === App.indiceHoje() ? '<span class="hoje-tag">hoje</span>' : ''}
            </div>
            <button class="sel-dia ${d.descanso ? 'sel-descanso' : ''}" onclick="App.abrirDiaTreino(${i})">
              <span class="sd-txt">${rotulos[ordem[i]]}</span>
              <span class="sd-seta">▾</span>
            </button>
          </div>`).join('')}

        ${padrao ? '' : `
          <button class="btn sec" style="margin-top:14px" onclick="App.restaurarOrdem()">
            Voltar à ordem original do plano
          </button>`}
      </div>`;
  },


  /* ============ BIBLIOTECA DE EXERCÍCIOS ============ */
  /* a tela solta continua existindo (rota 'biblioteca'), mas o caminho
     normal agora é a aba dentro de Treinos */
  biblioteca() {
    return `
      <div class="topo">
        <div>
          <h1 class="display">Exercícios</h1>
          <div class="topo-sub">${BIBLIOTECA.length} exercícios com execução explicada</div>
        </div>
        <button class="btn-mini" style="width:40px;height:40px" onclick="App.ir('treinos')">✕</button>
      </div>

      <div class="tela">
        ${this._bibliotecaConteudo()}
      </div>`;
  },

  /* ============ METAS ============ */
  /* ---------- peso e metas ----------
     Era uma aba própria. Virou um bloco dentro do Progresso: peso e
     evolução são progresso, e a barra de baixo ficou com as cinco abas
     das telas de referência. */
  _peso() {
    const p = Store.db.perfil;

    /* a meta pode ser perder OU ganhar peso — a conta vale para os dois lados */
    const dif = p.meta_peso - p.peso_inicial;
    const ganhar = dif > 0;
    const manter = Math.abs(dif) < 0.05;
    const variacao = Math.round((p.peso_atual - p.peso_inicial) * 10) / 10;  // + ganhou, − perdeu
    const andado = ganhar ? variacao : -variacao;                            // quanto andou na direção certa
    const pct = manter ? 100 : Math.max(0, Math.min(100, Math.round((andado / Math.abs(dif)) * 100)));
    const atingiu = manter || (ganhar ? p.peso_atual >= p.meta_peso : p.peso_atual <= p.meta_peso);
    const faltam = Math.round(Math.abs(p.peso_atual - p.meta_peso) * 10) / 10;
    const naDirecao = (ganhar && variacao > 0) || (!ganhar && variacao < 0);

    return `
        <h3 class="secao-tt">Seu peso</h3>
        <div class="peso-fila">
          <div class="peso-box">
            <div class="l">Inicial</div>
            <div class="n">${p.peso_inicial}<small>kg</small></div>
          </div>
          <div class="peso-box">
            <div class="l">Atual</div>
            <div class="n">${p.peso_atual}<small>kg</small></div>
            ${variacao !== 0 ? `<div class="d" style="color:${naDirecao ? 'var(--verde)' : 'var(--vermelho)'}">${variacao > 0 ? '↑' : '↓'} ${Math.abs(variacao)} kg</div>` : ''}
          </div>
          <div class="peso-box">
            <div class="l">Meta</div>
            <div class="n">${p.meta_peso}<small>kg</small></div>
          </div>
        </div>

        <div class="card">
          <div class="meta-topo" style="margin-bottom:10px">
            <span class="meta-nome" style="font-size:14.5px">Progresso até a meta</span>
            <span class="meta-num">${pct}%</span>
          </div>
          <div class="barra" style="height:10px"><i style="width:${pct}%"></i></div>
          <div style="font-size:12.5px;color:var(--cinza);margin-top:10px;font-weight:600">
            ${atingiu
              ? 'Meta atingida. Agora é sustentar. 🎉'
              : `Faltam <b style="color:var(--tinta)">${faltam} kg</b> para ${ganhar ? 'chegar no peso que você quer' : 'chegar na sua meta'}.`}
          </div>
        </div>

        <div class="card">
          <div class="card-tt">${Ic.balanca(20)} Evolução do peso<span class="n">${Store.db.pesagens.length} pesagens</span></div>
          ${Comp.grafico(Store.seriePeso())}
          <button class="btn" style="margin-top:14px" onclick="App.abrirPeso()">Registrar pesagem de hoje</button>
        </div>`;
  },

  /* ============ PROGRESSO ============ */
  progresso() {
    const r = Store.resumo('semana');       /* sem seletor: a janela é sempre de 7 dias */
    const nv = Store.nivel();
    const p = Store.db.perfil;

    return `
      <div class="topo">
        <div>
          <h1 class="display">Progresso</h1>
          <div class="topo-sub">Tudo o que você construiu até aqui</div>
        </div>
      </div>

      <div class="tela stagger">
        <div class="card">
          <div class="card-tt">${Ic.calendario(20)} Consistência</div>
          <div class="meta-topo" style="margin-bottom:8px">
            <span class="meta-nome">Dias ativos na semana</span>
            <span class="meta-num">${r.diasAtivos} de ${r.dias}</span>
          </div>
          <div class="barra" style="height:9px"><i style="width:${Math.round((r.diasAtivos / r.dias) * 100)}%"></i></div>
          <div style="font-size:12.5px;color:var(--cinza);margin-top:11px;font-weight:600">
            Sequência atual: <b style="color:var(--tinta)">${Store.streak()} ${Store.streak() === 1 ? 'dia' : 'dias'}</b> sem falhar.
          </div>
        </div>

        <button class="card fora-btn" onclick="App.abrirFotos()">
          <span class="fb-ic">${Ic.camera(21)}</span>
          <div>
            <div class="fb-t">Fotos de progresso</div>
            <div class="fb-s">O que a balança não mostra. Só neste aparelho.</div>
          </div>
          <span class="lista-seta">›</span>
        </button>

        ${Telas._evolucaoCargas()}

        ${Telas._peso()}

        <button class="card fora-btn" onclick="App.ir('niveis')">
          <span class="fb-ic">${Ic.festa(21)}</span>
          <div>
            <div class="fb-t">Ver níveis de evolução</div>
            <div class="fb-s">Os 10 níveis e como ganhar pontos</div>
          </div>
          <span class="lista-seta">›</span>
        </button>
      </div>`;
  },

  /* ============ NÍVEIS ============
     Era uma lista de dez níveis mais uma tabela de pontos empilhadas no
     fim do Progresso: muita rolagem pra uma coisa que se lê uma vez.
     Virou tela própria, atrás de um botão. */
  niveis() {
    const nv = Store.nivel();

    return `
      <div class="topo">
        <div>
          <h1 class="display">Níveis</h1>
          <div class="topo-sub">Você está no ${nv.n} de ${nv.totalNiveis} · ${nv.pontos} pontos</div>
        </div>
        <button class="btn-mini" style="width:40px;height:40px" onclick="App.ir('progresso')">✕</button>
      </div>

      <div class="tela stagger">
        <div class="card">
          ${NIVEIS.map(n => `
            <div class="lista-item" style="${n.n === nv.n ? 'background:var(--verde-tint2);margin:0 -18px;padding:15px 18px;border-radius:12px' : ''}">
              <span style="font-size:20px">${n.icone}</span>
              <div>
                <div style="font-size:14px;font-weight:800">${n.nome}</div>
                <div style="font-size:11.5px;color:var(--cinza);font-weight:600">${n.frase}</div>
              </div>
              <span class="lista-v" style="font-size:12.5px;color:${nv.pontos >= n.min ? 'var(--verde-esc)' : 'var(--cinza-c)'}">
                ${nv.pontos >= n.min ? '✓' : n.min + ' pts'}
              </span>
            </div>`).join('')}
        </div>

        <h3 class="secao-tt">Como ganhar pontos</h3>
        <div class="card">
          <div class="lista-item"><span class="lista-k">Marcar um alimento</span><span class="lista-v">+${PONTOS.alimento}</span></div>
          <div class="lista-item"><span class="lista-k">Concluir uma refeição inteira</span><span class="lista-v">+${PONTOS.refeicao}</span></div>
          <div class="lista-item"><span class="lista-k">Bater a meta de água</span><span class="lista-v">+${PONTOS.agua}</span></div>
          <div class="lista-item"><span class="lista-k">Bater a meta de sono</span><span class="lista-v">+${PONTOS.sono}</span></div>
          <div class="lista-item"><span class="lista-k">Concluir o treino do dia</span><span class="lista-v">+${PONTOS.treino}</span></div>
          <div class="lista-item"><span class="lista-k">Registrar uma pesagem</span><span class="lista-v">+${PONTOS.pesagem}</span></div>
          ${App.temCorrida() ? `<div class="lista-item"><span class="lista-k">Concluir uma sessão de corrida</span><span class="lista-v">+${PONTOS.corrida}</span></div>` : ''}
        </div>
      </div>`;
  },

  /* evolução de carga por exercício (aba de progresso) */
  _evolucaoCargas() {
    const lista = Store.evolucaoCargas();

    if (!lista.length) return `
      <h3 class="secao-tt">Evolução de carga</h3>
      <div class="card">
        <div class="vazio" style="padding:26px 16px">
          <div class="em">${Ic.halter(34)}</div>
          <p>Anote as cargas na aba de Treinos, tocando na seta<br>de cada exercício, e a evolução aparece aqui.</p>
        </div>
      </div>`;

    const totalGanho = Math.round(lista.reduce((s, e) => s + Math.max(0, e.ganho), 0) * 10) / 10;

    return `
      <h3 class="secao-tt">Evolução de carga</h3>
      <div class="card">
        <div class="card-tt">${Ic.halter(20)} Por exercício<span class="n">${lista.length} registrados</span></div>

        ${totalGanho > 0 ? `
          <div class="carga-destaque">
            <div class="cd-n">+${totalGanho}<span>kg</span></div>
            <div class="cd-l">somando o ganho de todos os exercícios desde o primeiro registro</div>
          </div>` : ''}

        ${lista.map(e => `
          <div class="carga-linha">
            <div class="cl-topo">
              <span class="cl-nome">${e.ex}</span>
              <span class="cl-ganho ${e.ganho > 0 ? 'sobe' : e.ganho < 0 ? 'desce' : ''}">
                ${e.ganho > 0 ? '+' : ''}${e.ganho} kg
              </span>
            </div>
            <div class="cl-corpo">
              ${Comp.sparkline(e.serie)}
              <div class="cl-nums">
                <span>${e.inicio}kg</span>
                <span class="seta">→</span>
                <span class="atual">${e.atual}kg</span>
              </div>
            </div>
          </div>`).join('')}
      </div>`;
  },

  /* ============ PERFIL ============ */
  /* ---------- PLANO DUO ----------
     Aparece em três formas, e em mais nenhuma:
     - quem comprou o Duo e ainda não chamou ninguém: o convite;
     - quem já chamou: quem está na vaga, e o botão de tirar;
     - quem ENTROU por convite: só o aviso de quem pagou pra ela.
     Plano normal não vê nada disso. O estado vem de App.duo, carregado
     ao abrir a aba (App.carregarDuo). */
  _duo() {
    const d = App.duo;
    if (!Backend.ativo() || !d || !d.ok) return '';

    if (d.titular_email) {
      return `
        <h3 class="secao-tt">Seu acesso</h3>
        <div class="card">
          <div class="tema-linha">
            <div class="tema-ic">${Ic.pessoa(20)}</div>
            <div class="tema-txt">
              <div class="t">Você está no Plano Duo</div>
              <div class="s">A sua vaga veio da assinatura de <strong>${d.titular_email}</strong>. Seu plano, suas metas e seu progresso são só seus: ninguém mais enxerga.</div>
            </div>
          </div>
        </div>`;
    }

    if (Number(d.vagas || 1) < 2) return '';

    const convidados = d.convidados || [];
    const livre = convidados.length < Number(d.vagas) - 1;

    return `
      <h3 class="secao-tt">Plano Duo</h3>
      <div class="card">
        ${convidados.length ? convidados.map(c => `
          <div class="tema-linha">
            <div class="tema-ic">${Ic.pessoa(20)}</div>
            <div class="tema-txt">
              <div class="t">${c.email}</div>
              <div class="s">${c.status === 'ativa' ? 'Com acesso liberado. É só ela entrar no app com esse e-mail.' : 'Sem acesso no momento.'}</div>
            </div>
            <button class="btn sec" style="width:auto;padding:9px 14px;font-size:13px"
                    onclick="App.duoRemover('${c.email}')">Tirar</button>
          </div>`).join('') : ''}

        ${livre ? `
          <div class="tema-txt" style="padding:4px 0 12px">
            <div class="t">Você tem uma vaga para outra pessoa</div>
            <div class="s">Digite o e-mail dela. Ela entra no app com esse e-mail, monta o plano dela e o progresso de vocês fica separado.</div>
          </div>
          ${App.duoErro ? `<div class="erro">${App.duoErro}</div>` : ''}
          <div class="login-campo" style="margin-bottom:10px">
            <input type="email" id="in-duo" placeholder="E-mail da segunda pessoa" autocomplete="off"
                   onkeydown="if(event.key==='Enter')App.duoConvidar()">
          </div>
          <button class="btn" id="btn-duo" onclick="App.duoConvidar()">Liberar acesso para ela</button>
        ` : `
          <p class="lembrete-nota">A vaga do seu plano está ocupada. Para chamar outra pessoa, tire a atual primeiro.</p>
        `}
      </div>`;
  },

  /* ---------- divulgação do Plano Duo ----------
     Rendida acima de "Seus dados" só pra quem ainda NÃO tem a segunda
     vaga (nem é convidada de ninguém): quem já tem Duo vê o cartão de
     _duo() lá embaixo, não este. Some sozinha se CHECKOUT_URL_DUO
     estiver vazio ou dentro do app da loja (Google não deixa vender
     assinatura fora da Play Store por ali). */
  _duoPromo() {
    const d = App.duo;
    if (window.NO_APP_DA_LOJA) return '';
    if (!CONFIG.CHECKOUT_URL_DUO) return '';
    if (!Backend.ativo() || !d || !d.ok) return '';
    if (d.titular_email) return '';
    if (Number(d.vagas || 1) >= 2) return '';

    return `
      <div class="card nivel-card duo-promo">
        <div class="duo-promo-corpo">
          <div class="nivel-topo">
            <div>
              <div class="nivel-n">Plano Duo</div>
              <div class="nivel-nome">Divida sua assinatura</div>
            </div>
            <div class="duo-badge">50% de desconto</div>
          </div>
          <div class="nivel-falta">Chame alguém para dividir o plano. Cada um responde o próprio quiz e tem plano, metas e progresso separados.</div>
        </div>
        <button class="duo-promo-btn" onclick="App.abrirDuo()">Assinar o Plano Duo · ${CONFIG.PRECO_DUO || 'R$14,90'}/mês</button>
      </div>`;
  },

  perfil() {
    const p = Store.db.perfil;
    const nv = Store.nivel();
    const email = Backend.emailAtual();

    return `
      <div class="tela stagger" style="padding-top:26px">
        <div class="perfil-topo">
          <div class="perfil-av-caixa">
            <div class="perfil-av">${p.avatar ? `<img src="${p.avatar}" alt="Foto de perfil">` : p.nome[0].toUpperCase()}</div>
            <button class="av-editar" onclick="App.abrirEditarAvatar()" aria-label="Trocar foto de perfil">📷</button>
          </div>
          <div class="perfil-nome display">${p.nome}</div>
          <div class="perfil-mail">${email || 'Conta local neste aparelho'}</div>
          <div style="display:inline-flex;align-items:center;gap:7px;background:var(--verde-tint);color:var(--verde-esc);padding:7px 14px;border-radius:20px;font-size:12.5px;font-weight:800;margin-top:12px">
            ${nv.icone} Nível ${nv.n} · ${nv.nome}
          </div>
        </div>

        ${this._duoPromo()}

        <div class="card">
          <div class="card-tt">${Ic.pessoa(20)} Seus dados</div>
          <div class="lista-item"><span class="lista-k">Sexo</span><span class="lista-v">${p.sexo === 'feminino' ? 'Feminino' : 'Masculino'}</span></div>
          <div class="lista-item"><span class="lista-k">Idade</span><span class="lista-v">${p.idade} anos</span></div>
          <div class="lista-item"><span class="lista-k">Altura</span><span class="lista-v">${p.altura} cm</span></div>
          <div class="lista-item"><span class="lista-k">Peso atual</span><span class="lista-v">${p.peso_atual} kg</span></div>
          <div class="lista-item"><span class="lista-k">Meta de peso</span><span class="lista-v">${p.meta_peso} kg</span></div>
          <div class="lista-item"><span class="lista-k">Objetivo</span><span class="lista-v">${App.rotuloObjetivo()}</span></div>
          <div class="lista-item"><span class="lista-k">Local de treino</span><span class="lista-v">${p.local === 'casa' ? 'Em casa' : 'Academia'}</span></div>
        </div>

        <button class="btn sec" onclick="App.abrirEditar()">Editar meus dados</button>
        <div style="height:10px"></div>
        <button class="btn sec" onclick="App.abrirPeso()">Registrar pesagem</button>

        ${this._duo()}

        <h3 class="secao-tt">Lembretes</h3>
        <div class="card">
          ${Telas._switchLembrete('refeicao', Ic.talher(20), 'Lembrete de refeição',
            'Avisa nos horários do seu cardápio.')}
          ${Telas._switchLembrete('agua', Ic.gota(20), 'Lembrete de água',
            `Avisa ${AGUA_HORARIOS.length} vezes ao dia, de ${AGUA_HORARIOS[0]} às ${AGUA_HORARIOS[AGUA_HORARIOS.length - 1]}.`)}
          ${Telas._switchLembrete('sono', Ic.lua(20), 'Lembrete de sono',
            `Avisa às ${HORA_SONO} para começar a desacelerar.`)}
        </div>
        <p class="agenda-nota" style="margin-top:-8px">O lembrete de treino fica na aba Treinos, junto com o horário que você escolhe.</p>

        <h3 class="secao-tt">Ajuda e suporte</h3>
        <div class="card" style="padding:6px 18px">
          <a class="lista-item lista-link" href="${CONFIG.SUPORTE_WHATS}" target="_blank" rel="noopener">
            <span class="lista-ic">${Ic.chat(19)}</span>
            <div>
              <div class="lista-t">Falar com o suporte</div>
              <div class="lista-s">WhatsApp ${CONFIG.SUPORTE_NUMERO}, de segunda a sexta</div>
            </div>
            <span class="lista-seta">›</span>
          </a>
        </div>

        <h3 class="secao-tt">Conta</h3>
        <div class="card" style="padding:6px 18px">
          <div class="lista-item"><span class="lista-k">Membro desde</span><span class="lista-v">${App.dataBr(p.criado_em)}</span></div>
          <div class="lista-item"><span class="lista-k">Sincronização</span><span class="lista-v" style="color:${Backend.ativo() ? 'var(--verde)' : 'var(--cinza-c)'}">${Backend.ativo() ? 'Na nuvem' : 'Só neste aparelho'}</span></div>
        </div>

        <div style="height:10px"></div>
        ${Backend.ativo()
          ? `<button class="btn perigo" onclick="App.sair()">Sair da conta</button>`
          : `<button class="btn perigo" onclick="App.resetar()">Apagar meus dados</button>`}

        <div style="text-align:center;font-size:11.5px;color:var(--cinza-c);margin-top:22px;line-height:1.6;font-weight:600">
          Material educativo de apoio. Não substitui acompanhamento<br>médico ou nutricional. Resultados variam de pessoa para pessoa.
        </div>
      </div>`;
  }
};

/* =========================================================
   COMPONENTES reutilizáveis
   ========================================================= */
const Comp = {
  /* botão que abre as opções de troca de um alimento */
  botaoTroca(a) {
    const nomeBase = a.nomeOriginal || a.nome;
    const idx = Store.indiceTrocavel(nomeBase);
    if (idx < 0) return '';
    return `
      <button class="btn-troca ${a.trocado ? 'ativa' : ''}"
              onclick="event.stopPropagation();App.abrirTroca(${idx})">
        ${a.trocado ? '✓ trocado · ver opções' : '⇄ trocar por outro alimento'}
      </button>`;
  },

  anel(pct, valor, unidade) {
    const r = 54, c = 2 * Math.PI * r;
    const off = c * (1 - Math.min(100, pct) / 100);
    return `
      <div class="anel">
        <svg viewBox="0 0 132 132">
          <defs>
            <linearGradient id="gradAnel" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#0E7A42"/>
              <stop offset="100%" stop-color="#3FBE7C"/>
            </linearGradient>
          </defs>
          <circle class="trilho" cx="66" cy="66" r="${r}"/>
          <circle class="barra" cx="66" cy="66" r="${r}"
                  stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
        </svg>
        <div class="anel-centro">
          <div class="anel-num">${valor}</div>
          <div class="anel-lbl">${unidade} · ${pct}%</div>
        </div>
      </div>`;
  },

  atalho(icone, titulo, sub, tela, ultimo) {
    return `
      <div class="meta-linha" style="padding:15px 18px;cursor:pointer;${ultimo ? 'border-bottom:none' : ''}" onclick="App.ir('${tela}')">
        <div class="meta-ic treino">${icone}</div>
        <div class="meta-corpo">
          <div class="meta-nome">${titulo}</div>
          <div style="font-size:12.5px;color:var(--cinza);margin-top:2px;font-weight:600">${sub}</div>
        </div>
        <div style="color:var(--cinza-c);font-size:18px">›</div>
      </div>`;
  },

  /* minigráfico de carga dentro da linha do exercício */
  sparkline(vals) {
    if (vals.length < 2) {
      return `<div class="spark-vazio">1 registro</div>`;
    }
    const W = 86, H = 26;
    const min = Math.min(...vals), max = Math.max(...vals);
    const amp = (max - min) || 1;
    const x = i => (i / (vals.length - 1)) * W;
    const y = v => H - 3 - ((v - min) / amp) * (H - 6);
    const d = vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

    return `
      <svg class="spark" viewBox="0 0 ${W} ${H}">
        <path d="${d}" fill="none" stroke="#0E7A42" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${x(vals.length - 1).toFixed(1)}" cy="${y(vals[vals.length - 1]).toFixed(1)}" r="2.8" fill="#0E7A42"/>
      </svg>`;
  },

  /* gráfico de linha do peso */
  grafico(serie) {
    if (serie.length < 2) {
      return `<div class="vazio" style="padding:30px 20px">
                <div class="em">${Ic.balanca(34)}</div>
                <p>Registre pelo menos duas pesagens<br>para ver a sua curva de evolução.</p>
              </div>`;
    }

    const W = 300, H = 150, pad = 34;
    const pesos = serie.map(p => p.peso);
    const min = Math.min(...pesos) - 1.5, max = Math.max(...pesos) + 1.5;
    const x = i => pad + (i / (serie.length - 1)) * (W - pad - 12);
    const y = v => H - 26 - ((v - min) / (max - min)) * (H - 52);

    const linha = serie.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.peso).toFixed(1)}`).join(' ');
    const area = linha + ` L${x(serie.length - 1).toFixed(1)},${H - 26} L${x(0).toFixed(1)},${H - 26} Z`;

    return `
      <div class="grafico">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
          <defs>
            <linearGradient id="gradPeso" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#0E7A42" stop-opacity=".26"/>
              <stop offset="100%" stop-color="#0E7A42" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <line x1="${pad}" y1="${H-26}" x2="${W-12}" y2="${H-26}" stroke="#E6EDE9"/>
          <line x1="${pad}" y1="${H/2-13}" x2="${W-12}" y2="${H/2-13}" stroke="#E6EDE9" stroke-dasharray="3,4"/>
          <text class="g-eixo" x="4" y="${y(max-1.5)+4}">${max.toFixed(0)}</text>
          <text class="g-eixo" x="4" y="${y(min+1.5)+4}">${min.toFixed(0)}</text>
          <path d="${area}" fill="url(#gradPeso)"/>
          <path d="${linha}" fill="none" stroke="#0E7A42" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          ${serie.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.peso).toFixed(1)}" r="3.5" fill="#fff" stroke="#0E7A42" stroke-width="2.5"/>`).join('')}
        </svg>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--cinza-c);font-weight:700;padding:0 4px">
        <span>${App.dataCurta(serie[0].data)}</span>
        <span>${App.dataCurta(serie[serie.length-1].data)}</span>
      </div>`;
  }
};
