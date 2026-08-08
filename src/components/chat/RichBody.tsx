import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Linking, type TextStyle } from 'react-native';
import { Fonts, FontSize, Spacing } from '../../constants/theme';

/**
 * Rendu d'une annonce du canal GoesPay, rédigée en HTML par l'équipe.
 *
 * NI WEBVIEW NI BIBLIOTHÈQUE : une WebView par bulle coûterait un contexte web
 * complet dans une liste qui défile, et une dépendance de rendu HTML pèserait
 * lourd pour le seul cas de l'annonce. On couvre donc le sous-ensemble
 * réellement utilisé dans une annonce — paragraphes, sauts, gras, italique,
 * souligné, liens, listes, titres — et TOUT LE RESTE est réduit à son texte.
 *
 * C'est aussi une garde : le HTML n'est jamais interprété tel quel, seules les
 * balises reconnues produisent quelque chose. Une balise inattendue (script,
 * iframe, style) ne peut rien déclencher, son contenu se lit en texte.
 */

interface Props {
  html: string;
  color: string;
  linkColor: string;
}

/** Fragment de texte avec son style, à l'intérieur d'un bloc. */
interface Span {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  href?: string;
}

interface Block {
  kind: 'p' | 'h' | 'li';
  spans: Span[];
}

/** Entités les plus courantes dans un texte rédigé en français. */
function decode(text: string): string {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', ccedil: 'ç',
    ugrave: 'ù', ocirc: 'ô', icirc: 'î', laquo: '«', raquo: '»',
    hellip: '…', rsquo: '’', euro: '€', deg: '°',
  };
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => named[name] ?? m);
}

/**
 * Découpe le HTML en blocs de fragments stylés.
 *
 * Analyse linéaire avec une pile de styles : suffisant pour du contenu
 * rédactionnel, et incapable d'exécuter quoi que ce soit — c'est le but.
 */
function parse(html: string): Block[] {
  const blocks: Block[] = [];
  let current: Block = { kind: 'p', spans: [] };
  const stack: Array<{ tag: string; href?: string }> = [];

  const flush = () => {
    if (current.spans.some((s) => s.text.trim() !== '')) blocks.push(current);
    current = { kind: 'p', spans: [] };
  };

  // Le contenu non affichable part avant toute analyse.
  const cleaned = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');

  const token = /<\/?([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;

  while ((m = token.exec(cleaned)) !== null) {
    const [, rawTag, attrs, text] = m;

    if (text != null) {
      const value = decode(text).replace(/\s+/g, ' ');
      if (value !== '') {
        const open = (t: string) => stack.some((s) => s.tag === t);
        current.spans.push({
          text: value,
          bold: open('b') || open('strong') || current.kind === 'h',
          italic: open('i') || open('em'),
          underline: open('u'),
          href: stack.find((s) => s.href)?.href,
        });
      }
      continue;
    }

    const tag = (rawTag || '').toLowerCase();
    const closing = m[0].startsWith('</');

    if (tag === 'br') {
      current.spans.push({ text: '\n' });
      continue;
    }

    if (['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol'].includes(tag)) {
      flush();
      if (!closing) {
        current.kind = tag === 'li' ? 'li' : tag.startsWith('h') ? 'h' : 'p';
      }
      continue;
    }

    if (closing) {
      const i = stack.map((s) => s.tag).lastIndexOf(tag);
      if (i >= 0) stack.splice(i, 1);
    } else {
      const href = tag === 'a'
        ? (attrs || '').match(/href\s*=\s*["']([^"']+)["']/i)?.[1]
        : undefined;
      stack.push({ tag, href });
    }
  }

  flush();
  return blocks;
}

export function RichBody({ html, color, linkColor }: Props) {
  const blocks = useMemo(() => parse(html || ''), [html]);

  if (!blocks.length) return null;

  const open = (href: string) => {
    // Un lien d'annonce vient de l'équipe, mais on n'ouvre que ce qui ressemble
    // à une adresse : jamais un schéma exotique. Les mêmes schémas que ceux
    // acceptés à la rédaction côté serveur — sans quoi un numéro d'assistance
    // s'afficherait en lien et ne ferait rien au toucher.
    if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href) || /^tel:/i.test(href)) {
      Linking.openURL(href).catch(() => {});
    }
  };

  return (
    <View style={styles.wrap}>
      {blocks.map((block, i) => (
        <View key={i} style={block.kind === 'li' ? styles.listRow : undefined}>
          {block.kind === 'li' && <Text style={[styles.bullet, { color }]}>{'•'}</Text>}
          <Text
            style={[
              styles.line,
              block.kind === 'h' && styles.heading,
              { color },
              block.kind === 'li' ? styles.listText : null,
            ]}
          >
            {block.spans.map((span, j) => {
              const style: TextStyle = {};
              if (span.bold) style.fontFamily = Fonts.bold;
              else if (span.italic) style.fontStyle = 'italic';
              if (span.underline) style.textDecorationLine = 'underline';
              if (span.href) {
                style.color = linkColor;
                style.textDecorationLine = 'underline';
              }
              return (
                <Text
                  key={j}
                  style={style}
                  onPress={span.href ? () => open(span.href as string) : undefined}
                >
                  {span.text}
                </Text>
              );
            })}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  line: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.md,
    lineHeight: 21,
  },
  heading: {
    fontFamily: Fonts.bold,
    fontSize: FontSize.lg,
    lineHeight: 24,
  },
  listRow: { flexDirection: 'row', gap: Spacing.sm },
  listText: { flex: 1 },
  bullet: { fontSize: FontSize.md, lineHeight: 21 },
});
