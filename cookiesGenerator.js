import { chromium } from 'playwright';
import PROXY_CREDS from './secrets/PROXY_SECRET.json' with { type: 'json' };

const TIKTOK_URL = 'https://www.tiktok.com/';
const storageStatePath = './storageState.json';
let ctx = null;
let page = null;


const loginAndSaveCookies = async () => {
    if (!ctx || !page) {
        await initFirefoxBrowser();
    }

    await page?.goto(TIKTOK_URL, { waitUntil: 'load' });

    console.log('Manually log in to TikTok.');
    while (true) {
        await page?.waitForTimeout(15000); // Wait for 15 seconds to allow manual login

        const isLoggedIn = await checkProfileLink();
        if (isLoggedIn) {
            break;
        }

        console.log('Login not detected yet. Waiting for user to complete login...');
    }

    await closeBrowser();
};

const initFirefoxBrowser = async () => {
    const browser = await chromium.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        firefoxUserPrefs: {
            'media.volume_scale': "0", // mute
        },
    });
    ctx = await browser.newContext({
        proxy: PROXY_CREDS,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        viewport: { width: 1280, height: 720 },
    });
    console.log(`Browser context created successfully.`);
    page = await ctx.newPage();
    page.setDefaultTimeout(0);
};

const closeBrowser = async () => {
    if (ctx) {
        await ctx.storageState({ path: storageStatePath });
        await ctx.close();
    }
};

const checkProfileLink = async () => {
    const profileLink = await page?.locator('a[data-e2e="nav-profile"]');
    if (profileLink) {
        try {
            const href = await profileLink.getAttribute('href');
            if (href && href !== '/@') {
                console.log(`User is connected successfully with the username: ${href}.` +
                    ` Saving cookies to: ${storageStatePath}`);
                return true;
            }
        }
        catch (error) {
            console.error(`Profile link not found or does not contain the expected user.`, error);
        }
    }
    return false;
};

(async () => {
    await loginAndSaveCookies();
    process.exit(0);
})();
