import React from 'react';
import { Text, TextStyle } from 'react-native';

/**
 * Rendu léger façon board (miroir de devFormatBody) : *gras* _italique_ =souligné=,
 * combinables/imbriquables. Retourne un arbre de <Text> stylé.
 */
const MARKERS: Record<string, TextStyle> = {
  '*': { fontWeight: '700' },
  _: { fontStyle: 'italic' },
  '=': { textDecorationLine: 'underline' },
};

let keySeq = 0;

function parse(input: string, style: TextStyle): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let buffer = '';

  const flush = () => {
    if (buffer) {
      nodes.push(
        <Text key={`t${keySeq++}`} style={style}>
          {buffer}
        </Text>,
      );
      buffer = '';
    }
  };

  while (i < input.length) {
    const ch = input[i];
    if (MARKERS[ch]) {
      // Cherche le marqueur fermant identique.
      const close = input.indexOf(ch, i + 1);
      if (close > i + 1) {
        flush();
        const inner = input.slice(i + 1, close);
        nodes.push(
          <Text key={`m${keySeq++}`} style={{ ...style, ...MARKERS[ch] }}>
            {parse(inner, { ...style, ...MARKERS[ch] })}
          </Text>,
        );
        i = close + 1;
        continue;
      }
    }
    buffer += ch;
    i++;
  }
  flush();
  return nodes;
}

export function DevFormattedText({ body, style }: { body: string; style?: TextStyle }) {
  const base = style || {};
  return <Text style={base}>{parse(body || '', base)}</Text>;
}
