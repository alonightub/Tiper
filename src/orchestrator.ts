import { DataHandler } from './dataHandler';
import { TikTokBrowserScraper } from './scraper';
import { CONFIG, logger, Proxy } from './config';
import SecretsManager from './secretsManager';

const MAX_CONC_BROWSERS = 8;
let _isOrchestratorBusy = false;

class Orchestrator {
    private dataHandler: DataHandler;
    private secretsManager: SecretsManager;
    private videosNum: number;
    private sentinalUser: string;
    private proxy: Proxy;
    public dataFileName: string;

    constructor(videosNum: number, sentinalUser: string, proxyRegionCode: string, dataHandler: DataHandler, secretsManager: SecretsManager) {
        if (_isOrchestratorBusy) {
            throw new Error('Orchestrator is busy with another collection. Please try again in a few minutes, Liam.');
        }

        this.dataHandler = dataHandler;
        this.secretsManager = secretsManager;
        this.videosNum = videosNum;
        this.sentinalUser = sentinalUser;
        this.proxy = secretsManager.getProxy();
        this.proxy.username = this.proxy.username.slice(0, -2) + proxyRegionCode;

        const dateTime = new Date().toISOString().replace(/[:.]/g, '-');
        this.dataFileName = `${sentinalUser}_${dateTime}.json`;
    }

    public async startScraping(concBrowsersNum: number): Promise<void> {
        logger.info(`>>> Starting to fetch ${this.videosNum} videos for sentinalUser ${this.sentinalUser} using ${this.proxy.username}. concurrentBrowsers: ${concBrowsersNum}`);
        const startTime = Date.now();
        if (concBrowsersNum > MAX_CONC_BROWSERS) {
            logger.error(`The number of concurrent browsers must not exceed ${MAX_CONC_BROWSERS}. Setting to ${MAX_CONC_BROWSERS}.`);
            concBrowsersNum = MAX_CONC_BROWSERS;
        }

        try {
            _isOrchestratorBusy = true;
            const videos = await this.scrapeVideos(concBrowsersNum);
            const uniqueVideos = this.getUniqueVideos(videos);
            logger.info(`>>> Finished fetching videos: ${uniqueVideos.length} unique videos were fetched`);

            await this.dataHandler.saveData(uniqueVideos, this.dataFileName);
            this.logTimeTaken(startTime);
        } catch (error) {
            logger.error('An error occurred while fetching videos', error);
        } finally { 
            _isOrchestratorBusy = false;
        }
    }

    private async scrapeVideos(concBrowsersNum: number): Promise<any[]> {
        const maxVideosPerBrowser = this.videosNum / CONFIG.CONCURRENT_BROWSERS_NUM;
        const results = await Promise.all(
            Array(concBrowsersNum).fill(null).map(async (_, index) => {
                if ((index + 1) % 4 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
                try {
                    const scraper = new TikTokBrowserScraper(index, maxVideosPerBrowser, this.sentinalUser, this.proxy);
                    return scraper.getForyouVideos();
                } catch (error) {
                    logger.error(`Error occurred in scraper instance ${index}:`, error);
                    return [];
                }
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
        const timeTaken = ((endTime - startTime) / 1000 / 60).toFixed(2);
        logger.info(`Time taken: ${timeTaken} minutes`);
    }
}

export { Orchestrator, _isOrchestratorBusy };