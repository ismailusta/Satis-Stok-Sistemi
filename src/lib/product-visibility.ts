import type { Where } from 'payload'

/** Payload sorgusu: online mağazada listelenebilir (false değil; alan yok / eski kayıt = görünür). */
export function storefrontVisibilityWhere(): Where {
  return {
    or: [
      { showInStorefront: { equals: true } },
      { showInStorefront: { exists: false } },
    ],
  }
}

/** Payload sorgusu: kasada satılabilir. */
export function posVisibilityWhere(): Where {
  return {
    or: [{ showInPos: { equals: true } }, { showInPos: { exists: false } }],
  }
}

export function whereAnd(a: Where, b: Where): Where {
  return { and: [a, b] }
}

export function isStorefrontVisible(doc: { showInStorefront?: unknown }): boolean {
  return doc.showInStorefront !== false
}

export function isPosVisible(doc: { showInPos?: unknown }): boolean {
  return doc.showInPos !== false
}
