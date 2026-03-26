import { describe, expect, it } from 'vitest'

import { createWindowOptions } from './windowConfig'

describe('windowConfig', () => {
  it('hides the native title text for the main window', () => {
    expect(createWindowOptions('/tmp')).toMatchObject({
      title: '',
      titleBarStyle: 'hiddenInset',
    })
  })

  it('allows the main window to shrink to 1000 pixels wide', () => {
    expect(createWindowOptions('/tmp')).toMatchObject({
      minWidth: 1000,
      minHeight: 720,
    })
  })
})
