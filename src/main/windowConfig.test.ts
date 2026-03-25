import { describe, expect, it } from 'vitest'

import { createWindowOptions } from './windowConfig'

describe('windowConfig', () => {
  it('hides the native title text for the main window', () => {
    expect(createWindowOptions('/tmp')).toMatchObject({
      title: '',
      titleBarStyle: 'hiddenInset',
    })
  })
})
