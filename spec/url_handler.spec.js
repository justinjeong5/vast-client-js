import { urlHandler } from '../src/fetcher/url_handler';
import { Fetcher } from '../src/fetcher/fetcher';

const pendingFetch = (url, { signal }) =>
  new Promise((_, reject) => {
    signal.addEventListener('abort', () => {
      const error = new Error('The operation was aborted.');
      error.name = 'AbortError';
      reject(error);
    });
  });

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
    global.fetch = jest.fn(pendingFetch);

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

  it('reports timed out requests through the fetcher error path', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(pendingFetch);
    const fetcher = new Fetcher();
    fetcher.setOptions({ timeout: 100 });
    const emitter = jest.fn();

    const result = fetcher.fetchVAST({
      url: 'https://example.com/vast.xml',
      maxWrapperDepth: 0,
      emitter,
    });
    const rejection = expect(result).rejects.toThrow('AbortError');

    expect(() => jest.advanceTimersByTime(100)).not.toThrow();
    await rejection;
    expect(emitter).toHaveBeenNthCalledWith(
      2,
      'VAST-resolved',
      expect.objectContaining({
        error: expect.objectContaining({ name: 'AbortError' }),
        statusCode: 408,
      })
    );
  });
});
