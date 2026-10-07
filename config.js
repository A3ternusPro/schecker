/* ============================================================
   AETERNUS Checker — конфигуратор
   ------------------------------------------------------------
   Каждая ось: id, заголовок, тип (one|many), варианты.
   Вариант: [значение, подпись, теги, пояснение]
   ============================================================ */

const AXES = [

{id:'siteType', t:'Тип сайта', type:'one', req:true, opts:[
  ['shop',     'Интернет-магазин',              ['shop','catalog','cart','commerce'], 'Корзина и оформление заказа'],
  ['catalog',  'Каталог без корзины',           ['catalog','quote','commerce'],       'Товары с ценами, заказ через заявку или счёт'],
  ['services', 'Сайт услуг',                    ['services','commerce'],              ''],
  ['corp',     'Корпоративный сайт',            ['corp','commerce','services'],       'Производство, холдинг, представительство'],
  ['landing',  'Лендинг',                       ['landing','commerce'],               'Одна страница или несколько посадочных'],
  ['info',     'Контентный проект',             ['info'],                             'Блог, СМИ, справочник'],
  ['aggr',     'Агрегатор или маркетплейс',     ['catalog','aggr','commerce'],        'Доска объявлений, витрина партнёров'],
  ['saas',     'Сервис или SaaS',               ['saas','commerce','cabinet'],        'Веб-приложение с тарифами']
]},

{id:'sales', t:'Модель продаж', type:'one', req:true, opts:[
  ['b2c',   'B2C — розница',        ['b2c'],       'Продаём физическим лицам'],
  ['b2b',   'B2B — бизнесу',        ['b2b'],       'Юрлица, договоры, счета'],
  ['mixed', 'Смешанная',            ['b2c','b2b'], 'И то, и другое']
]},

{id:'industry', t:'Отрасль', type:'one', req:true, group:true, opts:[
  ['general',    'Общая коммерция',            [],                'grp:Обычные'],
  ['retail',     'Ритейл и товары',            ['retail']],
  ['build',      'Строительство и ремонт',     ['build']],
  ['manuf',      'Производство и поставки',    ['manuf']],
  ['auto',       'Авто: дилер, сервис, запчасти',['auto']],
  ['horeca',     'Кафе, рестораны, отели',     ['horeca','local']],
  ['travel',     'Туризм и отдых',             ['travel']],
  ['rent',       'Аренда и прокат',            ['rent']],
  ['events',     'Мероприятия',                ['events']],
  ['it',         'IT и digital',               ['it']],
  ['logistics',  'Логистика и перевозки',      ['logistics']],
  ['sport',      'Спорт и фитнес',             ['sport','local']],

  ['med',        'Медицина',                   ['med','ymyl'],      'grp:Регулируемые и YMYL'],
  ['dental',     'Стоматология',               ['med','ymyl','dental']],
  ['vet',        'Ветеринария',                ['med','ymyl','vet']],
  ['beauty',     'Красота и косметология',     ['beauty','ymyl']],
  ['pharma',     'Аптеки и БАДы',              ['med','ymyl','pharma']],
  ['fin',        'Финансы и инвестиции',       ['fin','ymyl']],
  ['bank',       'Банки, займы, МФО',          ['fin','ymyl','bank']],
  ['insurance',  'Страхование',                ['fin','ymyl','insurance']],
  ['law',        'Юридические услуги',         ['law','fin','ymyl']],
  ['accounting', 'Бухгалтерия и аутсорсинг',   ['fin','ymyl']],
  ['realty',     'Недвижимость',               ['realty','ymyl']],
  ['edu',        'Образование и курсы',        ['edu','ymyl']],
  ['jobs',       'Трудоустройство',            ['ymyl']],
  ['kids',       'Товары и услуги для детей',  ['kids','ymyl']],
  ['funeral',    'Ритуальные услуги',          ['ymyl','local']]
]},

{id:'geo', t:'География продвижения', type:'one', req:true, opts:[
  ['city',     'Один город',                ['local'],           ''],
  ['branches', 'Несколько городов или филиалов',['local','branches'],'У каждого своя страница'],
  ['ru',       'Вся Россия',                ['ru'],              ''],
  ['intl',     'Несколько стран или языков',['intl'],            '']
]},

{id:'se', t:'Поисковые системы', type:'one', req:true, opts:[
  ['ya',   'Яндекс в приоритете',  ['yandex'],          'Аргументация через ЭПОС и коммерческие факторы'],
  ['both', 'Яндекс и Google',      ['yandex','google'], ''],
  ['go',   'Google в приоритете',  ['google'],          'Аргументация через E-E-A-T и Core Web Vitals']
]},

{id:'flags', t:'Что есть на сайте', type:'many', opts:[
  ['office',     'Офис, шоурум или клиника',   ['office']],
  ['payment',    'Онлайн-оплата',              ['payment']],
  ['delivery',   'Доставка',                   ['delivery']],
  ['pickup',     'Самовывоз',                  ['pickup']],
  ['filters',    'Фильтры в каталоге',         ['filters']],
  ['cabinet',    'Личный кабинет',             ['cabinet']],
  ['blog',       'Блог или база знаний',       ['blog','info']],
  ['booking',    'Онлайн-запись или бронирование',['booking']],
  ['calc',       'Калькулятор стоимости',      ['calc']],
  ['ugc',        'Комментарии или форум',      ['ugc']],
  ['spa',        'Контент подгружается через JS',['spa']],
  ['msubdomain', 'Отдельная мобильная версия', ['msubdomain']],
  ['subdomains', 'Есть другие поддомены',      ['subdomains']],
  ['franchise',  'Франшиза или партнёрка',     ['franchise']],
  ['hr',         'Вакансии',                   ['hr']],
  ['mobilebiz',  'Выездной бизнес без офиса',  ['mobile-biz']]
]},

{id:'sections', t:'Разделы аудита', type:'many', all:true, opts:[
  ['tech',      'Техническая часть',     ['s:tech']],
  ['commerce',  'Коммерческие факторы',  ['s:commerce']],
  ['blocks',    'Блоки на страницах',    ['s:blocks']],
  ['pages',     'Обязательные страницы', ['s:pages']],
  ['analytics', 'Аналитика и сервисы',   ['s:analytics']],
  ['trust',     'E-E-A-T',               ['s:trust']],
  ['legal',     'Юридические требования',['s:legal']],
  ['local',     'Локальное SEO',         ['s:local']],
  ['geo',       'GEO',                   ['s:geo']]
]}

];

/* Какие блоки в какой раздел аудита */
const SECTION_OF_BLOCK = {
  idx:'tech', http:'tech', meta:'tech', url:'tech', img:'tech',
  speed:'tech', markup:'tech', sec:'tech', mob:'tech',
  analytics:'analytics', legal:'legal', local:'local',
  comm:'commerce', pages:'pages',
  main:'blocks', serv:'blocks', cat:'blocks', prod:'blocks',
  eeat:'trust', med:'trust', fin:'trust', info:'trust',
  geo:'geo'
};

/* Порядок разделов: в списке аудита, в боковой колонке и в ТЗ */
const SECTION_ORDER = ['tech','commerce','blocks','pages','analytics','trust','legal','local','geo'];

/* Названия разделов берутся из оси sections — второго списка нет,
   поэтому конфигуратор и боковая колонка не могут разойтись */
function sectionName(key){
  const ax=AXES.find(a=>a.id==='sections');
  const o=ax&&ax.opts.find(o=>o[0]===key);
  return o? o[1] : key;
}

/* Производные теги: добавляются автоматически */
function derive(tags){
  const has=t=>tags.has(t), add=t=>tags.add(t);

  if(has('shop')&&has('b2c'))        { add('returns-law'); add('cart-flow'); }
  if(has('catalog')&&has('b2b'))     { add('kp'); add('wholesale'); add('requisites'); add('specs'); }
  if(has('b2b'))                     { add('requisites'); add('kp'); }
  if(has('med'))                     { add('license'); add('price-required'); add('contraindications'); add('special-pd'); }
  if(has('fin')||has('law'))         { add('license'); add('disclaimer'); }
  if(has('branches'))                { add('nap'); add('multi-page'); }
  if(has('payment')||has('cabinet')) { add('pd-forms'); add('oferta'); }
  if(has('booking'))                 { add('pd-forms'); }
  if(has('intl'))                    { add('hreflang'); }
  if(has('spa'))                     { add('js-render'); }
  if(has('commerce'))                { add('pd-forms'); }
  if(has('horeca')||has('sport')||has('funeral')) { add('local'); }
  return tags;
}

/* Пресеты: заранее заполненные ответы */
const PRESETS = [
  ['Интернет-магазин B2C',  {siteType:'shop',    sales:'b2c',   industry:'retail',  geo:'ru',       se:'ya', flags:['payment','delivery','pickup','filters','cabinet']}],
  ['B2B-производство',      {siteType:'catalog', sales:'b2b',   industry:'manuf',   geo:'ru',       se:'ya', flags:['office','pickup','hr']}],
  ['Сайт услуг с офисом',   {siteType:'services',sales:'mixed', industry:'general', geo:'city',     se:'ya', flags:['office','calc']}],
  ['Стоматология',          {siteType:'services',sales:'b2c',   industry:'dental',  geo:'city',     se:'ya', flags:['office','booking']}],
  ['Многопрофильная клиника',{siteType:'services',sales:'b2c',  industry:'med',     geo:'branches', se:'ya', flags:['office','booking','blog']}],
  ['Автосервис',            {siteType:'services',sales:'b2c',   industry:'auto',    geo:'city',     se:'ya', flags:['office','booking','calc']}],
  ['Строительная компания', {siteType:'corp',    sales:'mixed', industry:'build',   geo:'city',     se:'ya', flags:['office','calc','blog']}],
  ['Юридическая фирма',     {siteType:'services',sales:'mixed', industry:'law',     geo:'city',     se:'ya', flags:['office','blog']}],
  ['Турагентство',          {siteType:'catalog', sales:'b2c',   industry:'travel',  geo:'city',     se:'ya', flags:['office','booking','payment']}],
  ['Контентный проект',     {siteType:'info',    sales:'b2c',   industry:'general', geo:'ru',       se:'both',flags:['blog','ugc']}],
  ['Лендинг',               {siteType:'landing', sales:'b2c',   industry:'general', geo:'city',     se:'ya', flags:[]}]
];

if (typeof module!=='undefined') module.exports={AXES,SECTION_OF_BLOCK,SECTION_ORDER,sectionName,derive,PRESETS};
