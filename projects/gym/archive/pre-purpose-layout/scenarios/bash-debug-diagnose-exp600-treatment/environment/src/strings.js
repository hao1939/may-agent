// src/strings.js - String utilities

import { SLUG_PATTERN } from './helpers/regex.js';

export function capitalize(str) {
  if (!str) return '';
  return str.split(' ').map(w => w.charAt(0).toUppercase() + w.slice(1)).join(' ');
}

export function slugify(str) {
  return str.toLowerCase().trim().replace(SLUG_PATTERN, '-').replace(/^-+|-+$/g, '');
}

export function truncate(str, maxLen) {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}
