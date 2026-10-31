/**
 * Détection de code dans une saisie : balises HTML ou XML, attributs
 * d'événement, adresses javascript:, gabarits, injection SQL, appels JS ou PHP,
 * commandes système, traversée de chemin, octet nul, blocs de code.
 *
 * Copie conforme des règles du serveur (LightLab\Goes\Services\CodeGuard,
 * plugin lightlab/goes) : le serveur fait foi et refuse de toute façon
 * (HTTP 422). Ce contrôle sert à prévenir avant l'envoi, sans aller-retour.
 * Une règle changée d'un côté se change de l'autre, à l'identique.
 *
 * On refuse une FORME de code, jamais un mot : « select », « update »,
 * « delete », « script » ou « import » passent dans une phrase, comme les
 * apostrophes (N'Guessan, l'argent), « <3 », « 5 < 10 », les montants, les
 * numéros, les adresses électroniques et les liens https ordinaires.
 */

export type CodeMotif =
  | 'balise'
  | 'evenement'
  | 'uri'
  | 'gabarit'
  | 'php'
  | 'js'
  | 'sql'
  | 'commentaire'
  | 'shell'
  | 'chemin'
  | 'octet_nul'
  | 'bloc_code';

/** Formes lues : n (normalisée), d (décodée), c (compacte), s (SQL). */
type Views = { n: string; d: string; c: string; s: string; sn: string };
type Rule = readonly [CodeMotif, RegExp, string];

const R = (source: string) => new RegExp(source);

/**
 * Règles, dans l'ordre où on les cherche. Le texte est déjà en minuscules.
 * Formes : n (normalisée), d (décodée), c (décodée sans tabulation ni retour
 * à la ligne), s (SQL : décodée, commentaires et « + » ramenés à des espaces).
 */
const RULES: readonly Rule[] = [
  // ── Balises HTML ou XML ──
  ['balise', R(String.raw`<[a-z][a-z0-9:_-]*(?:[\s/][^<>]*)?>`), 'ndc'],
  ['balise', R(String.raw`</[a-z][a-z0-9:_-]*`), 'ndc'],
  ['balise', R(String.raw`<(?:script|iframe|frame|frameset|object|embed|applet|svg|math|img|image|video|audio|source|body|html|head|meta|link|style|base|form|input|button|textarea|select|option|details|marquee|isindex|template|xss|portal|animate|foreignobject|bgsound|keygen|layer|ilayer|dialog|picture|xml|xmp|noscript|plaintext|listing|title|div|span|table|h[1-6])\b`), 'ndc'],
  ['balise', R(String.raw`<a\s`), 'ndc'],
  ['balise', R(String.raw`<!(?:--|\[cdata\[|doctype|entity|element|attlist)`), 'ndc'],
  ['balise', R(String.raw`<\?xml`), 'ndc'],
  ['balise', R(String.raw`\bxmlns(?::[a-z]+)?\s*=`), 'nd'],

  // ── Attributs d'événement ──
  ['evenement', R(String.raw`\bon(?:abort|activate|afterprint|animation[a-z]*|auxclick|before[a-z]+|begin|blur|bounce|cancel|canplay[a-z]*|change|click|close|contextmenu|copy|cuechange|cut|dblclick|drag[a-z]*|drop|durationchange|emptied|end|ended|error|finish|focus[a-z]*|formdata|fullscreen[a-z]*|hashchange|input|invalid|key[a-z]+|load[a-z]*|message[a-z]*|mouse[a-z]+|offline|online|pagehide|pageshow|paste|pause|play[a-z]*|pointer[a-z]+|popstate|progress|ratechange|readystatechange|repeat|reset|resize|scroll[a-z]*|search|seek[a-z]*|select[a-z]*|show|stalled|start|storage|submit|suspend|timeupdate|toggle|touch[a-z]+|transition[a-z]*|unhandledrejection|unload|volumechange|waiting|wheel|zoom)\s*=`), 'ndc'],

  // ── Adresses actives ──
  ['uri', R(String.raw`(?:java|vb|live|ecma)script:\S`), 'ndc'],
  ['uri', R(String.raw`\bmocha:\S`), 'ndc'],
  ['uri', R(String.raw`\bdata:\s*(?:text/(?:html|xml|javascript)|application/(?:x-)?(?:javascript|ecmascript|xhtml\+xml|xml)|image/svg\+xml)`), 'ndc'],
  ['uri', R(String.raw`\b(?:file|php|phar|expect|gopher|dict|ldap|jar|zip|glob|data)://`), 'ndc'],
  ['uri', R(String.raw`\bjndi:`), 'ndc'],

  // ── Gabarits ──
  ['gabarit', R(String.raw`\{\{`), 'nd'],
  ['gabarit', R(String.raw`\{%`), 'nd'],
  ['gabarit', R(String.raw`\$\{`), 'nd'],
  ['gabarit', R(String.raw`#\{[^}]*\}`), 'nd'],
  ['gabarit', R(String.raw`<%`), 'nd'],
  ['gabarit', R(String.raw`\{\$[a-z_]`), 'nd'],
  ['gabarit', R(String.raw`\*\{[^}]*\}`), 'nd'],
  ['gabarit', R(String.raw`<#(?:assign|list|if|include|import|macro|function|setting)\b`), 'nd'],

  // ── PHP ──
  ['php', R(String.raw`<\?(?:php|=)`), 'ndc'],
  ['php', R(String.raw`\b(?:phpinfo|shell_exec|passthru|proc_open|popen|pcntl_exec|base64_decode|gzinflate|gzuncompress|str_rot13|create_function|call_user_func(?:_array)?|file_get_contents|file_put_contents|fopen|fwrite|fsockopen|unserialize|preg_replace|move_uploaded_file|curl_exec|show_source|highlight_file|include_once|require_once|var_dump|print_r)\s*\(`), 'nd'],
  ['php', R(String.raw`\b(?:system|exec|eval|include|require|assert)\(`), 'nd'],
  ['php', R(String.raw`\b(?:var_dump|phpinfo|shell_exec|passthru|proc_open|base64_decode|file_get_contents|file_put_contents|call_user_func|create_function|fsockopen|pcntl_exec)\b`), 'nd'],
  ['php', R(String.raw`\$_(?:get|post|request|cookie|server|files|env|session|globals)\b`), 'nd'],
  ['php', R(String.raw`__halt_compiler`), 'nd'],
  ['php', R(String.raw`\bo:\d+:"[a-z_\\]`), 'nd'],

  // ── JavaScript et autres langages serveur ──
  ['js', R(String.raw`\b(?:alert|prompt|confirm)\s*\(\s*(?:['"\x60/]|\d+\s*\)|document|window|this\b|self\b|top\b|parent\b|location|string\.|atob|eval)`), 'ndc'],
  ['js', R(String.raw`\b(?:alert|prompt|confirm)\x60`), 'ndc'],
  ['js', R(String.raw`\beval\s*\(`), 'ndc'],
  ['js', R(String.raw`\b(?:settimeout|setinterval|execscript)\s*\(`), 'nd'],
  ['js', R(String.raw`\bnew\s+function\b`), 'nd'],
  ['js', R(String.raw`\bfunction\s*[a-z_$]*\s*\([^)]*\)\s*\{`), 'nd'],
  ['js', R(String.raw`=>\s*\{`), 'nd'],
  ['js', R(String.raw`\{\s*return\b`), 'nd'],
  ['js', R(String.raw`\bdocument\s*\.\s*(?:cookie|domain|location|write|writeln|body|forms|createelement|getelementby[a-z]*|queryselector[a-z]*|documentelement)`), 'ndc'],
  ['js', R(String.raw`\b(?:document|window)\s*\[`), 'ndc'],
  ['js', R(String.raw`\bwindow\s*\.\s*(?:location|open|name|eval|atob|fetch|top|parent|frames)\b`), 'ndc'],
  ['js', R(String.raw`\b(?:top|self|parent|opener)\s*\.\s*location\b`), 'ndc'],
  ['js', R(String.raw`\blocation\s*\.\s*(?:href|hash|replace|assign|reload)\b`), 'ndc'],
  ['js', R(String.raw`\.\s*(?:innerhtml|outerhtml|insertadjacenthtml)\b`), 'ndc'],
  ['js', R(String.raw`\bstring\s*\.\s*fromcharcode\b`), 'ndc'],
  ['js', R(String.raw`\b(?:atob|btoa)\s*\(`), 'ndc'],
  ['js', R(String.raw`\bfetch\s*\(\s*['"\x60]`), 'nd'],
  ['js', R(String.raw`\bxmlhttprequest\b`), 'nd'],
  ['js', R(String.raw`\b(?:import|require)\s*\(\s*['"\x60]`), 'nd'],
  ['js', R(String.raw`\bprocess\s*\.\s*(?:env|mainmodule|binding|exit)\b`), 'nd'],
  ['js', R(String.raw`\b(?:child_process|execsync|globalthis)\b`), 'nd'],
  ['js', R(String.raw`__proto__`), 'nd'],
  ['js', R(String.raw`\bconstructor\s*(?:\.\s*constructor|\[|\.\s*prototype)`), 'nd'],
  ['js', R(String.raw`\bprototype\s*\[`), 'nd'],
  ['js', R(String.raw`\bconsole\s*\.\s*(?:log|error|warn|info)\s*\(`), 'nd'],
  ['js', R(String.raw`\b(?:localstorage|sessionstorage)\s*\.`), 'nd'],
  ['js', R(String.raw`\b(?:srcdoc|formaction|xlink:href)\s*=`), 'ndc'],
  ['js', R(String.raw`__(?:import|class|globals|builtins|subclasses|mro|init|getattribute|dict|base|bases|reduce|code|loader)__`), 'nd'],
  ['js', R(String.raw`\bos\s*\.\s*(?:system|popen|exec[a-z]*|spawn[a-z]*)\s*\(`), 'nd'],
  ['js', R(String.raw`\bsubprocess\s*\.\s*[a-z]`), 'nd'],
  ['js', R(String.raw`\bimport\s+os\b`), 'nd'],
  ['js', R(String.raw`\bjava\.(?:lang|io|util|net|nio)\.`), 'nd'],
  ['js', R(String.raw`\bruntime\s*\.\s*getruntime\b`), 'nd'],
  ['js', R(String.raw`\b(?:processbuilder|getruntime)\b`), 'nd'],
  ['js', R(String.raw`\bclass\s*\.\s*forname\b`), 'nd'],
  ['js', R(String.raw`#_memberaccess|@ognl\.`), 'nd'],

  // ── SQL ──
  ['sql', R(String.raw`\bunion\s*(?:all\s*|distinct\s*)?\(?\s*select\b`), 's'],
  ['sql', R(String.raw`\bselect\s+(?:\*\s*(?:from\b|,|$)|null\b|@@[a-z]+|(?:count|concat|concat_ws|group_concat|char|version|user|database|schema|sleep|benchmark|load_file|if|ascii|substring|substr|mid|hex|unhex|md5|sha1|current_user|system_user|extractvalue|updatexml)\s*\(|case\s+when\b|\d+\s*(?:,\s*\d|\)|--|#|;))`), 's'],
  ['sql', R(String.raw`\(\s*select\s*(?:\(|\*|\d|null\b|@@|sleep|benchmark|count|concat|char|if\s*\(|case\b|user\s*\(|database\s*\(|version\s*\()`), 's'],
  ['sql', R(String.raw`\bselect\b[\w\s*,.()]{1,80}?\bfrom\s+[\w.\x60"\[\]]+\s+(?:where|order\s+by|group\s+by|limit|join|union|inner|left)\b`), 's'],
  ['sql', R(String.raw`\binsert\s+into\s+[\w.\x60"\[\]]+\s*(?:\(|values\b|select\b)`), 's'],
  ['sql', R(String.raw`\bdelete\s+from\s+[\w.\x60"\[\]]+\s+where\b`), 's'],
  ['sql', R(String.raw`\bupdate\s+[\w.\x60"\[\]]+\s+set\s+[\w.\x60"\[\]]+\s*=`), 's'],
  ['sql', R(String.raw`\b(?:drop|truncate)\s+(?:table|database|schema)\b`), 's'],
  ['sql', R(String.raw`\balter\s+table\b`), 's'],
  ['sql', R(String.raw`\bcreate\s+(?:table|database)\s+[\w.\x60"]+\s*\(`), 's'],
  ['sql', R(String.raw`['"\x60]\s*\)*\s*(?:(?:or|and|xor)\b|\|\||&&)\s*\(*\s*(['"\x60]?)\w*\1\s*(?:=|<>|!=|<=>)\s*\(*\s*['"\x60]?\w*`), 's'],
  ['sql', R(String.raw`['"\x60]\s*\)*\s*(?:or|and)\s+\d+\s*[<>]=?\s*\d+`), 's'],
  ['sql', R(String.raw`['"\x60]\s*\)*\s*(?:or|and)\s+(?:true|false|null|not\s|exists\s*\(|sleep\s*\(|\d+\s*(?:--|#|$))`), 's'],
  ['sql', R(String.raw`['"\x60]\s*\)*\s*;\s*(?:drop|delete|insert|update|select|shutdown|exec|execute|declare|truncate|alter|create|grant|waitfor)\b`), 's'],
  ['sql', R(String.raw`['"\x60]\s*\)*\s*--(?:[\s+\-]\S{0,10})?\s*$`), 's'],
  ['sql', R(String.raw`--\s*-\s*$|--\+\s*$`), 's'],
  ['sql', R(String.raw`['"\x60]\s*\)*\s*#\s*$`), 's'],
  ['sql', R(String.raw`(?:^|[\d)'"\x60]\s*)\b(?:or|and)\s+(\d+)\s*=\s*\1\b`), 's'],
  ['sql', R(String.raw`\b(?:or|and)\s+'(\w*)'\s*=\s*'\1'`), 's'],
  ['sql', R(String.raw`\b(?:sleep|pg_sleep)\s*\(\s*\d+(?:\.\d+)?\s*\)`), 's'],
  ['sql', R(String.raw`\bbenchmark\s*\(\s*\d+\s*,`), 's'],
  ['sql', R(String.raw`\b(?:sleep|pg_sleep|benchmark)\s*\(\s*(?:if\s*\(|\(|select\b)`), 's'],
  ['sql', R(String.raw`\bconvert\s*\(\s*n?(?:varchar|char|int)\b|\bhashbytes\s*\(|\bcast\s*\([^)]{0,60}\bas\s+(?:int|integer|varchar|char|numeric|signed)\b`), 's'],
  ['sql', R(String.raw`\bwaitfor\s+delay\s+['"]`), 's'],
  ['sql', R(String.raw`\b(?:dbms_pipe|utl_inaddr|utl_http)\.`), 's'],
  ['sql', R(String.raw`\b(?:extractvalue|updatexml|load_file)\s*\(`), 's'],
  ['sql', R(String.raw`\binto\s+(?:out|dump)file\b`), 's'],
  ['sql', R(String.raw`\bxp_cmdshell\b|\bexec\s+(?:master\.|xp_|sp_)`), 's'],
  ['sql', R(String.raw`\binformation_schema\b|\bsqlite_master\b|\b(?:sysobjects|syscolumns)\b`), 's'],
  ['sql', R(String.raw`\b(?:mysql|sys|performance_schema)\.(?:user|tables|columns|schemata|db)\b`), 's'],
  ['sql', R(String.raw`\bpg_(?:catalog|shadow|user|tables|sleep)\b`), 's'],
  ['sql', R(String.raw`@@(?:version|datadir|hostname|basedir|tmpdir)\b`), 's'],
  ['sql', R(String.raw`\border\s+by\s+\d+\s*(?:--|#)`), 's'],
  ['sql', R(String.raw`\bchar\s*\(\s*\d+\s*(?:,\s*\d+\s*)+\)`), 's'],
  ['sql', R(String.raw`\b(?:concat|concat_ws|group_concat)\s*\(`), 's'],
  ['sql', R(String.raw`\bhaving\s+\d+\s*=\s*\d+`), 's'],
  ['commentaire', R(String.raw`/\*[\s\S]*?\*/|/\*!`), 'nd'],

  // ── Commandes système ──
  ['shell', R(String.raw`(?:[;&|\x60]|\$\()\s*(?:id|whoami|uname(?:\s+-[a-z]+)?|ifconfig|ipconfig|hostname|pwd|netstat(?:\s+-[a-z]+)?|systeminfo|ls(?:\s+-[a-z]+)?|curl|wget|env|printenv)\s*(?:$|[;&|\x60#)<>])`), 'ndc'],
  ['shell', R(String.raw`^\s*(?:id|whoami|uname|ifconfig|ipconfig|ls|pwd|curl|wget)\s*[;&|\x60<>]`), 'ndc'],
  ['shell', R(String.raw`^\s*(?:echo|printf)\s+['"$]`), 'ndc'],
  ['shell', R(String.raw`(?:^|[;&|\x60(]|\$\()\s*(?:cat|tac|head|tail|more|less|nl)\s+/[a-z]`), 'ndc'],
  ['shell', R(String.raw`[;&|\x60]\s*(?:sleep|ping)\s+(?:-[a-z]+\s*)?\d+`), 'ndc'],
  ['shell', R(String.raw`[;&|\x60]\s*\(?\s*(?:echo|printf|nslookup|bash|sh|nc|ncat|python[0-9.]*|perl|base64|rm|chmod|mkfifo|wget|curl)\s`), 'ndc'],
  ['shell', R(String.raw`\$\(\s*(?:id|whoami|uname|cat|ls|echo|curl|wget|sleep|nslookup|ping|bash|sh|printf|pwd|env|hostname|xxd|base64)\b`), 'ndc'],
  ['shell', R(String.raw`\x60\s*(?:id|whoami|uname|cat|ls|echo|curl|wget|sleep|nslookup|ping|bash|sh|pwd|env|hostname|/bin/)`), 'ndc'],
  ['shell', R(String.raw`\$\{?ifs`), 'ndc'],
  ['shell', R(String.raw`/etc/(?:passwd|shadow|group|hosts|issue|hostname|httpd)\b|\betc/(?:passwd|shadow)\b`), 'ndc'],
  ['shell', R(String.raw`/proc/self/|/(?:usr/)?s?bin/[a-z]|/dev/tcp/`), 'ndc'],
  ['shell', R(String.raw`\bcmd(?:\.exe)?\s+/c\b|\bpowershell(?:\.exe)?\s+-`), 'ndc'],
  ['shell', R(String.raw`\b(?:wget|curl)\s+(?:-[a-z]|https?://|ftp://)`), 'ndc'],
  ['shell', R(String.raw`\bnc(?:at)?\s+-[a-z]*[elvnz]|\brm\s+-[rf]+\s|\bchmod\s+[+0-7]|\bmkfifo\b|\bbase64\s+-d\b`), 'ndc'],
  ['shell', R(String.raw`\bnslookup\s+\S+\.[a-z]`), 'ndc'],
  ['shell', R(String.raw`\|\s*(?:ba)?sh\b`), 'ndc'],
  ['shell', R(String.raw`%(?:comspec|systemroot|windir)%|\b(?:win\.ini|boot\.ini|system32)\b`), 'ndc'],
  ['shell', R(String.raw`\(\)\s*\{`), 'ndc'],

  // ── Traversée de chemin ──
  ['chemin', R(String.raw`(?:^|[^.])\.\.[\\/]`), 'ndc'],
  ['chemin', R(String.raw`[\\/]\.\.(?:[\\/]|$)`), 'ndc'],
  ['chemin', R(String.raw`(?:^|[\\/])\.{2,}[\\/]`), 'ndc'],
  ['chemin', R(String.raw`%2e%2e|%252e|\.\.%2f|\.\.%5c|%c0%ae|%c0%af|\.\.;/`), 'n'],
  ['chemin', R(String.raw`(?:^|[\\/])\.env\b|/\.git/|\bwp-config\b|\.htaccess\b|\bweb-inf\b`), 'ndc'],

  // ── Blocs de code ──
  ['bloc_code', R(String.raw`\x60\x60\x60|~~~`), 'n'],
];

const INVISIBLE = /[­᠎​-‏‪-‮⁠-⁤﻿]/g;

const NAMED_ENTITIES: Record<string, string> = {
  lt: '<', gt: '>', quot: '"', apos: "'", amp: '&', sol: '/', bsol: '\\', colon: ':',
  semi: ';', lpar: '(', rpar: ')', lbrace: '{', rbrace: '}', lcub: '{', rcub: '}',
  lsqb: '[', rsqb: ']', lbrack: '[', rbrack: ']', tab: '\t', newline: '\n', nbsp: ' ',
  grave: '`', num: '#', dollar: '$', percnt: '%', equals: '=', excl: '!', period: '.',
  comma: ',', vert: '|', ast: '*', plus: '+', quest: '?', commat: '@', hyphen: '-',
  dash: '-', lowbar: '_',
};

/** Caractère ASCII de ce code, sinon la séquence d'origine. */
function ascii(code: number, original: string): string {
  return code >= 0 && code < 128 ? String.fromCharCode(code) : original;
}

/**
 * Une passe de décodage : entités HTML (avec ou sans point-virgule), %XX,
 * \uXXXX, \u{XX}, \xXX. Seuls les caractères ASCII sont restitués.
 */
function decodeOnce(s: string): string {
  return s
    .replace(/&#x0*([0-9a-f]{1,6});?/gi, (m, h) => ascii(parseInt(h, 16), m))
    .replace(/&#0*([0-9]{1,7});?/g, (m, d) => ascii(parseInt(d, 10), m))
    .replace(
      /&(lt|gt|quot|apos|amp|sol|bsol|colon|semi|lpar|rpar|lbrace|rbrace|lcub|rcub|lsqb|rsqb|lbrack|rbrack|tab|newline|nbsp|grave|num|dollar|percnt|equals|excl|period|comma|vert|ast|plus|quest|commat|hyphen|dash|lowbar)(;|\b)/gi,
      (m, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? m,
    )
    .replace(/%([0-7][0-9a-f])/gi, (_m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u\{0*([0-9a-f]{1,6})\}/gi, (m, h) => ascii(parseInt(h, 16), m))
    .replace(/\\u00([0-7][0-9a-f])/gi, (_m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\x([0-7][0-9a-f])/gi, (_m, h) => String.fromCharCode(parseInt(h, 16)));
}

/** Forme lue par les règles SQL : commentaires et « + » ramenés à des espaces. */
function sqlForm(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').split('+').join(' ').replace(/ {2,}/g, ' ');
}

function views(value: string): Views {
  let norm = value;
  try {
    if (typeof norm.normalize === 'function') norm = norm.normalize('NFKC');
  } catch {
    // Moteur sans normalisation Unicode : on lit le texte tel quel.
  }
  norm = norm.replace(INVISIBLE, '').toLowerCase().replace(/ {2,}/g, ' ');

  let decoded = norm;
  for (let i = 0; i < 3; i++) {
    const next = decodeOnce(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  decoded = decoded.toLowerCase().replace(/ {2,}/g, ' ');

  return {
    n: norm,
    d: decoded,
    c: decoded.replace(/[\t\n\r\x0B\x0C\x00]+/g, ''),
    s: sqlForm(decoded),
    sn: sqlForm(norm),
  };
}

/** Motif de code trouvé dans le texte, ou null s'il n'y en a pas. */
export function detectCode(value: string): CodeMotif | null {
  if (!value) return null;
  if (value.includes('\0')) return 'octet_nul';

  const v = views(value);
  if (v.d.includes('\0')) return 'octet_nul';

  for (const [motif, pattern, forms] of RULES) {
    const read: string[] = [];
    for (const form of forms) {
      const text = v[form as keyof Views];
      if (read.includes(text)) continue;
      read.push(text);
      if (pattern.test(text)) return motif;
    }
  }

  return null;
}
