import { addLinkContent, ARCHIVE_BOX_API_KEY, ARCHIVE_BOX_HOST, ARCHIVE_BOX_URL } from '@/app/lib/data';
import { get, getHtmlAsDocument } from '@/app/lib/utils';
import assert from 'assert';
import { NextRequest } from 'next/server';

export async function POST(
  req: NextRequest
) {
  console.log('Received archive webhook')
  const body = await req.json();
  console.log(`with body`)
  console.log(body);
  switch (body.model) {
    case 'core.snapshot':
      console.log('Got snapshot');
      sync_content_from_archive(body.fields.timestamp);
      break;
    case 'core.archiveresult':
      console.log('Got archiveresult');

      const pwd_parts = body['fields']['pwd'].split('/')

      // Intentionally no await on an async function to allow us to return this request response ASAP and not block archivebox webhook
      sync_content_from_archive(pwd_parts[pwd_parts.length - 1])
      break;
    default:
      throw new Error(`Unknown model from archivebox webhoook: ${body.model}`);
  }

  return Response.json({});
}

type SyncedContentHandler = (index_data: any) => Promise<{content: string, timestamp_epoch_seconds: number} | null>;

const no_op: SyncedContentHandler = async function (index_data: any): Promise<{content: string, timestamp_epoch_seconds: number} | null> {
  return null;
};

function getTimeSecondsEpochOfRun(run : any): number {
  return new Date(run['start_ts']).getTime() / 1000;
}

function getLatestRun(runs: any[], succeeded_only: boolean = false): any | null {
  let latest_run : any | null = null;

  console.log(`Parsing ${JSON.stringify(runs)}`)

  runs = runs ?? [];
  for (const run of runs) {
    if (succeeded_only && run['status'] !== 'succeeded') {
      continue;
    }

    if (latest_run === null) {
      latest_run = run;
      continue;
    }

    const start_time_epoch_seconds = getTimeSecondsEpochOfRun(run);
    const other_start_time_epoch_seconds = getTimeSecondsEpochOfRun(latest_run);

    if (start_time_epoch_seconds > other_start_time_epoch_seconds) {
      // This one is newer.
      latest_run = run;
    }
  }

  return latest_run;
}

function getLatestSuccessfulIndexTextAndTime(runs: any[]): {content: string, timestamp_epoch_seconds: number} | null {
  const maybe_latest_run = getLatestRun(runs);

  if (maybe_latest_run === null) {
    return null;
  }

  const content =  maybe_latest_run['index_texts'].join(' ');
  return {
    content,
    timestamp_epoch_seconds: getTimeSecondsEpochOfRun(maybe_latest_run),
  };
}

const handleHtmlToText: SyncedContentHandler = async function (index_data: any): Promise<{content: string, timestamp_epoch_seconds: number} | null> {
  const runs : any[] = index_data['history']['htmltotext'];
  return getLatestSuccessfulIndexTextAndTime(runs);
}

const handleMedia: SyncedContentHandler = async function (index_data: any): Promise<{content: string, timestamp_epoch_seconds: number} | null> {
  const runs : any[] = index_data['history']['media'];
  const maybe_latest_run = getLatestRun(runs, true);

  if (maybe_latest_run === null) {
    return null;
  }
  const timestamp = index_data['timestamp'];
  const media_endpoint = `/archive/${timestamp}/media/`;
  const media_index_html = await archivebox_get(media_endpoint);
  const document = getHtmlAsDocument(media_index_html);
  const links = Array.from(document.querySelectorAll('a'));
  const info_json_links = links.filter((link) => {
    return link.innerText.endsWith('.info.json');
  })

  assert(info_json_links.length <= 1, `Expected at most one .info.json link for ${media_endpoint}`);
  const info_json = info_json_links.length > 0 ? JSON.parse(await archivebox_get(`${media_endpoint}${info_json_links[0].innerText}`)) : {} as any;

  // index_texts contains subtitles, description
  // Also add title and channel and tags
  const content =  [
    info_json['fulltitle'] ?? "",
    info_json['channel'] ?? "",
    info_json['uploader'] ?? "",
    info_json['uploader_id'] ?? "",
    ...(info_json['tags'] ?? []),
    ...maybe_latest_run['index_texts'],
  ].join(' ');

  return {
    content,
    timestamp_epoch_seconds: getTimeSecondsEpochOfRun(maybe_latest_run),
  };
}

const handleMercury: SyncedContentHandler = async function (index_data: any): Promise<{content: string, timestamp_epoch_seconds: number} | null> {
  const runs : any[] = index_data['history']['mercury'];
  const maybe_latest_run = getLatestRun(runs, true);

  if (maybe_latest_run === null) {
    return null;
  }

  const timestamp = index_data['timestamp'];
  const content_txt_endpoint = `/archive/${timestamp}/mercury/content.txt`;
  const content = await archivebox_get(content_txt_endpoint)
  return {
    content,
    timestamp_epoch_seconds: getTimeSecondsEpochOfRun(maybe_latest_run),
  };
}

const handleReadability: SyncedContentHandler = async function (index_data: any): Promise<{content: string, timestamp_epoch_seconds: number} | null> {
  const runs : any[] = index_data['history']['readability'];
  return getLatestSuccessfulIndexTextAndTime(runs);
}

const handleTitle: SyncedContentHandler = async function (index_data: any): Promise<{content: string, timestamp_epoch_seconds: number} | null> {
  const runs : any[] = index_data['history']['title'];
  const maybe_latest_run = getLatestRun(runs, true);

  if (maybe_latest_run === null) {
    return null;
  }

  return {
    content: maybe_latest_run['output'],
    timestamp_epoch_seconds: getTimeSecondsEpochOfRun(maybe_latest_run),
  };
}

const MAPPING: { [key: string]: SyncedContentHandler } = {
  'archive_org': no_op,
  'dom': no_op,
  'favicon': no_op,
  'git': no_op,
  'headers': no_op,
  'htmltotext': handleHtmlToText,
  'media': handleMedia,
  'mercury': handleMercury,
  'pdf': no_op,
  'readability': handleReadability,
  'screenshot': no_op,
  'singlefile': no_op,
  'title': handleTitle,
  'wget': no_op,
};

async function archivebox_get(endpoint: string): Promise<string> {
  return await get(`${ARCHIVE_BOX_URL}${endpoint}`, {
    "X-ArchiveBox-API-Key": ARCHIVE_BOX_API_KEY,
    Host: ARCHIVE_BOX_HOST,
  });
}

async function sync_content_from_archive(archive_timestamp_seconds_epoch: string) {
  const index_data = JSON.parse(await archivebox_get(`/archive/${archive_timestamp_seconds_epoch}/index.json`));

  const url = index_data['url'];

  for (const extractor_type of Object.keys(MAPPING)) {
    console.log(`Running extractor ${extractor_type} for url ${url}`)
    const func = MAPPING[extractor_type];
    const data = await func(index_data);

    if (data === null) continue;

    // Save data to database (saving will ignore out of date data too)
    try {
      await addLinkContent(url, data.content, extractor_type, data.timestamp_epoch_seconds);
    } catch (err) {
      console.log(`Swallowing error trying to handle link content ${extractor_type} for ${url}`);
      console.log(err);
    }
  }

  // TODO: Update embeddings for things with this link
}
