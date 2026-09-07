/**
 * Minimal Code 128-B encoder for printable tool IDs.
 * The application IDs use uppercase safe characters, which are supported by
 * Code Set B and work with ordinary 1D barcode scanners.
 */
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
] as const;

const START_CODE_B = 104;
const STOP_CODE = 106;
const QUIET_ZONE = 10;

export type BarcodeBar = { x: number; width: number };

function encodeCode128B(value: string): number[] {
  if (!value || [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) > 126)) {
    throw new Error('Code 128-B only supports printable ASCII characters.');
  }

  const dataCodes = [...value].map((character) => character.charCodeAt(0) - 32);
  const checksum = (START_CODE_B + dataCodes.reduce((total, code, index) => total + code * (index + 1), 0)) % 103;

  return [START_CODE_B, ...dataCodes, checksum, STOP_CODE];
}

export function getCode128Bars(value: string): { bars: BarcodeBar[]; modules: number } {
  const codes = encodeCode128B(value);
  const bars: BarcodeBar[] = [];
  let x = QUIET_ZONE;

  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code];
    let isBar = true;

    for (const widthCharacter of pattern) {
      const width = Number(widthCharacter);
      if (isBar) bars.push({ x, width });
      x += width;
      isBar = !isBar;
    }
  }

  return { bars, modules: x + QUIET_ZONE };
}

/** Renders a high-resolution bitmap for jsPDF's PNG image API. */
export function renderCode128DataUrl(value: string, width = 720, height = 200): string {
  const { bars, modules } = getCode128Bars(value);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create barcode image.');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#000000';

  const moduleWidth = width / modules;
  for (const bar of bars) {
    context.fillRect(Math.round(bar.x * moduleWidth), 0, Math.ceil(bar.width * moduleWidth), height);
  }

  return canvas.toDataURL('image/png');
}
