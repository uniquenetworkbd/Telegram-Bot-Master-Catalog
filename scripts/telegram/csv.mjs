export function parseCsv(source) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const input = String(source ?? '').replace(/^\uFEFF/, '');

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some(value => value.length > 0)) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error('Malformed CSV: unclosed quoted field');
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some(value => value.length > 0)) rows.push(row);
  }
  if (rows.length < 2) throw new Error('CSV does not contain a header and records');

  const headers = rows.shift().map(value => value.trim());
  if (headers.some(header => !header) || new Set(headers).size !== headers.length) {
    throw new Error('CSV header contains an empty or duplicate field');
  }
  return rows.map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error('CSV row ' + (index + 2) + ' has ' + values.length + ' fields; expected ' + headers.length);
    }
    return Object.fromEntries(headers.map((header, column) => [header, values[column]]));
  });
}
