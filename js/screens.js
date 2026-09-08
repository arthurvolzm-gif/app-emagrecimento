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
          <div class="topo-nome display">${p.nome.split(' ')[0]}</div>
        </div>
        <div class="avatar">${p.nome[0].toUpperCase()}</div>
      </div>

      <div class="tela stagger">

        ${typeof CONFIG !== 'undefined' && CONFIG.MODO_PREVIA ? `
          <div class="previa">
            <div class="previa-tt">Prévia das animações · desligue em config.js</div>
            <div class="previa-chips">
              ${NIVEIS.map(n => `
                <button class="previa-chip" style="background:linear-gradient(140deg, ${n.cor1}, ${n.cor2})"
                        onclick="App.previaNivel(${n.n})" title="${n.nome}">
                  <span class="pc-ic">${n.icone}</span>
                  <span class="pc-n">${n.n}</span>
                </button>`).join('')}
            </div>
          </div>` : ''}

        <div class="card nivel-card" style="background:linear-gradient(135deg, ${nv.cor1}, ${nv.cor2})">
          <div class="nivel-topo">
            <div class="nivel-emoji">${nv.icone}</div>
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
            ? `Faltam <b>${nv.faltam} pontos</b> para ${nv.proximo.nome} ${nv.proximo.icone}`
            : 'Nível máximo alcançado. Você chegou lá. 👑'}</div>
        </div>

        <div class="card">
          <div class="card-tt">🎯 Meta de hoje</div>
          <div class="anel-wrap">
            ${Comp.anel(pctKcal, t.kcal, 'kcal')}
            <div class="anel-info">
              <div class="meta-grande">Meta diária</div>
              <div class="meta-val">${p.meta_kcal} kcal</div>
              <div class="mini-stat"><span class="k">Proteína</span><span class="v">${t.prot}g <small style="color:var(--cinza-c)">/ ${p.meta_prot}g</small></span></div>
              <div class="mini-stat"><span class="k">Refeições</span><span class="v">${t.marcados}/${t.total}</span></div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-tt">💧 Metas do dia</div>

          <div class="meta-linha">
            <div class="meta-ic agua">💧</div>
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
            <div class="meta-ic sono">😴</div>
            <div class="meta-corpo">
              <div class="meta-topo">
                <span class="meta-nome">Sono</span>
                <span class="meta-num ${t.sono >= p.meta_sono ? '' : 'pendente'}">${t.sono ? t.sono + 'h' : '—'} / ${p.meta_sono}h</span>
              </div>
              <div class="barra roxo"><i style="width:${pctSono}%"></i></div>
            </div>
            <button class="btn-mini" onclick="App.abrirSono()">✎</button>
          </div>

          <div class="meta-linha">
            <div class="meta-ic treino">🏋️</div>
            <div class="meta-corpo">
              <div class="meta-topo">
                <span class="meta-nome">${treinoHoje.descanso ? 'Dia de descanso' : 'Treino: ' + treinoHoje.foco}</span>
                <span class="meta-num ${t.treino ? '' : 'pendente'}">${t.treino ? 'Concluído' : (treinoHoje.descanso ? 'Livre' : 'Pendente')}</span>
              </div>
              <div class="barra"><i style="width:${t.treino ? 100 : 0}%"></i></div>
            </div>
            ${treinoHoje.descanso || t.treino ? '' : `<button class="btn-mini" onclick="App.marcarTreino()">✓</button>`}
          </div>
        </div>

        <div class="streak-linha">
          <div class="streak-box destaque">
            <div class="n">${streak}</div>
            <div class="l">${streak === 1 ? 'dia seguido' : 'dias seguidos'}</div>
          </div>
          <div class="streak-box">
            <div class="n">${ms.treino}<small style="font-size:14px;color:var(--cinza-c)">/5</small></div>
            <div class="l">Treinos<br>na semana</div>
          </div>
          <div class="streak-box">
            <div class="n">${ms.dieta}<small style="font-size:14px;color:var(--cinza-c)">/7</small></div>
            <div class="l">Dietas<br>completas</div>
          </div>
        </div>

        <h3 class="secao-tt">Continuar de onde parou</h3>
        <div class="card" style="padding:0;overflow:hidden">
          ${Comp.atalho('🍽️', 'Alimentação de hoje', `${t.marcados} de ${t.total} alimentos marcados`, 'alimentacao')}
          ${Comp.atalho('🏋️', treinoHoje.descanso ? 'Dia de descanso' : treinoHoje.foco, treinoHoje.descanso ? 'Aproveite para recuperar' : `${treinoHoje.exercicios.length} exercícios hoje`, 'treinos')}
          ${Comp.atalho('📈', 'Seu progresso', 'Resumo da semana e do mês', 'progresso', true)}
        </div>
      </div>`;
  },

  /* ============ ALIMENTAÇÃO ============ */
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
          📋  Ver cardápio completo e lista de compras
        </button>

        ${plano.map(r => Telas._refeicao(r)).join('')}

        <div class="card livre-card">
          <div class="card-tt" style="margin-bottom:8px">🍕 Refeição livre</div>
          <p style="font-size:13.5px;color:#4a4a4a;line-height:1.6;font-weight:600;margin:0">
            ${Store.planoBase().livre}
          </p>
        </div>

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
          <h1 class="display">${verCompras ? 'Lista de compras' : 'Cardápio completo'}</h1>
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
                <div class="card-tt">${r.icone} ${r.nome} · ${r.horario}<span class="n">${kcalRef} kcal</span></div>
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

          <div class="card livre-card">
            <div class="card-tt" style="margin-bottom:8px">🍕 Refeição livre</div>
            <p style="font-size:13.5px;color:#4a4a4a;line-height:1.6;font-weight:600;margin:0">${Store.planoBase().livre}</p>
          </div>
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
          <div class="ref-ic">${r.icone}</div>
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
  treinos() {
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
        <button class="btn-mini" style="width:40px;height:40px" onclick="App.ir('biblioteca')">📖</button>
      </div>

      <div class="tela stagger">
        <div class="card plano-cab">
          <h3>${plano.nome}</h3>
          <p>${plano.desc}</p>
          <div class="plano-tags">
            <span class="tag">🎯 ${App.rotuloObjetivo()}</span>
            <span class="tag">📅 ${plano.frequencia}</span>
            <span class="tag">🏃 Cardio: ${(CARDIO_POR_OBJETIVO[Store.db.perfil.objetivo] || CARDIO_POR_OBJETIVO.manutencao).frequencia.toLowerCase()}</span>
          </div>
          <p style="font-size:12.5px;opacity:.9;margin-top:12px;line-height:1.5;font-weight:600">
            ${(CARDIO_POR_OBJETIVO[Store.db.perfil.objetivo] || CARDIO_POR_OBJETIVO.manutencao).porque}
          </p>
        </div>

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
              <div class="em">🌙</div>
              <h3>Dia de Descanso</h3>
              <p>${dia.sugestao}</p>
            </div>
          </div>
          ${Telas._cardio(true)}` : `
          <div class="card">
            <div class="card-tt">🏋️ ${dia.foco}<span class="n">${dia.exercicios.length} exercícios</span></div>
            ${dia.exercicios.map((e, i) => Telas._exercicio(e, i)).join('')}
          </div>

          ${Telas._cardio(false)}

          ${ehHoje ? (feito
            ? `<div class="treino-feito">✓ Treino concluído hoje</div>`
            : `<button class="btn" onclick="App.marcarTreino()">Marcar treino como concluído</button>`) : `
            <div class="aviso">Este é o treino de ${dia.diaLongo}. Você só marca como concluído no dia.</div>`}
        `}

        ${Telas._organizarSemana(plano, dias)}
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
          ${semCardio ? '🛌' : '🏃'} ${bloco.titulo}
          <span class="n">${c.frequencia}</span>
        </div>
        <p class="cardio-txt">${bloco.texto}</p>
        <p class="cardio-dica">${bloco.dica}</p>
      </div>`;
  },

  /* linha do exercício, com seta que abre o registro de carga */
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

          <div class="carga-form">
            <div class="carga-campo">
              <label>Carga (kg)</label>
              <input id="carga-peso" type="number" inputmode="decimal" step="0.5"
                     placeholder="0" value="${ultima ? ultima.peso : ''}" onclick="event.stopPropagation()">
            </div>
            <div class="carga-campo">
              <label>Repetições</label>
              <input id="carga-reps" type="number" inputmode="numeric"
                     placeholder="${String(e.reps).replace(/\D/g, '') || '12'}"
                     value="${ultima && ultima.reps ? ultima.reps : ''}" onclick="event.stopPropagation()">
            </div>
            <button class="carga-btn" onclick="event.stopPropagation();App.salvarCarga(${i})">Salvar</button>
          </div>
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
            <select class="sel-dia ${d.descanso ? 'sel-descanso' : ''}" onchange="App.trocarDiaTreino(${i}, this.value)">
              ${plano.dias.map((op, idx) => `
                <option value="${idx}" ${ordem[i] === idx ? 'selected' : ''}>${rotulos[idx]}</option>
              `).join('')}
            </select>
          </div>`).join('')}

        ${padrao ? '' : `
          <button class="btn sec" style="margin-top:14px" onclick="App.restaurarOrdem()">
            Voltar à ordem original do plano
          </button>`}
      </div>`;
  },

  /* ============ BIBLIOTECA DE EXERCÍCIOS ============ */
  biblioteca() {
    const busca = App.busca.toLowerCase();
    const lista = BIBLIOTECA.filter(e =>
      (App.cat === 'Todos' || e.cat === App.cat) &&
      (!busca || e.nome.toLowerCase().includes(busca) || e.musc.join(' ').toLowerCase().includes(busca))
    );

    return `
      <div class="topo">
        <div>
          <h1 class="display">Exercícios</h1>
          <div class="topo-sub">${BIBLIOTECA.length} exercícios com execução explicada</div>
        </div>
        <button class="btn-mini" style="width:40px;height:40px" onclick="App.ir('treinos')">✕</button>
      </div>

      <div class="tela">
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
          </div>`).join('') : `
          <div class="vazio">
            <div class="em">🔍</div>
            <p>Nenhum exercício encontrado para essa busca.</p>
          </div>`}
      </div>`;
  },

  /* ============ METAS ============ */
  metas() {
    const p = Store.db.perfil;
    const ms = Store.metasSemana();

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
      <div class="topo">
        <div>
          <h1 class="display">Suas metas</h1>
          <div class="topo-sub">Onde você começou, onde está e onde quer chegar</div>
        </div>
      </div>

      <div class="tela stagger">
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
          <div class="card-tt">📉 Evolução do peso<span class="n">${Store.db.pesagens.length} pesagens</span></div>
          ${Comp.grafico(Store.seriePeso())}
          <button class="btn" style="margin-top:14px" onclick="App.abrirPeso()">Registrar pesagem de hoje</button>
        </div>

        <div class="card">
          <div class="card-tt">🎯 Metas diárias</div>
          <div class="lista-item"><span class="lista-k">Calorias por dia</span><span class="lista-v">${p.meta_kcal} kcal</span></div>
          <div class="lista-item"><span class="lista-k">Proteína por dia</span><span class="lista-v">${p.meta_prot} g</span></div>
          <div class="lista-item"><span class="lista-k">Água por dia</span><span class="lista-v">${(p.meta_agua/1000).toFixed(1)} L</span></div>
          <div class="lista-item"><span class="lista-k">Sono por noite</span><span class="lista-v">${p.meta_sono} h</span></div>
        </div>

        <div class="card">
          <div class="card-tt">✅ Metas batidas nos últimos 7 dias</div>
          <div class="grid2">
            <div class="stat" style="box-shadow:none;border-color:var(--linha)"><div class="ic">💧</div><div class="n">${ms.agua}<small>/7</small></div><div class="l">Meta de água</div></div>
            <div class="stat" style="box-shadow:none;border-color:var(--linha)"><div class="ic">😴</div><div class="n">${ms.sono}<small>/7</small></div><div class="l">Meta de sono</div></div>
            <div class="stat" style="box-shadow:none;border-color:var(--linha)"><div class="ic">🏋️</div><div class="n">${ms.treino}<small>/5</small></div><div class="l">Treinos feitos</div></div>
            <div class="stat" style="box-shadow:none;border-color:var(--linha)"><div class="ic">🍽️</div><div class="n">${ms.dieta}<small>/7</small></div><div class="l">Dieta completa</div></div>
          </div>
        </div>
      </div>`;
  },

  /* ============ PROGRESSO ============ */
  progresso() {
    const r = Store.resumo(App.periodo);
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
        <div class="toggle">
          <button class="${App.periodo === 'semana' ? 'on' : ''}" onclick="App.setPeriodo('semana')">Semana</button>
          <button class="${App.periodo === 'mes' ? 'on' : ''}" onclick="App.setPeriodo('mes')">Mês</button>
        </div>

        <div class="grid2">
          <div class="stat"><div class="ic">🏋️</div><div class="n">${r.treinos}</div><div class="l">Treinos concluídos</div></div>
          <div class="stat"><div class="ic">💧</div><div class="n">${r.agua}<small>L</small></div><div class="l">Água bebida</div></div>
          <div class="stat"><div class="ic">🔥</div><div class="n">${r.kcalMedia}<small>kcal</small></div><div class="l">Média por dia</div></div>
          <div class="stat"><div class="ic">🥩</div><div class="n">${r.prot}<small>g</small></div><div class="l">Proteína total</div></div>
          <div class="stat"><div class="ic">⚖️</div><div class="n" style="color:${r.pesoPerdido > 0 ? 'var(--verde)' : 'inherit'}">${r.pesoPerdido > 0 ? '−' : ''}${Math.abs(r.pesoPerdido)}<small>kg</small></div><div class="l">Peso no período</div></div>
          <div class="stat"><div class="ic">🍽️</div><div class="n">${r.refeicoes}</div><div class="l">Refeições completas</div></div>
        </div>

        <div class="card" style="margin-top:14px">
          <div class="card-tt">📅 Consistência</div>
          <div class="meta-topo" style="margin-bottom:8px">
            <span class="meta-nome">Dias ativos no período</span>
            <span class="meta-num">${r.diasAtivos} de ${r.dias}</span>
          </div>
          <div class="barra" style="height:9px"><i style="width:${Math.round((r.diasAtivos / r.dias) * 100)}%"></i></div>
          <div style="font-size:12.5px;color:var(--cinza);margin-top:11px;font-weight:600">
            Sequência atual: <b style="color:var(--tinta)">${Store.streak()} ${Store.streak() === 1 ? 'dia' : 'dias'}</b> sem falhar.
          </div>
        </div>

        ${Telas._evolucaoCargas()}

        <div class="card nivel-card" style="background:linear-gradient(135deg, ${nv.cor1}, ${nv.cor2})">
          <div class="nivel-topo">
            <div class="nivel-emoji">${nv.icone}</div>
            <div>
              <div class="nivel-n">Nível ${nv.n} de ${nv.totalNiveis}</div>
              <div class="nivel-nome">${nv.nome}</div>
            </div>
            <div class="nivel-pts"><b>${nv.pontos}</b><span>pontos</span></div>
          </div>
          <div class="nivel-barra"><i style="width:${nv.pct}%"></i></div>
          <div class="nivel-falta">${nv.proximo ? `Faltam ${nv.faltam} pontos para <b>${nv.proximo.nome}</b>` : 'Nível máximo. 👑'}</div>
        </div>

        <h3 class="secao-tt">Como ganhar pontos</h3>
        <div class="card">
          <div class="lista-item"><span class="lista-k">Marcar um alimento</span><span class="lista-v">+${PONTOS.alimento}</span></div>
          <div class="lista-item"><span class="lista-k">Concluir uma refeição inteira</span><span class="lista-v">+${PONTOS.refeicao}</span></div>
          <div class="lista-item"><span class="lista-k">Bater a meta de água</span><span class="lista-v">+${PONTOS.agua}</span></div>
          <div class="lista-item"><span class="lista-k">Bater a meta de sono</span><span class="lista-v">+${PONTOS.sono}</span></div>
          <div class="lista-item"><span class="lista-k">Concluir o treino do dia</span><span class="lista-v">+${PONTOS.treino}</span></div>
          <div class="lista-item"><span class="lista-k">Registrar uma pesagem</span><span class="lista-v">+${PONTOS.pesagem}</span></div>
        </div>

        <h3 class="secao-tt">Todos os níveis</h3>
        <div class="card">
          ${NIVEIS.map(n => `
            <div class="lista-item" style="${n.n === nv.n ? 'background:var(--verde-tint2);margin:0 -18px;padding:15px 18px;border-radius:12px' : ''}">
              <span style="font-size:20px">${n.icone}</span>
              <div>
                <div style="font-size:14px;font-weight:800">${n.nome}</div>
                <div style="font-size:11.5px;color:var(--cinza);font-weight:600">${n.frase}</div>
              </div>
              <span class="lista-v" style="font-size:12.5px;color:${nv.pontos >= n.min ? 'var(--verde)' : 'var(--cinza-c)'}">
                ${nv.pontos >= n.min ? '✓' : n.min + ' pts'}
              </span>
            </div>`).join('')}
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
          <div class="em">🏋️</div>
          <p>Anote as cargas na aba de Treinos, tocando na seta<br>de cada exercício, e a evolução aparece aqui.</p>
        </div>
      </div>`;

    const totalGanho = Math.round(lista.reduce((s, e) => s + Math.max(0, e.ganho), 0) * 10) / 10;

    return `
      <h3 class="secao-tt">Evolução de carga</h3>
      <div class="card">
        <div class="card-tt">🏋️ Por exercício<span class="n">${lista.length} registrados</span></div>

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
  perfil() {
    const p = Store.db.perfil;
    const nv = Store.nivel();
    const email = Backend.emailAtual();

    return `
      <div class="tela stagger" style="padding-top:26px">
        <div class="perfil-topo">
          <div class="perfil-av">${p.nome[0].toUpperCase()}</div>
          <div class="perfil-nome display">${p.nome}</div>
          <div class="perfil-mail">${email || 'Conta local neste aparelho'}</div>
          <div style="display:inline-flex;align-items:center;gap:7px;background:var(--verde-tint);color:var(--verde-esc);padding:7px 14px;border-radius:20px;font-size:12.5px;font-weight:800;margin-top:12px">
            ${nv.icone} Nível ${nv.n} · ${nv.nome}
          </div>
        </div>

        <div class="card">
          <div class="card-tt">👤 Seus dados</div>
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
        <path d="${d}" fill="none" stroke="#159A55" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${x(vals.length - 1).toFixed(1)}" cy="${y(vals[vals.length - 1]).toFixed(1)}" r="2.8" fill="#159A55"/>
      </svg>`;
  },

  /* gráfico de linha do peso */
  grafico(serie) {
    if (serie.length < 2) {
      return `<div class="vazio" style="padding:30px 20px">
                <div class="em">⚖️</div>
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
              <stop offset="0%" stop-color="#159A55" stop-opacity=".26"/>
              <stop offset="100%" stop-color="#159A55" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <line x1="${pad}" y1="${H-26}" x2="${W-12}" y2="${H-26}" stroke="#E6EDE9"/>
          <line x1="${pad}" y1="${H/2-13}" x2="${W-12}" y2="${H/2-13}" stroke="#E6EDE9" stroke-dasharray="3,4"/>
          <text class="g-eixo" x="4" y="${y(max-1.5)+4}">${max.toFixed(0)}</text>
          <text class="g-eixo" x="4" y="${y(min+1.5)+4}">${min.toFixed(0)}</text>
          <path d="${area}" fill="url(#gradPeso)"/>
          <path d="${linha}" fill="none" stroke="#159A55" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          ${serie.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.peso).toFixed(1)}" r="3.5" fill="#fff" stroke="#159A55" stroke-width="2.5"/>`).join('')}
        </svg>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--cinza-c);font-weight:700;padding:0 4px">
        <span>${App.dataCurta(serie[0].data)}</span>
        <span>${App.dataCurta(serie[serie.length-1].data)}</span>
      </div>`;
  }
};
