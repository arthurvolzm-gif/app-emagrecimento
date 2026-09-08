/* =========================================================
   DADOS DO APP — planos, treinos, biblioteca e gamificação
   Tudo aqui é conteúdo (não lógica). Para editar cardápios ou
   treinos, mexa só neste arquivo.
   ========================================================= */

/* ---------- NÍVEIS (gamificação por pontos) ----------
   Nomes escolhidos para servirem a homens e mulheres sem flexão
   de gênero. `cor1`/`cor2` formam o degradê do cartão de nível,
   que vai esquentando conforme a pessoa evolui.                  */
const NIVEIS = [
  { n:1,  nome:'Iniciante',    min:0,     icone:'🌱', cor1:'#0E7A42', cor2:'#3FBE7C', frase:'Você deu o primeiro passo.' },
  { n:2,  nome:'Persistente',  min:250,   icone:'🔥', cor1:'#127A4E', cor2:'#4CC98A', frase:'A rotina começou a pegar.' },
  { n:3,  nome:'Constante',    min:700,   icone:'⚡', cor1:'#127257', cor2:'#3FC2A0', frase:'Já não é força de vontade, virou hábito.' },
  { n:4,  nome:'Consistente',  min:1500,  icone:'🎯', cor1:'#106A67', cor2:'#3CB9C4', frase:'Você aparece até nos dias difíceis.' },
  { n:5,  nome:'Imbatível',    min:2800,  icone:'💪', cor1:'#155E7C', cor2:'#3FA3D4', frase:'Um mês inteiro de escolhas certas.' },
  { n:6,  nome:'Imparável',    min:4800,  icone:'🚀', cor1:'#2B4E96', cor2:'#5B86E0', frase:'Nada mais tira você do trilho.' },
  { n:7,  nome:'Inabalável',   min:7500,  icone:'🛡️', cor1:'#4A3E9E', cor2:'#8A72E8', frase:'O corpo mudou e a cabeça também.' },
  { n:8,  nome:'Referência',   min:11000, icone:'⭐', cor1:'#7A3A8E', cor2:'#C06BD8', frase:'As pessoas à sua volta já repararam.' },
  { n:9,  nome:'Elite',        min:15500, icone:'💎', cor1:'#9E3A63', cor2:'#E0709C', frase:'Poucos chegam onde você chegou.' },
  { n:10, nome:'Lenda',        min:21000, icone:'👑', cor1:'#A8641A', cor2:'#F0B23F', frase:'Outro corpo, outra pessoa.' }
];

/* pontos por ação concluída */
const PONTOS = {
  alimento:   3,   // cada alimento marcado
  refeicao:   10,  // bônus ao concluir a refeição inteira
  agua:       20,  // bater a meta de água do dia
  sono:       20,  // bater a meta de sono do dia
  treino:     40,  // concluir o treino do dia
  pesagem:    15   // registrar uma pesagem
};

/* ---------- PLANOS ALIMENTARES ----------
   Um plano por objetivo. Os valores são a BASE de referência: o app
   reescala todas as gramagens para a meta calórica de cada pessoa.

   - `alt`      : lista de trocas equivalentes para aquele alimento
   - `opcional` : não conta para "refeição completa", mas soma calorias
                  se a pessoa marcar (caso da sobremesa)                  */
const PLANOS_ALIMENTARES = {

  /* ===== EMAGRECIMENTO (cutting) — déficit com proteína alta ===== */
  emagrecimento: {
    kcalBase: 1650,
    livre: 'Uma refeição livre por semana, de preferência no fim de semana e no lugar de uma refeição comum, não somada a ela.',
    refeicoes: [
      {
        id: 'cafe', nome: 'Café da Manhã', horario: '07:00', icone: '☀️',
        alimentos: [
          { id:'c1', nome:'Ovos mexidos', g:100, un:'2 unidades', kcal:155, prot:13,
            alt:['200g de claras + 1 gema','1 scoop de whey (30g)','120g de queijo cottage','150g de iogurte proteico'] },
          { id:'c2', nome:'Pão integral', g:50, un:'2 fatias', kcal:130, prot:6,
            alt:['2 fatias de pão de forma integral','1 pão francês sem miolo','40g de tapioca','40g de aveia em flocos','1 crepioca (1 ovo + 20g de goma)'] },
          { id:'c3', nome:'Queijo branco', g:30, un:'1 fatia', kcal:72, prot:5,
            alt:['1 fatia de queijo minas','2 col. de requeijão light','15g de pasta de amendoim'] },
          { id:'c4', nome:'Mamão papaia', g:120, un:'1/2 unidade', kcal:48, prot:1,
            alt:['1 fatia de melão','8 morangos','1 fatia de abacaxi','1 laranja','1/2 banana'] },
          { id:'c5', nome:'Café sem açúcar', g:200, un:'1 xícara', kcal:5, prot:0,
            alt:['Chá verde','Chá de hibisco','Café com adoçante'] }
        ]
      },
      {
        id: 'lanche1', nome: 'Lanche da Manhã', horario: '10:00', icone: '🍎',
        alimentos: [
          { id:'l1', nome:'Iogurte natural desnatado', g:170, un:'1 pote', kcal:90, prot:15,
            alt:['120g de queijo cottage','1 scoop de whey com água','2 ovos cozidos','200g de leite desnatado'] },
          { id:'l2', nome:'Castanha-do-pará', g:15, un:'3 unidades', kcal:98, prot:2,
            alt:['15g de amêndoas','15g de nozes','10 amendoins','1 col. de pasta de amendoim'] }
        ]
      },
      {
        id: 'almoco', nome: 'Almoço', horario: '12:30', icone: '🍽️',
        alimentos: [
          { id:'a1', nome:'Arroz integral cozido', g:100, un:'4 col. sopa', kcal:124, prot:3,
            alt:['100g de arroz branco','100g de quinoa','150g de batata-doce','120g de macarrão integral','130g de mandioca'] },
          { id:'a2', nome:'Feijão cozido', g:80, un:'1 concha', kcal:61, prot:4,
            alt:['80g de lentilha','80g de grão-de-bico','80g de ervilha'] },
          { id:'a3', nome:'Peito de frango grelhado', g:130, un:'1 filé médio', kcal:214, prot:40,
            alt:['150g de tilápia','120g de patinho','130g de peito de peru','3 ovos inteiros','150g de merluza'] },
          { id:'a4', nome:'Legumes cozidos', g:120, un:'à vontade', kcal:48, prot:2,
            alt:['Brócolis','Abobrinha','Chuchu','Cenoura','Vagem','Couve-flor'] },
          { id:'a5', nome:'Salada crua', g:150, un:'à vontade', kcal:30, prot:1,
            alt:['Alface, tomate e pepino','Rúcula com cebola','Repolho com cenoura','Acelga com tomate'] },
          { id:'a6', nome:'Sobremesa', g:100, un:'se quiser', kcal:70, prot:1, opcional:true,
            alt:['1 fruta média','1 pote de gelatina diet','20g de chocolate 70%','1 picolé de fruta'] }
        ]
      },
      {
        id: 'lanche2', nome: 'Lanche da Tarde', horario: '16:00', icone: '🥤',
        alimentos: [
          { id:'l3', nome:'Whey protein', g:30, un:'1 scoop', kcal:120, prot:24,
            alt:['2 ovos cozidos','170g de iogurte proteico','120g de queijo cottage','100g de atum'] },
          { id:'l4', nome:'Banana', g:100, un:'1 unidade', kcal:89, prot:1,
            alt:['1 maçã','1 pera','1 fatia de melão','1 laranja','2 fatias de abacaxi'] }
        ]
      },
      {
        id: 'jantar', nome: 'Jantar', horario: '19:30', icone: '🌙',
        alimentos: [
          { id:'j1', nome:'Omelete (2 ovos + legumes)', g:150, un:'1 porção', kcal:190, prot:15,
            alt:['120g de frango desfiado','150g de peixe grelhado','130g de carne moída magra','1 crepioca com frango'] },
          { id:'j2', nome:'Batata-doce cozida', g:100, un:'1 unidade pequena', kcal:86, prot:2,
            alt:['80g de mandioca','100g de inhame','80g de arroz integral','2 fatias de pão integral'] },
          { id:'j3', nome:'Salada verde', g:150, un:'à vontade', kcal:25, prot:1,
            alt:['Folhas variadas com 1 fio de azeite','Legumes refogados','Sopa de legumes'] }
        ]
      }
    ]
  },

  /* ===== HIPERTROFIA (bulking) — superávit controlado ===== */
  hipertrofia: {
    kcalBase: 2600,
    livre: 'Uma refeição livre por semana. No bulking ela costuma cair bem no dia do treino mais pesado.',
    refeicoes: [
      {
        id: 'cafe', nome: 'Café da Manhã', horario: '07:00', icone: '☀️',
        alimentos: [
          { id:'c1', nome:'Ovos inteiros', g:150, un:'3 unidades', kcal:233, prot:19,
            alt:['2 ovos + 100g de claras','2 scoops de whey','200g de queijo cottage'] },
          { id:'c2', nome:'Pão integral', g:100, un:'4 fatias', kcal:260, prot:12,
            alt:['2 pães franceses','80g de tapioca','2 crepiocas','100g de aveia em flocos'] },
          { id:'c3', nome:'Aveia em flocos', g:40, un:'4 col. sopa', kcal:155, prot:5,
            alt:['40g de granola sem açúcar','2 fatias extras de pão','40g de cuscuz'] },
          { id:'c4', nome:'Banana', g:100, un:'1 unidade', kcal:89, prot:1,
            alt:['150g de mamão','120g de manga','1 fatia de melancia','1 punhado de uvas'] },
          { id:'c5', nome:'Pasta de amendoim', g:20, un:'1 col. sopa', kcal:118, prot:5,
            alt:['20g de castanhas','1 fatia de queijo + 1 col. de requeijão','1/2 abacate pequeno'] }
        ]
      },
      {
        id: 'lanche1', nome: 'Lanche da Manhã', horario: '10:00', icone: '🍎',
        alimentos: [
          { id:'l1', nome:'Iogurte natural integral', g:200, un:'1 pote', kcal:122, prot:11,
            alt:['150g de queijo cottage','300ml de leite integral','1 vitamina de banana com leite'] },
          { id:'l2', nome:'Granola sem açúcar', g:40, un:'3 col. sopa', kcal:180, prot:5,
            alt:['40g de aveia + 10g de mel','2 fatias de pão integral','40g de castanhas'] }
        ]
      },
      {
        id: 'almoco', nome: 'Almoço', horario: '12:30', icone: '🍽️',
        alimentos: [
          { id:'a1', nome:'Arroz branco ou integral', g:180, un:'7 col. sopa', kcal:234, prot:5,
            alt:['150g de macarrão integral','250g de batata-doce','200g de mandioca','180g de quinoa'] },
          { id:'a2', nome:'Feijão cozido', g:120, un:'1 concha e meia', kcal:92, prot:6,
            alt:['120g de lentilha','120g de grão-de-bico','120g de feijão preto'] },
          { id:'a3', nome:'Patinho moído ou frango', g:180, un:'1 porção grande', kcal:306, prot:52,
            alt:['180g de salmão','200g de tilápia','180g de coxão mole','4 ovos + 100g de frango'] },
          { id:'a4', nome:'Legumes cozidos', g:120, un:'à vontade', kcal:48, prot:2,
            alt:['Brócolis','Abobrinha','Cenoura','Couve-flor','Vagem'] },
          { id:'a5', nome:'Salada crua com azeite', g:150, un:'à vontade', kcal:90, prot:1,
            alt:['Folhas variadas + 1 fio de azeite','Salada de tomate com azeite','Salada com 1/4 de abacate'] },
          { id:'a6', nome:'Sobremesa', g:100, un:'se quiser', kcal:110, prot:2, opcional:true,
            alt:['1 fruta grande','1 pote de iogurte com mel','30g de chocolate 70%','1 bola de sorvete'] }
        ]
      },
      {
        id: 'lanche2', nome: 'Lanche Pré-Treino', horario: '16:00', icone: '⚡',
        alimentos: [
          { id:'l3', nome:'Whey protein', g:30, un:'1 scoop', kcal:120, prot:24,
            alt:['3 ovos cozidos','200g de iogurte proteico','150g de frango desfiado'] },
          { id:'l4', nome:'Pão integral com mel', g:60, un:'2 fatias', kcal:180, prot:7,
            alt:['50g de tapioca','150g de banana','60g de aveia','1 batata-doce média'] }
        ]
      },
      {
        id: 'jantar', nome: 'Jantar', horario: '20:00', icone: '🌙',
        alimentos: [
          { id:'j1', nome:'Frango grelhado ou carne magra', g:160, un:'1 filé grande', kcal:264, prot:49,
            alt:['4 ovos inteiros','180g de peixe','160g de patinho','170g de peito de peru'] },
          { id:'j2', nome:'Batata-doce ou mandioca', g:180, un:'1 porção', kcal:155, prot:3,
            alt:['150g de arroz integral','150g de macarrão','4 fatias de pão integral'] },
          { id:'j3', nome:'Legumes e salada', g:180, un:'à vontade', kcal:60, prot:2,
            alt:['Legumes refogados','Salada com azeite','Sopa de legumes com frango'] }
        ]
      }
    ]
  },

  /* ===== MANUTENÇÃO — sustentar o peso e melhorar a composição ===== */
  manutencao: {
    kcalBase: 2050,
    livre: 'Uma a duas refeições livres por semana, sem exagero no restante dos dias.',
    refeicoes: [
      {
        id: 'cafe', nome: 'Café da Manhã', horario: '07:00', icone: '☀️',
        alimentos: [
          { id:'c1', nome:'Ovos mexidos', g:120, un:'2 unidades e 1 clara', kcal:180, prot:16,
            alt:['200g de iogurte proteico','1 scoop de whey','150g de queijo cottage'] },
          { id:'c2', nome:'Pão integral', g:60, un:'2 fatias', kcal:156, prot:7,
            alt:['1 pão francês','50g de tapioca','50g de aveia','1 crepioca'] },
          { id:'c3', nome:'Queijo branco', g:30, un:'1 fatia', kcal:72, prot:5,
            alt:['2 col. de requeijão','15g de pasta de amendoim','1 fatia de peito de peru'] },
          { id:'c4', nome:'Fruta da estação', g:130, un:'1 porção', kcal:60, prot:1,
            alt:['Mamão','Melão','Morango','Banana','Laranja'] },
          { id:'c5', nome:'Café sem açúcar', g:200, un:'1 xícara', kcal:5, prot:0,
            alt:['Chá verde','Café com adoçante','Chá de hibisco'] }
        ]
      },
      {
        id: 'lanche1', nome: 'Lanche da Manhã', horario: '10:00', icone: '🍎',
        alimentos: [
          { id:'l1', nome:'Iogurte natural', g:170, un:'1 pote', kcal:104, prot:12,
            alt:['130g de queijo cottage','1 scoop de whey','2 ovos cozidos'] },
          { id:'l2', nome:'Castanhas variadas', g:20, un:'1 punhado', kcal:130, prot:3,
            alt:['20g de amêndoas','20g de nozes','1 col. de pasta de amendoim'] }
        ]
      },
      {
        id: 'almoco', nome: 'Almoço', horario: '12:30', icone: '🍽️',
        alimentos: [
          { id:'a1', nome:'Arroz integral', g:130, un:'5 col. sopa', kcal:161, prot:4,
            alt:['130g de arroz branco','180g de batata-doce','130g de quinoa','150g de macarrão'] },
          { id:'a2', nome:'Feijão cozido', g:100, un:'1 concha', kcal:76, prot:5,
            alt:['100g de lentilha','100g de grão-de-bico','100g de feijão preto'] },
          { id:'a3', nome:'Proteína grelhada', g:150, un:'1 filé', kcal:247, prot:45,
            alt:['Frango','Patinho','Tilápia','Peito de peru','3 ovos + 80g de frango'] },
          { id:'a4', nome:'Legumes cozidos', g:120, un:'à vontade', kcal:48, prot:2,
            alt:['Brócolis','Abobrinha','Cenoura','Vagem','Couve-flor'] },
          { id:'a5', nome:'Salada crua', g:150, un:'à vontade', kcal:40, prot:1,
            alt:['Folhas variadas','Tomate com cebola','Repolho com cenoura'] },
          { id:'a6', nome:'Sobremesa', g:100, un:'se quiser', kcal:90, prot:1, opcional:true,
            alt:['1 fruta média','1 gelatina','25g de chocolate 70%','1 pote de iogurte'] }
        ]
      },
      {
        id: 'lanche2', nome: 'Lanche da Tarde', horario: '16:00', icone: '🥤',
        alimentos: [
          { id:'l3', nome:'Whey ou ovos', g:30, un:'1 scoop', kcal:120, prot:24,
            alt:['2 ovos cozidos','170g de iogurte proteico','100g de atum'] },
          { id:'l4', nome:'Fruta', g:120, un:'1 unidade', kcal:70, prot:1,
            alt:['Banana','Maçã','Pera','Laranja','Melão'] }
        ]
      },
      {
        id: 'jantar', nome: 'Jantar', horario: '19:30', icone: '🌙',
        alimentos: [
          { id:'j1', nome:'Proteína (carne, frango ou peixe)', g:140, un:'1 porção', kcal:231, prot:42,
            alt:['Omelete de 3 ovos','140g de peixe','140g de frango','140g de patinho'] },
          { id:'j2', nome:'Carboidrato', g:130, un:'1 porção', kcal:112, prot:3,
            alt:['Batata-doce','Arroz integral','Mandioca','2 fatias de pão integral'] },
          { id:'j3', nome:'Salada e legumes', g:170, un:'à vontade', kcal:45, prot:2,
            alt:['Salada verde','Legumes refogados','Sopa de legumes'] }
        ]
      }
    ]
  }
};

/* ---------- TREINOS ----------
   Chave: `${sexo}_${local}` → plano semanal.
   'descanso: true' vira card de descanso na agenda.            */
const PLANOS_TREINO = {
  feminino_academia: {
    nome: 'Plano Feminino · Academia',
    desc: 'Foco em glúteos e pernas, com superior e cardio para acelerar o gasto calórico.',
    frequencia: '5x por semana',
    dias: [
      { dia: 'Seg', foco: 'Glúteos e Posterior', exercicios: [
        { ex: 'Agachamento livre', series: 4, reps: '12', desc: '90s' },
        { ex: 'Levantamento terra romeno', series: 4, reps: '12', desc: '90s' },
        { ex: 'Elevação pélvica', series: 4, reps: '15', desc: '60s' },
        { ex: 'Cadeira flexora', series: 3, reps: '15', desc: '60s' },
        { ex: 'Coice na polia', series: 3, reps: '15 cada', desc: '45s' }
      ]},
      { dia: 'Ter', foco: 'Superior (Costas e Bíceps)', exercicios: [
        { ex: 'Puxada frontal', series: 4, reps: '12', desc: '60s' },
        { ex: 'Remada baixa', series: 4, reps: '12', desc: '60s' },
        { ex: 'Rosca direta', series: 3, reps: '12', desc: '45s' },
        { ex: 'Rosca martelo', series: 3, reps: '12', desc: '45s' },
        { ex: 'Prancha abdominal', series: 3, reps: '40s', desc: '30s' }
      ]},
      { dia: 'Qua', foco: 'Quadríceps e Panturrilha', exercicios: [
        { ex: 'Leg press 45°', series: 4, reps: '15', desc: '90s' },
        { ex: 'Cadeira extensora', series: 4, reps: '15', desc: '60s' },
        { ex: 'Afundo com halteres', series: 3, reps: '12 cada', desc: '60s' },
        { ex: 'Panturrilha em pé', series: 4, reps: '20', desc: '45s' },
        { ex: 'Abdominal infra', series: 3, reps: '15', desc: '30s' }
      ]},
      { dia: 'Qui', foco: 'Superior (Ombro e Tríceps)', exercicios: [
        { ex: 'Desenvolvimento com halteres', series: 4, reps: '12', desc: '60s' },
        { ex: 'Elevação lateral', series: 4, reps: '15', desc: '45s' },
        { ex: 'Tríceps na polia', series: 3, reps: '15', desc: '45s' },
        { ex: 'Supino reto com halteres', series: 3, reps: '12', desc: '60s' }
      ]},
      { dia: 'Sex', foco: 'Glúteos e Cardio', exercicios: [
        { ex: 'Agachamento sumô', series: 4, reps: '15', desc: '60s' },
        { ex: 'Elevação pélvica com barra', series: 4, reps: '12', desc: '90s' },
        { ex: 'Abdução na máquina', series: 4, reps: '20', desc: '45s' }
      ]},
      { dia: 'Sáb', descanso: true, sugestao: 'Caminhada leve de 30 a 40 minutos, se quiser.' },
      { dia: 'Dom', descanso: true, sugestao: 'Descanso total. Recuperação é parte do treino.' }
    ]
  },

  feminino_casa: {
    nome: 'Plano Feminino · Em Casa',
    desc: 'Peso do corpo e elásticos, sem equipamento. Alta densidade para queima calórica.',
    frequencia: '5x por semana',
    dias: [
      { dia: 'Seg', foco: 'Glúteos e Pernas', exercicios: [
        { ex: 'Agachamento livre', series: 4, reps: '20', desc: '45s' },
        { ex: 'Elevação pélvica no chão', series: 4, reps: '20', desc: '45s' },
        { ex: 'Afundo alternado', series: 3, reps: '15 cada', desc: '45s' },
        { ex: 'Coice de quatro apoios', series: 3, reps: '20 cada', desc: '30s' },
        { ex: 'Panturrilha em pé', series: 4, reps: '25', desc: '30s' }
      ]},
      { dia: 'Ter', foco: 'Superior e Core', exercicios: [
        { ex: 'Flexão de joelhos', series: 4, reps: '12', desc: '45s' },
        { ex: 'Remada com elástico', series: 4, reps: '15', desc: '45s' },
        { ex: 'Prancha abdominal', series: 3, reps: '40s', desc: '30s' },
        { ex: 'Abdominal remador', series: 3, reps: '15', desc: '30s' }
      ]},
      { dia: 'Qua', foco: 'Cardio e Abdômen', exercicios: [
        { ex: 'Polichinelo', series: 4, reps: '40s', desc: '20s' },
        { ex: 'Corrida estacionária', series: 4, reps: '40s', desc: '20s' },
        { ex: 'Mountain climber', series: 4, reps: '30s', desc: '30s' },
        { ex: 'Prancha lateral', series: 3, reps: '30s cada', desc: '30s' }
      ]},
      { dia: 'Qui', foco: 'Glúteos e Posterior', exercicios: [
        { ex: 'Agachamento sumô', series: 4, reps: '20', desc: '45s' },
        { ex: 'Ponte unilateral', series: 3, reps: '15 cada', desc: '45s' },
        { ex: 'Abdução deitada', series: 3, reps: '20 cada', desc: '30s' },
        { ex: 'Stiff com elástico', series: 3, reps: '15', desc: '45s' }
      ]},
      { dia: 'Sex', foco: 'Circuito Full Body', exercicios: [
        { ex: 'Burpee adaptado', series: 4, reps: '10', desc: '60s' },
        { ex: 'Agachamento com salto', series: 4, reps: '12', desc: '60s' },
        { ex: 'Flexão de joelhos', series: 3, reps: '12', desc: '45s' },
        { ex: 'Prancha abdominal', series: 3, reps: '45s', desc: '30s' }
      ]},
      { dia: 'Sáb', descanso: true, sugestao: 'Caminhada leve ao ar livre, se der vontade.' },
      { dia: 'Dom', descanso: true, sugestao: 'Descanso total. O corpo muda no descanso.' }
    ]
  },

  masculino_academia: {
    nome: 'Plano Masculino · Academia',
    desc: 'Divisão ABC com foco em força e preservação de massa magra durante o déficit.',
    frequencia: '5x por semana',
    dias: [
      { dia: 'Seg', foco: 'Peito e Tríceps', exercicios: [
        { ex: 'Supino reto', series: 4, reps: '10', desc: '90s' },
        { ex: 'Supino inclinado com halteres', series: 4, reps: '12', desc: '75s' },
        { ex: 'Crucifixo na máquina', series: 3, reps: '15', desc: '60s' },
        { ex: 'Tríceps testa', series: 3, reps: '12', desc: '60s' },
        { ex: 'Tríceps na polia', series: 3, reps: '15', desc: '45s' }
      ]},
      { dia: 'Ter', foco: 'Costas e Bíceps', exercicios: [
        { ex: 'Barra fixa ou puxada frontal', series: 4, reps: '10', desc: '90s' },
        { ex: 'Remada curvada', series: 4, reps: '10', desc: '90s' },
        { ex: 'Remada unilateral', series: 3, reps: '12 cada', desc: '60s' },
        { ex: 'Rosca direta', series: 3, reps: '12', desc: '45s' },
        { ex: 'Rosca martelo', series: 3, reps: '12', desc: '45s' }
      ]},
      { dia: 'Qua', foco: 'Pernas Completo', exercicios: [
        { ex: 'Agachamento livre', series: 4, reps: '10', desc: '120s' },
        { ex: 'Leg press 45°', series: 4, reps: '12', desc: '90s' },
        { ex: 'Cadeira extensora', series: 3, reps: '15', desc: '60s' },
        { ex: 'Mesa flexora', series: 3, reps: '15', desc: '60s' },
        { ex: 'Panturrilha em pé', series: 4, reps: '20', desc: '45s' }
      ]},
      { dia: 'Qui', foco: 'Ombro e Abdômen', exercicios: [
        { ex: 'Desenvolvimento militar', series: 4, reps: '10', desc: '90s' },
        { ex: 'Elevação lateral', series: 4, reps: '15', desc: '45s' },
        { ex: 'Elevação frontal', series: 3, reps: '12', desc: '45s' },
        { ex: 'Crucifixo inverso', series: 3, reps: '15', desc: '45s' },
        { ex: 'Abdominal infra', series: 4, reps: '15', desc: '30s' }
      ]},
      { dia: 'Sex', foco: 'Full Body e Cardio', exercicios: [
        { ex: 'Levantamento terra', series: 4, reps: '8', desc: '120s' },
        { ex: 'Supino reto', series: 3, reps: '12', desc: '75s' },
        { ex: 'Puxada frontal', series: 3, reps: '12', desc: '60s' }
      ]},
      { dia: 'Sáb', descanso: true, sugestao: 'Cardio leve opcional: caminhada, bike ou natação.' },
      { dia: 'Dom', descanso: true, sugestao: 'Descanso total. Recuperação é parte do treino.' }
    ]
  },

  masculino_casa: {
    nome: 'Plano Masculino · Em Casa',
    desc: 'Peso do corpo, com progressão de dificuldade e circuitos metabólicos.',
    frequencia: '5x por semana',
    dias: [
      { dia: 'Seg', foco: 'Peito, Ombro e Tríceps', exercicios: [
        { ex: 'Flexão de braço', series: 4, reps: '15', desc: '60s' },
        { ex: 'Flexão inclinada (pés elevados)', series: 3, reps: '12', desc: '60s' },
        { ex: 'Flexão diamante', series: 3, reps: '10', desc: '60s' },
        { ex: 'Mergulho na cadeira', series: 3, reps: '15', desc: '45s' }
      ]},
      { dia: 'Ter', foco: 'Costas e Bíceps', exercicios: [
        { ex: 'Remada com elástico', series: 4, reps: '15', desc: '60s' },
        { ex: 'Remada com mochila', series: 4, reps: '15', desc: '60s' },
        { ex: 'Rosca com elástico', series: 3, reps: '15', desc: '45s' },
        { ex: 'Superman', series: 3, reps: '15', desc: '45s' }
      ]},
      { dia: 'Qua', foco: 'Pernas e Glúteos', exercicios: [
        { ex: 'Agachamento livre', series: 4, reps: '20', desc: '60s' },
        { ex: 'Afundo alternado', series: 4, reps: '15 cada', desc: '60s' },
        { ex: 'Agachamento búlgaro', series: 3, reps: '12 cada', desc: '60s' },
        { ex: 'Elevação pélvica no chão', series: 3, reps: '20', desc: '45s' },
        { ex: 'Panturrilha em pé', series: 4, reps: '25', desc: '30s' }
      ]},
      { dia: 'Qui', foco: 'Core e Estabilidade', exercicios: [
        { ex: 'Prancha abdominal', series: 4, reps: '45s', desc: '30s' },
        { ex: 'Abdominal remador', series: 4, reps: '15', desc: '30s' },
        { ex: 'Prancha lateral', series: 3, reps: '30s cada', desc: '30s' },
        { ex: 'Mountain climber', series: 4, reps: '40s', desc: '20s' }
      ]},
      { dia: 'Sex', foco: 'Circuito Metabólico', exercicios: [
        { ex: 'Burpee', series: 5, reps: '10', desc: '60s' },
        { ex: 'Agachamento com salto', series: 4, reps: '15', desc: '45s' },
        { ex: 'Polichinelo', series: 4, reps: '45s', desc: '20s' },
        { ex: 'Flexão de braço', series: 3, reps: '12', desc: '45s' }
      ]},
      { dia: 'Sáb', descanso: true, sugestao: 'Caminhada ou pedalada leve, se quiser.' },
      { dia: 'Dom', descanso: true, sugestao: 'Descanso total. O músculo cresce na recuperação.' }
    ]
  }
};

/* ---------- CARDIO POR OBJETIVO ----------
   Os planos de treino acima são o esqueleto de FORÇA e mudam por sexo e
   local. O cardio é o que muda por OBJETIVO: quem está em déficit precisa
   de muito mais volume aeróbico do que quem está tentando ganhar massa.
   Por isso ele fica aqui, separado, e é aplicado por cima do plano.     */
const CARDIO_POR_OBJETIVO = {
  emagrecimento: {
    frequencia: 'Quase todos os dias',
    treino: {
      titulo: 'Cardio pós-treino',
      texto: '20 a 25 minutos em ritmo moderado logo depois do treino: esteira, bike, elíptico ou escada.',
      dica: 'Moderado é o ritmo em que você consegue falar frases curtas, mas não cantar.'
    },
    descanso: {
      titulo: 'Cardio do dia de descanso',
      texto: 'Caminhada de 30 a 40 minutos, mesmo em ritmo leve. Vale ir ao mercado a pé.',
      dica: 'Descanso é da musculação, não do movimento.'
    },
    porque: 'No déficit, o cardio amplia o gasto sem precisar cortar mais comida.'
  },

  manutencao: {
    frequencia: '3x por semana',
    treino: {
      titulo: 'Cardio pós-treino',
      texto: '15 a 20 minutos em ritmo leve a moderado, em 3 dos seus dias de treino.',
      dica: 'Escolha os dias em que sobrar mais energia.'
    },
    descanso: {
      titulo: 'Dia livre',
      texto: 'Caminhada leve se bater vontade, sem obrigação nenhuma.',
      dica: 'Manutenção também é sustentar a rotina sem sufoco.'
    },
    porque: 'Aqui o cardio é mais por saúde e disposição do que por gasto calórico.'
  },

  hipertrofia: {
    frequencia: '2x por semana',
    treino: {
      titulo: 'Cardio na dose certa',
      texto: '10 a 15 minutos em ritmo leve, no máximo 2x na semana, de preferência longe do treino de pernas.',
      dica: 'Se for fazer, deixe para depois da musculação, nunca antes.'
    },
    descanso: {
      titulo: 'Descanso de verdade',
      texto: 'Sem cardio. O corpo cresce nas horas em que você não treina.',
      dica: 'Cardio demais come o superávit que faz você ganhar massa.'
    },
    porque: 'No ganho de massa, cardio em excesso trabalha contra o seu objetivo.'
  }
};

/* ---------- BIBLIOTECA DE EXERCÍCIOS ---------- */
const BIBLIOTECA = [
  { id: 1,  nome: 'Agachamento livre',        cat: 'Pernas',   musc: ['Quadríceps','Glúteos'],   desc: 'Pés na largura dos ombros, desça até a coxa ficar paralela ao chão mantendo o peito aberto.' },
  { id: 2,  nome: 'Agachamento sumô',         cat: 'Pernas',   musc: ['Glúteos','Adutores'],     desc: 'Pés bem afastados e pontas viradas para fora. Desça controlando e suba apertando os glúteos.' },
  { id: 3,  nome: 'Leg press 45°',            cat: 'Pernas',   musc: ['Quadríceps','Glúteos'],   desc: 'Apoie os pés no meio da plataforma e evite travar os joelhos no final do movimento.' },
  { id: 4,  nome: 'Cadeira extensora',        cat: 'Pernas',   musc: ['Quadríceps'],             desc: 'Estenda os joelhos até a contração máxima e desça devagar, sem soltar o peso.' },
  { id: 5,  nome: 'Cadeira flexora',          cat: 'Pernas',   musc: ['Posterior de coxa'],      desc: 'Flexione os joelhos puxando o calcanhar em direção ao glúteo, sem tirar o quadril do banco.' },
  { id: 6,  nome: 'Mesa flexora',             cat: 'Pernas',   musc: ['Posterior de coxa'],      desc: 'Deitado de bruços, flexione os joelhos de forma controlada e segure a contração no topo.' },
  { id: 7,  nome: 'Afundo com halteres',      cat: 'Pernas',   musc: ['Quadríceps','Glúteos'],   desc: 'Passo à frente, desça até o joelho de trás quase tocar o chão e volte empurrando o calcanhar.' },
  { id: 8,  nome: 'Agachamento búlgaro',      cat: 'Pernas',   musc: ['Glúteos','Quadríceps'],   desc: 'Pé de trás apoiado num banco. Desça na vertical, concentrando o esforço na perna da frente.' },
  { id: 9,  nome: 'Levantamento terra romeno',cat: 'Pernas',   musc: ['Posterior','Glúteos'],    desc: 'Joelhos levemente flexionados, empurre o quadril para trás mantendo a coluna neutra.' },
  { id: 10, nome: 'Panturrilha em pé',        cat: 'Pernas',   musc: ['Panturrilha'],            desc: 'Suba na ponta dos pés o máximo possível e desça alongando bem, sem pressa.' },
  { id: 11, nome: 'Elevação pélvica',         cat: 'Glúteos',  musc: ['Glúteos'],                desc: 'Costas apoiadas no banco, suba o quadril até alinhar o tronco e aperte o glúteo no topo.' },
  { id: 12, nome: 'Elevação pélvica no chão', cat: 'Glúteos',  musc: ['Glúteos'],                desc: 'Deitada, pés próximos ao quadril, eleve até formar uma linha reta de joelho a ombro.' },
  { id: 13, nome: 'Coice na polia',           cat: 'Glúteos',  musc: ['Glúteos'],                desc: 'Empurre a perna para trás sem arquear a lombar, contraindo o glúteo no final.' },
  { id: 14, nome: 'Coice de quatro apoios',   cat: 'Glúteos',  musc: ['Glúteos'],                desc: 'Apoiada nos joelhos e mãos, eleve a perna dobrada em direção ao teto.' },
  { id: 15, nome: 'Abdução na máquina',       cat: 'Glúteos',  musc: ['Glúteo médio'],           desc: 'Abra as pernas contra a resistência e volte devagar, sem deixar o peso bater.' },
  { id: 16, nome: 'Abdução deitada',          cat: 'Glúteos',  musc: ['Glúteo médio'],           desc: 'Deitada de lado, eleve a perna de cima mantendo o quadril estável.' },
  { id: 17, nome: 'Ponte unilateral',         cat: 'Glúteos',  musc: ['Glúteos'],                desc: 'Mesma execução da ponte, mas com uma perna só estendida no ar.' },
  { id: 18, nome: 'Stiff com elástico',       cat: 'Glúteos',  musc: ['Posterior','Glúteos'],    desc: 'Elástico sob os pés, desça o tronco empurrando o quadril para trás.' },
  { id: 19, nome: 'Barra fixa',               cat: 'Costas',   musc: ['Dorsal','Bíceps'],        desc: 'Puxe o corpo até o queixo passar da barra, controlando a descida.' },
  { id: 20, nome: 'Puxada frontal',           cat: 'Costas',   musc: ['Dorsal'],                 desc: 'Puxe a barra até a altura do peito, aproximando as escápulas.' },
  { id: 21, nome: 'Remada curvada',           cat: 'Costas',   musc: ['Dorsal','Trapézio'],      desc: 'Tronco inclinado à frente, puxe a barra em direção ao umbigo.' },
  { id: 22, nome: 'Remada baixa',             cat: 'Costas',   musc: ['Dorsal'],                 desc: 'Sentado, puxe o triângulo até o abdômen mantendo a coluna ereta.' },
  { id: 23, nome: 'Remada unilateral',        cat: 'Costas',   musc: ['Dorsal'],                 desc: 'Apoiado no banco, puxe o halter em direção ao quadril.' },
  { id: 24, nome: 'Remada com elástico',      cat: 'Costas',   musc: ['Dorsal'],                 desc: 'Elástico preso à frente, puxe os punhos até as costelas juntando as escápulas.' },
  { id: 25, nome: 'Superman',                 cat: 'Costas',   musc: ['Lombar'],                 desc: 'Deitado de bruços, eleve braços e pernas ao mesmo tempo e segure 2 segundos.' },
  { id: 26, nome: 'Supino reto',              cat: 'Peito',    musc: ['Peitoral','Tríceps'],     desc: 'Desça a barra até o peito com os cotovelos a 45° e suba empurrando com força.' },
  { id: 27, nome: 'Supino inclinado',         cat: 'Peito',    musc: ['Peitoral superior'],      desc: 'Banco a 30-45°, desça os halteres na linha do peito alto.' },
  { id: 28, nome: 'Crucifixo',                cat: 'Peito',    musc: ['Peitoral'],               desc: 'Braços levemente flexionados, abra até sentir o alongamento e feche contraindo.' },
  { id: 29, nome: 'Flexão de braço',          cat: 'Peito',    musc: ['Peitoral','Tríceps'],     desc: 'Corpo alinhado da cabeça ao calcanhar, desça até o peito quase tocar o chão.' },
  { id: 30, nome: 'Flexão diamante',          cat: 'Peito',    musc: ['Tríceps','Peitoral'],     desc: 'Mãos juntas formando um triângulo. Foco maior no tríceps.' },
  { id: 31, nome: 'Desenvolvimento militar',  cat: 'Ombro',    musc: ['Deltoide'],               desc: 'Empurre a barra acima da cabeça sem arquear a lombar.' },
  { id: 32, nome: 'Elevação lateral',         cat: 'Ombro',    musc: ['Deltoide medial'],        desc: 'Eleve os halteres até a altura dos ombros, sem balançar o tronco.' },
  { id: 33, nome: 'Elevação frontal',         cat: 'Ombro',    musc: ['Deltoide anterior'],      desc: 'Eleve à frente até a altura dos olhos, controlando a descida.' },
  { id: 34, nome: 'Crucifixo inverso',        cat: 'Ombro',    musc: ['Deltoide posterior'],     desc: 'Tronco inclinado, abra os braços para trás juntando as escápulas.' },
  { id: 35, nome: 'Rosca direta',             cat: 'Braço',    musc: ['Bíceps'],                 desc: 'Cotovelos fixos ao lado do corpo, suba o peso sem impulso.' },
  { id: 36, nome: 'Rosca martelo',            cat: 'Braço',    musc: ['Bíceps','Antebraço'],     desc: 'Pegada neutra (palmas viradas para dentro) durante todo o movimento.' },
  { id: 37, nome: 'Tríceps na polia',         cat: 'Braço',    musc: ['Tríceps'],                desc: 'Cotovelos colados ao corpo, estenda até travar e volte devagar.' },
  { id: 38, nome: 'Tríceps testa',            cat: 'Braço',    musc: ['Tríceps'],                desc: 'Deitado, flexione os cotovelos levando a barra até a testa.' },
  { id: 39, nome: 'Mergulho na cadeira',      cat: 'Braço',    musc: ['Tríceps'],                desc: 'Mãos apoiadas na cadeira atrás do corpo, desça flexionando os cotovelos.' },
  { id: 40, nome: 'Prancha abdominal',        cat: 'Abdômen',  musc: ['Core'],                   desc: 'Antebraços no chão, corpo reto, abdômen contraído. Não deixe o quadril cair.' },
  { id: 41, nome: 'Prancha lateral',          cat: 'Abdômen',  musc: ['Oblíquos'],               desc: 'Apoiada num antebraço, quadril elevado formando linha reta.' },
  { id: 42, nome: 'Abdominal infra',          cat: 'Abdômen',  musc: ['Abdômen inferior'],       desc: 'Deitado, eleve as pernas até 90° e desça sem tocar o chão.' },
  { id: 43, nome: 'Abdominal remador',        cat: 'Abdômen',  musc: ['Core'],                   desc: 'Tronco e pernas sobem juntos, formando um "V" no ponto máximo.' },
  { id: 44, nome: 'Mountain climber',         cat: 'Cardio',   musc: ['Core','Cardio'],          desc: 'Na posição de prancha, alterne os joelhos em direção ao peito em ritmo acelerado.' },
  { id: 45, nome: 'Burpee',                   cat: 'Cardio',   musc: ['Corpo todo'],             desc: 'Agache, jogue os pés para trás, faça uma flexão, volte e salte.' },
  { id: 46, nome: 'Polichinelo',              cat: 'Cardio',   musc: ['Cardio'],                 desc: 'Salte abrindo pernas e braços simultaneamente, em ritmo constante.' },
  { id: 47, nome: 'Agachamento com salto',    cat: 'Cardio',   musc: ['Pernas','Cardio'],        desc: 'Agache e exploda num salto, aterrissando suave com joelhos levemente flexionados.' },
  { id: 48, nome: 'Corrida estacionária',     cat: 'Cardio',   musc: ['Cardio'],                 desc: 'Corra no lugar elevando bem os joelhos, mantendo o ritmo alto.' }
];

const CATEGORIAS = ['Todos', 'Pernas', 'Glúteos', 'Costas', 'Peito', 'Ombro', 'Braço', 'Abdômen', 'Cardio'];

/* ordem fixa da semana — a posição no array é o dia, o conteúdo é trocável */
const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const DIAS_SEMANA_LONGO = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
