import { Readable } from 'stream';
import { RadioStreamResolver, StreamFetch } from '../../src/radio/RadioStreamResolver';
import { StreamResolutionError } from '../../src/core/errors';
import { AudioStreamType } from '../../src/core/types';
import { NullLogger } from '../helpers/fakes';

const BASE = 'https://radio.garden/api';

describe('RadioStreamResolver', () => {
  it('resolve o stream ao vivo seguindo o redirect', async () => {
    const body = Readable.toWeb(Readable.from([Buffer.from('audio')]));
    const fetchFn: StreamFetch = async () => ({ ok: true, status: 200, body });
    const resolver = new RadioStreamResolver(BASE, new NullLogger(), fetchFn);

    const audio = await resolver.resolve('vbFsCngB');

    expect(audio.type).toBe(AudioStreamType.Arbitrary);
    expect(typeof (audio.stream as Readable).pipe).toBe('function');
  });

  it('lança StreamResolutionError quando a estação está indisponível', async () => {
    const fetchFn: StreamFetch = async () => ({
      ok: false,
      status: 502,
      body: null,
    });
    const resolver = new RadioStreamResolver(BASE, new NullLogger(), fetchFn);

    await expect(resolver.resolve('x')).rejects.toBeInstanceOf(
      StreamResolutionError,
    );
  });

  it('lança quando não há corpo de resposta', async () => {
    const fetchFn: StreamFetch = async () => ({
      ok: true,
      status: 200,
      body: null,
    });
    const resolver = new RadioStreamResolver(BASE, new NullLogger(), fetchFn);

    await expect(resolver.resolve('x')).rejects.toBeInstanceOf(
      StreamResolutionError,
    );
  });
});
