/* ============================================================
   AETERNUS Checker — генератор robots.txt
   ------------------------------------------------------------
   RES_ALLOW  разрешающие правила для ресурсов. Общие для всех.
   CMS_PRESETS    наборы запретов по системам управления сайтом.
   CMS_COMMON     наборы запретов по типу функциональности.
   buildRobots()  собирает файл
   checkRobots()  проверяет на типовые ошибки

   Логика сборки:
     секция * — те же Allow и Disallow, но без Clean-param
     секция Yandex — то же плюс Clean-param
     Sitemap — одной строкой в конце, вне секций
   Дедупликация внутри секции; совпадения между секциями
   сохраняются, это разные адресаты.

   ВАЖНО: пресеты — отправная точка, а не готовый ответ.
   Перед выдачей клиенту сверяйте с реальной структурой сайта.
   ============================================================ */

/* Разрешающие правила для ресурсов.
   Страховка: даже если появится широкий запрет, важное останется открытым. */
const RES_ALLOW = [
  '/*.css$','/*.js$','/*.mjs$','/*.json$','/*.map$',
  '/*.svg$','/*.png$','/*.jpg$','/*.jpeg$','/*.gif$','/*.webp$','/*.avif$','/*.ico$','/*.bmp$',
  '/*.woff$','/*.woff2$','/*.ttf$','/*.eot$','/*.otf$',
  '/*.pdf$','/*.xml$','/*.webmanifest$','/*.mp4$','/*.webm$'
];

/* Наборы по системам управления сайтом */
const CMS_PRESETS = {

bitrix:{ name:'1С-Битрикс',
allow:['*/bitrix/*.css','*/bitrix/*.js','*/local/*.css','*/local/*.js','*/upload/*'],
disallow:['/bitrix/','/local/','/cgi-bin/','/personal/','/auth/','/search/','/*?print=',
 '/*&print=','/*?action=','/*&action=','/*register=','/*forgot_password=','/*change_password=',
 '/*login=','/*logout=','/*auth=','/*backurl=','/*back_url=','/*BACKURL=','/*BACK_URL=',
 '/*?set_filter=','/*?arrFilter=','/*ADD_TO_COMPARE_LIST','/*ORDER_BY','/*?sort=','/*sort_by=',
 '/*?order=','/*?list_style=','/*clear_cache=','/*bitrix_include_areas=',
 '/*show_include_exec_time=','/*show_page_exec_time=','/*show_sql_stat=','/*index.php$']},

wordpress:{ name:'WordPress',
allow:['/wp-admin/admin-ajax.php','/wp-content/uploads/'],
disallow:['/wp-admin/','/wp-includes/','/wp-json/','/xmlrpc.php','/wp-login.php','/readme.html',
 '/?s=','/search/','/author/','/trackback','*/feed','/comments/','*/comment-page-',
 '/*?attachment_id=','/*?replytocom=']},

opencart:{ name:'OpenCart',
allow:[],
disallow:['/admin','/system','/*route=account/','/*route=affiliate/','/*route=checkout/',
 '/*route=product/search','/*route=common/home','/cart','/login','/wishlist','/compare',
 '/*?sort=','/*&sort=','/*?order=','/*&order=','/*?limit=','/*&limit=',
 '/*?filter=','/*&filter=','/*?tracking=','/*&tracking=','/*?search=']},

joomla:{ name:'Joomla',
allow:[],
disallow:['/administrator/','/bin/','/cache/','/cli/','/components/','/includes/','/installation/',
 '/language/','/layouts/','/libraries/','/logs/','/modules/','/plugins/','/tmp/',
 '/*?start=','/*?limitstart=','/*?searchword','/*?view=']},

modx:{ name:'MODX',
allow:['/assets/*.css','/assets/*.js','/assets/images/'],
disallow:['/manager/','/core/','/connectors/','/assets/components/','/*?id=','/*?search=']},

drupal:{ name:'Drupal',
allow:['/core/*.css','/core/*.js','/sites/default/files/'],
disallow:['/core/','/includes/','/profiles/','/scripts/','/admin/','/user/','/node/add',
 '/search/','/*?q=','/comment/reply']},

tilda:{ name:'Tilda',
allow:[],
disallow:['/*?tilda','/*?utm_','/*?gclid=','/*?yclid=']},

insales:{ name:'InSales',
allow:[],
disallow:['/admin','/cart','/orders','/account','/client_account','/search','/*?search=',
 '/*?sort_by=','/*?q=','/compare']},

headless:{ name:'Next.js и другие headless',
allow:['/_next/static/','/_next/image'],
disallow:['/api/','/_next/','/admin/','/dashboard/']},

webasyst:{ name:'Webasyst и Shop-Script',
allow:['/wa-data/public/'],
disallow:['/webasyst/','/wa-data/','/wa-content/','/wa-apps/','/my/','/signup/','/login/',
 '/search/','/compare/','/cart/','/*?sort=','/*?view=']}

};

/* Наборы по функциональности, не зависящие от системы */
const CMS_COMMON = {
cart:{ name:'Корзина и оформление заказа',
  disallow:['/cart','/cart/','/basket','/basket/','/checkout','/order','/oformlenie'] },
account:{ name:'Личный кабинет и авторизация',
  disallow:['/account/','/lk/','/personal/','/profile/','/login','/logout','/register','/password'] },
search:{ name:'Поиск по сайту',
  disallow:['/search','/search/','/*?s=','/*?q=','/*?search=','/*?query='] },
compare:{ name:'Сравнение и избранное',
  disallow:['/compare','/compare/','/favorites','/favorite/','/wishlist','/viewed'] },
utm:{ name:'Метки отслеживания',
  disallow:[],
  clean:['utm_source','utm_medium','utm_campaign','utm_content','utm_term',
         'gclid','yclid','fbclid','ymclid','_openstat','from','roistat','erid'] },
sortfilter:{ name:'Сортировка и вывод',
  disallow:['/*?sort=','/*&sort=','/*?order=','/*&order=','/*?limit=','/*?view=','/*?display='] },
service:{ name:'Служебные файлы',
  disallow:['/*.pdf$','/print/','/*?print=','/ajax/','/tmp/','/backup/','/test/','/dev/'] }
};

/* ─────────── сборка ─────────── */

function splitLines(t){
  return String(t||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
}
function uniq(a){
  const seen=new Set();
  return a.filter(x=>{ const k=x.trim(); if(!k||seen.has(k)) return false; seen.add(k); return true; });
}

/* cfg: {cms:[], common:[], disallow:'', allow:'', clean:'', sitemap:'', host:''} */
function buildRobots(cfg){
  cfg=cfg||{};
  const cms=cfg.cms||[], com=cfg.common||[];

  let allow=[...RES_ALLOW];
  let disallow=[];
  let clean=[];

  cms.forEach(k=>{ const p=CMS_PRESETS[k]; if(!p) return;
    allow=allow.concat(p.allow||[]); disallow=disallow.concat(p.disallow||[]); });
  com.forEach(k=>{ const c=CMS_COMMON[k]; if(!c) return;
    disallow=disallow.concat(c.disallow||[]); clean=clean.concat(c.clean||[]); });

  allow=allow.concat(splitLines(cfg.allow));
  disallow=disallow.concat(splitLines(cfg.disallow));
  clean=clean.concat(splitLines(cfg.clean).flatMap(x=>x.split(/[&,\s]+/)).filter(Boolean));

  allow=uniq(allow); disallow=uniq(disallow); clean=uniq(clean);

  /* Clean-param: ограничение 500 символов на правило, разбиваем при превышении */
  const cleanRules=[];
  let cur=[];
  clean.forEach(p=>{
    const test=cur.concat([p]).join('&');
    if(('Clean-param: '+test).length>500 && cur.length){ cleanRules.push(cur.join('&')); cur=[p]; }
    else cur.push(p);
  });
  if(cur.length) cleanRules.push(cur.join('&'));

  const section=(agent,withClean)=>{
    const L=['User-agent: '+agent];
    allow.forEach(x=>L.push('Allow: '+x));
    disallow.forEach(x=>L.push('Disallow: '+x));
    if(withClean) cleanRules.forEach(x=>L.push('Clean-param: '+x));
    return L.join('\n');
  };

  let out=section('*',false)+'\n\n'+section('Yandex',true);
  const sm=String(cfg.sitemap||'').trim();
  if(sm) out+='\n\nSitemap: '+sm;
  return out+'\n';
}

/* ─────────── проверки ─────────── */

function checkRobots(cfg,text){
  const w=[];
  cfg=cfg||{};
  const dis=splitLines(cfg.disallow), cl=splitLines(cfg.clean)
    .flatMap(x=>x.split(/[&,\s]+/)).filter(Boolean);
  const all=text||buildRobots(cfg);
  const allDis=all.split('\n').filter(l=>/^Disallow:/.test(l)).map(l=>l.slice(9).trim());
  const allClean=all.split('\n').filter(l=>/^Clean-param:/.test(l))
    .flatMap(l=>l.slice(12).trim().split(/[&\s]+/)).filter(Boolean);

  /* 1. параметр одновременно закрыт и указан в Clean-param */
  const both=allClean.filter(p=>allDis.some(d=>d.indexOf(p)>-1));
  if(both.length) w.push({t:'warn',
    m:'Параметры указаны и в Disallow, и в Clean-param: '+both.join(', ')+
      '. Это взаимоисключающие указания: запрет не даёт обойти адрес, а Clean-param предполагает обход со склейкой. '+
      'Для меток отслеживания Яндекс рекомендует именно Clean-param, а не запрет.'});

  /* 2. закрыта пагинация */
  if(allDis.some(d=>/[?&](page|PAGEN|start|limitstart)/i.test(d))) w.push({t:'warn',
    m:'Закрыта пагинация. Робот не сможет пройти вглубь каталога, и товары со второй страницы и дальше рискуют не попасть в индекс.'});

  /* 3. сайт закрыт целиком */
  if(allDis.some(d=>d==='/')) w.push({t:'err',
    m:'Правило Disallow: / закрывает сайт целиком.'});

  /* 4. запрет перекрывает ресурсы без возврата через Allow */
  const risky=allDis.filter(d=>/(assets|static|templates|themes|media|files|upload|css|js|fonts)/i.test(d) && !/\$/.test(d));
  if(risky.length && !all.includes('Allow: /*.css$')) w.push({t:'warn',
    m:'Запреты могут перекрыть стили и скрипты: '+risky.slice(0,5).join(', ')+
      '. Разрешающие правила по расширениям обязательны.'});

  /* 5. карта сайта */
  if(!/^Sitemap:/m.test(all)) w.push({t:'info',
    m:'Не указан адрес карты сайта. Директива ставится одной строкой в конце файла.'});
  else{
    const smLine=all.split('\n').find(l=>/^Sitemap:/.test(l))||'';
    if(!/^Sitemap:\s*https?:\/\//.test(smLine)) w.push({t:'warn',
      m:'Адрес карты сайта должен быть абсолютным, с указанием протокола.'});
  }

  /* 6. Clean-param не настроен при закрытых метках */
  if(!allClean.length && allDis.some(d=>/utm_|gclid|yclid/i.test(d))) w.push({t:'info',
    m:'Метки отслеживания закрыты запретом, но Clean-param не указан. Для Яндекса вторая директива предпочтительнее.'});

  /* 7. устаревшие директивы */
  if(/^\s*(Host|Crawl-delay):/mi.test(all)) w.push({t:'info',
    m:'Директивы Host и Crawl-delay Яндекс не учитывает с 2018 года, их можно убрать. Скорость обхода задаётся в Вебмастере.'});

  /* 8. параметры, меняющие содержимое, в Clean-param */
  const risky2=allClean.filter(p=>/^(page|filter|category|city|region|lang)$/i.test(p));
  if(risky2.length) w.push({t:'warn',
    m:'В Clean-param указаны параметры, которые меняют содержимое страницы: '+risky2.join(', ')+
      '. Их склейка приведёт к выпадению страниц из индекса.'});

  return w;
}

if (typeof module!=='undefined') module.exports={RES_ALLOW,CMS_PRESETS,CMS_COMMON,buildRobots,checkRobots};
