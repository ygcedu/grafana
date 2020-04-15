import { streamJSONResponse } from './StreamJSONResponse.worker';
import { MockOboe } from './mocks/oboe';
import oboeOriginal from 'oboe';

jest.mock('oboe');
const oboe = (oboeOriginal as unknown) as jest.Mock;

describe('StreamJSONResponse Web Worker', () => {
  it('truncates array responses at the specified limit', () => {
    oboe.mockImplementationOnce(() => {
      return new MockOboe(['foo', 'bar', 'moo']);
    });

    const LIMIT = 2;
    const cb = jest.fn();

    streamJSONResponse(
      {
        url: '',
        limit: LIMIT,
      },
      cb
    );

    expect(cb).toHaveBeenCalledTimes(LIMIT);
  });

  it('truncates object responses at the specified limit', () => {
    oboe.mockImplementationOnce(() => {
      return new MockOboe({
        foo: 1,
        bar: 2,
        moo: 3,
      });
    });

    const LIMIT = 2;
    const cb = jest.fn();

    streamJSONResponse(
      {
        url: '',
        limit: LIMIT,
        hasObjectResponse: true,
      },
      cb
    );

    expect(cb).toHaveBeenCalledTimes(LIMIT);
  });
});
