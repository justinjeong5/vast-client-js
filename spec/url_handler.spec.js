import { urlHandler } from '../src/fetcher/url_handler';

describe('urlHandler', () => {
  beforeEach(() => {
    global.AbortController = class AbortController {
      constructor() {
        this.signal = {
          addEventListener: (type, listener) => {
            this.listener = type === 'abort' ? listener : this.listener;
          },
        };
      }

      abort() {
        this.listener();
      }
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.fetch;
    delete global.AbortController;
  });

  it('aborts timed out requests without throwing outside the promise', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn((url, { signal }) =>
      new Promise((_, reject) => {
        signal.addEventListener('abort', () => {
          const error = new Error('The operation was aborted.');
          error.name = 'AbortError';
          reject(error);
        });
      })
    );

    const result = urlHandler.get('https://example.com/vast.xml', {
      timeout: 100,
      withCredentials: false,
    });

    expect(() => jest.advanceTimersByTime(100)).not.toThrow();
    await expect(result).resolves.toEqual({
      error: expect.objectContaining({ name: 'AbortError' }),
      statusCode: 408,
    });
  });
});
