import { DataHandler } from './dataHandler';
import { TikTokBrowserScraper } from './scraper';
import { CONFIG, logger } from './config';

class ScraperManager {
    private dataHandler: DataHandler;
    private videosNum: number;
    private sentinalUser: string;
    private proxyRegionCode: string;

    constructor(videosNum: number = CONFIG.VIDEOS_TO_FETCH, sentinalUser: string = CONFIG.COOKIES_STORAGE_STATE, proxyRegionCode: string = 'IL') {
        this.dataHandler = new DataHandler(sentinalUser);
        this.videosNum = videosNum ?? CONFIG.VIDEOS_TO_FETCH;
        this.sentinalUser = sentinalUser;
        this.proxyRegionCode = proxyRegionCode;
    }

    public async startScraping(concBrowsersNum: number = CONFIG.CONCURRENT_BROWSERS_NUM): Promise<void> {
        logger.info(`>>> Starting to fetch videos with the following parameters: videosNum: ${this.videosNum}, sentinalUser: ${this.sentinalUser}, proxyRegionCode: ${this.proxyRegionCode}, concurrentBrowsers: ${concBrowsersNum}`);
        const startTime = Date.now();
        if (concBrowsersNum > 6) {
            logger.error('The number of concurrent browsers must not exceed 6. Setting to 5.');
            concBrowsersNum = 5;
        }

        try {
            const videos = await this.scrapeVideos(concBrowsersNum);
            const uniqueVideos = this.getUniqueVideos(videos);

            logger.info(`>>> Finished fetching videos: ${uniqueVideos.length} unique videos were fetched`);
            await this.dataHandler.saveDataToBucket(uniqueVideos);
            
            this.logTimeTaken(startTime);
        } catch (error) {
            logger.error('An error occurred while fetching videos', error);
        }
    }

    private async scrapeVideos(concBrowsersNum: number): Promise<any[]> {
        const maxVideosPerBrowser = this.videosNum / CONFIG.CONCURRENT_BROWSERS_NUM;
        const results = await Promise.all(
            Array(concBrowsersNum).fill(null).map(async (_, index) => {
                if ((index + 1) % 3 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
                const scraper = new TikTokBrowserScraper(index, maxVideosPerBrowser, this.sentinalUser, this.proxyRegionCode);
                return scraper.getForyouVideos();
            })
        );
        return results.flat();
    }

    private getUniqueVideos(items: any[]): any[] {
        return [
            ...new Map(items.map(item => [item.video.videoID, item])).values()
        ];
    }

    private logTimeTaken(startTime: number): void {
        const endTime = Date.now();
        const timeTaken = (endTime - startTime) / 1000 / 60;
        logger.info(`Time taken: ${timeTaken} minutes`);
    }

    public getFinalBucketDestination(): string {
        return this.dataHandler.dataFileName;
    }
}

if (require.main === module) {
    (async () => {
        const scraperManager = new ScraperManager(20, undefined, 'RO');
        await scraperManager.startScraping();
    })();
}

export { ScraperManager };