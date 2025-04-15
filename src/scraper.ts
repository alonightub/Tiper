import { chromium, firefox, BrowserContext, Page, Response } from 'playwright';
import { CONFIG, logger, Proxy } from './config';

class TikTokBrowserScraper {
    private static readonly TIKTOK_BASE_URL: string = 'https://www.tiktok.com';
    private static readonly API_PATHS = {
        foryou: '/foryou',
        foryouItemsList: '/api/recommend/item_list',
    };
    private static readonly SCROLLING_SELECTOR_PATH: string = 'path[d="m24 27.76 13.17-13.17a1 1 0 0 1 1.42 0l2.82 2.82a1 1 0 0 1 0 1.42L25.06 35.18a1.5 1.5 0 0 1-2.12 0L6.59 18.83a1 1 0 0 1 0-1.42L9.4 14.6a1 1 0 0 1 1.42 0L24 27.76Z"]';

    private newVideos: any[] = [];
    private ctx: BrowserContext | null = null;
    private page: Page | null = null;
    private index: number;
    private storageStatePath: string;
    private videosToFetch: number;
    private sentinalUser: string;
    private proxy: Proxy;

    constructor(index: number, videosToFetch: number, sentinalUser: string, proxy: Proxy) {
        this.sentinalUser = sentinalUser;
        this.videosToFetch = videosToFetch;
        this.index = index;
        this.storageStatePath = CONFIG.SECRETS_DIR + '/' + this.sentinalUser;
        this.proxy = proxy;
    };

    private log(message: string, level: 'info' | 'error' = 'info', ...args: any[]) {
        if (level === 'info') {
            logger.info(`[Scraper ${this.index}] ${message}`, ...args);
        } else if (level === 'error') {
            logger.error(`[Scraper ${this.index}] ${message}`, ...args);
        }
    }

    public async getForyouVideos(): Promise<any[]> {
        if (!this.ctx || !this.page) {
            await this.initFirefoxBrowser();
        }

        this.page?.on("response", async (response: Response) => {
            if (response.url().includes(TikTokBrowserScraper.API_PATHS.foryouItemsList)) {
                const fetchedVideos = await this.parseItemsResponse(response);
                this.log(`New request detected: contains ${fetchedVideos.length} videos`);

                this.newVideos.push(...fetchedVideos);
            }
        });
        await this.page?.goto(TikTokBrowserScraper.TIKTOK_BASE_URL + TikTokBrowserScraper.API_PATHS.foryou, {
            waitUntil: 'commit'
        });
        await this.page?.waitForTimeout(3000);
        await this.checkProfileLink();

        this.log('>> Starting to scroll, max scrolls:' + CONFIG.MAX_SCROLLS.toString());
        for (let j = 0; j < CONFIG.MAX_SCROLLS && this.videosToFetch > this.newVideos.length; j++) {
            if ((j + 1) % 5 === 0) {
                this.log(`${j + 1} videos scrolled`);
            }
            await this.scrollPage();
        }
        this.log(`>> Finished scrolling: ${this.newVideos.length} new videos were fetched`);

        this.closeBrowser();
        return this.newVideos;
    }

    private async scrollPage(): Promise<void> {
        if (!this.page) return;
        try {
            await this.page.waitForSelector(TikTokBrowserScraper.SCROLLING_SELECTOR_PATH);
            await this.page.click(TikTokBrowserScraper.SCROLLING_SELECTOR_PATH);
            await this.page.waitForTimeout(Math.random() * 1000);
        } catch (error) {
            this.log('Error during scrolling:', 'error', error);
            await this.page.waitForTimeout(Math.random() * 3000);
        }
    }

    private async parseItemsResponse(response: Response): Promise<any[]> {
        try {
            const responseBody = await response.json();
            const itemList = responseBody.itemList;
            return itemList.filter((item: any) => !item.isAd && !item.liveRoomInfo);
        } catch (err) {
            this.log(`Error parsing the response: \n ${JSON.stringify((await response.json()).itemList)} \n\n ERROR:`, 'error', err);
            return [];
        }
    }

    private async initFirefoxBrowser(): Promise<BrowserContext> {
        const browser = await chromium.launch({
            headless: !CONFIG.OPEN_BROWSER,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            firefoxUserPrefs: {
                'media.volume_scale': "0", // mute
            },
        });
        this.ctx = await browser.newContext({
            proxy: this.proxy,
            storageState: this.storageStatePath,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            viewport: { width: 1280, height: 720 },
        });
        this.log(`Browser context created successfully with proxy user: ${this.proxy.username}`);

        this.page = await this.ctx.newPage();
        this.page.setDefaultTimeout(0);

        return this.ctx;
    }

    private async closeBrowser(): Promise<void> {
        await this.ctx?.storageState({
            path: this.storageStatePath
        });

        await this.ctx?.close();
    }

    private async checkProfileLink(): Promise<boolean> {
        const profileLink = await this.page?.locator('a[data-e2e="nav-profile"]');
        if (profileLink) {
            let href: string | null = null;
            try {
                href = await profileLink.getAttribute('href');
                this.log(`User is connected successfully with the username: ${href}`);
                return true;
            } catch (error) {
                this.log(`Profile link not found or does not contain ${this.sentinalUser}`, 'error', error);
            }
        }
        return false;
    }
}

export { TikTokBrowserScraper };