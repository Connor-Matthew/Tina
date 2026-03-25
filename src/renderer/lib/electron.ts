import type { DesktopApi } from '../../shared/contracts'

export function getDesktopApi(): DesktopApi {
  return window.desktop
}
