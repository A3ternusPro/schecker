/* ============================================================
   AETERNUS SEO Audit — разбор выгрузок Screaming Frog
   ------------------------------------------------------------
   COLS      соответствие «поле → возможные заголовки колонки».
             Список, а не одно значение: заголовки меняются между
             версиями и зависят от языка интерфейса. Сравнение
             нестрогое — регистр, пробелы и знаки нормализуются.
             Чтобы поддержать новый заголовок, допишите его сюда.

   SF_RULES  что считать находкой. Каждое правило привязано
             к слагу пункта и указывает, из какого файла берутся
             данные и как строится сводка.

   Правила проверены на реальной выгрузке: 990 строк Internal All
   и 126 строк Inlinks с сайта на 127 страниц.
   ============================================================ */

/* ─────────── соответствие колонок ─────────── */
const SF_COLS = {

/* Internal → All */
address:      ['Address','Адрес','URL'],
contentType:  ['Content Type','Тип контента'],
statusCode:   ['Status Code','Код ответа','Код статуса'],
status:       ['Status','Статус'],
indexability: ['Indexability','Индексируемость'],
indexStatus:  ['Indexability Status','Статус индексируемости'],
title:        ['Title 1','Заголовок 1','Title'],
description:  ['Meta Description 1','Метаописание 1','Meta Description'],
h1:           ['H1-1','H1_1','H1'],
h1b:          ['H1-2','H1_2'],
metaRobots:   ['Meta Robots 1','Meta Robots'],
xRobots:      ['X-Robots-Tag 1','X-Robots-Tag'],
canonical:    ['Canonical Link Element 1','Canonical','Канонический адрес'],
sizeBytes:    ['Size (bytes)','Размер (байт)','Size'],
wordCount:    ['Word Count','Количество слов'],
crawlDepth:   ['Crawl Depth','Глубина обхода'],
uniqueInlinks:['Unique Inlinks','Уникальные входящие ссылки'],
hash:         ['Hash','Хеш'],
responseTime: ['Response Time','Время ответа'],
redirectUrl:  ['Redirect URL','Адрес перенаправления'],
redirectType: ['Redirect Type','Тип перенаправления'],
httpVersion:  ['HTTP Version','Версия HTTP'],
language:     ['Language','Язык'],
crawlTime:    ['Crawl Timestamp','Время обхода'],

/* Inlinks. Экспорт из нижней панели даёт From и To,
   массовый экспорт — Source и Destination. Поддерживаются оба. */
linkType:     ['Type','Тип'],
from:         ['From','Source','Источник','Откуда'],
to:           ['To','Destination','Назначение','Куда'],
anchor:       ['Anchor Text','Anchor','Анкор','Текст ссылки'],
altText:      ['Alt Text','Альтернативный текст'],
follow:       ['Follow'],
linkPath:     ['Link Path','Путь до ссылки'],
linkPosition: ['Link Position','Расположение ссылки'],
linkOrigin:   ['Link Origin','Источник ссылки'],

/* встречаются в отдельных файлах массового экспорта */
occurrences:  ['Occurrences','Вхождений'],
dimensions:   ['Dimensions','Размеры'],
imgInlinks:   ['IMG Inlinks']

};

/* ─────────── распознавание по имени файла ───────────
   Массовый экспорт Bulk Export → Issues кладёт каждую проблему
   отдельным файлом. Колонки у многих совпадают: пять файлов
   с заголовками безопасности не отличить иначе как по имени.
   Поэтому имя проверяется первым, колонки — как запасной путь.

   Файл создаётся, только если проблема найдена. Значит состав
   папки меняется от сайта к сайту, и жёсткий список не годится:
   сопоставление идёт по началу имени.

   pages — строки описывают страницы, links — ссылки,
   note — наблюдение без привязки к пункту,
   skip — сознательно не используем. */
const SF_FILES = {
'issues_overview_report':                {kind:'overview'},

'images_missing_alt_text':               {slug:'img.alt-text', kind:'pages'},
'images_images_missing_alt_text_inlinks':{slug:'img.alt-text', kind:'links'},
'images_missing_alt_attribute':          {slug:'img.alt-text', kind:'pages'},
'images_images_missing_alt_attribute_inlinks':{slug:'img.alt-text', kind:'links'},
'images_over_100_kb':                    {slug:'img.webp-weight', kind:'pages',
                                          unit:['изображение','изображения','изображений']},
'images_images_over_x_kb_inlinks':       {slug:'img.webp-weight', kind:'links'},
'images_missing_size_attributes':        {slug:'img.dimensions-cls', kind:'pages',
                                          unit:['изображение','изображения','изображений']},
'images_incorrectly_sized_images':       {slug:'img.size-vs-display', kind:'pages'},

'content_low_content_pages':             {slug:'http.empty-categories', kind:'pages'},
'content_exact_duplicates':              {slug:'content.exact-duplicates', kind:'pages'},
'content_soft_404_pages':                {slug:'http.soft-404', kind:'pages'},

'h1_missing':                            {slug:'meta.h1-on-listings', kind:'pages'},
'h1_multiple':                           {slug:'meta.h1-single', kind:'pages'},
'meta_description_missing':              {slug:'meta.description-missing', kind:'pages'},
'meta_description_duplicate':            {slug:'meta.description-duplicate', kind:'pages'},
'page_titles_missing':                   {slug:'meta.title-missing', kind:'pages'},
'page_titles_duplicate':                 {slug:'meta.title-duplicate', kind:'pages'},
'page_titles_same_as_h1':                {slug:'meta.h1-not-title-copy', kind:'pages'},

'canonicals_missing':                    {slug:'idx.canonical-self', kind:'pages'},
'canonicals_nonindexable_canonical':     {slug:'idx.canonical-self', kind:'pages'},
'canonicals_canonicalised':              {kind:'note', note:'Закрыто каноническим адресом: {n}. Обычно это норма.'},

'response_codes_internal_redirection':   {slug:'http.redirect-in-links', kind:'pages'},
'response_codes_internal_client_error':  {slug:'http.404-code', kind:'pages'},
'response_codes_internal_server_error':  {slug:'http.5xx', kind:'pages'},
'response_codes_external_client_error':  {slug:'http.broken-external', kind:'pages'},
'response_codes_internal_blocked_by_robots_txt':{kind:'note', note:'Закрыто в robots.txt и не обходилось: {n}.'},
'response_codes_internal_no_response':   {kind:'note', note:'Не ответили при обходе: {n}. Причина — таймаут или обрыв соединения.'},
'response_codes_external_no_response':   {kind:'note', note:'Внешних адресов не ответило при обходе: {num}. Часто это защита от роботов — проверьте вручную.'},

'security_http_urls':                    {slug:'http.https-redirect', kind:'pages'},
'security_missing_hsts_header':          {slug:'sec.response-headers', kind:'pages'},
'security_missing_contentsecuritypolicy_header':{slug:'sec.response-headers', kind:'pages'},
'security_missing_xframeoptions_header': {slug:'sec.response-headers', kind:'pages'},
'security_missing_xcontenttypeoptions_header':{slug:'sec.response-headers', kind:'pages'},
'security_missing_secure_referrerpolicy_header':{slug:'sec.response-headers', kind:'pages'},
'security_unsafe_crossorigin_links':     {slug:'sec.unsafe-cross-origin', kind:'links'},
'security_protocolrelative_resource_links':{slug:'sec.no-mixed-content', kind:'links'},
'security_mixed_content':                {slug:'sec.no-mixed-content', kind:'links'},

'url_underscores':                       {slug:'url.human-readable', kind:'pages'},
'url_uppercase':                         {slug:'url.no-uppercase-cyrillic', kind:'pages'},
'url_over_115_characters':               {slug:'url.length', kind:'pages'},
'url_parameters':                        {kind:'note', note:'Адресов с параметрами: {num}. Проверьте, нужны ли они в индексе.'},

'links_internal_nofollow_outlinks':      {slug:'url.internal-nofollow', kind:'links'},
'links_internal_outlinks_with_no_anchor_text':{slug:'url.links-no-anchor', kind:'links'},

'pagination_non_indexable':              {slug:'meta.pagination-meta', kind:'pages'},
'hreflang_missing_return_links':         {slug:'meta.hreflang', kind:'pages'},

/* длина метатегов и структура подзаголовков намеренно не автоматизируются:
   это рекомендации, а не ошибки, и автостатус по ним создаёт шум */
'page_titles_over':   {kind:'skip'}, 'page_titles_below':  {kind:'skip'},
'meta_description_over':{kind:'skip'},'meta_description_below':{kind:'skip'},
'h1_over':            {kind:'skip'}, 'h1_nonsequential':   {kind:'skip'},
'h2_':                {kind:'skip'}
};

/* Имя файла → правило. Сравнение по началу имени, без расширения. */
function matchFile(name){
  const n=String(name||'').toLowerCase().replace(/\.csv$|\.xlsx?$/,'').replace(/[()]/g,'');
  let best=null;
  Object.keys(SF_FILES).forEach(k=>{
    const key=k.replace(/[()]/g,'');
    if(n.indexOf(key)===0 && (!best||key.length>best.key.length)) best={key,rule:SF_FILES[k]};
  });
  if(!best) return null;
  const r=Object.assign({file:name},best.rule);
  /* Файл с суффиксом _inlinks описывает ссылки, а не страницы.
     Для наблюдений такой файл не нужен: он повторит ту же цифру. */
  if(/_inlinks$/.test(n)){
    if(r.kind==='note'||r.kind==='skip') return {file:name,kind:'skip'};
    r.kind='links';
  }
  return r;
}

/* ─────────── распознавание файла по колонкам ─────────── */
const SF_KINDS = [
  {kind:'inlinks',  need:['from','to','statusCode'],            name:'Входящие ссылки'},
  {kind:'internal', need:['address','statusCode','indexability'],name:'Обход сайта'},
  {kind:'issues',   need:['address'],                            name:'Отдельная проблема'}
];

/* ─────────── словарь расположений ─────────── */
const SF_POSITION = {
  'content':    'в тексте страниц',
  'navigation': 'в меню',
  'footer':     'в подвале сайта',
  'header':     'в шапке сайта',
  'aside':      'в боковой колонке',
  'head':       'в служебной части кода'
};

/* ─────────── правила ─────────── */
/* src      internal | inlinks
   scope    html — только страницы, all — любые ресурсы
   test     что считать находкой
   summary  тип сводки: links | pages | count
   table    колонки итоговой таблицы */

const SF_RULES = [

/* ── коды ответов ── */
{slug:'http.404-code', src:'internal', scope:'all', summary:'pages',
 test:r=>/^4/.test(r.statusCode),
 table:['address','statusCode','status','contentType']},

{slug:'http.5xx', src:'internal', scope:'all', summary:'pages',
 test:r=>/^5/.test(r.statusCode),
 table:['address','statusCode','status']},

{slug:'http.301-not-302', src:'internal', scope:'all', summary:'pages',
 test:r=>r.statusCode==='302'||r.statusCode==='307',
 table:['address','statusCode','redirectUrl','redirectType']},

/* ── ссылки ── */
{slug:'http.redirect-in-links', src:'inlinks', summary:'links',
 test:r=>/^3/.test(r.statusCode)&&r.linkType==='Hyperlink',
 table:['to','from','anchor','linkPosition','linkPath']},

{slug:'http.broken-internal', src:'inlinks', summary:'links',
 test:r=>/^[45]/.test(r.statusCode)&&r.linkType==='Hyperlink',
 table:['to','statusCode','from','anchor','linkPosition','linkPath']},

{slug:'img.alt-text', src:'inlinks', summary:'links',
 test:r=>r.linkType==='Image'&&!(r.altText||'').trim(),
 table:['to','from','linkPath']},

/* ── метатеги ── */
{slug:'meta.title-missing', src:'internal', scope:'html', summary:'pages',
 test:r=>r.indexability==='Indexable'&&!(r.title||'').trim(),
 table:['address','title']},

{slug:'meta.title-duplicate', src:'internal', scope:'html', summary:'pages',
 dup:'title', test:r=>r.indexability==='Indexable'&&!!(r.title||'').trim(),
 table:['address','title','description','h1']},

{slug:'meta.description-missing', src:'internal', scope:'html', summary:'pages',
 test:r=>r.indexability==='Indexable'&&!(r.description||'').trim(),
 table:['address','description']},

{slug:'meta.description-duplicate', src:'internal', scope:'html', summary:'pages',
 dup:'description', test:r=>r.indexability==='Indexable'&&!!(r.description||'').trim(),
 table:['address','description','title']},

{slug:'meta.h1-on-listings', src:'internal', scope:'html', summary:'pages',
 test:r=>r.indexability==='Indexable'&&!(r.h1||'').trim(),
 table:['address','title']},

{slug:'meta.h1-single', src:'internal', scope:'html', summary:'pages',
 test:r=>!!(r.h1b||'').trim(),
 table:['address','h1','h1b']},

/* ── индексация ── */
{slug:'idx.canonical-self', src:'internal', scope:'html', summary:'pages',
 test:r=>r.indexability==='Indexable'&&(r.canonical||'').trim()&&
         normUrl(r.canonical)!==normUrl(r.address),
 table:['address','canonical','indexStatus']},

{slug:'idx.no-accidental-noindex', src:'internal', scope:'html', summary:'pages',
 test:r=>/noindex/i.test((r.metaRobots||'')+' '+(r.xRobots||'')),
 table:['address','metaRobots','xRobots']},

{slug:'idx.orphan-pages', src:'internal', scope:'html', summary:'pages',
 test:r=>r.indexability==='Indexable'&&String(r.uniqueInlinks||'').trim()==='0',
 table:['address','crawlDepth']},

/* ── адреса и структура ── */
{slug:'url.click-depth', src:'internal', scope:'html', summary:'pages',
 test:r=>r.indexability==='Indexable'&&Number(r.crawlDepth)>3,
 table:['address','crawlDepth','uniqueInlinks']},

{slug:'url.human-readable', src:'internal', scope:'html', summary:'pages',
 test:r=>r.indexability==='Indexable'&&/_|[A-ZА-Я]/.test(pathOf(r.address)),
 table:['address']},

/* ── содержимое ── */
{slug:'http.empty-categories', src:'internal', scope:'html', summary:'pages',
 test:r=>r.indexability==='Indexable'&&Number(r.wordCount)<100,
 table:['address','wordCount','title']},

{slug:'content.exact-duplicates', src:'internal', scope:'html', summary:'pages',
 dup:'hash', test:r=>r.indexability==='Indexable'&&!!(r.hash||'').trim(),
 table:['address','title','hash']},

/* ── скорость ── */
{slug:'speed.ttfb', src:'internal', scope:'html', summary:'pages',
 test:r=>Number(r.responseTime)>0.6,
 table:['address','responseTime']},

{slug:'speed.http2', src:'internal', scope:'all', summary:'count',
 test:r=>/^1\.[01]$/.test(String(r.httpVersion||'').trim()),
 table:['address','httpVersion']},

/* ── изображения ── */
{slug:'img.webp-weight', src:'internal', scope:'img', summary:'size',
 test:r=>Number(r.sizeBytes)>102400,
 table:['address','sizeBytes','contentType']}

];

/* ─────────── заголовки итоговых таблиц ───────────
   Формулировки для исполнителя, а не термины Screaming Frog:
   подрядчик должен понимать, что делать, не открывая инструкцию. */
const SF_TABLE_HEADERS = {
  address:'Адрес страницы', statusCode:'Код ответа', status:'Статус',
  contentType:'Тип файла', redirectUrl:'Куда ведёт после перенаправления',
  redirectType:'Тип перенаправления',
  title:'Текущий Title', description:'Текущий Description',
  h1:'Текущий H1', h1b:'Второй H1 на странице',
  canonical:'Указанный канонический адрес', indexStatus:'Причина',
  metaRobots:'Значение meta robots', xRobots:'Заголовок X-Robots-Tag',
  crawlDepth:'Кликов от главной', uniqueInlinks:'Входящих ссылок',
  wordCount:'Слов на странице', responseTime:'Время ответа, с',
  httpVersion:'Версия протокола', sizeBytes:'Вес файла',
  hash:'Отпечаток содержимого',

  to:'Проблемная ссылка', from:'Страница, где найдена', anchor:'Текст ссылки',
  linkPositionRu:'Где размещена', linkPath:'Путь до ссылки в коде',
  redirectTo:'Куда ведёт после перенаправления',
  occurrences:'Сколько раз встречается', samplePage:'Пример страницы',
  sizeKb:'Вес, КБ'
};

/* Наборы колонок для ссылок: сжатая таблица по уникальным ссылкам
   и полная по всем вхождениям. Сквозная ссылка на ста страницах
   даёт одну строку в первой и сто во второй. */
const SF_LINK_TABLES = {
  'http.redirect-in-links':{
    unique:['to','redirectTo','linkPositionRu','anchor','occurrences','samplePage','linkPath'],
    full:  ['to','redirectTo','linkPositionRu','anchor','from','linkPath'],
    extra: ['Исправлено']},
  'http.broken-internal':{
    unique:['to','statusCode','linkPositionRu','anchor','occurrences','samplePage','linkPath'],
    full:  ['to','statusCode','linkPositionRu','anchor','from','linkPath'],
    extra: ['Что сделать: заменить адрес или убрать ссылку']},
  'img.alt-text':{
    unique:['to','occurrences','samplePage','linkPath'],
    full:  ['to','from','linkPath'],
    extra: ['Новый alt']}
};

/* Пустые колонки, которые дозаполняет специалист */
const SF_TABLE_EXTRA = {
  'meta.title-duplicate':      ['Новый Title','Новый Description','Новый H1'],
  'meta.title-missing':        ['Новый Title'],
  'meta.description-missing':  ['Новый Description'],
  'meta.description-duplicate':['Новый Description'],
  'meta.h1-on-listings':       ['Новый H1'],
  'http.redirect-in-links':    ['Готово'],
  'http.broken-internal':      ['Что сделать'],
  'img.alt-text':              ['Новый alt'],
  'idx.canonical-self':        ['Действие']
};

/* ─────────── вспомогательное ─────────── */
function normUrl(u){ return String(u||'').trim().replace(/\/+$/,'').toLowerCase(); }
function pathOf(u){ try{ return String(u||'').replace(/^https?:\/\/[^/]+/i,'').split('?')[0]; }catch(e){ return ''; } }

if (typeof module!=='undefined') module.exports={SF_COLS,SF_FILES,matchFile,SF_KINDS,SF_POSITION,SF_RULES,SF_TABLE_HEADERS,SF_TABLE_EXTRA,SF_LINK_TABLES,normUrl,pathOf};
