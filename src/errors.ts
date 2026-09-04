export enum ErrorCode {
  InvalidInput = 'INVALID_INPUT',
  InvalidOption = 'INVALID_OPTION',
  RenderTimeout = 'RENDER_TIMEOUT',
  OptionTooLarge = 'OPTION_TOO_LARGE',
  RendererUnavailable = 'RENDERER_UNAVAILABLE',
  StorageFailed = 'STORAGE_FAILED',
  DeliveryNotAllowed = 'DELIVERY_NOT_ALLOWED',
}

/**
 * 携带机器可读 code 与出错字段的错误。
 * LLM 靠这两项才能定位问题并自我修正后重试，所以抛错时务必填上 field。
 */
export class ChartError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = 'ChartError';
  }
}
