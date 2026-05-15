'use client'

import React, { useLayoutEffect, useRef } from 'react'

import styles from './magaza.module.css'

function mountHtmlWithScripts(container: HTMLElement, html: string) {
  container.innerHTML = html
  container.querySelectorAll('script').forEach((oldScript) => {
    const newScript = document.createElement('script')
    for (const attr of Array.from(oldScript.attributes)) {
      newScript.setAttribute(attr.name, attr.value)
    }
    newScript.textContent = oldScript.textContent
    oldScript.replaceWith(newScript)
  })
}

type Props = {
  html: string
  onClose: () => void
}

export function IyzicoCheckoutOverlay({ html, onClose }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = mountRef.current
    if (!el || !html) return
    mountHtmlWithScripts(el, html)
  }, [html])

  return (
    <div
      aria-modal
      className={styles.iyzicoPayOverlay}
      role="dialog"
      onClick={onClose}
    >
      <div
        className={styles.iyzicoPaySolo}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.iyzicoPayMount} ref={mountRef} />
      </div>
    </div>
  )
}
