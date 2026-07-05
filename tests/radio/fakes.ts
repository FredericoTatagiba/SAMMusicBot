import { IRadioDirectory } from '../../src/radio/IRadioDirectory';
import { IRadioStreamResolver } from '../../src/radio/IRadioStreamResolver';
import { AudioStream, AudioStreamType } from '../../src/core/types';
import {
  RadioPlaceView,
  RadioSearchHit,
  RadioStation,
} from '../../src/radio/types';

export interface FakeDirectoryData {
  search?: RadioSearchHit[];
  place?: RadioPlaceView;
  channels?: RadioStation[];
  channel?: RadioStation;
}

/** Diretório fake: devolve dados canned e registra o que foi consultado. */
export class FakeRadioDirectory implements IRadioDirectory {
  readonly searchQueries: string[] = [];
  readonly placeIds: string[] = [];

  constructor(private readonly data: FakeDirectoryData = {}) {}

  async search(query: string): Promise<readonly RadioSearchHit[]> {
    this.searchQueries.push(query);
    return this.data.search ?? [];
  }
  async getPlace(placeId: string): Promise<RadioPlaceView> {
    this.placeIds.push(placeId);
    return (
      this.data.place ?? { placeId, title: 'País', stations: [], cities: [] }
    );
  }
  async getPlaceChannels(): Promise<readonly RadioStation[]> {
    return this.data.channels ?? [];
  }
  async getChannel(channelId: string): Promise<RadioStation> {
    return this.data.channel ?? { channelId, title: 'Estação' };
  }
}

/** Resolver fake: registra os canais resolvidos, sem rede. */
export class FakeRadioStreamResolver implements IRadioStreamResolver {
  readonly resolved: string[] = [];

  async resolve(channelId: string): Promise<AudioStream> {
    this.resolved.push(channelId);
    return {
      stream: { on: () => {} } as unknown as NodeJS.ReadableStream,
      type: AudioStreamType.Arbitrary,
    };
  }
}
